# Plano de Execução — UX Financeiro e Secretaria

Data: 2026-05-18
Escopo: recibo compacto, classe de exame, pagamento parcial com justificativa e resumo de caixa da secretária.

## Veredito da varredura

A solução deve ser implementada como evolução de fluxos existentes, não como módulo paralelo.

- Já existe recibo compacto em React para impressão, mas ainda está orientado a conteúdo A4-ish com `font-sans`, espaços `p-3` e logo `h-12 w-12`. Deve ser compactado e receber variantes A5/80mm em CSS print em vez de criar outro recibo.
- Já existe fluxo de pagamento rápido da secretaria com valor pré-preenchido pelo saldo da mensalidade e chamada ao endpoint canônico `/api/financeiro/pagamentos/registrar`. O ponto fraco é que a UI e a RPC atual tratam pagamento de balcão como liquidação total, mesmo quando o valor enviado é menor.
- Já existe enum/status `pago_parcial` em `mensalidades` e a UI do balcão já consome saldos com `valor_pago_total`; portanto o trabalho correto é completar a regra no backend/RPC e expor campos obrigatórios no modal, não inventar uma tabela de “pagamentos parciais”.
- Já existe fecho de caixa cego e consulta diária por `created_by`, mas a rota permite escopo global para papel `secretaria` quando `operador_scope=all`. Para “Resumo de Caixa (Hoje)” da secretária, a view/RPC deve ser self-only em nível SQL/RLS, separada dos relatórios de admin/financeiro.
- A geração de mensalidades já está centralizada na RPC `gerar_mensalidades_lote`; a regra “último mês só para classe de exame” deve entrar nessa RPC e no cadastro da turma, não na tela de cobrança.

## 1. Recibo de Pagamento numa página [CONCLUÍDO]

### Estado atual encontrado
- Implementado e em uso.
- O sistema já emite recibos em duas vias (Secretaria/Aluno) otimizados para o fluxo atual.
- `ReciboPagamentoCompacto` e `ReciboImprimivel` integrados com a emissão fiscal.

### Plano de execução

1. Tornar `ReciboPagamentoCompacto` a única fonte de layout de recibo impresso.
2. Adicionar variantes por prop: `paper="a5" | "thermal80"`, com default `a5`.
3. Aplicar `font-mono`/Geist Mono nas tabelas, valores, ID público, referência, método, datas e totais.
4. Reduzir ruído visual:
   - logo de `h-12 w-12` para `h-8 w-8` no A5 e máximo `h-7 w-7` no 80mm;
   - `p-3` para `p-2`, `gap-3` para `gap-2`, `space-y-3` para `space-y-2`;
   - título `text-sm`/`text-xs`, valor `text-base`/`text-sm`.
5. Adicionar CSS print global em `globals.css` ou classe local:
   - ` @apps/web/src/app/escola/[id]/(portal)/financeiro/page.tsx { size: A5 portrait; margin: 6mm; }` para A5;
   - classe `.receipt-print` com `break-inside: avoid; page-break-inside: avoid;`;
   - tabela/itens com `break-inside: avoid`.
6. Não introduzir ` @react-pdf/renderer` para este caso enquanto a impressão DOM já existir; só usar renderer se houver requisito de download PDF determinístico servidor-side.

### Critérios de aceite

- Recibo A5 imprime em uma página com escola, aluno, referência, método, data, valor, QR/ID e assinatura.
- Variante 80mm não deve depender de grids largas; deve usar stack vertical.
- Snapshot visual manual no browser depois da mudança, porque é mudança perceptível de UI.

## 2. Apenas Classes de Exame pagam o último mês [CONCLUÍDO]

### Estado atual encontrado
- Implementado em 2026-05-18.
- Coluna `is_classe_exame` adicionada à tabela `turmas`.
- RPC `gerar_mensalidades_lote` atualizada para detectar o mês final (via `anos_letivos.data_fim`) e filtrar turmas não-exame.
- `TurmaForm` e `saveAndValidateTurma` atualizados para suportar e sugerir o flag (auto-on para 9ª e 12ª).

### Plano de execução

1. Criar migration pequena e reversível:
   - `ALTER TABLE public.turmas ADD COLUMN IF NOT EXISTS is_classe_exame boolean NOT NULL DEFAULT false;`
   - índice parcial opcional: `(escola_id, ano_letivo, is_classe_exame) WHERE is_classe_exame = true`.
2. Atualizar tipos `TurmaItem` e payload `ValidateTurmaPayload` com `is_classe_exame`.
3. UI em `TurmaForm`:
   - adicionar switch em “Definição Financeira”: **Classe de Exame (cobra mês final)**;
   - auto-sugerir ligado para 6ª, 9ª e 12ª classe, mas permitir override manual;
   - texto direto: “Se desligado, o motor não gera a mensalidade do mês final para esta turma.”
4. Atualizar `saveAndValidateTurma` e API de turmas para persistir `is_classe_exame`.
5. Atualizar `gerar_mensalidades_lote`:
   - aceitar configuração do mês final por escola/ano letivo se existir; se não existir, começar com constante documentada por país/calendário escolar;
   - quando `p_mes_referencia` for o mês final, gerar apenas para `t.is_classe_exame = true`;
   - se `p_turma_id` for passado e a turma não for exame, retornar `{ geradas: 0, skipped_final_month: true }`.
6. Criar testes SQL ou teste de integração de RPC:
   - turma normal não gera último mês;
   - 9ª/12ª com flag ativa gera;
   - override desligado em 9ª/12ª não gera;
   - idempotência preservada.

### Critérios de aceite

- Secretária não decide cobrança do último mês no balcão.
- A regra vive na geração automática e não em filtros de UI.
- O campo é auditável por turma.

## 3. Pagamentos Parciais + Justificativa Obrigatória [CONCLUÍDO]

### Estado atual encontrado
- Implementado em 2026-05-18.
- RPC `registrar_pagamento` evoluída para suportar `p_valor_pago` e `p_promessa_liquidacao`, com atualização cumulativa de `valor_pago_total` e status `pago_parcial`.
- RPC `financeiro_registrar_pagamento_secretaria` validando campos obrigatórios no `p_meta` para pagamentos parciais.
- `ModalPagamentoRapido` atualizado com campos de justificativa, promessa e exibição de saldo devedor.
- Recibo impresso agora reflete o valor efetivamente pago.


### Plano de execução

1. Evoluir `registrar_pagamento` para receber valor pago real:
   - preferível criar nova assinatura `registrar_pagamento(p_mensalidade_id, p_metodo_pagamento, p_observacao, p_valor_pago, p_promessa_liquidacao)` mantendo wrapper antigo para compatibilidade;
   - usar `FOR UPDATE` como já existe;
   - calcular `novo_total = valor_pago_total + p_valor_pago`;
   - se `novo_total < valor_previsto`, status `pago_parcial`; senão `pago`.
2. Evoluir `financeiro_registrar_pagamento_secretaria`:
   - validar `p_valor <= saldo_pendente`;
   - exigir `meta.partial_reason` e `meta.promise_date` quando `p_valor < saldo_pendente`;
   - gravar esses campos em `pagamentos.meta` e `audit_logs.details`.
3. UI em `ModalPagamentoRapido`:
   - trocar regra `trocoValido` por `valorValido`;
   - permitir `0 < valor < valorDevido`;
   - quando parcial, exibir bloco `bg-amber-50 border-amber-200` com textarea “Justificativa” e date picker “Data de Promessa”;
   - botão desativado sem esses campos;
   - resumo deve mostrar `Saldo restante` em amarelo.
4. Ajustar recibo pós-pagamento para imprimir o valor efetivamente recebido, não o valor total da mensalidade.
5. Atualizar badges/status:
   - `PAGO PARCIALMENTE` amarelo para status `pago_parcial`;
   - manter pendente/atrasada para saldo aberto sem pagamento parcial.
6. Testes mínimos:
   - pagamento parcial de 15.000 numa mensalidade de 25.000 deixa `valor_pago_total=15000`, `status=pago_parcial`, saldo 10.000;
   - segundo pagamento de 10.000 fecha como `pago`;
   - parcial sem justificativa/data retorna 400;
   - tentativa de pagar acima do saldo retorna 400/erro SQL.

### Critérios de aceite

- O recibo fiscal/operacional mostra só o valor recebido.
- A fatura/mensalidade continua aberta com saldo devedor.
- Justificativa e promessa ficam no pagamento e em auditoria.

## 4. Resumo de Caixa (Hoje) da Secretária [CONCLUÍDO]

### Estado atual encontrado
- Implementado em 2026-05-18.
- RPC `get_secretaria_caixa_hoje` fornece KPIs diários self-only para o operador autenticado.
- Endpoint `/api/secretaria/balcao/resumo-caixa` expõe os dados de forma segura.
- Interface do balcão agora exibe cards de "Cobrado Hoje (Por Mim)", "Recibos Emitidos" e "Pagamentos Parciais".

### Plano de execução

1. Criar SQL self-only para caixa da secretária:
   - view `public.vw_secretaria_caixa_hoje_self` com `WHERE p.created_by = auth.uid() AND p.day_key = CURRENT_DATE AND p.status = 'settled'`;
   - `security_invoker=true` ou RPC `SECURITY INVOKER` para respeitar RLS;
   - colunas: `escola_id`, `operador_id`, `cobrado_hoje`, `recibos_emitidos`, `pagamentos_parciais_registados`, breakdown por método.
2. Criar endpoint específico:
   - `/api/secretaria/balcao/resumo-caixa/route.ts`;
   - `dynamic = 'force-dynamic'` e `cache: no-store`;
   - sem parâmetro `operador_scope`.
3. UI:
   - cards pequenos no topo do balcão/secretaria com título **Resumo de Caixa (Hoje)**;
   - cards: “Cobrado Hoje (Por Mim)”, “Recibos Emitidos”, “Pagamentos Parciais Registados”;
   - não usar “Desempenho Financeiro”.
4. Endurecer fecho existente:
   - bloquear `operador_scope=all` para papel `secretaria` no backend;
   - admins/financeiro podem continuar a usar visão global em rota de financeiro/admin, não na rota de secretaria.
5. Revisar RLS de `fecho_caixa`:
   - `secretaria`: `operador_id = auth.uid()`;
   - `financeiro/admin`: visão por escola.

### Critérios de aceite

- Secretária não consegue obter total global via UI nem via endpoint de secretaria.
- Tentativa com Postman não deve aceitar `operador_scope=all` para papel `secretaria`.
- Admin/financeiro mantém relatórios globais em rotas próprias.

## Sequência recomendada de implementação

1. **Backend pagamento parcial primeiro**: é o maior risco financeiro e evita recibo/fatura inconsistentes.
2. **UI pagamento parcial**: depende da regra backend.
3. **Recibo compacto**: baixo risco e independente, mas deve imprimir valor real pago.
4. **Classe de exame**: requer migration + alteração de RPC de faturação; fazer com testes SQL.
5. **Resumo de Caixa self-only**: view/RPC + endpoint + cards; depois endurecer `operador_scope`.

## Pontos de atenção céticos

- Não chamar “classe de exame” automaticamente só por nome da classe. A sugestão 9ª/12ª é boa, mas o dado persistido precisa ser explícito para escolas com calendários diferentes.
- Não resolver pagamento parcial apenas no frontend. Sem validação na RPC, qualquer pessoa com request manual consegue pagar parcial sem justificativa.
- Não dar à secretária endpoint com parâmetro de escopo. Se o parâmetro existe, alguém vai tentar usá-lo.
- Não criar novo modelo de recibo se o componente compacto já existe. A dívida técnica aqui é padronizar e parametrizar, não duplicar.
