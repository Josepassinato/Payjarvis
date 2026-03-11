# HISTORICO.md — PayJarvis

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
