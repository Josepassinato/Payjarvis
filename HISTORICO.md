# HISTORICO.md — PayJarvis

## 2026-03-13 — Email SMTP + Multi-tenancy OpenClaw (Slot Manager + User Router + Instance Spawner)

### O que foi feito

#### Email Service (SMTP Zoho)
1. **`apps/api/src/services/email.ts`** — Transporter SMTP via smtp.zoho.com:587 (STARTTLS), singleton nodemailer
2. **5 templates HTML responsivos**: templateApprovalRequest, templateTransactionConfirmed, templateTransactionBlocked, templateDailySummary, templateHandoffRequest
3. **Notificações dual-channel**: `notifications.ts` agora envia Telegram + Email em paralelo (non-blocking) em: notifyApprovalCreated, notifyTransactionApproved, notifyTransactionBlocked, notifyHandoffCreated
4. **Rotas**: `POST /notifications/email` (envio avulso autenticado), `GET /notifications/email/status` (status config)
5. **Dependências**: nodemailer + @types/nodemailer
6. **Env vars**: ZOHO_EMAIL, ZOHO_PASSWORD, ZOHO_SMTP, ZOHO_PORT em .env.production

#### Multi-tenancy OpenClaw — Schema
1. **`OpenClawInstance`** model — name, processName (PM2), port (unique), capacity (default 100), currentLoad, status (ACTIVE/FULL/OFFLINE)
2. **`InstanceUser`** model — userId (unique 1:1), instanceId. Relação `instanceAssignment` no User
3. Schema sincronizado com `prisma db push`. Instance-01 seedada (PM2: openclaw, port 4000, capacity 100, 1 user)

#### Slot Manager (`apps/api/src/services/instance-manager.ts`)
- `findAvailableInstance()` — busca instância ACTIVE com menor carga
- `isInstanceFull(instanceId)` — boolean: currentLoad >= capacity
- `updateInstanceStatus(instanceId)` — auto-toggle ACTIVE ↔ FULL
- `getInstanceStats()` / `getInstanceStatus()` — array com load, capacity, available, utilizationPct

#### User Router
- `assignUser(userId)` / `assignUserToInstance()` — encontra slot, auto-spawn se todas cheias
- `releaseUser(userId)` / `removeUserFromInstance()` — libera slot, decrementa load
- `getInstanceForUser(userId)` / `getUserInstance()` — retorna instância do usuário
- `routeUser(userId)` — fluxo completo: verifica existente → assign → spawn → retorna endpoint `http://localhost:{port}`
- `getRouteForBot(botId)` — resolve botId → owner → instância → endpoint

#### Instance Spawner
- `spawnInstance()` — 1. mkdir /root/openclaw-instances/instance-{N}/ 2. Copia index.js, gemini.js, memory.js, payjarvis.js, package.json, skills/ 3. Gera .env com porta única (3010, 3011...) 4. npm install --production 5. pm2 start 6. pm2 save 7. Salva no banco. Max 10 instâncias
- `despawnInstance(instanceId)` — valida (não instance-01, vazia, >1 ativa) → pm2 delete → rm -rf dir → DELETE banco
- `deactivateInstance(instanceId)` — pm2 stop + status OFFLINE (mantém arquivos)
- `checkAndSpawn()` — se TODAS instâncias >= 90% capacidade → spawn automático

#### Rotas (`apps/api/src/routes/instances.ts`)
| Rota | Método | Ação |
|------|--------|------|
| `/instances` | GET | Lista instâncias {instances, totalUsers, totalCapacity, utilizationPct} |
| `/instances/my` | GET | Instância do usuário autenticado |
| `/instances/assign` | POST | Atribuir usuário a instância |
| `/instances/my` | DELETE | Liberar slot |
| `/instances/spawn` | POST | Spawn manual |
| `/instances/:id` | DELETE | Despawn (remove se vazia) |
| `/instances/:id/deactivate` | POST | Desativar (OFFLINE) |
| `/instances/:id/full` | GET | Boolean: cheia? |
| `/instances/route` | GET | Endpoint do usuário autenticado |
| `/instances/route/bot/:botId` | GET | Endpoint da instância do bot |
| `/instances/capacity` | GET | Check + auto-spawn se >= 90% |

#### Integrações
- **Onboarding Step 5** — ao completar onboarding, usuário é auto-atribuído a instância via assignUserToInstance()
- **Audit Logger** — 2 novos eventos: INSTANCE_SPAWNED, USER_ASSIGNED
- **Seed script** — `apps/api/scripts/seed-instance.ts` executado: instance-01 criada

### Arquivos criados
- `apps/api/src/services/email.ts`
- `apps/api/src/services/instance-manager.ts`
- `apps/api/src/routes/instances.ts`
- `apps/api/scripts/seed-instance.ts`

### Arquivos alterados
- `packages/database/prisma/schema.prisma` (+OpenClawInstance, +InstanceUser, +instanceAssignment no User)
- `apps/api/src/services/notifications.ts` (+email dual-channel em todas notificações)
- `apps/api/src/routes/notifications.ts` (+email routes, +sendEmail import)
- `apps/api/src/core/audit-logger.ts` (+INSTANCE_SPAWNED, +USER_ASSIGNED events)
- `apps/api/src/routes/onboarding.routes.ts` (+auto-assign instância no step 5)
- `apps/api/src/server.ts` (+instanceRoutes import/register)
- `apps/api/package.json` (+nodemailer, +@types/nodemailer)
- `.env.production` (+ZOHO_EMAIL, +ZOHO_PASSWORD, +ZOHO_SMTP, +ZOHO_PORT)

### Estado atual
- payjarvis-api: ONLINE (pm2, porta 3001) — com instance routes + email service
- payjarvis-rules: ONLINE (pm2, porta 3002)
- payjarvis-web: ONLINE (pm2)
- browser-agent: ONLINE (pm2, porta 3003)
- openclaw: ONLINE (pm2) — instance-01 registrada no banco (capacity 100, load 1)

### Integracoes ativas
- **Email**: SMTP Zoho configurado (aguardando ZOHO_PASSWORD após criar jarvis@payjarvis.com)
- **Multi-tenancy**: OpenClawInstance + InstanceUser + slot manager + user router + spawner — ATIVO
- **4 Camadas**: Core + Composio + Browserbase + Dashboard — sem alterações
- Clerk auth, Stripe, Telegram, Redis, PostgreSQL, Chrome CDP — sem alterações

### Pendente
- Configurar domínio payjarvis.com no Zoho Mail (MX + SPF + TXT no GoDaddy)
- Criar mailbox jarvis@payjarvis.com e gerar app password
- Setar ZOHO_PASSWORD no .env.production

### Sandbox
- `/root/sandbox/Payjarvis_email_20260313/` — preservada para rollback

---

## 2026-03-13 — Arquitetura de 4 Camadas (Core + Composio + Browserbase + Dashboard)

### O que foi feito

#### Camada 1 — PayJarvis Core (`apps/api/src/core/`)
1. **`policy-engine.ts`** — Avalia permissões: limites diários/semanais/mensais (query Transaction aggregate), categorias whitelist/blocklist, merchants whitelist/blacklist, time window (timezone-aware), auto-approve threshold
2. **`trust-manager.ts`** — Trust levels: RESTRICTED (<200) | STANDARD (200-500) | TRUSTED (500-800) | AUTONOMOUS (>800). Auto-approve limits: $0 / $25 / $100 / $500 por nível
3. **`approval-manager.ts`** — Human-in-the-loop: requestApproval (10min TTL), approve/reject com update de trust score, checkTimeouts (background 60s), notificação Telegram automática
4. **`session-manager.ts`** — Sessões Redis com TTL 30min, key `session:bot:{botId}`, tracking de intent/pendingActions/context
5. **`audit-logger.ts`** — Log imutável append-only. 12 event types (BOT_ACTION_REQUESTED, POLICY_DECISION, APPROVAL_*, API_CALL_MADE, COMPOSIO_ACTION, BROWSERBASE_SESSION, PAYMENT_*). 4 camadas
6. **`action-executor.ts`** — Ponto central de execução. SEARCH/READ = log only. PURCHASE/BOOK/RESERVE/SEND = policy engine completa + approval flow
7. **`index.ts`** — Re-exports de todos os módulos

#### Camada 1 — Core Routes (`apps/api/src/routes/core.ts`)
- `GET /api/core/policy/:botId` — retorna política + trust level
- `PUT /api/core/policy/:botId` — atualiza política (upsert)
- `GET /api/core/approvals/:botId` — lista aprovações pendentes
- `POST /api/core/approvals/:id/approve` — aprova uma ação
- `POST /api/core/approvals/:id/reject` — rejeita uma ação
- `GET /api/core/audit/:botId` — histórico de auditoria (filtro por camada, paginação)
- `GET /api/core/session/:botId` — sessão ativa
- `POST /api/core/session/:botId/action` — executa ação via action-executor (usado pelo OpenClaw)
- `GET /api/core/status` — status das 4 camadas (para dashboard)

#### Camada 2 — Commerce Integration
- Commerce router atualizado com audit logging via Layer 1 audit-logger (AuditEvents.API_CALL_MADE)

#### Camada 3 — Composio (`apps/api/src/services/composio/`)
1. **`composio-client.ts`** — Singleton SDK, composioExecute, composioListActions, hasConnectedAccount
2. **`actions.ts`** — sendConfirmationEmail (GMAIL_SEND_EMAIL), fetchEmails (GMAIL_FETCH_EMAILS), createCalendarEvent (GOOGLECALENDAR_CREATE_EVENT), listCalendarEvents (GOOGLECALENDAR_LIST_EVENTS), sendNotification (SLACK_SEND_MESSAGE)
3. **Routes** (`/api/composio/*`): tools list, connect OAuth, connections, email/calendar/notify actions
4. **Setup script** (`apps/api/scripts/composio-setup.ts`)

#### Camada 4 — Browserbase (`apps/browser-agent/src/services/`)
1. **`browserbase-client.ts`** — SDK real: createSession, getSession, getSessionLiveURLs, closeSession, listActiveSessions
2. **`assisted-fallback.ts`** — Cloud browser fallback: cria sessão Browserbase, conecta Playwright via CDP, detecta obstáculos (CAPTCHA/AUTH/NAVIGATION), retorna NEEDS_HANDOFF com live view URL
3. **`handoff-manager.ts`** — Human handoff: mensagens amigáveis por tipo de obstáculo, cria HandoffRequest via API, resolve handoff
4. **Routes** adicionadas ao browser-agent server: `/browser/session/create`, `/browser/session/:id/live`, `/browser/session/:id/close`, `/browser/fallback`, `/browser/handoff/:sessionId`, `/browser/sessions`

#### Frontend — Layer Status Dashboard
- **`apps/web/src/app/(dashboard)/layers/page.tsx`** — Dashboard com 4 cards de status (verde/amarelo/cinza), contadores de ações por camada, botões de configuração
- **Sidebar** — "Layers" adicionado à navegação com ícone de camadas
- **i18n** — strings em EN, PT, ES (layers.title, layers.subtitle, nomes de camadas)

#### OpenClaw — Roteamento pelo Action-Executor
- **`/root/openclaw/payjarvis.js`** — `executeAction()` adicionada: roteia payments pelo `POST /api/core/session/:botId/action` antes de executar. PURCHASE passa pela policy engine (pode ser DENIED ou PENDING_APPROVAL)

#### Prisma Schema
- **`PolicyDecisionLog`** model adicionado: botId, action (JSON), allowed, reason, trustLevel, layer, createdAt

#### Variáveis de Ambiente
- `COMPOSIO_API_KEY=ak_DLG0q1eWkEv2iTOr_PRa`
- `BROWSERBASE_API_KEY=bb_live_zKhgFzlsoQ0k7JJMp316moROWsg`
- `BROWSERBASE_PROJECT_ID=d7276057-3235-4591-b90c-3cc18746e3d3`

### Arquivos criados
- `apps/api/src/core/policy-engine.ts`
- `apps/api/src/core/trust-manager.ts`
- `apps/api/src/core/approval-manager.ts`
- `apps/api/src/core/session-manager.ts`
- `apps/api/src/core/audit-logger.ts`
- `apps/api/src/core/action-executor.ts`
- `apps/api/src/core/index.ts`
- `apps/api/src/routes/core.ts`
- `apps/api/src/services/composio/composio-client.ts`
- `apps/api/src/services/composio/actions.ts`
- `apps/api/src/services/composio/index.ts`
- `apps/api/src/routes/composio.ts`
- `apps/api/scripts/composio-setup.ts`
- `apps/browser-agent/src/services/browserbase-client.ts`
- `apps/browser-agent/src/services/assisted-fallback.ts`
- `apps/browser-agent/src/services/handoff-manager.ts`
- `apps/web/src/app/(dashboard)/layers/page.tsx`

### Arquivos alterados
- `packages/database/prisma/schema.prisma` (+PolicyDecisionLog model)
- `apps/api/src/server.ts` (+coreRoutes, +composioRoutes, +startTimeoutChecker)
- `apps/api/src/services/commerce/index.ts` (+Layer 2 audit logging)
- `apps/web/src/components/sidebar.tsx` (+Layers nav item)
- `apps/web/src/locales/en.json`, `pt.json`, `es.json` (+layers section)
- `apps/browser-agent/src/server.ts` (+6 Browserbase endpoints)
- `.env.production` (+COMPOSIO_API_KEY, +BROWSERBASE_API_KEY, +BROWSERBASE_PROJECT_ID)
- `/root/openclaw/payjarvis.js` (+executeAction routing via action-executor)

### Estado atual
- payjarvis-api: ONLINE (pm2, porta 3001) — com core routes + composio routes
- payjarvis-rules: ONLINE (pm2, porta 3002)
- payjarvis-web: ONLINE (pm2) — com dashboard /layers
- browser-agent: ONLINE (pm2, porta 3003) — com Browserbase endpoints
- openclaw: ONLINE (pm2) — com routing pelo action-executor

### Integracoes ativas
- **Camada 1**: Policy engine, trust manager, approval manager (10min timeout), session manager (Redis 30min), audit logger — TUDO ATIVO
- **Camada 2**: Commerce APIs (Amadeus, Yelp, Ticketmaster) — mock mode (sem API keys), com audit logging Layer 2
- **Camada 3**: Composio SDK conectado (API key configurada). Gmail: 23 ações, Calendar: 28 ações, Slack: 130+ ações disponíveis. Apps NOT CONNECTED (requer OAuth via /api/composio/connect/:app)
- **Camada 4**: Browserbase SDK conectado (API key + project ID configurados). Pronto para criar sessões cloud browser, assisted fallback, e human handoff com live view
- Clerk auth: Google OAuth + email verification
- Stripe: sk_live_ configurada
- Chrome CDP: porta 18800 (auto-connect)
- Telegram: @Jarvis12Brain_bot (notificações admin + user)
- Redis: cache commerce, sessions, rate limiting, token replay
- PostgreSQL: banco principal (PolicyDecisionLog table criada)

### Riscos / Atencao
- Composio apps precisam de OAuth para funcionar (Gmail, Calendar, Slack) — usar POST /api/composio/connect/:app
- Commerce APIs ainda em mock mode — configurar API keys (Amadeus, Yelp, Ticketmaster) para dados reais
- Approval timeout checker roda a cada 60s — aprovações expiram em 10 minutos
- Trust score RESTRICTED (<200) suspende o agent automaticamente
- Browserbase sessions têm timeout de 5 minutos por padrão — ajustável no createSession

### Sandbox
- `/root/sandbox/Payjarvis_4layers_20260313/` — preservada para rollback

---

## 2026-03-13 — Página de Integrações (Onboarding + Dashboard)

### O que foi feito
1. **Novo endpoint** `GET /api/integrations/available` — retorna lista de 12 providers com disponibilidade baseada em env vars do servidor
2. **Novo endpoint** `POST /bots/:botId/integrations/toggle` — toggle individual de provider com connectedAt timestamp
3. **Componente `IntegrationGrid`** reutilizável (`components/integration-grid.tsx`):
   - Grid por categoria (Travel, Restaurants, Events, Marketplace, Transport, Delivery)
   - Cards com toggle on/off, badge "Connected" (verde) e "Coming Soon" (cinza)
   - Toggle animado com spinner durante save
   - Suporte a estado otimista no dashboard
4. **Onboarding Step 3** reescrito: busca providers disponíveis do servidor, pre-habilita todos os disponíveis, salva via API no submit
5. **Dashboard `/integrations`** reescrito: seletor de bot, grid com toggles que salvam imediatamente via API, contador de serviços ativos
6. **i18n**: strings atualizadas em EN, PT, ES (categorias, badges, contadores)

### Arquivos criados
- `apps/web/src/components/integration-grid.tsx`

### Arquivos alterados
- `apps/api/src/routes/onboarding.routes.ts` (+available endpoint, +toggle endpoint)
- `apps/web/src/lib/api.ts` (+AvailableProvider type, +getAvailableIntegrations, +toggleBotIntegration)
- `apps/web/src/app/onboarding/step/3/page.tsx` (reescrito com IntegrationGrid)
- `apps/web/src/app/(dashboard)/integrations/page.tsx` (reescrito com IntegrationGrid)
- `apps/web/src/locales/en.json`, `pt.json`, `es.json` (integrations section expandida)

### Estado atual
- payjarvis-api: ONLINE (pm2, porta 3001) — com endpoints de integrações
- payjarvis-web: ONLINE (pm2) — com páginas de integrações
- Onboarding: 5 steps (1:KYC, 2:Bot, **3:Integrações**, 4:Payment, 5:Terms)
- Dashboard: `/integrations` com grid de providers e toggles

### Sandbox
- `/root/sandbox/Payjarvis_integrations_20260313/` — preservada para rollback

---

## 2026-03-13 — Commerce Provider Agents (6 serviços centralizados)

### O que foi feito
1. **6 serviços commerce** criados em `apps/api/src/services/commerce/`:
   - `flights.ts` — Amadeus Flight Offers API (OAuth2 auth, mock mode)
   - `hotels.ts` — Amadeus Hotel Offers API (2-step: find + offers, mock mode)
   - `restaurants.ts` — Yelp Fusion Business Search (mock mode)
   - `events.ts` — Ticketmaster Discovery API v2 (mock mode)
   - `transport.ts` — Uber API (placeholder, sempre mock)
   - `delivery.ts` — Uber Eats API (placeholder, sempre mock)
   - `index.ts` — Router central com cache Redis (5min), rate limiting (10 req/min/bot/service), audit logging
2. **Rotas commerce** em `apps/api/src/routes/commerce.ts`:
   - POST /api/commerce/flights/search
   - POST /api/commerce/hotels/search
   - POST /api/commerce/restaurants/search
   - POST /api/commerce/events/search
   - POST /api/commerce/transport/request
   - POST /api/commerce/delivery/search
   - Todas protegidas por `requireBotAuth` middleware
3. **Prisma schema** atualizado: modelo `CommerceSearchLog` + tabela SQL criada
4. **Redis** `redisIncr()` adicionado para rate limiting com TTL
5. **.env.example** atualizado com chaves de API commerce (Amadeus, Yelp, Ticketmaster, Uber)
6. **Todos 6 endpoints testados** com curl — todos retornando mock data corretamente

### Arquivos criados
- `apps/api/src/services/commerce/index.ts`
- `apps/api/src/services/commerce/flights.ts`
- `apps/api/src/services/commerce/hotels.ts`
- `apps/api/src/services/commerce/restaurants.ts`
- `apps/api/src/services/commerce/events.ts`
- `apps/api/src/services/commerce/transport.ts`
- `apps/api/src/services/commerce/delivery.ts`
- `apps/api/src/routes/commerce.ts`

### Arquivos alterados
- `apps/api/src/server.ts` (+import/register commerceRoutes)
- `apps/api/src/services/redis.ts` (+redisIncr function)
- `packages/database/prisma/schema.prisma` (+CommerceSearchLog model)
- `.env.example` (+Commerce APIs section)

### Estado atual
- payjarvis-api: ONLINE (pm2, porta 3001) — com commerce routes
- payjarvis-rules: ONLINE (pm2, porta 3002)
- payjarvis-web: ONLINE (pm2)
- browser-agent: ONLINE (pm2, porta 3003, CDP 18800)

### Integracoes ativas
- Commerce APIs: todas em mock mode (chaves não configuradas)
  - Amadeus (flights/hotels): precisa AMADEUS_CLIENT_ID + AMADEUS_CLIENT_SECRET
  - Yelp (restaurants): precisa YELP_API_KEY
  - Ticketmaster (events): precisa TICKETMASTER_API_KEY
  - Uber (transport/delivery): placeholders (requer partnership)
- Redis: cache commerce (5min TTL), rate limiting
- Clerk auth, Stripe, Telegram, Chrome CDP: sem alterações

### Riscos / Atencao
- Mock mode ativo para todos os serviços — configurar API keys no .env para dados reais
- Rate limit: 10 requests/minuto por bot por serviço — ajustável em commerce/index.ts
- Cache Redis 5 min — pode causar dados stale em buscas frequentes
- Transport e Delivery são sempre mock (APIs requerem partnership approval)

---

## 2026-03-12 — Onboarding Step "Integrations" + BotIntegration model

### O que foi feito
1. **BotIntegration model** adicionado ao Prisma schema — provider, category, enabled, config (JSON), connectedAt
2. **Tabela `bot_integrations`** criada via SQL (CREATE TABLE + indexes + unique constraint botId+provider)
3. **Onboarding expandido de 4 para 5 steps**:
   - Step 1: Identity (KYC) — sem mudanca
   - Step 2: Bot — sem mudanca
   - Step 3: **Integrations** (NOVO) — galeria de provedores em cards com toggle
   - Step 4: Payment — era step 3
   - Step 5: Terms — era step 4
4. **Completion marker**: 5 → 6 (users existentes migrados via UPDATE SET +1 WHERE >= 3)
5. **7 categorias de provedores**: Food & Delivery (Uber Eats, DoorDash, Instacart), Travel (Amadeus, Airbnb, Booking.com, Expedia), Restaurants (OpenTable, Yelp), Events (Ticketmaster, StubHub, Fandango), Marketplace (Amazon, Mercado Livre, Shopify), Transport (Uber, Lyft), Utilities (Coming Soon: electricity, internet, insurance)
6. **API routes**: POST /onboarding/step/3 (integrations), GET/PUT /bots/:botId/integrations
7. **i18n**: strings de integracoes em EN, PT, ES
8. **Frontend**: step 3 galeria, step 4 (payment reposicionado), step 5 (terms reposicionado), progress component atualizado para 5 steps

### Arquivos alterados
- `packages/database/prisma/schema.prisma` (+BotIntegration model, +integrations relation no Bot)
- `apps/api/src/routes/onboarding.routes.ts` (new step 3, renumbered step 4/5, bot integrations endpoints)
- `apps/web/src/app/onboarding/step/3/page.tsx` (reescrito: galeria de integracoes)
- `apps/web/src/app/onboarding/step/4/page.tsx` (reescrito: payment, era step 3)
- `apps/web/src/app/onboarding/step/5/page.tsx` (novo: terms, era step 4)
- `apps/web/src/app/onboarding/page.tsx` (completion threshold 5→6)
- `apps/web/src/app/(dashboard)/layout.tsx` (guard threshold 5→6)
- `apps/web/src/components/onboarding-progress.tsx` (+integrations step)
- `apps/web/src/lib/api.ts` (+BotIntegration type, +getBotIntegrations, +updateBotIntegrations)
- `apps/web/src/locales/en.json`, `pt.json`, `es.json` (+step3 integrations, renumbered step4/step5)

### Estado atual
- payjarvis-api: ONLINE (pm2, porta 3001) — API rebuilt com novas rotas
- payjarvis-web: ONLINE (pm2) — web rebuilt com 5 steps
- payjarvis-rules: ONLINE (pm2, porta 3002)
- browser-agent: ONLINE (pm2, porta 3003, CDP 18800)

### Riscos / Atencao
- Users com onboardingStep=5 (old completion) foram migrados para 6 (new completion) via SQL
- Step 3 (integrations) e skippable — user pode pular e configurar depois em Settings
- Providers "Coming Soon" (utilities) mostram card desabilitado
- Integrations dashboard page (/integrations) ja existe no sidebar mas ainda mostra config OpenClaw — pode ser expandida com o grid de integracoes

---

## 2026-03-12 — Fixes: Stripe keys, i18n EN, 12h time, timezone, trust score, notifications

### O que foi feito
1. **Stripe test/live fix**: `.env.production` STRIPE_SECRET_KEY atualizado de `sk_test_` para `sk_live_`
2. **Bot username fix**: instrução de vinculação no onboarding corrigida de `@PayJarvisBot` para `@Jarvis12Brain_bot` (`apps/api/src/routes/notifications.ts`)
3. **i18n padronização EN**: todas strings de notificação (notifications.ts, routes/notifications.ts) traduzidas de PT para EN (~22 strings)
4. **Formato 12h AM/PM**: selects de horário no dashboard convertidos para formato 12h (`apps/web/src/app/(dashboard)/bots/[id]/page.tsx`)
5. **Timezone por usuário**: campo `timezone` adicionado ao Policy (Prisma schema + SQL ALTER TABLE), dropdown com 20 fusos no dashboard, `checkTimeWindow` usa `Intl.DateTimeFormat` para calcular hora local
6. **Trust score fix**: `checkTimeWindow` removido de `ANOMALY_RULES` (causava -50), novo delta `blocked_time_window: -5`. Scores dos bots resetados para 1000
7. **Notificações bot fix**: `TELEGRAM_BOT_TOKEN` e `ADMIN_TELEGRAM_BOT_TOKEN` corrigidos para @Jarvis12Brain_bot (8615760515)
8. **Browser-agent auto-connect**: CDP reconecta automaticamente no boot via setTimeout + POST /connect
9. **Browser-agent no ecosystem**: adicionado ao `ecosystem.config.cjs` para sobreviver a `pm2 delete/start`

### Arquivos alterados
- `.env.production` (Stripe key, Telegram tokens, browser-agent vars)
- `ecosystem.config.cjs` (+browser-agent app)
- `apps/api/src/routes/notifications.ts` (bot username, EN strings)
- `apps/api/src/services/notifications.ts` (EN strings, date format en-US)
- `apps/api/src/services/trust-score.ts` (time window reclassified)
- `apps/rules-engine/src/rules/check-time-window.ts` (timezone support)
- `apps/browser-agent/src/server.ts` (auto-connect CDP)
- `apps/web/src/app/(dashboard)/bots/[id]/page.tsx` (12h format, timezone dropdown)
- `apps/web/src/lib/api.ts` (+timezone field)
- `packages/database/prisma/schema.prisma` (+timezone column)
- `packages/types/src/index.ts` (+timezone in PolicyConfig)

### Estado atual
- payjarvis-api: ONLINE (pm2, porta 3001)
- payjarvis-rules: ONLINE (pm2, porta 3002)
- payjarvis-web: ONLINE (pm2)
- browser-agent: ONLINE (pm2, porta 3003, CDP 18800, auto-connect)

### Integracoes ativas
- Clerk auth: Google OAuth habilitado, email verification ativo
- Stripe: sk_live_ configurada, CardElement dark theme
- Chrome CDP: porta 18800 (auto-connect no boot)
- Telegram @Jarvis12Brain_bot: notificações admin + onboarding (token 8615760515, chat 1762460701)
- Redis: cache de approvals, handoffs, tokens BDIT
- Prisma/PostgreSQL: banco principal (timezone column adicionada)

### Riscos / Atencao
- 2 bots duplicados no DB (`cmmnzmkmh000d2o9s4mvcz6iv` e `cmmnz556h00042o9slmxfs7g3`) podem ser limpos
- PM2 env caching: usar `pm2 delete + pm2 start` (não apenas restart) para recarregar env do ecosystem.config.cjs

---

## 2026-03-12 — Admin Telegram notifications via @Jarvis12Brain_bot

### O que foi feito
1. Adicionado canal de notificação admin separado via @Jarvis12Brain_bot (token: 8615760515)
2. `notifyApprovalCreated` agora SEMPRE envia para o admin (chat ID 1762460701) via @Jarvis12Brain_bot, independente do fluxo normal via @PayJarvisBot
3. Novo endpoint `POST /notifications/telegram/admin-webhook` para processar callbacks (aprovar/rejeitar) vindos do @Jarvis12Brain_bot
4. `answerCallbackQuery` e `editMessageText` agora aceitam `botToken` opcional para suportar múltiplos bots
5. Webhook do @Jarvis12Brain_bot configurado para `https://www.payjarvis.com/api/notifications/telegram/admin-webhook`
6. Verificação de segurança: admin-webhook só aceita callbacks do `ADMIN_TELEGRAM_CHAT_ID`

### Arquivos alterados
- `.env.production` (+ADMIN_TELEGRAM_BOT_TOKEN, +ADMIN_TELEGRAM_CHAT_ID)
- `apps/api/src/services/notifications.ts` (sendAdminTelegramNotification, botToken param)
- `apps/api/src/routes/notifications.ts` (admin-webhook endpoint)

### Estado atual
- payjarvis-api: ONLINE (pm2, porta 3001)
- payjarvis-rules: ONLINE (pm2, porta 3002)
- payjarvis-web: ONLINE (pm2)
- browser-agent: ONLINE (pm2, porta 3003, CDP 18800)

### Integracoes ativas
- Clerk auth: Google OAuth habilitado, email verification ativo
- Stripe: pk_live configurada, CardElement dark theme
- Chrome CDP: porta 18800
- Telegram @PayJarvisBot: webhook para onboarding/link de usuários (token 8486332506)
- Telegram @Jarvis12Brain_bot: webhook para notificações admin de aprovação (token 8615760515, chat 1762460701)
- Redis: cache de approvals, handoffs, tokens BDIT
- Prisma/PostgreSQL: banco principal

### Sandbox
- `/root/sandbox/Payjarvis_2026-03-12/` — preservada para rollback

---

## 2026-03-12 — Painel de autenticação customizado + Google OAuth + Logout

### O que foi feito
1. **Sign-in customizado** (`/sign-in`) — substituído componente genérico `<SignIn />` por UI dark theme com email/senha, link "Esqueceu a senha?" e botão "Continuar com Google" (OAuth)
2. **Sign-up com confirmação de email** (`/sign-up`) — formulário com email, senha, confirmação + tela de código de verificação 6 dígitos enviado por email. Após verificar → redirect para onboarding
3. **Recuperação de senha** (`/forgot-password`) — fluxo 4 etapas: email → código → nova senha → sucesso com redirect
4. **Google OAuth** — botão "Continuar com Google" no login, página `/sso-callback` para finalizar fluxo OAuth (Client ID e Secret configurados no Clerk Dashboard)
5. **Botão Sair no sidebar** — abaixo de "Parceiros", usa `useClerk().signOut()` com redirect para `/sign-in`, hover vermelho
6. **Middleware atualizado** — `/forgot-password` e `/sso-callback` adicionadas como rotas públicas

### Arquivos alterados
- `apps/web/src/app/sign-in/[[...sign-in]]/page.tsx` (reescrito)
- `apps/web/src/app/sign-up/[[...sign-up]]/page.tsx` (reescrito)
- `apps/web/src/app/forgot-password/page.tsx` (novo)
- `apps/web/src/app/sso-callback/page.tsx` (novo)
- `apps/web/src/components/sidebar.tsx` (botão Sair)
- `apps/web/src/middleware.ts` (rotas públicas)

### Estado atual
- payjarvis-api: ONLINE (pm2, porta 3001)
- payjarvis-rules: ONLINE (pm2, porta 3002)
- payjarvis-web: ONLINE (pm2) — rebuild com auth customizado
- browser-agent: ONLINE (pm2, porta 3003, CDP 18800)

### Integracoes ativas
- Clerk auth: Google OAuth habilitado, email verification ativo
- Stripe: pk_live configurada, CardElement dark theme
- Chrome CDP: porta 18800
- Telegram notifications: via TELEGRAM_BOT_TOKEN
- Redis: cache de approvals, handoffs, tokens BDIT
- Prisma/PostgreSQL: banco principal

### Riscos / Atencao
- Clerk Dashboard precisa ter "Email code" habilitado como estratégia de verificação (Settings → Email, Phone, Username) para forgot-password e sign-up verification funcionarem
- Google OAuth precisa de redirect URI configurado no Google Cloud Console apontando para o domínio do PayJarvis
- Sandbox preservada em `/root/sandbox/Payjarvis_auth_20260312/` para rollback

---

## 2026-03-11 — Fix: Stripe CardElement dark theme (onboarding step 3)

### Problema
CardElement do Stripe renderizava com tema light (fundo branco/transparente) dentro da pagina dark theme. Texto cinza claro (#e5e7eb) ficava invisivel no fundo claro do iframe, criando aparencia de "area cinza vazia".

### O que foi feito
1. Adicionado `stripeElementsOptions` com `appearance.theme: "night"` e variaveis de cor alinhadas ao design system (colorBackground: #1e2330, colorText: #e5e7eb, colorPrimary: #2563eb)
2. `<Elements>` provider agora recebe `options={stripeElementsOptions}` em ambos os arquivos:
   - `apps/web/src/app/onboarding/step/3/page.tsx` (1 instancia)
   - `apps/web/src/app/(dashboard)/payment-methods/page.tsx` (3 instancias)
3. Build e deploy realizados com sucesso

### Estado atual
- payjarvis-api: ONLINE (pm2, porta 3001)
- payjarvis-rules: ONLINE (pm2, porta 3002)
- payjarvis-web: ONLINE (pm2) — rebuild com fix Stripe
- browser-agent: ONLINE (pm2, porta 3003, CDP 18800)

### Integracoes ativas
- Stripe: pk_live configurada, CardElement com dark theme
- Chrome CDP: porta 18800
- Telegram notifications: via TELEGRAM_BOT_TOKEN
- Redis: cache de approvals, handoffs, tokens BDIT
- Prisma/PostgreSQL: banco principal

### Riscos / Atencao
- appearance API do Stripe afeta principalmente PaymentElement; para CardElement legacy o efeito e parcial (fundo do iframe). Cores de texto/placeholder sao controladas pelo style option ja existente
- Sandbox preservado em /root/sandbox/Payjarvis_stripe_20260311/ para rollback

---

## 2026-03-11 — Merged Deploy: Agent Identity + Onboarding Wizard

### O que foi feito
Merge de duas sandboxes independentes em um deploy unificado:

#### Agent Identity System (sandbox Payjarvis_2026-03-11)
1. Modelo Agent (first-class, trustScore 0-1000) + AgentReputation
2. Trust score refactored (escala 0-1000, reputation tracking)
3. BDIT tokens com agent identity fields no JWT
4. JWKS com suporte a key rotation
5. Payment methods: Stripe SetupIntent + PayPal connect com validação
6. Redis hardening: redisSetNX, redisPublish, crash em prod se indisponível
7. Merchant race condition fix (atomic gate via redisSetNX)
8. Browser agent: auto-reconnect CDP, health check, obstacle detection
9. Rules engine: policy cache invalidation via Redis pub/sub
10. Frontend: nova paleta brand, reputation grid, animações

#### Onboarding Wizard (sandbox Payjarvis_onboarding_20260311_0639)
1. Páginas /onboarding/step/1-4 (KYC, bot creation, payment, terms)
2. Schema: dateOfBirth, documentNumber, country, address, kycPhotoPath, kycSubmittedAt, onboardingStep, termsAcceptedAt
3. API: /onboarding/status, /onboarding/step/1-4 (auth required)
4. OnboardingGuard no dashboard layout (redirect se step < 5)
5. Middleware: /onboarding como rota pública no Clerk
6. i18n: strings de onboarding em en/es/pt
7. OCR via tesseract.js para documento no step 1

### Estado atual
- payjarvis-api: ONLINE (pm2, porta 3001)
- payjarvis-rules: ONLINE (pm2, porta 3002)
- payjarvis-web: ONLINE (pm2)
- browser-agent: ONLINE (pm2, porta 3003)

### Integracoes ativas
- Chrome CDP: porta 18800 (auto-reconnect ativo)
- Telegram notifications: via TELEGRAM_BOT_TOKEN
- Redis: cache, token replay protection, policy invalidation pub/sub
- Prisma/PostgreSQL: banco principal (schema atualizado com Agent + onboarding fields)
- Google Fonts: DM Sans, Plus Jakarta Sans, JetBrains Mono
- Clerk auth: middleware com /onboarding como rota pública

### Sandboxes preservadas para rollback
- /root/sandbox/Payjarvis_merged_20260311/ (merge final)
- /root/sandbox/Payjarvis_2026-03-11/ (agent identity)
- /root/sandbox/Payjarvis_onboarding_20260311_0639/ (onboarding)

### Riscos / Atencao
- OnboardingGuard redireciona todo usuário novo para /onboarding/step/1 — users existentes com onboardingStep=0 serão redirecionados no próximo login
- tesseract.js carrega WASM ~10MB no browser para OCR — pode ser lento em mobile
- CDP auto-reconnect: exponential backoff até 60s max

---

## 2026-03-11 — Security Headers + SSL Hardening

### O que foi feito
1. SSL hardening: TLSv1.2/1.3 only, ciphers modernos, session tickets off
2. HSTS: max-age=63072000 (2 anos), includeSubDomains, preload
3. X-Content-Type-Options: nosniff
4. X-Frame-Options: SAMEORIGIN (frontend), DENY (API)
5. X-XSS-Protection: 1; mode=block
6. Referrer-Policy: strict-origin-when-cross-origin
7. Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(self)
8. Content-Security-Policy completo (whitelists: Clerk, Google Fonts, Cloudflare challenges)
9. API (api.payjarvis.com) tambem com headers de seguranca

### Backup
- Config anterior: /etc/nginx/sites-enabled/payjarvis.bak.20260311

### Riscos / Atencao
- CSP pode bloquear scripts de terceiros nao listados — se adicionar nova integracao, atualizar CSP
- HSTS preload: uma vez submetido ao hstspreload.org, e dificil reverter

---

## 2026-03-11 — Design Overhaul do Frontend

### O que foi feito

#### Design System (11 arquivos alterados)
1. Nova paleta de cores: cinza-puro → azul-midnight (#080B12, #0D1117, #161B22, #21262D)
2. Brand color: Tailwind blue generico → azul eletrico (#0066FF, #0047FF)
3. Nova cor accent teal/cyan (#00D4AA) para diferenciacao visual
4. 3 fontes Google Fonts: DM Sans (display), Plus Jakarta Sans (body), JetBrains Mono (dados)
5. 7 animacoes CSS: fade-in staggered, slide-in, scale-in, glow

#### Landing Page
1. Hero: mesh gradient + grid pattern + animacoes staggered de entrada
2. Botao CTA com glow animation continua
3. Code block com syntax highlighting real (keywords, strings, types, functions)
4. Cards de solucao com gradientes sutis individuais
5. Flow diagrams com linhas gradiente

#### Dashboard
1. Stat cards: icones contextuais + gradientes sutis + hover scale
2. Alertas: borda lateral colorida (vermelho/amarelo) + icones SVG
3. Cores dos graficos atualizadas para novo brand

#### Componentes
1. Sidebar: logo icon gradiente (escudo) + barra lateral azul no item ativo + backdrop blur
2. DecisionBadge: dot indicator colorido + pulse no PENDING
3. TrustBar: barra com gradiente + score colorido
4. LoadingSpinner: ring duplo + texto mono
5. ErrorBox: icone de alerta + borda left vermelha
6. EmptyState: icone SVG de inbox vazio
7. Toast (approvals): slide-in da direita (corrigido de animate-pulse)

### Estado atual
- payjarvis-api: ONLINE (pm2, porta 3001)
- payjarvis-rules: ONLINE (pm2, porta 3002)
- payjarvis-web: ONLINE (pm2) — rebuild OK
- browser-agent: ONLINE (pm2, porta 3003, CDP 18800)

### Integracoes ativas
- Chrome CDP: porta 18800
- Telegram notifications: via TELEGRAM_BOT_TOKEN
- Redis: cache de approvals, handoffs, tokens BDIT
- Prisma/PostgreSQL: banco principal
- Google Fonts: DM Sans, Plus Jakarta Sans, JetBrains Mono (CDN externo)

### Riscos / Atencao
- Google Fonts carrega via CDN — se CDN cair, fallback para system fonts
- Sandbox preservado em /root/sandbox/Payjarvis_design_20260311/ para rollback

---

## 2026-03-11 — Correcoes API + notificacoes + handoff browser-agent

### O que foi feito

#### API (apps/api)
1. Rebuild da API — dist tinha build antigo com bug Prisma (agentReputation.findUnique com botId ao inves de agentId)
2. Novas funcoes em notifications.ts: notifyTransactionApproved() e notifyTransactionBlocked()
3. Chamadas fire-and-forget em payments.ts apos decisao APPROVED e BLOCKED
4. notifyApprovalCreated (PENDING_HUMAN) ja existia — sem alteracao

#### Browser Agent (apps/browser-agent)
1. User-Agent override: Chrome headless → Chrome 131 Windows (evita bloqueio Amazon)
2. webdriver flag desabilitado via Page.addScriptToEvaluateOnNewDocument
3. Network.enable + Network.setUserAgentOverride antes de Page.navigate
4. Timeout de load aumentado: 10s → 15s
5. Extracao de produtos Amazon: multi-seletor ([data-asin], s-search-result, etc), polling ate 10s
6. Cada produto retorna: title, price, link, rating, reviews, image, asin
7. Deteccao de obstaculos (CAPTCHA, AUTH, NAVIGATION) via Runtime.evaluate apos load
8. Handoff automatico: quando obstaculo detectado, chama POST /bots/:botId/request-handoff na API
9. State do server salva botApiKey/botId do /connect para usar no handoff

### Estado atual
- payjarvis-api: ONLINE (pm2, porta 3001)
- payjarvis-rules: ONLINE (pm2, porta 3002)
- payjarvis-web: ONLINE (pm2)
- browser-agent: ONLINE (pm2, porta 3003, CDP 18800)

### Integracoes ativas
- Chrome CDP: porta 18800 (headless, container ou local)
- Telegram notifications: via TELEGRAM_BOT_TOKEN na API
- Redis: cache de approvals, handoffs, tokens BDIT
- Prisma/PostgreSQL: banco principal

### Riscos / Atencao
- Browser-agent perde conexao CDP no restart — precisa POST /connect novamente
- Amazon pode mudar seletores de produtos — monitorar se extracao quebrar
- Handoff depende de PAYJARVIS_API_URL apontar para localhost:3001 (sem /api prefix internamente)
- Notificacoes Telegram dependem de user.notificationChannel === "telegram" e user.telegramChatId preenchido
