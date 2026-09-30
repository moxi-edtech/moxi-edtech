# SPRINT — KLASSE Compute Efficiency & Scale V1

```
prioridade:   P0
executor:     Antigravity
ref:          vercel-cost-audit-v1.md
data:         2026-09-23
```

**Objetivo:** corrigir os desperdícios identificados no Vercel Cost Audit V1 e preparar a camada de aplicação do KLASSE para crescer de poucas escolas para centenas sem crescimento desnecessariamente linear de requests, jobs e CPU.

**Princípio:** não otimizar para caber no plano Hobby. Otimizar para que 1.000 escolas não multipliquem desperdícios que já existem com 1 escola.

> No KLASSE, crescimento de tenants não deve implicar crescimento equivalente de polling, cron global ou trabalho ocioso. Trabalho deve existir porque ocorreu um evento, porque um utilizador solicitou algo ou porque uma regra de negócio exige processamento.

---

## 1. Regras da Sprint

O agente deve trabalhar nesta ordem:

```
medir baseline
↓
eliminar polling desnecessário
↓
transformar processamento em event-driven
↓
eliminar fan-out síncrono
↓
reduzir SSR desnecessário
↓
reduzir chamadas redundantes
↓
instrumentar
↓
testar isolamento multi-tenant
↓
medir novamente
```

**Fora de escopo desta sprint:**

- ❌ Migrar Vercel → Cloudflare
- ❌ Migrar Supabase
- ❌ Trocar Next.js
- ❌ Trocar Inngest
- ❌ Reescrever módulos funcionais
- ❌ Alterar regras de negócio
- ❌ Cachear indiscriminadamente dados tenant-sensitive

A aplicação deve continuar funcionalmente equivalente.

---

## 2. Baseline Obrigatório

Antes de qualquer alteração, registrar em:

```
/docs/audits/compute-scale-v1-before.md
```

Usar métricas reais disponíveis. Registrar:

- Function Invocations
- Fluid Active CPU
- Edge Requests
- requests/min
- requests/session
- requests/page navigation
- top routes
- top jobs
- top polling sources

Onde não houver telemetria real: **`UNKNOWN`**

Não substituir desconhecido por estimativa apresentada como facto.

---

## 3. P0 — Push Notifications Event-Driven

**Problema actual:**

```typescript
triggers: [{ cron: "* * * * *" }]
// consulta permanentemente se existem notificações
```

Eliminar esse desenho.

**Nova arquitectura:**

```
notificação criada
      ↓
commit DB
      ↓
klasse/notification.push.requested
      ↓
Inngest
      ↓
Push Worker
      ↓
subscriptions
      ↓
Web Push
```

O evento deve carregar apenas identificadores necessários:

```json
{
  "notificationId": "...",
  "schoolId": "...",
  "recipientType": "aluno|professor|admin",
  "recipientId": "..."
}
```

Não transportar conteúdo sensível desnecessário no payload do evento.

---

## 4. Idempotência do Push

Event-driven não pode significar:

```
evento duplicado
→ push duplicado
```

Criar mecanismo de idempotência baseado em:

```
notification_id + subscription_endpoint
```

Garantir:

```
1 notificação
1 subscription
1 entrega lógica
```

Retries não podem gerar mensagens duplicadas silenciosamente.

---

## 5. Recovery Job

Não eliminar completamente a capacidade de recuperação.

Criar cron de segurança com frequência conservadora (30–60 minutos):

```
buscar push pendente
com idade > threshold
e ainda não processado
```

Não varrer indiscriminadamente o histórico completo. Aplicar janela temporal.

```
event-driven = caminho normal (99%+ dos casos)
recovery cron = mecanismo de reparação
```

---

## 6. P0 — Remover Polling Agressivo

Inventariar novamente todos os padrões:

- `setInterval`
- `refreshInterval`
- `refetchInterval`
- `router.refresh()`
- `focus` revalidation
- `visibilitychange` revalidation

Para cada caso, classificar:

| Classificação | Definição |
|---|---|
| `REALTIME` | Supabase Realtime adequado |
| `EVENT_DRIVEN` | Evento de negócio disponível |
| `USER_INITIATED` | Só deve ocorrer por acção explícita |
| `LOW_FREQUENCY_POLLING` | Polling aceite, mas reduzido |
| `NECESSARY_POLLING` | Sem alternativa viável |

Não simplesmente transformar `15s → 60s` quando existe alternativa melhor.

---

## 7. Activity Feed

**Estado actual:**

```
useAdminActivityFeed       → polling 15s
useOperationalActivityFeed → polling 15s
(duplicados na mesma página)
```

**Objectivo:** eliminar a duplicação. Criar fonte única:

```typescript
useActivityFeed()
```

**Arquitectura preferencial:**

```
initial fetch
     ↓
Supabase Realtime
     ↓
evento recebido
     ↓
atualização/invalidation local
```

Adicionar safety refresh de baixa frequência (5–10 minutos) com a condição:

```typescript
if (document.visibilityState !== "visible") return;
// quando aba estiver escondida: não fazer polling
```

---

## 8. Operações da Secretaria

**Estado actual:**

```
setInterval 30s
  → GET /api/secretaria/aulas
  → GET /api/secretaria/planos-aula
  → GET /api/secretaria/notas/reabertura
(3 requests independentes a cada 30s)
```

**Objectivo:** criar endpoint consolidado:

```
GET /api/secretaria/operacoes-status
```

Resposta com schema versionado:

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-09-23T20:00:00Z",
  "aulas": { ... },
  "planosAula": { ... },
  "notasReabertura": { ... }
}
```

O backend deve resolver `user`, `school`, `academicYear` e `permissions` internamente. Nunca aceitar `school_id` client-side como autoridade.

---

## 9. Endpoint Agregado ≠ 3 APIs Internas

**Anti-pattern a evitar:**

```
/operacoes-status
   ↓ fetch /aulas
   ↓ fetch /planos
   ↓ fetch /notas
(isso apenas esconde o problema)
```

**Implementação correcta:** criar service layer reutilizável:

```
services/operations/
    getAulasStatus(ctx)
    getLessonPlanStatus(ctx)
    getGradeReopenStatus(ctx)
```

```typescript
// endpoint — autorização resolvida uma única vez antes do Promise.all
const [aulas, planos, notas] = await Promise.all([
  getAulasStatus(ctx),
  getLessonPlanStatus(ctx),
  getGradeReopenStatus(ctx),
]);
```

---

## 10. Professor Dashboard

**Estado actual:** múltiplos fetches paralelos no mount:

```typescript
fetch("/api/professor/atribuicoes")
fetch("/api/professor/agenda")
fetch("/api/professor/aulas?from=...")
fetch("/api/professor/dashboard/pendencias")
fetch("/api/professor/dashboard/overview")
// + 2 setIntervals independentes
```

Auditar dados redundantes entre estes endpoints. Criar contrato de bootstrap se fizer sentido:

```
GET /api/professor/dashboard
→ retorna apenas dados necessários para first paint
```

**Objectivo:**

```
5 requests no mount
↓
1–2 requests
```

Não criar endpoint gigantesco sem limites de payload.

---

## 11. Polling Adaptativo

Para casos onde polling continuar necessário, implementar utilitário comum em vez de cada componente inventar a sua própria estratégia:

| Contexto | Comportamento |
|---|---|
| Aba activa + operação crítica | 30–60s |
| Aba activa + informação normal | 2–5 min |
| Aba escondida (`hidden`) | pausar |
| Offline | pausar |
| Volta online | refresh imediato |
| Volta para aba (`visible`) | refresh imediato |

---

## 12. P0 — Calendar Intelligence Fan-Out

**Anti-pattern actual:**

```typescript
// execução sequencial — não escala
for (const school of schools) {
  await processSchool(school);
}
```

**Não resolver apenas com:**

```typescript
await Promise.all(schools.map(processSchool));
// fan-out descontrolado — também não escala
```

**Arquitectura correcta:**

```
calendar-alerts-dispatch
         ↓
 identifica escolas elegíveis
         ↓
 emite evento por escola
         ↓
┌────────┼────────┐
A        B        C
↓        ↓        ↓
job      job      job
(isolados, retryable, idempotentes)
```

---

## 13. Job por Escola

Evento Inngest:

```
klasse/calendar.evaluate-school
```

Payload mínimo:

```json
{
  "schoolId": "...",
  "asOfDate": "2026-09-23",
  "reason": "scheduled|triggered",
  "correlationId": "..."
}
```

Cada escola deve ser:

- **Isolada** — falha na escola A não bloqueia B, C, D
- **Retryable** — reprocessável sem efeitos colaterais
- **Idempotente** — mesmo evento, mesmo resultado
- **Observável** — logs estruturados com `schoolId` e `correlationId`

---

## 14. Concurrency Control

Configurar concorrência explicitamente no Inngest. Não deixar 500 escolas dispararem 500 chamadas de IA simultaneamente.

```typescript
// exemplo de configuração conservadora inicial
concurrency: {
  limit: 5, // tornar configurável via env
  key: "event.data.schoolId",
}
```

Monitorar:

- Queue latency
- Processing latency
- Provider rate limit errors
- Retries e dead-letter
- Custo AI por escola

---

## 15. Não Executar IA Quando Não Há Motivo

Antes de chamar o LLM, executar pre-check determinístico:

```
Calendar Rules
      ↓
há mudança/contexto relevante?
      ↓
NO → encerra (sem custo AI)
YES
      ↓
AI
```

Exemplos de condições para o pre-check:

- Evento próximo dentro da janela de alerta?
- Pendência existente não resolvida?
- Deadline entrou na janela de risco?
- Dados relevantes mudaram desde o último insight?
- Score de risco alterou?

Só após resposta afirmativa invocar o LLM.

---

## 16. Idempotência Temporal

Criar fingerprint de contexto que impeça gerar o mesmo insight diariamente quando nada mudou:

```typescript
const fingerprint = sha256([
  schoolId,
  ruleId,
  contextDate,
  nextDeadline,
  pendingCount,
  relevantDataVersion,
].join(":"));

// fingerprint igual → SKIP AI → retorna insight existente
```

Campos relevantes devem capturar tudo que pode tornar um insight diferente. Campos irrelevantes (timestamps de consulta, etc.) não devem compor o fingerprint.

---

## 17. P1 — SSR Audit

Não substituir 577 `force-dynamic` automaticamente.

Gerar inventário classificado para cada rota/página:

| Campo | Descrição |
|---|---|
| `route` | Path relativo |
| `reason_for_dynamic` | Por que está como force-dynamic |
| `auth_dependency` | Depende de identidade do user? |
| `tenant_dependency` | Depende de school_id? |
| `academic_year_dependency` | Depende de ano lectivo? |
| `data_volatility` | Muda com que frequência? |
| `cache_safety` | Seguro para cachear? |
| `recommendation` | Acção sugerida |

Classificações possíveis:

| Classificação | Significado |
|---|---|
| `DYNAMIC_REQUIRED` | Dados sensíveis, muda por request |
| `REQUEST_CACHEABLE` | Pode usar `revalidate: N` |
| `ISR_CANDIDATE` | Bom candidato para ISR |
| `CLIENT_FETCH_CANDIDATE` | Melhor fetched client-side |
| `UNKNOWN` | Necessita investigação adicional |

---

## 18. Regra de Cache

Nunca cachear apenas por `pathname` quando o resultado depende de:

- `school` / `organization`
- `user` / `role`
- `academicYear`
- `permissions`

Quando aplicável, a cache key deve considerar o contexto relevante:

```
schoolId + academicYearId + resource + query_params
```

Dados permission-sensitive exigem cuidado adicional — uma entrada de cache não pode vazar para outro tenant.

---

## 19. Isolamento de Ano Lectivo

O KLASSE possui selecção de ano lectivo. O cache nunca pode misturar:

```
escola A / 2026  ≠  escola A / 2025
escola A         ≠  escola B
```

Adicionar testes explícitos que validem este isolamento (ver secção 35).

---

## 20. P1 — AppShell

Auditar remounts do AppShell.

O AppShell não deveria refazer requests de dados globais em cada navegação SPA.

Investigar:

- Layout boundaries e `key` props
- Providers e contextos
- Route transitions do Next.js App Router

Para os seguintes dados, implementar cache/invalidation adequado:

- `sidebar-badges`
- `notifications`
- `school context`
- `academicYear`
- `permissions`

---

## 21. Sidebar Badges

**Eliminar:**

```
navegação
→ mount AppShell
→ fetch badges (no-store)
→ em cada navegação
```

**Implementar:**

```
carregamento inicial
→ client cache com TTL 30–60s
→ invalidação por evento financeiro relevante
→ safety TTL no caso de falha de evento
```

Eventos financeiros relevantes (novo pagamento, nova candidatura) invalidam imediatamente via estado local ou Realtime.

---

## 22. SessionLockProvider

Auditar chamadas repetidas a `supabase.auth.getUser()`.

Não remover validação de segurança. Separar responsabilidades:

```
segurança server-side
≠
UI session awareness
```

O frontend não precisa perguntar continuamente ao servidor algo que o SDK de autenticação já consegue sinalizar via `onAuthStateChange`. Usar o listener do SDK para detectar mudanças de sessão; reservar chamadas ao servidor para validações com consequências de autorização.

---

## 23. Service Worker

Rever estratégia `stale-while-revalidate` por endpoint.

Não aplicar universalmente — `stale-while-revalidate` faz sempre um request de rede em background, mesmo quando serve do cache.

Classificar cada categoria de endpoint:

| Estratégia | Quando usar |
|---|---|
| `CACHE_FIRST` | Assets estáticos, dados raramente alterados |
| `NETWORK_FIRST` | Dados operacionais críticos |
| `STALE_WHILE_REVALIDATE` | Dados que podem ser ligeiramente stale |
| `NETWORK_ONLY` | Dados financeiros, autenticação, operações |
| `OFFLINE_SNAPSHOT` | Listas para uso offline estruturado |

Dados extremamente dinâmicos não devem gerar revalidation invisível desnecessária.

---

## 24. Offline Continua Funcionando

Nenhuma optimização pode quebrar:

- ✅ Lançamento de presença offline
- ✅ Lançamento de notas offline
- ✅ Snapshots de alunos
- ✅ Sync queue
- ✅ PWA manifest e install flow

Executar regressão completa do fluxo:

```
offline → edição → online → sync
```

Não misturar esta sprint com futura implementação de conflict/version handling, salvo regressão necessária.

---

## 25. PDF

Não reescrever PDF nesta sprint.

Instrumentar:

- `document_type`
- `duration` (ms)
- `payload_size` (bytes de input)
- `output_size` (bytes de output)
- `school_id` (sanitizado, sem PII)

Adicionar limites de uso contra geração abusiva:

```
mesmo utilizador
+ mesmo documento
+ mesma versão
→ avaliar reutilização/cache seguro quando aplicável
```

---

## 26. Protecção Contra Thundering Herd

Pensar no cenário:

```
07:00 — 50 escolas começam actividades simultaneamente
→ dashboards
+ badges
+ calendar jobs
+ notifications
+ realtime reconnect
= spike de CPU simultâneo
```

Adicionar quando necessário:

- **Jitter** nos timers de polling e cron fan-out
- **Queue** para jobs de processamento pesado
- **Concurrency limits** explícitos no Inngest
- **Deduplication** para eventos duplicados
- **Exponential backoff** para retries

---

## 27. Backoff

Para chamadas externas (Supabase, AI, WAHA, Web Push, ProxyPay), usar retry controlado:

```
attempt 1
↓ (falha)
delay D₁
↓
attempt 2
↓ (falha)
delay D₂ = D₁ × 2 + jitter
↓
attempt 3
↓ (falha)
dead-letter / estado manual
```

Nunca loop infinito. Configurar `maxAttempts` explicitamente em cada Inngest function.

---

## 28. Request Deduplication

Identificar situações como:

```
Componente A → GET /api/X
Componente B → GET /api/X
Componente C → GET /api/X
(na mesma tela, ao mesmo tempo)
```

Consolidar através de:

| Abordagem | Quando usar |
|---|---|
| Shared provider / context | Dados de layout/shell |
| Query cache (SWR/TanStack) | Dados de feature partilhados |
| Request memoization | Dentro de um mesmo render server |
| Server aggregation | Dados de múltiplas origens |

Escolher a abordagem correcta para cada caso, não aplicar uma universalmente.

---

## 29. Observabilidade por Rota

Criar métricas mínimas estruturadas para operações:

```json
{
  "route": "/api/secretaria/operacoes-status",
  "method": "GET",
  "status": 200,
  "durationMs": 87,
  "requestId": "req_abc123"
}
```

Para operações com contexto de tenant:

```json
{
  "schoolId": "safe-opaque-id",
  "academicYearId": "...",
  "operation": "get-operacoes-status"
}
```

**Nunca registar:** token, password, API key, PII, payload financeiro sensível.

---

## 30. Observabilidade de Jobs

Todo job Inngest deve registar:

```json
{
  "job": "calendar.evaluate-school",
  "schoolId": "...",
  "correlationId": "...",
  "startedAt": "...",
  "finishedAt": "...",
  "durationMs": 1234,
  "attempt": 1,
  "status": "success|failed|skipped",
  "aiInvoked": true,
  "aiSkipReason": null
}
```

Para o campo `aiInvoked: false`, registar sempre `aiSkipReason` para auditar a eficácia do pre-check.

---

## 31. Métricas de Escala (FinOps)

Passar a medir oficialmente:

| Métrica | Unidade |
|---|---|
| `requests_per_active_user` | req/user/dia |
| `requests_per_school` | req/escola/dia |
| `requests_per_student` | req/aluno/dia |
| `cpu_per_1k_requests` | min/1k req |
| `cpu_per_active_school` | min/escola/dia |
| `db_queries_per_request` | queries/req |
| `jobs_per_school` | jobs/escola/dia |
| `ai_calls_per_school` | calls/escola/dia |
| `push_jobs_per_notification` | jobs/notif |

Estas serão as **métricas FinOps oficiais do KLASSE**.

---

## 32. Scale Tests

Depois das correcções, executar testes sintéticos.

| Cenário | Escolas | Utilizadores concorrentes |
|---|---|---|
| S1 | 1 | 10 |
| S2 | 10 | 100 |
| S3 | 50 | 500 |
| S4 | 100 | 1.000 |

Não é necessário criar 100 escolas reais. Fixtures isoladas podem representar tenants.

---

## 33. Workload Realista

Distribuição de carga sugerida nos testes:

| Perfil | % do tráfego |
|---|---|
| Aluno / Encarregado | 35% |
| Professor | 25% |
| Secretaria | 20% |
| Financeiro | 10% |
| Direcção | 5% |
| Outros | 5% |

Simular fluxos reais:

- login → dashboard → listar alunos → abrir turma
- lançar presença → consultar notas
- financeiro → activity feed → notifications

Não testar apenas endpoint vazio.

---

## 34. Acceptance Targets

> Estes números são **objectivos técnicos**, não promessas de infraestrutura.

Com 10 utilizadores activos:

| Métrica | Redução mínima |
|---|---|
| Idle background requests | ≥ 80% |
| Push no-op invocations | ≥ 95% |
| Activity Feed requests | ≥ 70% |
| Secretaria operações requests | ≥ 60% |
| Duplicate fetches | ≥ 80% |

E sem tolerância para:

- ❌ Qualquer regressão funcional
- ❌ Qualquer vazamento cross-tenant
- ❌ Qualquer mistura de ano lectivo

---

## 35. Testes de Segurança (P0)

Obrigatórios. Performance nunca pode enfraquecer RLS ou autorização:

```
escola A cache ≠ escola B cache
escola A realtime ≠ escola B realtime
escola A job ≠ escola B job
anoLetivo A cache ≠ anoLetivo B cache

user sem permissão
→ não pode receber dados cacheados privilegiados
```

Cada um destes deve ser um teste automatizado, não uma verificação manual.

---

## 36. Testes de Reconnect

Simular:

```
100 clients
↓
internet cai
↓
internet volta
```

Garantir que não ocorra thundering herd:

```
100 clients × 5 endpoints = 500 requests simultâneos
```

Verificar que o jitter está activo e que as reconexões são distribuídas.

---

## 37. Falha do Realtime

Simular Supabase Realtime indisponível.

A aplicação deve degradar graciosamente para low-frequency polling (ex: 5 min), e não continuar a tentar reconnect a cada 15 segundos indefinidamente.

```
Realtime UP   → event-driven
Realtime DOWN → polling 5min + indicator (opcional)
Realtime UP   → retoma event-driven automaticamente
```

---

## 38. Falha do Inngest

Simular:

```
evento emitido
→ worker falha
→ retry
→ idempotência garante:
   exactly-once logical effect
   (mesmo que a infra seja at-least-once)
```

Verificar especificamente que push duplicado não ocorre após retry de notificação.

---

## 39. Relatório Final

Criar ao terminar a sprint:

```
/docs/audits/compute-scale-v1-after.md
```

Estrutura obrigatória:

```markdown
# KLASSE Compute & Scale V1 — After

## Executive Summary
## Changes Applied
## Before
## After
## Request Reduction
## CPU Reduction
## Job Reduction
## AI Call Reduction
## Scale Tests
## Failure Tests
## Multi-Tenant Tests
## Remaining Bottlenecks
## Vercel Economics
## Cloudflare Trigger Point
## Recommendation
```

**Quatro números destacados no topo:**

```
BEFORE → AFTER

Function Invocations / sessão:      X → Y
Background Requests / hora / user:  X → Y
Active CPU / 1k requests:           X → Y
AI Calls / escola / dia:            X → Y
```

---

## 40. Não Inventar Economia

Separar claramente em todas as tabelas:

| Label | Significado |
|---|---|
| `MEASURED` | Valor observado com telemetria real |
| `PROJECTED` | Estimativa calculada, não observada |

Toda tabela de impacto deve indicar qual é qual.

Não repetir o erro de transformar estimativa de CPU em consumo observado como facto.

---

## 41. Critério Cloudflare

Esta sprint não decide migração. Ao final, produzir:

| Métrica | Valor |
|---|---|
| Custo actual (Vercel, após fixes) | MEASURED ou PROJECTED |
| Custo / escola activa / mês | PROJECTED |
| Custo / aluno activo / mês | PROJECTED |
| Custo / 1M requests | PROJECTED |

Cloudflare só entra em consideração quando pudermos comparar:

```
mesmo workload
+ mesmo KLASSE
+ mesma carga
→ Vercel vs Cloudflare
```

Não comparar Vercel ineficiente com Cloudflare optimizado.

---

## 42. Definition of Done

A sprint está concluída quando:

- ✅ Push normal é event-driven
- ✅ Cron de recuperação não corre a cada minuto
- ✅ Polling agressivo removido ou consolidado
- ✅ Activity feed possui fonte única (`useActivityFeed`)
- ✅ Polling pausa quando aba está escondida
- ✅ Secretaria não faz 3 requests a cada 30s
- ✅ Professor dashboard reduz round trips no mount
- ✅ Calendar AI usa fan-out por escola via Inngest
- ✅ Concurrency é limitada e configurável
- ✅ AI possui deterministic pre-check antes de invocar LLM
- ✅ Jobs são idempotentes (testado com retry simulado)
- ✅ SSR foi classificado (inventário), não alterado em massa
- ✅ AppShell não refaz requests desnecessários por navegação
- ✅ Service Worker foi auditado e estratégias ajustadas
- ✅ PWA/offline continua funcionando (regressão executada)
- ✅ Métricas foram instrumentadas (estruturadas, sem PII)
- ✅ Isolamento school/year foi testado automaticamente
- ✅ Scale tests foram executados (S1–S4)
- ✅ Relatório before/after existe com distinção MEASURED vs PROJECTED
- ✅ `build` passa
- ✅ `typecheck` passa
- ✅ `tests` passam

---

*Referências:*
*- [vercel-cost-audit-v1.md](../audits/vercel-cost-audit-v1.md) — diagnóstico base desta sprint*
*- [AGENTS.md](../../AGENTS.md) — contrato de engenharia*
