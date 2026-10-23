# P0 — validação financeira idempotente sobre a implementação de produção

## Fonte da verdade

A base é o esquema **efetivamente instalado no Supabase**, não a função histórica
de `20270605120000_unificar_recebimentos_balcao_portal.sql`. Consulta de leitura
em 23/10/2026: 632 migrations aplicadas; a correção `20271015110000` ainda não
estava aplicada. Assinaturas verificadas via `md5(pg_get_functiondef(...))`:

- `validar_pagamento(uuid,boolean,text)`: `74696d60970bed3361b17ba712725398`.
- `financeiro_aplicar_pagamento_existente(uuid,uuid)`: `9f4e1e0e785828c5b354056a428f38f5`.

O mecanismo instalado já faz `FOR UPDATE` na linha de pagamentos, rejeita
transições inválidas, controla o saldo da mensalidade e impede alocações
financeiras/fiscais repetidas por comprovativo. Não deve ser substituído
pela lógica antiga, que somava diretamente `mensalidades.valor_pago_total`.

## Falha que continuava presente

Na ramificação de `pagamento_intents`, uma segunda rejeição podia reescrever
a decisão; mais grave, uma rejeição posterior a `settled` podia cancelar
um serviço já concedido. Um comprovativo `failed` também podia voltar
a `settled` sem novo ciclo de análise.

## Correção cirúrgica

`20271015110000_fix_validar_pagamento_idempotency.sql` deriva da função
real instalada e introduz **apenas duas guardas na ramificação de serviços**:

1. Rejeitar um intent `failed` pela segunda vez é idempotente;
   rejeitar outros estados diferentes de `pending` é proibido.
2. Aprovar um intent só é permitido em `pending`, com replay
   idempotente quando já está `settled`.

O restante da função — isolamento de escola, papéis autorizados, pagamentos
de mensalidades, idempotência financeira, alocações fiscais, lançamentos e
auditoria — permanece **inalterado**. Uma guarda SQL verifica o hash da
função real antes de executar a migração, abortando perante drift no banco.
Em caso de drift, inspecionar e reconciliar o código; não desabilitar a
guarda para fazer o CI passar.

O timestamp `20271015110000` segue a numeração já existente no histórico
do repositório. Escolher timestamp inferior às migrations efetivas mais
recentes poderia fazer uma definição posterior sobrepor a correção.

## Testes

O workflow **Finance Validator P0 — Disposable PostgreSQL** inicia PostgreSQL
17 descartável e testa **as duas funções SQL reais** (`validar_pagamento`
e `financeiro_aplicar_pagamento_existente`) extraídas da produção,
com hashes verificados. O esquema sintético reproduz as colunas,
enums e restrições relevantes do motor financeiro, mas **não é
uma cópia integral do esquema de produção**.

Os testes cobrem validação/repetição, transições inválidas, escola e papel,
duas sessões concorrentes sobre o mesmo comprovativo, dois comprovativos
concorrentes para uma mensalidade, concorrência aprovação/rejeição do serviço,
uma única alocação, decomposição fiscal FT em bruto/líquido/imposto,
escrita única no `audit_logs` e atualização do lançamento mensal.

As policies RLS dos contratos sintéticos testam o isolamento por escola;
**não reproduzem todas as políticas reais, Auth HTTP ou triggers de produção**.
A homologação integral com o snapshot completo de esquema e RLS do Supabase
continua uma etapa separada para a PR #213.

Os IDs, escola, fatura e valores são inteiramente artificiais; nenhum dado
pessoal ou URL de conexão à produção está versionado.

## Regras de publicação

- Não executar a migração em produção sem conferir novamente o fingerprint.
- Não contornar a guarda de versão nem editar migrations históricas aplicadas.
- Publicar somente após validação integrada do esquema e plano de rollback.
- Este PR não altera concessões `GRANT`, políticas RLS ou motor fiscal.
