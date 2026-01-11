# Outbox Worker Runbook (Edge Dispatcher)

## Objetivo
Executar o job `/api/jobs/outbox` via Supabase Edge Function com `CRON_SECRET`.

## Pré-requisitos
- `OUTBOX_JOB_URL` (ex.: `https://<app-domain>/api/jobs/outbox`)
- `CRON_SECRET` (ou `OUTBOX_JOB_TOKEN`)

## Deploy da Edge Function
```bash
supabase functions deploy outbox-dispatch
```

## Definir secrets
```bash
supabase secrets set OUTBOX_JOB_URL="https://<app-domain>/api/jobs/outbox"
supabase secrets set CRON_SECRET="<token>"
```

## Agendar execução
No Supabase Dashboard:
1. **Edge Functions** → **outbox-dispatch**
2. **Schedules** → **Add schedule**
3. Cron recomendado: `*/2 * * * *`

## Teste rápido
```bash
curl -X POST "https://<project>.functions.supabase.co/outbox-dispatch" \
  -H "Authorization: Bearer <anon-or-service-key>"
```

## Observabilidade
- Erros de job ficam em `outbox_events.last_error` e status `failed`/`dead`.
- Reprocesso manual: `POST /api/jobs/outbox/retry` com `{ "event_id": "..." }`.
