# Fecho diário da secretaria — auditoria e contrato de produto

Status: draft. Núcleo, API, UI, inbox, cron e PDF codificados; ainda não homologados. Não aplicar em produção ou publicar antes dos gates.

## Evidência (main + consulta somente leitura ao PostgreSQL 17 de produção)

- Secretaria e Financeiro não enviavam Idempotency-Key exigido pela API; aprovação também enviava justificativa nula incompatível com o schema.
- A RPC financeiro_fecho_declarar_e_snapshot está em produção com SECURITY INVOKER, omite operador_id, data_fecho e três valores legados NOT NULL, e usa ON CONFLICT (escola_id, day_key) DO UPDATE. A tabela tem índice único por escola/dia e o contrato legado por operador/dia.
- A RPC declarar_fecho_caixa legada é SECURITY DEFINER e não verifica vínculo/papel explicitamente; não preenche day_key NOT NULL. Aprovação legada recalcula outra fonte e usa outros estados.
- A RPC financeiro_fecho_aprovar não limita a transição ao estado declared. A política fecho_update_unified permite UPDATE a operadores autorizados, inclusive secretaria. Não basta fechar a condição na API.
- O snapshot com SECURITY INVOKER depende da RLS de pagamentos: validar se os totais correspondem à escola inteira ou ao operador. Não misturar escopos.
- audit_logs tem rotina de limpeza de 30 dias ativa no código e função presente no banco. admin_activity_events é uma projeção curada de eventos, não prova de cobertura de toda a operação.
- O tipo de evento de fecho autorizado já existe; não reutilizar esse evento para representar uma declaração ou lembrete.
- A impressão atual é um extrato vivo; não é uma exportação do snapshot histórico operacional.
- As rotas de navegação existentes incluem /secretaria/fecho e Controlo de caixa. Validar rewrites/catch-all e permissões no smoke autenticado.

## UX alvo

Secretaria: dashboard > Expediente de hoje > Fechar expediente; sidebar Fecho diário; consulta de dias anteriores. Admin/direção: dashboard > resumo + notificações > histórico de fechos; filtros por data, estado e operador. Financeiro: conferência do caixa no mesmo workspace, sem exigir novo fecho de expediente. Preservar separação entre declarado, aprovado e divergente. Sem dados ilustrativos na aplicação.

Horário padrão sugerido: 17:00 Africa/Luanda, lembrete 30 minutos antes, configurável por escola/dias de funcionamento. Não enviar lembrete para dia fechado ou não útil. Notificação imediata após commit do fecho, não após a aprovação financeira. Se não fechar, notificar responsável com indicação de atraso. Não fechar automaticamente nem bloquear atendimento; atividades posteriores devem ficar explícitas, em adendo auditado.

## Contrato e gates de homologação

1. Confirmar escopo financeiro escola/dia vs operador/dia e multicampus. Manter o contrato canônico existente escola/dia até decisão explícita; não fazer expansão implícita do escopo de caixa.
2. Corrigir as duas RPCs canônicas e transformar as legadas em adaptadores compatíveis. Persistir colunas legadas coerentes. Authorization por escola e papel a partir de vínculo real; proibir escrita direta autenticada sem quebrar consumidores; transições atômicas, retries devolvendo o snapshot original e não substituindo aprovados. Validar concorrência, pagamentos tardios e snapshot consistente. Não permitir que secretaria aprove o próprio fecho.
3. Criar fecho operacional separado do caixa, transacional e imutável, com resumo por categorias e itens referenciáveis. Capturar somente operações de negócio efetivamente confirmadas; não armazenar tokens, payloads sensíveis, IPs ou consultas/telemetria desnecessárias. Cobertura por operação: matrícula, rematrícula, transferência, desistência/reintegração, alteração cadastral, documentos (pedido, emissão, cancelamento), pagamentos, estornos, bolsas, regularizações e correções académicas efetuadas pela secretaria. Dedupe por evento de negócio/ID e papel do ator no momento da ação. Sem inferir que todos os eventos de auditoria são operações únicas.
4. Reusar inbox notificacoes/eventos com evento dedicado e chave única por fecho e destinatário, fanout somente para vínculos ativos da escola. Outbox/recovery existente; sem novas assinaturas Realtime. Email opcional e sem PII, link autenticado ao relatório. Lembrete via scheduler existente com chave escola/dia/destinatário/tipo. Teste de reenvio e escola A/B.
5. Persistência histórica sem depender da retenção de audit_logs; política de retenção definida antes de homologação. PDF A4 com identidade da escola/KLASSE, data local, operador, estado, resumo, detalhe paginado e adendos. Exportações individual e por intervalo com paginação/lote limitado; RLS/autorização também na exportação.
6. Validação: CI, testes DB em ambiente isolado, smoke autenticado secretaria/admin/admin_financeiro/diretor/admin_secretaria, professor/aluno proibidos, isolamento multi-tenant, fecho sem movimento, erro, divergências por canal com soma líquida zero, dois operadores concorrentes, retry, aprovação simultânea, dias anteriores, fecho tardio, histórico após retenção e exportação sem truncamento.


## Segunda etapa — código enviado à PR #463

- Migrações 20271203005000 (enum) e 20271203005100 (contrato, triggers, RPCs, RLS e cron). Aplicar em ordem exclusivamente num ambiente isolado primeiro.
- Um fecho de caixa e um fecho operacional por escola/data; compatibilidade das assinaturas legadas, campos antigos obrigatórios, locks por escola/dia, replay do snapshot, transição terminal de decisão e proibição de autoaprovação (inclusive admin). Aprovação de um caixa por outro utilizador autorizado. Sem alterações a recibos ou lançamento de propinas.
- Registo operacional append-only de mutações reais em 12 entidades, incluindo matrículas, alunos, candidaturas, pagamentos, pedidos, documentos, mensalidades, notas, lançamentos, estornos, reapreciações e frequências. Não confiar no audit_logs (a política INSERT permite a authenticated criar logs) nem em actor_role informado pelo cliente. Identificar o ator por auth.uid() e vínculo vigente. Rematrícula/bolsa podem envolver múltiplos registos: números representam mutações persistidas, não atendimentos únicos.
- Fecho operacional e caixa separados, acessíveis no mesmo workspace; o fecho operacional não bloqueia atividades posteriores, que ficam como adendos. A declaração financeira permanece imutável. Fecho e notificação à administração na mesma transação, inbox existente, sem nova subscrição Realtime. O PDF indica o estado do caixa na consulta/exportação, não afirma que esse estado existia no momento do fecho operacional.
- Notificação in-app com deep link por perfil, sem email obrigatório. Lembrete opt-in configurável (17h, 30min, dias úteis sugeridos); cron a cada 15min, um por escola/data, sem novo lembrete após fecho; sem segundo alerta de atraso nesta etapa.
- Dashboard e sidebar em Secretaria, Operações e Admin. Histórico por data, preview agregado, paginação de 50, conferência por meio de pagamento, configurações de lembrete. Exportação PDF A4 por dia ou intervalo até 31 dias/10.000 registos, com adendos, identificação, paginação e erro explícito se exceder o limite. Não abre novas abas.
- Histórico operacional a partir da ativação da captura; primeiro dia assinalado como parcial; não fabricar dados retroativos. Não copiar payloads completos nem informações de credenciais.
- Testes de contrato estático e script SQL de privilégios/negação de acesso adicionados; ainda não executados em PostgreSQL 17 isolado.

## Bloqueios de publicação

1. CI final, drift do ledger de migrações, schema real em ambiente descartável e testes autenticados (duas escolas, perfis, concorrência, retries, ausência de movimento, alterações tardias, aprovação/rejeição, notificações, cron, PDF). Revisar os impactos de revogar escrita direta e de unificar as RPCs legadas.
2. Cobertura: confirmar todos os endpoints com service_role/worker, pois auth.uid() pode ser nulo e esses registos não são atribuídos automaticamente. Implementar origem autenticada de negócio nos fluxos faltantes antes de prometer cobertura integral. Confirmar outras tabelas de negócio introduzidas por PRs concorrentes, e semântica dos indicadores de atendimento. Validar impacto de triggers/WAL e locks em importações/lotes. Não extrapolar as contagens por entidade para número de atendimentos.
3. Política para caixa rejeitado (correção com nova versão auditada), pagamentos tardios de outra data e eventual fecho por polo/operador: decisão ainda pendente. Não alterar contrato escola/dia implicitamente.
4. Revisar permissões de navegação por perfil (incluindo diretor e admin_secretaria), dados anteriores à ativação, horários configurados e histórico de notificações. Não aplicar DDL ou fazer deploy sem homologação.
