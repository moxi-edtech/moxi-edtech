# KLASSE IA — situação RAA por turma (PR #214)

## Decisão normativa já existente

**RAA** significa Regulamento da Avaliação das Aprendizagens, Decreto Executivo n.º 04/2026. A aprovação e retenção já são resolvidas em `apps/web/src/lib/academico/raa-progression-server.ts`, a partir de `resolveRaaProgressionForMatricula` (RPC canónica `resolve_raa_progression_for_matricula`, com integração jurídica `resolveDecretoDecision`). O endpoint existente `GET /api/academico/raa/progressao` chama a mesma função. A IA **não define um novo limiar de notas, faltas ou reprovação**.

## Integração efetiva

A intenção `official_failure_risk` executa `officialRaaStatusByTurma` no mesmo registry e sessão autenticada, protegida pela flag `KLASSE_AI_OFFICIAL_FAILURE_RISK` e pelas provas `*_SOURCE_PROVEN` e `*_ISOLATION_PROVEN` (todas `false` por padrão). A implementação:

- Resolve escola, papel, ano letivo e filtros pelo mecanismo já existente, com acesso à BD exclusivamente pela sessão autenticada e RLS. Nunca usa `service_role`, SQL livre ou ferramenta de escrita.
- Consulta turmas da view canónica por escola/ano; lê matrículas de `matriculas` por `escola_id`, `session_id` e `turma_id`. O total de linhas **deve ser exato**; recusa quando não é verificável, quando excede 24 matrículas ou quando existem alunos duplicados/matrículas incompletas. Os limites conservadores evitam sobrecarga da camada gratuita do Supabase. O caminho RAA está adicionalmente limitado a 2 consultas por utilizador e 5 por escola em 10 minutos, verificadas na auditoria antes de qualquer RPC.
- Executa **o mesmo resolvedor RAA** utilizado pelo endpoint da Secretaria, no máximo duas matrículas em paralelo. Falhas de política/RPC ou cobertura geram recusa, nunca extrapolação de uma amostra.
- Apresenta por turma apenas contagens **factuais** de decisões `retido`, `retido_por_faltas`, `retido_por_indisciplina`, `pendente`, `recurso`, `inscricao_condicional`, `transitou` e `concluiu`. Não devolve nomes/IDs de alunos no texto final nem classifica matrículas com recurso, pendência ou inscrição condicional como reprovadas.
- Nunca afirma prever reprovação nem atribui probabilidade, pontuação ou ranking heurístico. Perguntas em linguagem natural sobre *risco* resultam em explicação dessa limitação e nas situações oficiais disponíveis, se a ferramenta estiver ativada e houver cobertura.

## Evidência e limitações

Testes novos: `assistant-raa-official-summary.spec.ts` (agregação por turma, estados não finais, erros de cobertura/duplicação/IDs divergentes/estado desconhecido) e `assistant-raa-read-contract.spec.ts` (provedor mockado, roteamento de intenções, origem RAA, escola/ano, limites e ativação fail-closed). Executar sem chave de provedor real.

**Não verificado:** E2E autenticado RLS real de duas escolas e dois polos, permissões diretamente na RPC por perfil, completude dos vínculos de polo, desempenho medido do resolvedor por até 24 matrículas e compatibilidade de todas as migrations em Postgres descartável. Até estas verificações, `OFFICIAL_FAILURE_RISK` permanece **desligada** e recusa, mesmo com o código funcional implementado. Não houve alterações de policies, migrations, motor académico ou produção.

A única decisão pendente de negócio sobre esta pergunta seria querer **uma previsão antecipada** de reprovação; a instrução atual proíbe previsões e não existe critério RAA oficial de probabilidade. Nenhuma aprovação suplementar do utilizador é necessária para reconhecer as decisões **oficiais já calculadas** pelo sistema.
