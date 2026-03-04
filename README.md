# PayJarvis

**Spending firewall for AI agents.** Control what your bots can spend — set limits, approve purchases in real-time, get Telegram alerts.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Fastify](https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white)](https://fastify.dev)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=next.js&logoColor=white)](https://nextjs.org)
[![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Why PayJarvis?

AI agents are starting to spend real money — booking flights, buying tools, paying for APIs. But there's no standard way to control *what* they can spend. PayJarvis sits between your agent and the payment, enforcing rules you define.

- Bot tries to buy something → PayJarvis checks your policy
- Under the auto-approve limit → instant approval
- Over the limit → you get a Telegram notification and approve/reject in seconds
- Every transaction is logged with a cryptographic audit trail (BDIT tokens)

## How It Works

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐     ┌──────────┐
│  AI Agent   │────▶│  PayJarvis   │────▶│  Rules Engine  │────▶│ Decision │
│  (your bot) │     │  API         │     │  (policies)    │     │          │
└─────────────┘     └──────┬───────┘     └────────────────┘     └────┬─────┘
                           │                                         │
                    ┌──────▼───────┐                          ┌──────▼──────┐
                    │   Telegram   │◀─────────────────────────│  APPROVED   │
                    │   (notify)   │     if PENDING_HUMAN     │  BLOCKED    │
                    └──────────────┘                          │  PENDING    │
                                                              └─────────────┘
```

## Architecture

```
payjarvis/
├── apps/
│   ├── api/              # Fastify REST API (port 3001)
│   ├── web/              # Next.js dashboard (port 3000)
│   ├── rules-engine/     # Policy evaluation service (port 3002)
│   └── browser-agent/    # Browser extension agent
├── packages/
│   ├── agent-sdk/        # SDK for bot developers
│   ├── merchant-sdk/     # SDK for merchants accepting BDIT
│   ├── verify-sdk/       # Client-side token verification
│   ├── bdit/             # BDIT token issuance (RS256 JWT)
│   ├── database/         # Prisma schema + migrations
│   └── types/            # Shared TypeScript types
```

**Tech stack**: Fastify · Next.js 14 · Prisma · PostgreSQL · Redis · Clerk · Turborepo

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis 7+

### Setup

```bash
git clone https://github.com/Josepassinato/Payjarvis.git
cd Payjarvis

npm install

cp .env.example .env
# Edit .env with your credentials (see Environment Variables below)

npm run db:generate
npx prisma migrate dev

npm run build
npm run dev
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| API | 3001 | Fastify backend — bots, transactions, approvals |
| Web | 3000 | Next.js dashboard — manage bots, view transactions |
| Rules Engine | 3002 | Policy evaluation — limits, categories, time windows |

## Agent SDK

Install the SDK in your AI agent to gate purchases through PayJarvis:

```bash
npm install @payjarvis/agent-sdk
```

```typescript
import { PayJarvis } from "@payjarvis/agent-sdk";

const pj = new PayJarvis({
  apiKey: "pj_bot_...",
  botId: "your-bot-id",
});

const decision = await pj.requestApproval({
  merchant: "Amazon",
  amount: 49.99,
  category: "shopping",
});

if (decision.approved) {
  completePurchase(decision.bditToken);
} else if (decision.pending) {
  // Owner notified on Telegram — wait for response
  const final = await pj.waitForApproval(decision.approvalId);
} else {
  console.log("Blocked:", decision.reason);
}
```

| Method | Description |
|--------|-------------|
| `requestApproval(req)` | Request approval for a purchase |
| `waitForApproval(id)` | Poll until resolved (2s interval, 5min timeout) |
| `checkLimits()` | Check remaining budget and current limits |

## Rules Engine

The rules engine evaluates each transaction against configurable policies:

| Rule | Description |
|------|-------------|
| Transaction limit | Max amount per single purchase |
| Daily / Weekly / Monthly limits | Aggregate spending caps |
| Category filter | Allow or block specific categories |
| Merchant whitelist/blacklist | Control which merchants are allowed |
| Time window | Restrict purchases to business hours or specific days |
| Trust score | Dynamic scoring based on bot behavior history |

## Telegram Notifications

1. Create a bot via [@BotFather](https://t.me/BotFather)
2. Set `TELEGRAM_BOT_TOKEN` in your `.env`
3. Set the webhook:
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://yourdomain.com/api/notifications/telegram/webhook"
   ```
4. Link your account in the dashboard under **Bot Settings → Notifications**

## API Reference

### Bot endpoints (authenticated via `X-Bot-Api-Key`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/bots/:id/request-payment` | Request payment approval |
| `GET` | `/approvals/:id/status` | Poll approval status |
| `GET` | `/bots/:id/limits/sdk` | Check spending limits |

### User endpoints (authenticated via Clerk)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/bots` | Create a bot |
| `GET` | `/bots` | List your bots |
| `GET` | `/bots/:id` | Bot details + stats |
| `POST` | `/bots/:id/policy` | Create or update policy |
| `GET` | `/approvals` | List pending approvals |
| `POST` | `/approvals/:id/respond` | Approve or reject |
| `GET` | `/transactions` | Transaction history |

### Platform endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/verify` | Verify a BDIT token (for merchants) |
| `GET` | `/jwks` | Public keys for token verification |

## BDIT Tokens

**Bot Digital Identity Token** — a signed RS256 JWT that proves a bot has authorization to spend. Each token contains:

- Bot ID and owner ID
- Trust score and KYC level
- Approved amount and category
- Merchant ID
- Expiration time

Merchants verify tokens using the public JWKS endpoint or the `@payjarvis/verify-sdk`.

## Environment Variables

```bash
# Database (PostgreSQL)
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Redis
REDIS_URL="redis://..."

# Auth (Clerk)
CLERK_SECRET_KEY="sk_..."
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."

# BDIT Keys (RS256)
PAYJARVIS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
PAYJARVIS_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n..."
PAYJARVIS_KEY_ID="payjarvis-key-2026-03"

# Telegram
TELEGRAM_BOT_TOKEN="..."

# URLs
NEXT_PUBLIC_API_URL="https://yourdomain.com/api"
RULES_ENGINE_URL="http://127.0.0.1:3002"
```

## Production

```bash
npm run build

cd packages/database && npx prisma migrate deploy && cd ../..

pm2 start ecosystem.config.cjs
pm2 save
```

## Contributing

Contributions are welcome. Please open an issue first to discuss what you'd like to change.

## License

[MIT](LICENSE)
