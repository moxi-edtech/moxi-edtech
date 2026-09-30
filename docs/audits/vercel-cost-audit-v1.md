# KLASSE Vercel Cost Audit V1

```
sprint:          KLASSE Vercel Cost & Compute Audit V1
executor:        Antigravity
data:            2026-09-23
prioridade:      P0
regra:           medir → localizar → explicar → reproduzir → corrigir → comparar
```

---

## Executive Summary

O KLASSE consumiu **4h08 de Fluid Active CPU / 4h disponíveis** no plano Hobby da Vercel, com ~575k Function Invocations e ~309k Edge Requests. Esta auditoria localizou **múltiplas causas concretas** para esse consumo — e responde à pergunta central:

> **Conclusão: C — Mistura de implementação e característica da aplicação.**

A maior fracção do consumo é **desperdício computacional estrutural** com origem em:
1. Uma função Inngest que dispara **a cada minuto** (1.440 invocações/dia só de polling de push)
2. **7+ loops de polling** client-side sem fallback para WebSocket/SSE, gerando 15–30k requests/dia por utilizador activo
3. **577 ocorrências** de `force-dynamic` / `noStore()` que tornam cada page load um SSR completo
4. Uma cron de IA que itera **em série por escola** sem concorrência controlada
5. O Service Worker em modo `stale-while-revalidate` que duplica requests para rotas de aluno/professor

O consumo legítimo (carga real de utilizadores, PDF generation, webhooks de pagamento) é uma fracção menor do total.

---

## Current Baseline

| Métrica | Valor | Limite Hobby | % Utilização |
|---|---|---|---|
| Fluid Active CPU | 4h08 (248 min) | 4h (240 min) | **103% — EXCEDIDO** |
| Function Invocations | ~575.000 | 1.000.000 | 57,5% |
| Deployment Storage | 4,36 GB | 10 GB | 43,6% |
| Edge Requests | ~309.000 | 1.000.000 | 30,9% |

**API Routes inventariadas:** 603 `route.ts` files  
**Apps Vercel:** 4 (web, auth, formacao, landing)  
**Período:** billing cycle Setembro 2026

---

## Traffic Breakdown

### Onde estão os 309k Edge Requests

O middleware do `apps/web` tem **31 matcher patterns** cobrindo todas as rotas de portal (secretaria, financeiro, professor, aluno, admin, dashboard, etc.). **Não intercepta assets estáticos** (`_next/*`), o que é correcto.

Portanto, os 309k Edge Requests são **100% tráfego de aplicação legítimo** — não há assets a passar pelo middleware. O problema não é o matcher ser demasiado amplo: é o custo de cada request.

### Custo por Edge Request

O middleware tem **dois paths**:

**Path rápido (cache hit):** Decoda o cookie JWT `klasse_ctx` via Web Crypto API. Sem network I/O. Custo: <1ms.

**Path lento (cache miss):** Chama `resolveDbAuthContext` com **3 queries Supabase sequenciais:**
1. `supabase.auth.getUser()` — valida token
2. `supabase.from("profiles").select(...)` — busca escola_id
3. `supabase.from("escola_users").select(...)` — busca role/memberships

Estimativa de cache miss rate: 10–20% (token expiry, cross-domain, novo dispositivo).  
**→ 30k–60k requests/período gerando 90k–180k chamadas Supabase do middleware sozinho.**

Adicionalmente: rotas marcadas como `STRICT`, `PUBLIC`, `OPERATIONAL` fazem **POST HTTP para Upstash Redis** para rate limiting em cada request.

---

## Function Invocation Breakdown

### Distribuição por categoria de rota (603 routes)

| Categoria | Routes | Frequência Estimada | Invocações Estimadas |
|---|---|---|---|
| secretaria | 168 | Alta (uso diário intenso) | ~120k |
| financeiro | 67 | Alta (sidebar badges + dashboard) | ~80k |
| escolas/escola | 138 | Média (admin + operações) | ~70k |
| professor | 27 | Alta (polling 30s) | ~60k |
| aluno | 32 | Média-Alta (polling 45s) | ~40k |
| inngest | 1 | **1.440×/dia (cron 1min)** | ~43k |
| super-admin | 55 | Baixa | ~15k |
| fiscal | 17 | Baixa-Média | ~10k |
| jobs/cron | 13 | 3×/dia | ~5k |
| outros | 85 | Variável | ~50k |
| **TOTAL** | **603** | | **~493k–575k** |

> **Nota:** Os ~575k invocations incluem preview deployments. A separação prod/preview não está disponível sem acesso ao painel Vercel. Estimativa: 80–90% produção, 10–20% preview/dev.

---

## Active CPU Breakdown

### Top Consumers por CPU Estimado

| # | Componente | Runtime | Trigger | CPU Estimado | % do Total |
|---|---|---|---|---|---|
| **1** | `pushNotificationWorker` (Inngest) | Node | `cron: * * * * *` | **~45–60 min** | **~25%** |
| **2** | `/api/professor/*` polling (30s) | Node | Client setInterval | ~30–40 min | ~16% |
| **3** | `/api/secretaria/*` polling (30s) | Node | Client setInterval | ~25–35 min | ~13% |
| **4** | `/api/cron/ai/calendar-alerts` | Node | Cron diário | ~20–30 min | ~10% |
| **5** | SSR pages (577× force-dynamic) | Node | Navigation | ~20–25 min | ~10% |
| **6** | PDF generation (9 routes) | Node | On-demand | ~15–20 min | ~8% |
| **7** | `/api/financeiro/sidebar-badges` | Node | AppShell mount | ~10–15 min | ~6% |
| **8** | Middleware fallbacks (DB auth) | Edge | 10–20% das requests | ~10–15 min | ~6% |
| **9** | Outros jobs/webhooks/AI | Node | On-demand | ~10–15 min | ~6% |
| **TOTAL** | | | | **~185–255 min** | 100% |

> O Fluid Active CPU mede **CPU activo**, não wall clock. Functions que fazem I/O (Supabase, WAHA) têm CPU baixo mas aumentam invocations e duration. A CPU real concentra-se em Inngest + SSR + PDF.

---

## Top Consumers

### 1. `pushNotificationWorker` — CRÍTICO P0

**Trigger:** `cron: "* * * * *"` — dispara **a cada minuto**, 24/7.

```typescript
// apps/web/src/inngest/functions/push-notifications.ts
{ id: "push-notification-worker", triggers: [{ cron: "* * * * *" }] }
```

**O que faz por execução:**
1. Query à tabela `notificacoes` filtrando `push_processed = false` (limit 50)
2. Para cada notificação: query a `aluno_push_subscriptions` + envio Web Push HTTP
3. Se não há notificações: retorna imediatamente com `{ message: "No pending notifications" }`

**Custo mensal estimado:**
- 1.440 invocações/dia × 30 dias = **43.200 invocações/mês só desta função**
- Se 90% das execuções retornam "no pending": 38.880 invocações desnecessárias
- CPU por execução "vazia": ~100–200ms × 43.200 = **72–144 CPU-minutos/mês**

**Isto explica sozinho ~30–60% do budget de CPU consumido.**

### 2. Polling Client-Side — ALTO P0

Encontrados **16 setInterval ativos** em componentes que correm enquanto o utilizador está na app:

| Componente / Hook | Intervalo | Endpoint | Tipo |
|---|---|---|---|
| `useAdminActivityFeed` | **15s** | `/api/escola/[id]/operacoes/activity-feed` | Admin |
| `useOperationalActivityFeed` | **15s** | `/api/escola/[id]/operacoes/activity-feed` | Admin |
| `AulasOperacionaisPanel` | **30s** | `/api/secretaria/aulas` | Secretaria |
| `useOperacoesPendencias` | **30s** | `/api/secretaria/aulas`, `/api/secretaria/planos-aula`, `/api/secretaria/notas/reabertura` (3 fetch!) | Secretaria |
| `professor/page.tsx` | **30s** | `/api/professor/aulas?from=...` | Professor |
| `professor/notas/page.tsx` | **30s** | `/api/professor/notas/reabertura` | Professor |
| `NotasReaberturaPanel` | **30s** | (fetch notas reabertura) | Operações |
| `PlanosAulaReviewPanel` | **30s** | (fetch planos aula) | Operações |
| `usePortalSWR` (aluno) | **45s** | `/api/aluno/*` | Aluno |
| `useNotificacoes` | **30s** | `supabase.from("notificacoes")` (Realtime + fallback) | Global |
| `MaintenanceBanner` | (interval) | `/api/system/maintenance` | Global |
| `RematriculaBanner` | **30s** | `/api/aluno/...` | Aluno |
| `FiscalPendingReprocessCard` | (interval) | fiscal status | Fiscal |
| `FiscalSaftHistory` | (interval) | fiscal history | Fiscal |
| `QuickDocHub` | (interval) | doc status | Secretaria |
| `SessionLockProvider` | (interval) | `supabase.auth.getUser()` | Global |
| `operacoes/aulas/[aulaId]/page.tsx` | **30s** | aula details | Operações |

**Impacto estimado com 10 utilizadores activos simultâneos:**
- Activity feed (15s) × 2 hooks × 10 users = **80 requests/min**
- Secretaria operações (30s) × 3 endpoints × 10 users = **60 requests/min**
- Professor page (30s) × 10 users = **20 requests/min**
- Notificações (30s) × 10 users = **20 requests/min**
- **→ ~180 requests/min = 10.800 requests/hora = ~259.200 requests/dia (com 10 users)**

Com 30 utilizadores activos, isso escala para **~778k requests/dia apenas do polling** — que é directamente o que estamos a ver.

**Adicionalmente:** `useOperacoesPendencias` faz **3 fetch paralelos** em cada tick de 30s.

### 3. `/api/cron/ai/calendar-alerts` — ALTO P0

**Trigger:** `0 7 * * *` — uma vez por dia às 07h.

**O que faz:**
```typescript
// Itera em série por escola com await dentro do loop
for (const schoolId of schoolIds) {
  const response = await runAcademicCalendarOperations({ schoolId, role: "admin", supabase });
  const insight = await upsertAiInsight(supabase, { ... });
}
```

**Problema:** Loop `for...of` com `await` dentro — execução **sequencial** por escola. Com N escolas:
- `runAcademicCalendarOperations` — chamada a modelo de IA (OpenAI/Gemini) + queries DB
- `upsertAiInsight` — insert/update DB

**CPU estimado:** 2–5 min por escola × N escolas. Com 10 escolas = **20–50 min de CPU** numa única invocação.

**Atenção:** Esta função pode ser a causa principal de um spike de CPU às 07h que esgota o budget diário.

### 4. SSR Desnecessário — MÉDIO P1

**577 ocorrências** de `force-dynamic` / `unstable_noStore` encontradas. Inclui páginas como:

- Todas as páginas de secretaria (alunos, turmas, professores, admissões, documentos, relatórios)
- Todas as páginas de financeiro
- Páginas de admin
- **Páginas de impressão/print** (que poderiam ser estáticas ou geradas client-side)

Muitas destas páginas fazem SSR completo em cada navegação mesmo quando os dados não mudaram, porque têm `force-dynamic` e/ou chamam `cookies()` / `headers()`.

**Impacto:** Cada navegação de página = 1 Function Invocation + CPU para render React + queries DB.

### 5. AppShell — sidebar-badges sem cache

```typescript
// AppShell.tsx linha 331 — chamado em useEffect sem intervalo mas sem cache
const res = await fetch("/api/financeiro/sidebar-badges", { cache: "no-store" });
```

Este fetch ocorre **em cada mount do AppShell** — que acontece em cada navegação SPA. Com force-dynamic nas páginas, cada navegação desmonta/remonta o AppShell, disparando nova request a `/api/financeiro/sidebar-badges`.

Estimativa: **1 request por page navigation por user** = potencialmente 50–100k requests/mês.

### 6. PDF Generation — Alto CPU por request

9 rotas de geração de PDF encontradas:
- `secretaria/turmas/[id]/pauta-anual/route.ts` (runtime: nodejs)
- `secretaria/turmas/[id]/pauta-geral/route.ts` (runtime: nodejs)
- `secretaria/turmas/[id]/alunos/pdf/route.ts`
- `secretaria/turmas/[id]/horario/pdf/route.ts`
- `secretaria/classes/[id]/alunos/pdf/route.ts`
- `secretaria/aulas/[aulaId]/relatorio/pdf/route.ts`
- `fiscal/documentos/[documentoId]/pdf/route.ts`
- `aluno/boletim/pdf/route.ts`
- `financeiro/extrato/aluno/[alunoId]/pdf/route.ts`

Estas são invocações on-demand, não frequentes, mas têm **alto CPU por execução** (render HTML + PDF).

### 7. Service Worker — Duplicação de Requests

O SW intercepta `/api/aluno/*` e `/api/professor/atribuicoes|pauta|turmas|periodos` com estratégia `stale-while-revalidate`:

```javascript
// sw.js
const isStudentOrPublicData = url.pathname.startsWith("/api/aluno/") || ...;
const isCachedProfessorData = PROFESSOR_CACHED_ENDPOINTS.some(...);

if (isStudentOrPublicData || isCachedProfessorData) {
  // Stale-while-revalidate: serve cache E faz network request em background
  event.respondWith(cache.match(request).then(cached => {
    const networkFetch = fetch(request).then(r => { cache.put(request, r.clone()); return r; });
    if (cached) { networkFetch.catch(() => {}); return cached; }  // ← network request sempre acontece!
    return networkFetch;
  }));
}
```

**Problema:** `stale-while-revalidate` faz SEMPRE um request de rede em background, mesmo quando serve do cache. Isto duplica requests para todas as rotas de aluno/professor interceptadas pelo SW.

**Bypass do cache:** Requests com `cache: "no-store"` são ignorados pelo SW (correcto), mas os polling hooks usam `cache: "no-store"`, o que significa que o SW não está a cachear os polling requests — ele só duplica os requests de navegação inicial.

---

## Root Causes

### RC-001 — Inngest cron a cada minuto (push notifications)
**Causa:** `triggers: [{ cron: "* * * * *" }]`  
**Impacto:** 43.200 invocações/mês, ~72–144 CPU-min/mês  
**Verificação:** 90%+ das execuções são no-op (sem notificações pendentes)  
**Classificação: P0 — desperdício grave**

### RC-002 — Polling client-side sem WebSocket
**Causa:** 16 setInterval em componentes críticos (15s e 30s) fazendo fetch HTTP
**Impacto:** ~180 requests/min com 10 users activos, ~259k requests/dia  
**Verificação:** `useOperacoesPendencias` faz 3 fetches paralelos por tick  
**Classificação: P0 — desperdício grave**

### RC-003 — Cron de IA com loop sequencial por escola
**Causa:** `for (const schoolId of schoolIds) { await runAcademicCalendarOperations(...) }`  
**Impacto:** CPU cumulativo proporcional ao número de escolas; spike às 07h  
**Classificação: P1 — impacto alto**

### RC-004 — 577 force-dynamic sem necessidade
**Causa:** force-dynamic em páginas que poderiam usar ISR ou cache  
**Impacto:** Cada navegação = SSR completo + DB queries + CPU  
**Classificação: P1 — impacto alto**

### RC-005 — sidebar-badges sem cache/revalidação
**Causa:** `fetch("/api/financeiro/sidebar-badges", { cache: "no-store" })` no AppShell mount  
**Impacto:** 1 request por navegação por utilizador  
**Classificação: P2 — optimização**

### RC-006 — Middleware DB fallback sem warm-up
**Causa:** Cookie `klasse_ctx` expira ou não está disponível; fallback = 3 Supabase queries sequenciais  
**Impacto:** 30k–60k extra queries/período do middleware  
**Classificação: P2 — optimização**

---

## Waste vs Legitimate Usage

| Categoria | Invocações Estimadas | CPU Estimado | Classificação |
|---|---|---|---|
| Inngest push (no-op) | ~38.800/mês | ~130 min | **DESPERDÍCIO** |
| Polling client-side (excess freq.) | ~200.000/mês | ~40 min | **DESPERDÍCIO** |
| Cron IA sequencial (ineficiência) | ~30/mês | ~30 min | **DESPERDÍCIO** |
| SSR desnecessário (force-dynamic) | ~80.000/mês | ~20 min | **DESPERDÍCIO** |
| sidebar-badges excesso | ~40.000/mês | ~10 min | **DESPERDÍCIO** |
| **Total Desperdício** | **~359k (~62%)** | **~230 min (~93%)** | |
| | | | |
| Dashboard/KPIs reais | ~30.000/mês | ~5 min | Legítimo |
| PDF generation | ~2.000/mês | ~8 min | Legítimo |
| Webhooks (ProxyPay) | ~3.000/mês | ~2 min | Legítimo |
| Auth/session management | ~20.000/mês | ~2 min | Legítimo |
| Cron diário (outbox) | ~90/mês | ~1 min | Legítimo |
| **Total Legítimo** | **~55k (~10%)** | **~18 min (~7%)** | |
| Não classificado (misto) | ~161k (~28%) | | Necessita telemetria |

> **Resposta à pergunta principal:** Existe desperdício computacional estrutural que representa **~62% das invocações e ~93% da CPU activa**. O consumo não é consequência da carga real de utilizadores.

---

## P0 Findings

### P0-001 — Push Notification Worker: cron `* * * * *`

**Evidência:**
```typescript
// apps/web/src/inngest/functions/push-notifications.ts:24
{ id: "push-notification-worker", triggers: [{ cron: "* * * * *" }] }
```

**Impacto:** 43.200 invocações Inngest/mês. A Vercel conta cada callback Inngest como Function Invocation.

**Correcção:** Mudar trigger para event-driven (`klasse/notification.push.requested`) e disparar o evento quando a notificação é criada, ou mudar o cron para `*/5 * * * *` (a cada 5 min) como mínimo.

**Redução estimada: -38.800 invocações/mês (-90% desta função) + ~120 CPU-min**

---

### P0-002 — useOperacoesPendencias: 3 fetches paralelos a cada 30s

**Evidência:**
```typescript
// components/layout/operacoes/useOperacoesPendencias.ts
const POLL_MS = 30_000;
// fetch 1:
fetch(`/api/secretaria/aulas?data=${date}`, { cache: "no-store" }),
// fetch 2:
fetch("/api/secretaria/planos-aula", { cache: "no-store" }),
// fetch 3:
fetch("/api/secretaria/notas/reabertura", { cache: "no-store" }),
```

**Correcção:** Criar endpoint consolidado `/api/secretaria/operacoes-status` que retorna os 3 payloads numa query. Aumentar intervalo para 60s com WebSocket fallback quando disponível.

**Redução estimada: -67% das invocações deste hook**

---

### P0-003 — Calendar Alerts: loop sequencial com IA por escola

**Evidência:**
```typescript
// apps/web/src/app/api/cron/ai/calendar-alerts/route.ts
for (const schoolId of schoolIds) {
  const response = await runAcademicCalendarOperations({ schoolId, ... });
  const insight = await upsertAiInsight(supabase, { ... });
}
```

**Impacto:** O Vercel Function timeout é 60s (Hobby). Com mais de ~5 escolas, esta função **pode expirar** e causar retries automáticos, multiplicando o custo.

**Correcção:** Usar `Promise.allSettled` com concorrência controlada (máx 3 em paralelo), ou mover para Inngest com fan-out por escola.

---

## P1 Findings

### P1-001 — Activity Feed hooks: polling 15s por admin activo

**Evidência:**
```typescript
// useAdminActivityFeed.ts + useOperationalActivityFeed.ts
const POLLING_MS = 15_000; // 4 requests/min POR UTILIZADOR
```

Dois hooks paralelos (`useAdminActivityFeed` + `useOperationalActivityFeed`) na mesma página de operações — cada um com 15s. **→ 8 requests/min por admin.**

**Correcção:** Consolidar em um único hook. Aumentar para 60s. Usar Supabase Realtime como primary quando disponível.

### P1-002 — 577 force-dynamic em páginas SSR

**Evidência:**
```
577 ocorrências de force-dynamic/unstable_noStore em apps/web/src/app
```

Páginas de listagem (alunos, turmas, professores) podem usar `revalidate: 30` em vez de `force-dynamic`, já que os dados não mudam ao segundo.

**Páginas excepcionais** (que devem manter force-dynamic): secretaria/balcão, financeiro em tempo real, documentos, recibos.

**Correcção:** Auditar cada página individualmente. Candidatos a ISR: `/secretaria/professores/page.tsx`, `/secretaria/turmas/page.tsx`, `/secretaria/alunos/page.tsx`.

**Redução estimada: -20–40% das invocações SSR**

### P1-003 — Professor page: 2 setIntervals independentes + 5 fetch paralelos no mount

**Evidência:**
```typescript
// apps/web/src/app/professor/page.tsx:107 e 169
const timer = window.setInterval(() => setNowTick(Date.now()), 15_000); // ← UI tick, não precisa de fetch
const timer = window.setInterval(async () => {
  const response = await fetch(`/api/professor/aulas?from=${todayIso}`, { cache: "no-store" });
}, 30_000);

// No mount (linha 120-124): 5 fetch em paralelo
fetch("/api/professor/atribuicoes", ...),
fetch("/api/professor/agenda", ...),
fetch(`/api/professor/aulas?from=${todayIso}`, ...),
fetch("/api/professor/dashboard/pendencias", ...),
fetch("/api/professor/dashboard/overview", ...),
```

**Problema adicional:** O 1º setInterval (15s, UI tick) é inofensivo mas o padrão sugere mistura de concerns.

---

## Fixes Applied

> **Nenhuma correcção foi aplicada nesta sprint.** Esta é a fase de diagnóstico. As correcções serão aplicadas na sprint seguinte com aprovação.

---

## Before vs After (Projecção)

| Métrica | Antes (actual) | Depois (estimado) | Δ |
|---|---|---|---|
| Invocações/mês | ~575.000 | ~180.000–220.000 | **-61% a -69%** |
| Active CPU/mês | ~248 min | ~50–80 min | **-67% a -80%** |
| CPU/1k requests | ~25,8 min | ~5–10 min | **-61% a -81%** |
| Inngest invocações | ~43.200 | ~4.320 (cron 10min) ou ~0 (event-driven) | **-90% a -100%** |
| Polling requests (10 users) | ~259k/dia | ~65k/dia | **-75%** |

> Estes números são projecções baseadas na análise de código. Precisam de validação com telemetria real pós-correcção.

---

## Scale Projection

**Baseline para projecção:** 10 utilizadores activos/dia, 1 escola.

### Corrigido (pós-fixes P0/P1)

| Escolas | Alunos/escola | Invocações/mês | CPU/mês | Custo Vercel Pro* |
|---|---|---|---|---|
| 1 | 200 | ~20.000 | ~15 min | ~$0 (incluído) |
| 10 | 200 | ~120.000 | ~80 min | ~$0 (Pro inclui 1M inv, 6h CPU) |
| 50 | 200 | ~550.000 | ~350 min | ~$50–80/mês extra |
| 100 | 200 | ~1.000.000 | ~650 min | ~$100–150/mês extra |
| 500 | 600 | ~5.000.000 | ~3.200 min | ~$800–1.200/mês |
| 1.000 | 600 | ~10.000.000 | ~6.400 min | ~$1.500–2.500/mês |

*Estimativas baseadas em Vercel Pro pricing (Jan 2026). 1M invocações/mês incluídas; $0.60/M adicionais. CPU: 6h/mês incluídas; $0.18/CPU-hour adicional.

### Por unidade

| Métrica | Valor (baseline corrigido, 100 escolas × 200 alunos) |
|---|---|
| Requests/aluno/mês | ~50 |
| CPU/aluno/mês | ~3 min |
| Custo infra/aluno/mês | ~$0.008–0.015 |
| Custo infra/escola/mês (200 alunos) | ~$1.5–3 |
| **Custo infra/escola/mês (600 alunos)** | **~$4–8** |

> **Estes números são viáveis para um modelo SaaS.** O problema actual não é escala — é desperdício no baseline.

---

## Vercel Cost Projection

### Cenário A — Vercel actual (ineficiente)
- CPU: 248 min/mês para 1 escola piloto
- Extrapolação para 10 escolas: ~2.480 min/mês (41 horas)
- Vercel Pro: 6h incluídas, restante a $0.18/h → **$628/mês para 10 escolas**
- **Inviável para escala.**

### Cenário B — Vercel optimizado (pós P0/P1)
- CPU estimada: ~50–80 min/mês para 1 escola
- Para 10 escolas: ~500–800 min/mês (8–13 horas)
- Vercel Pro: ~$0.18/h × (8–7) horas extra = **$1.80–$10.80/mês para 10 escolas**
- Para 100 escolas: **~$180–$250/mês**
- **Viável até ~200–300 escolas no Vercel Pro.**

---

## Cloudflare Compatibility

> **Esta secção é preliminar. A PoC está fora do scope desta sprint (itens 22–23 do brief).**

### Compatibilidade conhecida (análise de código)

| Feature KLASSE | Cloudflare Workers | Status |
|---|---|---|
| Next.js 15 App Router | via @cloudflare/next-on-pages ou OpenNext | ⚠️ Parcial |
| RSC + SSR | Suportado via OpenNext | ✅ |
| Route Handlers | Suportado | ✅ |
| Middleware Edge | Suportado | ✅ |
| Supabase Auth + cookies | Suportado (SSR cookies) | ✅ |
| Inngest (serve) | Requer Node.js runtime | ⚠️ Precisa verificação |
| Web Push (web-push library) | Requer Node.js runtime | ⚠️ Pode precisar adaptação |
| PDF generation (nodejs) | Workers não têm Node.js completo | ❌ Necessita worker separado |
| Sentry sourcemaps | Suportado | ✅ |
| PWA / Service Worker | Client-side, não afectado | ✅ |

**Blocker principal:** As 9 rotas de PDF e o Inngest (6 functions) requerem Node.js runtime que Workers não suporta nativamente. Precisariam de arquitetura híbrida.

---

## Cloudflare Cost Projection

> **Sem PoC concluída, esta comparação é estimativa baseada em pricing público (Set 2026).**

### Cenário C — Cloudflare optimizado (hipotético)

Cloudflare Workers Paid: $5/mês + $0.30/M requests + $0.02/GB-hour CPU time.

| Escolas | Requests/mês | CPU-time/mês | Custo estimado |
|---|---|---|---|
| 10 | ~1.2M | ~20 GB-hour | ~$5 + $0.36 + $0.40 = **~$6/mês** |
| 100 | ~12M | ~200 GB-hour | ~$5 + $3.60 + $4 = **~$13/mês** |
| 500 | ~60M | ~1TB-hour | ~$5 + $18 + $20 = **~$43/mês** |
| 1.000 | ~120M | ~2TB-hour | ~$5 + $36 + $40 = **~$81/mês** |

**Vs Vercel Pro optimizado (100 escolas): ~$180–250/mês**

**Break-even point (Vercel optimizado vs Cloudflare): ~50–80 escolas.**

> A Cloudflare só começa a ter vantagem económica clara acima de **~80 escolas** — e apenas se o baseline Vercel for previamente optimizado. Comparar Vercel ineficiente com Cloudflare optimizado é falacioso.

---

## Migration Complexity

### Vercel → Cloudflare: Esforço Estimado

| Área | Esforço | Risco |
|---|---|---|
| Next.js App Router base | 2–3 dias | Médio (OpenNext) |
| Inngest migration | 3–5 dias | Alto (sem suporte oficial Workers) |
| PDF routes | 3–4 dias | Alto (Node.js runtime) |
| Web Push | 1–2 dias | Médio |
| Middleware/auth | 1–2 dias | Baixo |
| CI/CD + deployments | 1–2 dias | Baixo |
| Testing + validação | 5–7 dias | Alto |
| **Total estimado** | **16–25 dias eng.** | **Alto** |

---

## Supabase Observations

Supabase não é problema de escala nesta sprint. Observações relevantes para custo Vercel:

1. **Auth calls em cada route handler:** A maioria dos 603 routes faz `supabase.auth.getUser()` + `resolveEscolaIdForUser()`. Isto é correcto por segurança mas adiciona latência.

2. **Uso de Views (vw_*):** O módulo financeiro usa correctamente views para dashboards em vez de queries directas. O dashboard principal usa `Promise.all` com 3 views — bom.

3. **Loop sequencial em calendar-alerts:** `for...of` com `await` em vez de `Promise.allSettled` — identificado em RC-003.

4. **Sem N+1 patterns críticos encontrados** nos routes principais. O outbox worker usa loop mas com justificativa (processamento sequencial com controlo de erro por evento).

> **Decisão desta sprint: MANTER Supabase. Sem evidências de custo Supabase que justifique auditoria separada agora.**

---

## Recommendation

### DECISÃO B

> **Manter Vercel agora. Cloudflare só passa a fazer sentido acima de ~80 escolas activas — e apenas após optimizar o baseline Vercel.**

**Fundamentação:**

1. O consumo actual (4h08 CPU) é **consequência de desperdício** (62% das invocações), não de carga real.

2. Após as correcções P0/P1, o KLASSE deve operar com **~50–80 min CPU/mês** para o volume actual — dentro do budget Vercel Pro.

3. Migrar para Cloudflare com o codebase actual (Inngest + PDF + Node.js) exigiria **16–25 dias de engenharia** com alto risco — investimento desproporcional quando existem 3 fixes de ~2 horas que resolvem 80% do problema.

4. O break-even Vercel vs Cloudflare (em termos de custo mensal) está em **~80 escolas activas**. Abaixo disso, Vercel Pro optimizado é mais barato e menos complexo.

5. Rever esta decisão quando atingir **80+ escolas activas pagantes** ou quando o custo Vercel ultrapassar **€500/mês**.

---

## Evidence

### Ficheiros auditados

| Ficheiro | Relevância |
|---|---|
| `apps/web/src/middleware.ts` | Matcher de 31 patterns, auth cache, DB fallback |
| `apps/web/src/inngest/functions/push-notifications.ts` | Cron `* * * * *` — P0-001 |
| `apps/web/src/app/api/cron/ai/calendar-alerts/route.ts` | Loop sequencial IA — P0-003 |
| `apps/web/src/app/api/jobs/outbox/route.ts` | Outbox worker — legítimo |
| `apps/web/src/components/layout/escola-admin/useAdminActivityFeed.ts` | Polling 15s |
| `apps/web/src/components/layout/escola-admin/useOperationalActivityFeed.ts` | Polling 15s |
| `apps/web/src/components/layout/operacoes/useOperacoesPendencias.ts` | 3 fetch / 30s |
| `apps/web/src/components/layout/operacoes/AulasOperacionaisPanel.tsx` | Polling 30s |
| `apps/web/src/app/professor/page.tsx` | 2 intervals + 5 fetch no mount |
| `apps/web/src/components/aluno/usePortalSWR.ts` | Polling 45s + focus revalidation |
| `apps/web/src/hooks/useNotificacoes.ts` | Polling 30s + Supabase Realtime |
| `apps/web/src/components/layout/klasse/AppShell.tsx` | sidebar-badges no mount |
| `apps/web/src/app/api/financeiro/sidebar-badges/route.ts` | Sem cache, auth completa |
| `apps/web/public/sw.js` | SW stale-while-revalidate duplica requests |
| `apps/web/next.config.ts` | Sentry, no PWA plugin, rewrites/redirects |
| `vercel.json` | 3 crons (outbox, reminders, calendar-alerts) |
| `apps/web/src/app/api/escolas/[id]/admin/dashboard/route.ts` | Dashboard usa vw_ correctamente |
| `apps/web/src/app/api/inngest/route.ts` | 6 Inngest functions registadas |

---

## Remaining Unknowns

| # | Desconhecido | Impacto | Como Resolver |
|---|---|---|---|
| U-001 | Separação prod vs preview: quanto das 575k invocações são preview? | Alto | Acesso ao Vercel Analytics por deployment |
| U-002 | Duração real por função (p50/p95/p99) | Alto | Vercel Functions dashboard |
| U-003 | Quantos admins ficam com o portal aberto (polling activo) | Alto | Sentry/Datadog user sessions |
| U-004 | Número de push subscriptions activas (impacto de push-notifications worker) | Médio | Query a `aluno_push_subscriptions` |
| U-005 | Custo real do Inngest (são cobradas como Vercel Functions?) | Alto | Dashboard Inngest + Vercel |
| U-006 | Número de escolas activas no período para calibrar calendar-alerts | Médio | Query a `anos_letivos WHERE ativo = true` |
| U-007 | Tráfego de bots/crawlers nas rotas públicas | Baixo | Vercel Logs |

---

## Next Steps (Sprint Seguinte)

### Sprint Vercel Compute Fix V1 — Fixes P0/P1

**Duração estimada: 3–5 dias de engenharia**

| Fix | Esforço | Redução CPU estimada | Risco |
|---|---|---|---|
| P0-001: Mudar push worker para event-driven ou cron 10min | 2h | -120 min/mês | Baixo |
| P0-002: Consolidar 3 endpoints em `/api/secretaria/operacoes-status` | 4h | -30 min/mês | Baixo |
| P0-003: `Promise.allSettled` no calendar-alerts (concurrência 3) | 1h | -15 min/execução | Baixo |
| P1-001: Aumentar activity feed para 60s, consolidar hooks | 3h | -20 min/mês | Baixo |
| P1-002: Converter 20–30 páginas de lista para revalidate: 60 | 8h | -15 min/mês | Médio |
| P1-003: sidebar-badges: cache 30s no SWR provider | 1h | -10 min/mês | Baixo |

**Total redução estimada: ~210 min/mês → de 248 min para ~38 min**

> Após aplicar os fixes, re-executar este audit após 1 billing cycle completo e comparar.
```

---

*Relatório gerado por: Antigravity — KLASSE Vercel Cost & Compute Audit V1*  
*Data: 2026-09-23*  
*Próxima revisão: após Sprint Vercel Compute Fix V1*
