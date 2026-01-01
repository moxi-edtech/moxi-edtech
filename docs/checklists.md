## Liberação de acesso de alunos (secretaria)

1) Aplicar migration `20260515120000_alunos_acesso.sql` (colunas de acesso em `alunos`, `outbox_notificacoes`, RPC `liberar_acesso_alunos_v2`, realtime outbox).
2) Env vars: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER`, opcional `TWILIO_SMS_NUMBER`; `RESEND_API_KEY`, `RESEND_FROM_EMAIL`; `CRON_SECRET` se usar worker protegido.
3) Worker/cron: consumir `outbox_notificacoes` (status pending), enviar via Twilio (WhatsApp, fallback SMS) ou Resend (email), atualizar status/erro/mensagem_id.
4) Webhook Twilio: apontar para `/api/webhooks/twilio` para atualizar status das mensagens.
5) UI/API: `/secretaria/acesso-alunos` lista pendentes; `/api/secretaria/alunos/sem-acesso`, `/metricas-acesso`, `/liberar-acesso` (idempotente); ativação self-service `/ativar-acesso` → `/api/alunos/ativar-acesso` (código + BI).
6) Segurança: rate limit em `/ativar-acesso`; para e-mails sintéticos, prever reset de senha via secretaria (não por “esqueci minha senha”).
