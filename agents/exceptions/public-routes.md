# Rotas públicas documentadas

## EXC-SEC-001-B — `/api/onboarding`

regra:       SEC-001
ficheiro:    apps/web/src/app/api/onboarding/route.ts
motivo:      Endpoint público de entrada de onboarding escolar; não há utilizador autenticado nem `escola_id` resolvível antes da criação do pedido.
aprovado_por: Codex
data:        2026-07-13
expira_em:   permanente

Controles aplicados:

- A rota aceita apenas `POST`.
- O payload é normalizado no servidor antes de gravar.
- O pedido fica com `status = pendente`, sem provisionar escola.
- A origem é marcada em `financeiro.onboarding_source = public_form`.
- Dados comerciais mínimos são gravados como rascunho para alinhamento com o CRM.
