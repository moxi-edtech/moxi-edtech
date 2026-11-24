# Operações — Dashboard clean (2026-11-24)

- Prioridade: contexto académico, alertas existentes quando relevantes, acompanhamento diário, ações rápidas, indicadores gerais, resumo financeiro, painéis secundários e avisos.
- Ações e contadores existentes preservados; o contador de aulas é rotulado «Aulas por confirmar» porque não contabiliza todas as aulas do dia; Fecho diário continua a abrir a gestão de fechos. Recebimentos e horários mantêm os modais e guardas. Nova matrícula e Nova admissão permanecem acessíveis.
- Contexto compacto mostra bloqueios/exames e permite consultar o evento corrente e o calendário. O resumo de caixa conserva os valores e a decomposição financeira num modal; sem previsão não se mostra percentagem de meta.
- Alterações exclusivamente de apresentação, condicionadas ao modo Operações; sem alteração de APIs, SQL, permissões, polling ou Realtime. O dashboard Secretaria e o modo Administração conservam a composição existente.
- Validação: testes de contrato adicionados; CI e smoke autenticado ainda necessários. Confirmar layout desktop/notebook e acesso por admin/admin_financeiro.

## Revisão pré-merge

- Cards diários e atalhos com densidade compacta opt-in; preservam texto, foco, ações e motivo de bloqueio. Secretaria e Admin mantêm variantes anteriores.
- Um botão «Atualizar painel» coordena o refresh dos dados de servidor e dos contadores; a tentativa local continua disponível em caso de erro. Mantém o polling e Realtime existentes.
- Propinas pendentes passam a usar o estado operacional pendente do ano lectivo activo, com âmbito explícito; o cálculo antigo total menos pagas antecipadas incluía liquidações não antecipadas. Propinas em atraso usam o mesmo read model. Não se afirma um total mensal que a view não fornece.
- Caixa acima do previsto mostra distinção de competência/caixa sem abrir modal. Sem migração, sem consulta adicional e sem mudança de RLS.
- CI da revisão e homologação autenticada ainda pendentes.
