## Liberação de acesso de alunos (secretaria)

1) Aplicar migrations `20260515120000_alunos_acesso.sql` + `20261019107000_outbox_auth_worker.sql` + `20261019109000_request_liberar_acesso.sql` (outbox + RPCs).
2) Env vars: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER`, opcional `TWILIO_SMS_NUMBER`; `RESEND_API_KEY`, `RESEND_FROM_EMAIL`; `CRON_SECRET` ou `OUTBOX_JOB_TOKEN` para o worker protegido.
3) Worker/cron: `/api/jobs/outbox` consome `outbox_events`, gera provisionamento Auth e atualiza `outbox_notificacoes`.
4) Webhook Twilio: apontar para `/api/webhooks/twilio` para atualizar status das mensagens.
5) UI/API: `/secretaria/acesso-alunos` lista pendentes; `/api/secretaria/alunos/sem-acesso`, `/metricas-acesso`, `/liberar-acesso` (idempotente); ativação self-service `/ativar-acesso` → `/api/alunos/ativar-acesso` (código + BI).
6) Segurança: rate limit em `/ativar-acesso`; para e-mails sintéticos, prever reset de senha via secretaria (não por “esqueci minha senha”).
