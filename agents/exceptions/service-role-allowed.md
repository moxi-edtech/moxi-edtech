# Excepções de service role

## EXC-SEC-002-A — `/api/webhooks/proxypay`

regra:       SEC-002
ficheiro:    apps/web/src/app/api/webhooks/proxypay/route.ts
motivo:      Callback não autenticado por sessão; usa service role apenas após validar provider activo e assinatura HMAC X-Signature, para persistir evento na fila.
aprovado_por: Codex
data:        2026-08-26
expira_em:   permanente

## EXC-SEC-002-A — `/api/webhooks/appypay`

regra:       SEC-002
ficheiro:    apps/web/src/app/api/webhooks/appypay/route.ts
motivo:      Callback de máquina autorizado para a integração AppyPay. Service role fica no servidor; escola/provedor vêm da configuração privada; consultas são tenant-scoped e a baixa exige GET autenticado da cobrança, correspondência de identificadores/valor e RPC existente com intent idempotente. Nenhum segredo é devolvido ou persistido em config da tabela.
aprovado_por: gundja (solicitação de integração e webhook nesta conversa)
data:        2026-10-28
expira_em:   permanente
