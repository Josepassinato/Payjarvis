import { Redis } from "ioredis";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    if (times > 5) return null;
    return Math.min(times * 200, 2000);
  },
  lazyConnect: true,
});

// Connect — in production, Redis is required
redis.connect().catch(() => {
  const env = process.env.NODE_ENV ?? "development";
  if (env === "production") {
    console.error("[Redis] CRITICAL: Redis not available in production — token replay protection compromised");
    process.exit(1);
  }
  console.warn("[Redis] Not available — falling back to in-memory stores (dev/test only)");
});

// In-memory fallback when Redis is not connected
const memoryStore = new Map<string, { value: string; expiresAt: number | null }>();

function isConnected(): boolean {
  return redis.status === "ready";
}

export async function redisSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  if (isConnected()) {
    if (ttlSeconds) {
      await redis.setex(key, ttlSeconds, value);
    } else {
      await redis.set(key, value);
    }
  } else {
    if (process.env.NODE_ENV === "production") {
      console.error(`[Redis] WARN: in-memory fallback used in production for key ${key.split(":").slice(0, 2).join(":")}`);
    }
    memoryStore.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
  }
}

export async function redisGet(key: string): Promise<string | null> {
  if (isConnected()) {
    return redis.get(key);
  }
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt && entry.expiresAt < Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value;
}

export async function redisDel(key: string): Promise<void> {
  if (isConnected()) {
    await redis.del(key);
  } else {
    memoryStore.delete(key);
  }
}

export async function redisSetNX(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
  if (isConnected()) {
    let result: string | null;
    if (ttlSeconds) {
      result = await redis.set(key, value, "EX", ttlSeconds, "NX");
    } else {
      result = await redis.set(key, value, "NX");
    }
    return result === "OK";
  }
  // In-memory fallback (dev only)
  const entry = memoryStore.get(key);
  if (entry && (!entry.expiresAt || entry.expiresAt > Date.now())) {
    return false; // Key already exists
  }
  memoryStore.set(key, {
    value,
    expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
  });
  return true;
}

export async function redisPublish(channel: string, message: string): Promise<void> {
  if (isConnected()) {
    await redis.publish(channel, message);
  }
}

export async function redisIncr(key: string, ttlSeconds?: number): Promise<number> {
  if (isConnected()) {
    const val = await redis.incr(key);
    if (val === 1 && ttlSeconds) {
      await redis.expire(key, ttlSeconds);
    }
    return val;
  }
  const entry = memoryStore.get(key);
  let current = 0;
  if (entry && (!entry.expiresAt || entry.expiresAt > Date.now())) {
    current = parseInt(entry.value, 10) || 0;
  }
  current++;
  memoryStore.set(key, {
    value: String(current),
    expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : (entry?.expiresAt ?? null),
  });
  return current;
}

export async function redisExists(key: string): Promise<boolean> {
  if (isConnected()) {
    return (await redis.exists(key)) === 1;
  }
  if (process.env.NODE_ENV === "production") {
    console.error(`[Redis] WARN: in-memory fallback used in production for key ${key.split(":").slice(0, 2).join(":")}`);
  }
  const entry = memoryStore.get(key);
  if (!entry) return false;
  if (entry.expiresAt && entry.expiresAt < Date.now()) {
    memoryStore.delete(key);
    return false;
  }
  return true;
}
