## Liberação de acesso de alunos (secretaria)

1) Aplicar migrations `20260515120000_alunos_acesso.sql` + `20261019107000_outbox_auth_worker.sql` + `20261019109000_request_liberar_acesso.sql` (outbox + RPCs).
2) Env vars: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`; `CRON_SECRET` ou `OUTBOX_JOB_TOKEN` + `OUTBOX_JOB_URL` para o worker protegido.
3) Worker/cron: Edge Function `outbox-dispatch` chama `/api/jobs/outbox` (POST com `x-job-token`). Agende via Supabase Edge Scheduled Function.
4) Runbook: `docs/outbox-worker-runbook.md`.
4) Validar envio de e-mails via `/api/jobs/outbox` e logs do worker.
5) UI/API: `/secretaria/acesso-alunos` lista pendentes; `/api/secretaria/alunos/sem-acesso`, `/metricas-acesso`, `/liberar-acesso` (idempotente); ativação self-service `/ativar-acesso` → `/api/alunos/ativar-acesso` (código + BI).
6) Segurança: rate limit em `/ativar-acesso`; para e-mails sintéticos, prever reset de senha via secretaria (não por “esqueci minha senha”).
