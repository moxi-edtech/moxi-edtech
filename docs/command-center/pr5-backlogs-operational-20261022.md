# Command Center — P1/P2: pesquisa operacional, acções, exportação e evidência

**Data:** 22/10/2026 · **Entrega:** [PR #243](https://github.com/moxi-edtech/moxi-edtech/pull/243) (draft, empilhada sobre #241). **Sem merge, deploy ou migrações aplicadas.** CC-001/replay histórico é uma frente paralela do proprietário e está fora desta intervenção.

## Fontes de domínio confirmadas no Supabase (leitura de metadados, sem consultar dados de alunos)

| Indicador de Turma/Classe | Fonte e regra exactas | O que NÃO representa |
| --- | --- | --- |
| Documentos sinalizados | O último evento de `candidaturas_status_log` da candidatura do aluno no ano e escola tem `metadata.tipo='DOCUMENTOS_PENDENTES'`. Eventos posteriores que resolvam a pendência retiram o sinal. | Ausência presumida de BI ou outro documento obrigatório por escola; um evento antigo que já foi resolvido |
| Propinas vencidas | `mensalidades` da matrícula/ano e escola, data de vencimento anterior ao dia da consulta, estado não cancelado/anulado/isento e `greatest(valor_previsto - valor_pago_total,0) > 0`. | Comprovativo em análise, mensalidade cancelada, pagamento aprovado sem liquidação, saldo ainda não vencido |
| Prioridade operacional | Soma dos dois indicadores (0, 1 ou 2), ordenação descrescente e desempate por nome normalizado + UUID antes do limite SQL. | Uma decisão financeira automática, ranking académico ou pontuação de risco |
| Matrícula incompleta | **Ainda sem filtro:** matrículas activas não autorizam inferir estados de candidaturas, RAA condicional, recurso ou extraordinária. | Um cálculo heurístico de matrícula pendente |

**Âmbito:** apenas matrículas activas do ano aberto. Fora da escola, polo sem vínculo canónico, histórico não homologado ou perfis negados: **falha fechada**.

## Implementação

- Migration nova `20271022133000_command_center_operational_roster_v1.sql`: RPC `SECURITY INVOKER`, índice documental/financeiro, pesquisa filtrada antes de `LIMIT`, total filtrado e cursor estável que inclui a prioridade. As RPC anteriores ficam intocadas.
- Limitação partilhada de 30 chamadas/minuto por utilizador/escola reutilizando `public.check_public_rate_limit` e a tabela existente `public.public_rate_limits`; helper restrito autentica o próprio utilizador e vínculo à escola. **Uma única chamada PostgREST por página**; a recusa devolve linha sentinela para não reverter a contagem do limitador.
- Turma e Classe: pesquisa, filtros documentais/financeiros, ordenar por prioridade, paginação contínua, estado preservado ao voltar ao explorador. Os marcadores não revelam montantes.
- Seis acções directas provenientes de `action-registry.ts` e do Balcão existente: matrícula (independente do aluno), rematrícula, pagamento, documento, perfil e nota. Capabilities consultadas só depois de expandir a linha, através do papel escolar e da matriz `permissions.ts`. **A interface não substitui a autorização do módulo de destino.**
- Exportação CSV: confirmação explícita, allowlist de perfis e limite por escola, falha fechada sem configuração, rejeição de fórmulas, apenas nome/processo/turma; cardinalidade verificada **antes** do download, auditoria persistida **antes** de libertar o CSV, sem guardar o termo de pesquisa. Registo com actor/escola/entidade/quantidade/filtro/ordenação/finalidade, sem nomes de menores.
- Componentes visuais reutilizáveis e navegação por teclado, 5 dimensões de tela × 3 escalas de fixture, estado de erro, vazio, carregamento, retorno do Balcão, lotação 55/50, filtros e acções. As capturas usam **somente dados ficcionais**.

## Testes e reprovação segura

Workflow: `Command Center Operational Backlogs`. Em PostgreSQL 17 **descartável**, a fixture cria 55 alunos na Escola A e um na Escola B, duas sinalizações documentais, duas dívidas realmente vencidas, um documento resolvido, uma mensalidade liquidada e outra cancelada. Confere 20/20/15, prioridade, cursor sem omissões/duplicações, recusa por escola, contador partilhado com 31.ª chamada bloqueada, e captura `EXPLAIN (ANALYZE,BUFFERS)`.

Os workflows de contratos, visual e regressão do Command Center continuam obrigatórios. O resultado final de CI deve ser associado ao **HEAD real da PR** após o último commit.

## Gatilhos necessários antes de permitir produção

1. **Política de exportação humana:** perfis e finalidades por escola, limite de linhas e período de retenção de auditoria. Até lá, `KLASSE_CC_ROSTER_EXPORT_POLICY_JSON` não é activado e `enabled=false`.
2. **Homologação de negócio** das fontes documentais (especialmente modalidades fora das candidaturas) e documentos obrigatórios por escola. Não extrapolar.
3. **RLS/Auth de verdade** em réplica actual do Supabase, perfis operacionais e recusados, escolas e polos distintos, fluxos autenticados de matrícula/pagamentos/notas e três atendimentos consecutivos.
4. **Benchmarks comparáveis** de p50/p95, bytes e requisições/hora em ambiente autenticado, quotas Supabase/Vercel e `EXPLAIN` com cardinalidade realista. O fixture é sintético e não prova carga ou latência de produção.
5. **WCAG AA completa**: leitor de ecrã e zoom nativo do Chrome, foco e contraste; as capturas e testes de teclado são regressão, não certificado WCAG.
6. Autorizar separadamente e em ordem a aplicação das migrations versionadas, integração das branches empilhadas e deploy. **Esta PR não autoriza nenhuma dessas acções.**

Não alterar histórico aplicado ou o motor de pagamentos/fiscalidade para que um teste passe.
