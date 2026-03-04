# PayJarvis — Spending Firewall for AI Agents

Control what your AI agents can spend. Set limits, approve purchases in real-time, get Telegram alerts.

## What is PayJarvis?

PayJarvis is a spending control layer for AI agents. Bot owners install the SDK in their AI agent, configure spending limits, and get real-time notifications when their bot wants to make a purchase above the auto-approve threshold.

**Core features:**
- Per-purchase, daily, weekly, monthly spending limits
- Auto-approve small purchases, require human approval for large ones
- Telegram notifications for approval requests
- Full audit trail of every transaction
- Trust scoring based on bot behavior
- Cryptographic BDIT tokens for transaction verification

## Architecture

```
payjarvis/
├── apps/
│   ├── api/              # Fastify backend (port 3001)
│   ├── web/              # Next.js dashboard
│   ├── rules-engine/     # Decision engine (port 3002)
│   └── browser-agent/    # Browser extension agent
├── packages/
│   ├── agent-sdk/        # SDK for bot owners (@payjarvis/agent-sdk)
│   ├── merchant-sdk/     # SDK for merchants (@payjarvis/merchant-sdk)
│   ├── database/         # Prisma schema + migrations
│   ├── types/            # Shared TypeScript types
│   ├── bdit/             # BDIT token issuance/verification
│   └── verify-sdk/       # Client-side token verification
└── public/               # Static landing page
```

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis 7+

### Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database, Redis, and Clerk credentials

# Generate Prisma client and run migrations
npm run db:generate
npx prisma migrate dev

# Build all packages
npm run build

# Start development
npm run dev
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| API | 3001 | Fastify backend |
| Web | 3000 | Next.js dashboard |
| Rules Engine | 3002 | Policy evaluation |

## Agent SDK

Install the SDK in your AI agent to gate purchases through PayJarvis:

```bash
npm install @payjarvis/agent-sdk
```

```typescript
import { PayJarvis } from '@payjarvis/agent-sdk';

const pj = new PayJarvis({
  apiKey: 'pj_bot_...',
  botId: 'your-bot-id',
});

// Before any purchase:
const decision = await pj.requestApproval({
  merchant: 'Amazon',
  amount: 49.99,
  category: 'shopping',
});

if (decision.approved) {
  // Purchase approved — proceed
  completePurchase(decision.bditToken);
} else if (decision.pending) {
  // Owner notified on Telegram — wait for approval
  const final = await pj.waitForApproval(decision.approvalId!);
} else {
  // Blocked by spending limits
  console.log('Blocked:', decision.reason);
}
```

### SDK Methods

| Method | Description |
|--------|-------------|
| `requestApproval(req)` | Request approval for a purchase |
| `waitForApproval(id)` | Poll until approval is resolved (2s interval, 5min timeout) |
| `checkLimits()` | Check current spending limits and remaining budget |

## Telegram Notifications

1. Create a bot via [@BotFather](https://t.me/BotFather)
2. Set `TELEGRAM_BOT_TOKEN` in your environment
3. Configure the webhook: `curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://yourdomain.com/api/notifications/telegram/webhook"`
4. Link your account in the dashboard (Bot Settings > Notifications)

## API Endpoints

### Bot Authentication (X-Bot-Api-Key header)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/bots/:id/request-payment` | Request payment approval |
| GET | `/approvals/:id/status` | Poll approval status |
| GET | `/bots/:id/limits/sdk` | Check spending limits |

### User Authentication (Clerk)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/bots` | Create bot |
| GET | `/bots` | List bots |
| GET | `/bots/:id` | Get bot details |
| POST | `/bots/:id/policy` | Upsert policy |
| GET | `/approvals` | List pending approvals |
| POST | `/approvals/:id/respond` | Approve/reject |
| GET | `/transactions` | List transactions |
| POST | `/notifications/telegram/link` | Generate Telegram link code |

## Environment Variables

```bash
# Database
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

## Production Deployment

```bash
# Build everything
npm run build

# Run migrations
cd packages/database && npx prisma migrate deploy

# Start with PM2
pm2 start ecosystem.config.cjs
```

## Tech Stack

- **Backend**: Fastify, Prisma, PostgreSQL, Redis
- **Frontend**: Next.js 14, React 18, Tailwind CSS
- **Auth**: Clerk
- **Crypto**: RS256 JWT (BDIT tokens)
- **Notifications**: Telegram Bot API
- **Monorepo**: npm workspaces + Turborepo

## License

Private — All rights reserved.
