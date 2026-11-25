# Cobrança de folhas de prova — sprint backend

## Estado
Prévia individual e colectiva, somente leitura, integrada na central de impressão existente. Não existe ainda autorização para criar ou liquidar obrigações de folha de prova. Não instalar/activar o código reservado no catálogo até fechar a mutação e os pontos de entrada genéricos. Sem alteração do gerador de impressão, fiscal ou produção.

## Reutilização
- `servicos_escola`: catálogo/preço por escola; código reservado `SERV_FOLHA_PROVA`, emolumento distinto de inscrição em exame.
- `servico_pedidos`: obrigação e snapshot do preço.
- `pagamento_intents`: intenção, confirmação e conciliação existentes.
- `pagamentos` / recibos de serviços: liquidação e emissão existentes; validar o caminho operacional actual, sem activar o motor fiscal.
- `provas_destinatarios`: fonte de elegibilidade nominal, SECURITY INVOKER e RLS (escola, polo, matrícula activa, ano e turma). Não duplicar regras académicas.
- `provas_pedagogicas`: identidade académica, não expor enunciado/questões ao portal financeiro ou ao aluno.

## Prévia disponível na branch
GET /api/escola/{id}/provas/cobranca?prova={uuid}&versao={n}&modo=imprimir&turmas={uuid}&matricula={uuid}&offset=0&limit=1
A consulta colectiva usa o mesmo endpoint, omite matricula e aceita até dez turmas elegíveis. O snapshot opcional da selecção é comparado com a distribuição canónica; divergências retornam 409. A resposta inclui prova, versão, matrícula (se individual), turmas, snapshot, quantidade total de destinatários (não apenas o lote/página), código de serviço, moeda AOA, valor unitário e total estimado em cêntimos ou null e estado do preço. A prévia não reserva nem cria cobrança. Não retorna nomes, conteúdo ou dados de pagamento. Preço não configurado não equivale a gratuito. Não usar a resposta como autorização de pagamento.

Na central de impressão, a acção Consultar cobrança aparece apenas após preparar destinatários nominais. A consulta é explícita e não bloqueia a impressão. O painel apresenta preço unitário e estimativa bruta da selecção, não saldo por liquidar. Mudança de prova, turma, aluno ou snapshot invalida a prévia; a folha genérica não tem cobrança associada.

## Decisões pendentes antes de escrita
1. Unidade comercial: folha por prova e aluno (proposta inicial), ou pacote por aluno/trimestre. Não confundir com número de páginas físicas, cópia ou série alternativa.
2. Moeda: o fluxo existente de serviços usa AOA. Confirmar se o preço é realmente denominado em USD; nesse caso, definir moeda de liquidação, câmbio autorizado, data, arredondamento e snapshot antes de implementar. Não gravar USD em valor_base interpretado como AOA.
3. Isenções: definir política explícita, independente de bolsa de propinas. Não bloquear acesso à avaliação nem impressão pedagógica por dívida.
4. Permissões de geração/liquidação: mapear papéis financeiros existentes; autorização de impressão não é autorização financeira.

## Mutação transaccional (próximo incremento)
- RPC com identidade autenticada, tenant e permissões financeiras verificadas em SQL; preservar RLS de polo e chamar a elegibilidade canónica. Não confiar em aluno, valor, moeda, estado ou lista de destinatários fornecidos pelo cliente.
- Identidade comercial por escola + matrícula + unidade de cobrança estável; se por prova, usar identidade canónica da avaliação (tratar séries alternativas e substituições para não duplicar). Não incluir versão de impressão na chave financeira.
- Inspecionar restrições/políticas de servico_pedidos e pagamento_intents; garantir unicidade no banco e serializar criação concorrente. Reutilizar obrigação activa/paga, inclusive após alteração de preço. Não recriar dívida após reimpressão. Tratar cancelamento/estorno com o fluxo financeiro vigente e histórico preservado.
- Uma transacção deve validar preço positivo, inserir obrigação com contexto mínimo e intenção vinculada, ou devolver as existentes. Não realizar duas escritas REST independentes.
- Validar que o código reservado não possa ser usado pelas rotas genéricas de venda/serviços sem identidade e elegibilidade; restringir acesso directo à alteração de contexto/valor/estado.
- Sem side effects em GET, impressão, aprovação pedagógica ou download. Geração em lote será comando explícito, com prévia e snapshot, limite e processamento idempotente.
- A liquidação existente é a fonte da verdade; transferência pendente não significa pago. Não confiar isoladamente em status granted. Confirmar valor, moeda, vínculo e recibo através do contrato de pagamento actual.
- Configuração de preços e front-end só após os gates transaccionais. Manter o freeze fiscal integral.

## Gate de homologação
- Tenant/polo cruzados, matrícula alheia/inactiva, versão desactualizada, prova não aprovada, turma incompatível, professor sem papel financeiro.
- Preço ausente, zero, negativo, moeda não suportada, preço alterado entre prévia e confirmação.
- Requisições simultâneas, reimpressão, versão/série alternativa, pagamento pendente, liquidado, cancelado ou estornado.
- Cobrança por aluno e por lote sem duplicados; pagamentos/recibos existentes, conciliação e RLS.
- CI, testes SQL autenticados e validação de migração em ambiente isolado antes de merge. Não aplicar em produção neste sprint inicial.
