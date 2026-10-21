# Command Center — Visões Contextuais (modal)

> Estado: implementação em desenvolvimento na branch `feat/command-center-contextual-modal-foundation-20261021`. Este documento descreve a arquitetura e os contratos previstos; não constitui homologação nem autorização de deploy.

## Objetivo

Estender o **CommandPalette** existente para permitir pesquisar e explorar entidades académicas dentro do mesmo modal. Evitar outro painel de navegação e preservar a experiência de atendimento do aluno no Balcão.

## Entrada e interação

1. Abrir a pesquisa global (topbar ou Cmd/Ctrl+K).
2. Selecionar um resultado do tipo **curso**: a pesquisa transforma-se numa visão contextual, sem mudar de página.
3. Apresentar os indicadores académicos do curso, classes e turmas do ano letivo selecionado.
4. Selecionar uma classe filtra as turmas no mesmo modal; selecionar uma turma mostra o seu resumo e uma ação explícita para abrir a página existente.
5. **Voltar à pesquisa** mantém a pesquisa anterior. Fechar o modal limpa o contexto; reabrir inicia na pesquisa.
6. Resultados de **aluno** mantêm o fluxo de Balcão e a confirmação de troca de atendimento.

O contrato de contexto suporta `curso | classe | turma | professor`, mas a visão rica implementada nesta fase é apenas **curso**. Os outros tipos devem conservar um fallback explícito até receberem endpoints próprios.

## Bibliotecas e estratégia

- **cmdk**: seleção, pesquisa, teclado e estrutura do CommandPalette já existente.
- **Radix Dialog**: acessibilidade, foco e comportamento de abertura/fecho já fornecidos pela composição do projeto.
- **TanStack Query v5**: cache por escola, entidade e ano letivo; refetch/retry controlado; não persistir dados académicos em armazenamento local.
- **Framer Motion**: já instalado; usar apenas transições discretas, respeitando `prefers-reduced-motion`. Não introduzir dependências redundantes.
- **TanStack Virtual**: já instalado, mas só utilizar se uma futura lista paginada de alunos o justificar.

## Componentes e contratos

| Artefacto | Responsabilidade |
| --- | --- |
| `apps/web/src/components/CommandPalette.tsx` | Entrada única, seleção e transição pesquisa ↔ contexto |
| `apps/web/src/lib/command-center/entity-context.ts` | Contrato tipado: `type`, `id`, `escolaId`, `label`, `academicYearId` |
| `apps/web/src/components/secretaria/command-center/CourseContextView.tsx` | Visão de curso, classes, turmas, estados de erro e carregamento |
| `apps/web/src/hooks/useCourseContext.ts` | Consulta e cache por contexto académico |
| `apps/web/src/app/api/escolas/[id]/command-center/cursos/[cursoId]/route.ts` | Endpoint GET autenticado e autorizado, leitura apenas |
| `supabase/migrations/20271015100000_command_center_course_overview.sql` | Agregação académica por escola, curso e ano letivo |

### GET /api/escolas/:escolaId/command-center/cursos/:cursoId

Query opcional: `ano_letivo_id=<uuid>`. A resposta de sucesso tem `{ ok: true, data: { curso, anoLetivo, stats, classes, turmas, turmasLimitadas } }`.

- `stats`: contagens de classes, turmas e alunos no âmbito solicitado.
- `classes`: `id`, `nome`, `turmas`, `alunos`.
- `turmas`: `id`, `nome`, `classeId`, `turno`, `capacidade`, `alunos`.
- `turmasLimitadas`: indica que a lista de turmas foi truncada; os totais não devem ser derivados da lista truncada.

O endpoint devolve 401 para sessão ausente, 403 para acesso negado, 400 para parâmetros inválidos, 404 para curso inexistente e 503 se a função de leitura não estiver instalada. Não substituir erros por indicadores zero.

## Segurança e consistência

- Autenticar o utilizador, resolver a escola e validar papéis K12 antes da consulta.
- O **banco** deve aplicar isolamento de escola também na RPC. Nenhum identificador vindo da pesquisa é prova de autorização.
- A seleção do ano letivo deve ser preservada nas consultas e ao abrir uma turma.
- Não apresentar dados financeiros nesta fase: requerem autorização específica e contratos próprios de competência/recebimento.
- Não contar matrículas transferidas, anuladas, históricas ou duplicadas como alunos vigentes; validar os estados com o contrato académico canónico.
- Agregações de contagem devem acontecer no PostgreSQL e não em listas limitadas a 50 ou 100 itens.
- Respostas privadas: `Cache-Control: private, no-store`. O cache de interface deve ser segmentado por escola, curso e ano letivo e descartado ao trocar sessão/escola.

## Verificação antes de merge

- [ ] `pnpm install --frozen-lockfile` e `pnpm -C apps/web typecheck`.
- [ ] Lint e testes de unidade do contexto, estados de loading/erro/retry e navegação por teclado.
- [ ] Testes de integração da RPC com mais de 50 matrículas e mais de 100 turmas, histórico, transferências e ano letivo alternativo.
- [ ] Testes de isolamento entre escolas e acesso negado por papéis sem permissão, incluindo chamadas diretas ao endpoint/RPC.
- [ ] Testes E2E autenticados: pesquisa → curso → classe → turma → voltar, fechar/reabrir, foco/ESC e Balcão sem regressões.
- [ ] Confirmar que a migration foi aplicada no ambiente de homologação; não executar DDL diretamente em produção sem homologação.
- [ ] CI verde e revisão de diffs antes do merge.

## Fora do escopo inicial

Dashboards financeiras, professor/disciplina, histórico completo, novos painéis, animações complexas e alterações ao fluxo de cobrança.

## Referências

- [Auditoria e plano — issue #224](https://github.com/moxi-edtech/moxi-edtech/issues/224)
- [Global Search — roadmap](./global-search-roadmap.md)
