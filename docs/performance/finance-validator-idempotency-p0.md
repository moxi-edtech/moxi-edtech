# P0 — proteção contra liquidações e validações duplicadas

## Causa-raiz

A função canónica `public.validar_pagamento(uuid,boolean,text)`, na migration
`20270605120000_unificar_recebimentos_balcao_portal.sql`, bloqueia a linha
com `FOR UPDATE`, mas não valida se o comprovativo continua em `pending`.
Uma segunda aprovação incrementava novamente `mensalidades.valor_pago_total`;
uma rejeição concorrente podia alterar o estado do mesmo comprovativo.
O mesmo problema existe no ramo de `pagamento_intents`: um serviço já
concedido podia ser cancelado por decisão posterior.

## Correção

A migration `20271015110000_fix_validar_pagamento_idempotency.sql` mantém o
bloqueio por linha, isolamento de escola, validação de papel, emissão de
recibos e a função original. A única alteração são três guardas:

1. Apenas `pagamentos.status='pending'` pode ser aprovado/rejeitado.
2. A mensalidade bloqueada deve ter dívida positiva, e um novo comprovativo
   não pode fazer o saldo exceder o valor previsto; impede cobrança duplicada
   através de **dois comprovativos diferentes**.
3. Apenas `pagamento_intents.status='pending'` pode alterar serviços.
   Comprovativos rejeitados exigem reenvio para regressar ao estado pendente.

O repositório possui migrations com timestamps até outubro de 2027; uma
migration com o timestamp real de outubro de 2026 executaria antes de
`20270605120000` e seria anulada. A versão segue o último timestamp
existente, sem modificar migrations anteriores.

## Provas

O workflow **Finance Validator P0 — Disposable PostgreSQL** executa PostgreSQL
17 descartável, a função SQL real deste PR e três concorrências com duas
conexões independentes: aprovar/rejeitar o mesmo comprovativo, dois
comprovativos para a mesma dívida e aprovar/rejeitar o mesmo serviço.
Exige precisamente um vencedor e estado/valor/recibo coerentes. Outros
testes cobrem segundo clique, rejeição e reenvio, RLS entre duas escolas,
papéis, serviço concedido e recibo único.

O verificador `scripts/ci/verify_finance_validator_function.py` confirma
que o SQL difere da função anterior **somente** nas três guardas, não na
autorização ou na emissão de recibos.

**Limitação:** este workflow testa a função real, mas utiliza tabelas,
emissor fiscal e políticas RLS de *fixture*, não o motor de recibos
completo de produção. A homologação integral com todas as migrations,
sessões Auth HTTP e RLS canónico permanece pendente na PR #213. Dados,
identidades e montantes dos testes são integralmente sintéticos.

**Segurança:** nenhum merge, deploy, mudança direta em produção ou
alteração a grants/policies/funções fiscais nesta PR.
