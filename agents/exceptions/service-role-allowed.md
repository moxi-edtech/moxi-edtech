# Excepções de service role

## EXC-SEC-002-A — `/api/webhooks/proxypay`

regra:       SEC-002
ficheiro:    apps/web/src/app/api/webhooks/proxypay/route.ts
motivo:      Callback não autenticado por sessão; usa service role apenas após validar provider activo e assinatura HMAC X-Signature, para persistir evento na fila.
aprovado_por: Codex
data:        2026-08-26
expira_em:   permanente
