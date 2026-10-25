# Incremento EX-007 → EX-010 — desenho operacional dos exploradores

**Data:** 23/10/2026. **Branch:** `feat/explorers-ex007-ex010-operational-20261023`. **PR empilhada:** #262 sobre #261. 
**Ambiente:** desenvolvimento no GitHub; sem alteração da `main`, nem de RLS, dados, propinas ou produção.
**Fonte curricular:** escola, ano UUID, currículo `published`, versão e ligações académicas efetivas. Consulta não pode transformar existência no catálogo em atribuição.

## EX-007 — Turmas de Curso paginadas na base

A RPC `command_center_course_turmas_page` recebe `p_escola_id`, `p_curso_id`, `p_ano_letivo_id`, `p_page`, `p_page_size` (1–50), `p_classe_id` e `p_search` (até 72 caracteres). `SECURITY INVOKER`, autorização interna redundante, sem privilégios de execução a `anon`; nenhuma exposição de aluno, BI ou valores financeiros.

- O servidor determina `total`, `items`, `page`, `pageSize`, `hasMore`; ordenação estável `nome COLLATE "C",id`. Conta matrículas válidas distintas e exclui alunos eliminados.
- Curso lista apenas a página corrente (25 linhas) e pesquisa nomes literais, filtrando por turma/ano/classe no PostgreSQL. Sem deduzir que a lista anterior, limitada a 100 no resumo, seria exaustiva.
- Cache `command-center/curso-turmas` separada por escola, curso, UUID do ano, classe, página e pesquisa estabilizada; termo ainda em debounce não reaproveita resultados antigos.
- Endpoint retorna 503, sem fallback enganoso, até instalar a nova RPC. A versão instalada do Supabase continua a autoridade.

**Teste obrigatório:** `supabase/ops/tests/regression_command_center_course_overview.sql` em PostgreSQL 17 descartável, 127 turmas fictícias, 6 páginas, sem duplicação, filtro por classe reutilizada, busca literal, 403 equivalente a `42501` em acesso cruzado e falha de janela inválida. O teste carrega as migrations EX-005 e EX-007 antes dos cenários.

## EX-008 — Curso e Classe, tarefas primeiro

- Curso: percurso inequívoco Curso → Classe → Turma, escolha de classe contextual e paginação real. Totais gerais no resumo não mudam por causa do filtro da lista; resultado filtrado mostra seu próprio total.
- Classe: lista de atendimento acima dos diretórios académicos; acesso ao Balcão continua no caminho canónico. Capacidade inexistente não vira zero; turmas sem alunos, com vagas e lotadas são contadas apenas pelos registos realmente consultados, com marcador de parcial quando aplicável.
- Os dois exploradores mantêm mensagens específicas para erro, vazio confirmado, falha de permissão e janela ainda não carregada. Nenhum formulário alternativo de matrícula/pagamento.

## EX-009 — Professor, matriz da atribuição e agenda

- `composeProfessorOverview` devolve `atribuicoes` (Turma × Disciplina) deduplicadas a partir de `turma_disciplinas` e vínculos docentes legados; aulas publicadas apenas alimentam `horarios`.
- Um horário publicado **não** cria atribuição formal. Vínculo sem disciplina do catálogo permanece contabilizado como `unresolvedDisciplineLinks`, não é apagado ou rotulado com nome inventado.
- A matriz permite abrir diretamente Turma ou Disciplina; a agenda abaixo mostra apenas `horario_versoes.status=publicada`. Sem inferir conflito, presença, ausência ou carga horária contratual.

## EX-010 — Disciplina, cobertura por prova

- A rota mantém `curso_curriculos` publicado apenas para o ano selecionado, sem duplicar listas `curriculoHistorico`. A linha atual `ativo=false` continua visível no contexto da versão, sem inventar status em data passada.
- Evidências distintas no modelo: `turma_disciplinas` (atribuição), `turma_disciplinas_professores` (docente legado), `quadro_horarios` com versão publicada (horário). Só Turmas realmente vinculadas ao ano, escola, Curso e Classe entram na contagem por linha curricular.
- A visão distingue `turmasComVinculo`, `turmasComDocente` e `turmasComHorario`; em recortes incompletos, os números são limites inferiores, não ausência comprovada.
- A auditoria das **486 associações entre anos** fica preservada na decisão anterior; não reescrever FKs nem excluir vínculos por interpretação da UI.

## Gates de integração

1. CI completo do HEAD: typecheck, ESLint, suite unitária completa, regression SQL real em Postgres 17 descartável, build, testes de navegador. **Não afirmar verde antes de terminar.**
2. Aplicar EX-005 (`20271015100001`) e EX-007 (`20271015100002`) ao Supabase apenas por procedimento controlado após autorização e comparação com o banco instalado.
3. Homologar com Secretaria e Direção em pelo menos duas escolas, ano corrente e histórico: pesquisa/página 5/6 em curso com >100 turmas, classe reutilizada, alocação docente com/sem horário, disciplina publicada com linha inativa e vínculos conflitantes.
4. Garantir que o resultado em `main` e produção não dependa de RPC ausente; release posterior e separada da PR #261 se os seus próprios gates estiverem resolvidos.

**A PR #262 permanece draft até concluir o CI e a homologação autenticada.**
