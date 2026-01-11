# GO_LIVE_CHECKLIST.md — Piloto (3–5 escolas)

✅ KLASSE — GO-LIVE CHECKLIST (PILOTO)

## 🧱 BLOCO A — FUNDAÇÃO (TEM QUE ESTAR 100%)

### A1) Tenant Hard Wall (DB)
- `escola_id` NOT NULL em todas as tabelas core.
- Índices começando por `(escola_id, ...)`.
- Triggers/checks de consistência tenant nas FKs mais críticas (matrícula, pagamentos, notas, frequências).

### A2) RLS (acesso por papel)
- RLS ativo em todas as tabelas core.
- Policies para select/write em `alunos`, `matrículas`, `pagamentos`, `notas/avaliações`, `frequências`.
- Teste manual: usuário A não enxerga dados da escola B.

### A3) Service Role fora do caminho normal
- Nenhuma rota de secretaria usa `SUPABASE_SERVICE_ROLE_KEY`.
- Service role só em: outbox worker, provisionamento auth, jobs.
- Auditar 1x: grep por `service_role` no repo.

## 🔄 BLOCO B — RESILIÊNCIA (ONDE SISTEMAS QUEBRAM)

### B1) Outbox (eventos críticos)
- `outbox_events` com `status`, `attempts`, `max_attempts`, locks e `dedupe_key`.
- Job de requeue funcionando (`pg_cron`).
- Catálogo mínimo de eventos: `AUTH_PROVISION_USER`, `FINANCE_PAYMENT_CONFIRMED`, `MATRICULA_CREATED`, `MATRICULA_TRANSFERRED`.

### B2) Idempotência (dinheiro e auth)
- Pagamento: unique `(escola_id, transacao_id_externo)`.
- Payment Intent com `dedupe_key`.
- Regra: um intent confirmado nunca confirma de novo.

### B3) Cron / Jobs
- `pg_cron` ativo.
- Jobs com histórico (`cron.job_run_details`).
- Alerta simples: job falhou 3x seguidas → log visível.

## 🧾 BLOCO C — AUDITORIA (GF4)

### C1) Audit schema fechado
- `actor_id`, `actor_role`, `action`.
- `entity`, `entity_id`, `before`, `after`.
- `ip`, `user_agent`, `db_role`.

### C2) Cobertura mínima
- Matrícula: create/transfer/cancel.
- Pagamento: confirm/reverse.
- Nota: insert/update.
- Frequência: batch insert.

## ⚙️ BLOCO D — FLUXOS CORE

### D1) Matrícula
- 1 matrícula ativa por aluno/ano/escola.
- Transferência auditada.
- Cancelamento claro (soft delete ou status).

### D2) Pagamentos (piloto)
- Confirmação manual pela secretaria.
- `origem_confirmacao = 'manual' | 'webhook'`.
- Recibo gerado 1x (idempotente).

### D3) Boletim / Notas
- RLS ok.
- View ou função estável pra cálculo.
- Nota editada → audit.

### D4) Frequências
- Chave natural única por partição.
- Índices por `(escola_id, matricula_id, data)`.
- Inserção em lote sem duplicar.

### D5) Candidatura → Matrícula
- Consistência por aluno + ano + escola.
- Status claro (aprovada/rejeitada/convertida).

## 🚀 BLOCO E — PERFORMANCE & UX

### E1) Dashboards
- Materialized Views (sem cálculo ao vivo).
- Refresh via cron.
- UI mostra “Atualizado há X min”.

### E2) Pesquisa Global (KF2)
- Debounce 250–400ms.
- Limit <= 50.
- OrderBy estável.
- Payload mínimo (id + label + type).

## 🩺 BLOCO F — OPERACIONAL

### F1) Diagnostics interno
- Página simples com outbox pendente/falhou, jobs cron, últimos pagamentos.
- Acesso só admin/superadmin.

### F2) Logs & Erros
- Sentry (ou equivalente).
- `escola_id` + `user_id` nos eventos.
- `release/version` tag.

### F3) Backup & rollback
- Backup automático diário (Supabase ok).
- Política clara: não apaga dado no piloto.
