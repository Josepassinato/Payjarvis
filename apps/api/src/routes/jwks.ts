import type { FastifyInstance } from "fastify";
import { importSPKI, exportJWK } from "jose";

interface KeyEntry {
  pem: string;
  kid: string;
}

function loadKeys(): KeyEntry[] {
  const keys: KeyEntry[] = [];
  const env = process.env.BDIT_ENV ?? process.env.NODE_ENV ?? "development";

  // Current active key
  const currentPem = process.env.PAYJARVIS_PUBLIC_KEY?.replace(/\\n/g, "\n");
  const currentKid = process.env.PAYJARVIS_KEY_ID ?? `payjarvis-${env}-001`;
  if (currentPem) {
    keys.push({ pem: currentPem, kid: currentKid });
  }

  // Previous key (kept during rotation grace period)
  const prevPem = process.env.PAYJARVIS_PUBLIC_KEY_PREV?.replace(/\\n/g, "\n");
  const prevKid = process.env.PAYJARVIS_KEY_ID_PREV;
  if (prevPem && prevKid) {
    keys.push({ pem: prevPem, kid: prevKid });
  }

  return keys;
}

export async function jwksRoutes(app: FastifyInstance) {
  app.get("/.well-known/jwks.json", async (_request, reply) => {
    const keyEntries = loadKeys();

    if (keyEntries.length === 0) {
      return reply.status(503).send({ error: "No signing keys configured" });
    }

    const jwkKeys = await Promise.all(
      keyEntries.map(async (entry) => {
        const publicKey = await importSPKI(entry.pem, "RS256");
        const jwk = await exportJWK(publicKey);
        return {
          ...jwk,
          kid: entry.kid,
          alg: "RS256",
          use: "sig",
        };
      })
    );

    return reply
      .header("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400")
      .send({ keys: jwkKeys });
  });
}
