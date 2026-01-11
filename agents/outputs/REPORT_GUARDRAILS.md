# REPORT_GUARDRAILS.md — G0–G3 + Fluxos

## Visão Geral

- Ambiente: Supabase (DB remoto)
- Data: 2026-01-11
- Escopo: G0–G3 + 5 fluxos críticos

## Tabelas Relevantes (DDL resumido)

### `public.pagamentos`

```
id uuid pk
escola_id uuid not null
mensalidade_id uuid null
valor_pago numeric(10,2) not null
data_pagamento date
conciliado boolean
transacao_id_externo text
metodo_pagamento text
metodo text
referencia text
status text
created_at timestamptz
```

### `public.mensalidades`

```
id uuid pk
escola_id uuid
aluno_id uuid not null
valor_previsto numeric(14,2)
valor_pago_total numeric(14,2)
status text
data_pagamento_efetiva date
```

### `public.finance_payment_intents`

```
id uuid pk
escola_id uuid not null
aluno_id uuid null
mensalidade_id uuid null
amount numeric(14,2) not null
currency text
method text
external_ref text
proof_url text
status text
confirmed_at timestamptz
confirmed_by uuid
dedupe_key text not null
created_at timestamptz
```

### `public.outbox_events`

```
id uuid pk
escola_id uuid not null
event_type text not null
dedupe_key text
idempotency_key text not null
payload jsonb not null
status outbox_status not null
attempts int not null
max_attempts int not null
next_attempt_at timestamptz not null
locked_at timestamptz
locked_by text
created_at timestamptz not null
processed_at timestamptz
last_error text
```

### `public.audit_logs`

```
id bigint pk
escola_id uuid
actor_id uuid
actor_role text
user_id uuid
portal text
action text
entity text
entity_id text
before jsonb
after jsonb
details jsonb
ip text
user_agent text
created_at timestamptz
```

### `public.frequencias` (particionada)

```
id uuid pk
escola_id uuid not null
matricula_id uuid not null
routine_id uuid
curso_oferta_id uuid
data date
aula_id uuid
status text
```

## Scores por Guardrail (0–100%)

### G0 — Tenant Hard Wall: **90%**
- ✅ `escola_id` NOT NULL em tabelas core (aplicado em `alunos`, `pagamentos`).
- ✅ Índices começando por `escola_id` presentes nas principais tabelas.
- ✅ Triggers de consistência tenant adicionados em `matriculas` e `pagamentos`.
- ⚠️ Ainda não existe enforcement explícito para todas as FKs cross-tenant (ex.: `turma_disciplinas`, `atribuicoes_prof` dependem de triggers existentes).

**Evidências**
- `information_schema.columns` para `escola_id` (core tables).
- `pg_indexes` com prefixo `(escola_id, ...)`.
- Triggers `trg_matriculas_tenant_consistency` e `trg_pagamentos_tenant_consistency`.

### G1 — Service Role: **100%**
- ✅ `service_role` restrito a jobs/worker e edge functions.
- ✅ Rotas secretaria/financeiro continuam usando client do usuário + RLS.

**Evidências**
- Uso de `supabaseServer()` nas rotas de aplicação.
- `supabase/functions/outbox-worker` e `apps/web/src/app/api/jobs/outbox` usam service role.

### G2 — Idempotência + Outbox: **85%**
- ✅ `outbox_events` com status, locks e dedupe.
- ✅ `enqueue_outbox_event` corrigido para dedupe por `event_type + dedupe_key`.
- ✅ `ux_pagamentos_escola_transacao` garante idempotência em pagamentos externos.
- ⚠️ Cobertura de eventos mínimos ainda parcial (ex.: não há eventos explícitos para e-mail/SMS, ou política explícita de dead-letter).

**Evidências**
- `outbox_events` com `status`, `locked_at`, `locked_by`, `next_attempt_at`.
- Índice `ux_outbox_dedupe` e `dedupe_key` em texto.
- Índice `ux_pagamentos_escola_transacao`.

### G3 — pg_cron: **95%**
- ✅ Jobs ativos e rodando.
- ✅ `outbox_requeue_stuck()` recriado (cron `outbox_requeue_stuck` estabilizado).
- ✅ `cron.job_run_details` ativo (observabilidade disponível).

**Evidências**
- `cron.job` com `process_outbox_batch_finance`, `outbox_release_stuck_processing`.
- `cron.job_run_details` com execuções recentes bem-sucedidas.

## Fluxos Críticos

### 1) Matrícula — 1 ativa por aluno/ano/escola: **PASS**
- Query não encontrou duplicados para `status = 'ativa'`.

### 2) Pagamentos — idempotência real: **PASS**
- Unique `(escola_id, transacao_id_externo)` aplicado.

### 3) Notas/Boletim — cobertura e RLS: **PASS**
- RLS policies criadas para `notas` e `avaliacoes` (select/insert/update/delete).

### 4) Frequências — duplicação por chave natural: **PASS**
- Unique key por partição criada em todas as `frequencias_*`.

### 5) Candidatura → matrícula — consistência: **PASS**
- Join por `escola_id`, `aluno_id`, `ano_letivo` retorna consistência.

## Correções Aplicadas (SQL)

- `alunos.escola_id` e `pagamentos.escola_id` → `NOT NULL`.
- Índice `idx_presencas_escola_data`.
- Índice idempotência `ux_pagamentos_escola_transacao`.
- Unique key em todas as partições de `frequencias`.
- Triggers de consistência tenant em `matriculas` e `pagamentos`.
- `outbox_requeue_stuck()` recriado + dedupe fix (`outbox_events.dedupe_key` → text).
- Policies completas em `notas` e `avaliacoes`.

## Pendências Recomendada

- Expandir enforcement tenant para outras tabelas sensíveis com FKs cruzadas.
- Definir catálogo de eventos mínimos de outbox e backlog/diagnostics UI.

## Arquivos Operacionais

- `agents/outputs/GO_LIVE_CHECKLIST.md`
