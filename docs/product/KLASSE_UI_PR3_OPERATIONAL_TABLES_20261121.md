# KLASSE — PR 3 · Tabelas, filtros, paginação e estados operacionais

**Referência:** `main` após as PRs #398, #409 e #412. O objetivo é padronizar a apresentação de consultas operacionais sem criar uma segunda fonte de verdade.

## Diagnóstico confirmado no código

1. O endpoint `/api/secretaria/alunos` devolve `total: items.length` na paginação por cursor. Esse valor descreve **a página**, não a escola inteira. Numerais nos tabs e indicadores que o apresentam como global eram enganosos.
2. A página activa `AlunosSecretariaPage` iniciava consultas em dois efeitos distintos, com possibilidade de pedido antigo para uma página substituir resultados de um filtro novo. O componente legado `AlunosListClient` também mantinha os cursores em estado React e os incluía na dependência de carregamento, favorecendo reconsultas desnecessárias.
3. A lista de Professores da Secretaria consultava o servidor em dois efeitos, sem debounce e sem tratamento de falha, permitindo resultados fora de ordem e erros não capturados.
4. Na validação de recebimentos, erros do servidor podiam deixar a experiência presa no carregamento, sem distinguir falha de lista vazia. A tabela não tinha pesquisa ou paginação visual, mas as acções de aprovar e rejeitar já passavam pelo backend autorizado.

## Contratos partilhados

- `OperationalTableFilterBar`: campo de pesquisa com rótulo, limpar pesquisa, limpar filtros, conteúdo complementar e foco visível. Não interfere no estado dos filtros mantido pelos consumidores.
- `OperationalTablePagination`: modelo quando existe contagem global **verdadeira** (ex.: professores paginados pela API; filas paginadas em memória). Exibe intervalo e respeita página máxima, vazio e loading.
- `OperationalCursorPagination`: modelo quando a API só confirma `hasMore`; exibe página e quantidade carregada, **sem inventar total global**. Botões bloqueados durante o carregamento.
- `OperationalTableSkeleton`, `OperationalTableEmptyState` e `OperationalTableErrorState`: carregamento, sem resultados e erro têm visuais e acessibilidade diferentes. Skeletons não simulam dados reais nem são interativos; animações respeitam `prefers-reduced-motion`.
- `Table`: wrapper legado mantém os filhos e props da tabela semântica, com rolamento horizontal apenas onde necessário.

## Superfícies abrangidas

| Portal | Alteração | Fonte de dados |
| --- | --- | --- |
| Secretaria · Alunos | filtro e paginação por cursor, estado vazio/erro, abortar pedidos anteriores, contagem por página, ações visíveis com teclado e em mobile | `/api/secretaria/alunos` existente |
| Secretaria · Professores | pesquisa com debounce, filtros responsivos, paginação validada e estado explícito de erro; exportações mantidas | `/api/secretaria/professores` existente |
| Secretaria/Financeiro · Recebimentos | filtrar/paginar **apenas a apresentação**; somatórios mantêm todos os resultados autorizados; falha não aparece como “Tudo em dia”; modal de aprovação mantido | `getPagamentosPendentes` + `validarPagamentoAction` existentes |
| Secretaria · Ponto de professores | herda as melhorias no `OperationalTablePagination` e `OperationalTableSkeleton` já usados pelo relatório | rotas existentes |

Nenhuma migração, RLS, RPC, tabela, trigger, permissão, URL de exportação ou transição de estado financeiro é alterada. Não usar contagens de página como totais da escola, nem chamar o cliente para calcular totais globais a partir de páginas parciais.

## Validação e publicação

- Testes de normalização de paginação (0 resultados, inválidos, página fora do intervalo), renderização acessível, regressão de filtros e contratos funcionais.
- TypeScript `--noEmit --incremental false`, ESLint dos ficheiros modificados, guardas de tema e UI, CI GitHub completo.
- QA autenticado, com e sem resultados, em 320/375/768/1440 px, teclado, tema escuro e velocidade de rede reduzida; confirmar que aprovar/rejeitar não muda sem intervenção explícita.
- Nenhum merge ou deploy deve ser considerado concluído sem confirmação real do GitHub. CI não constitui homologação visual integral.

**Próxima fase fora da PR 3:** corrigir paginação no backend que exigir contagem global exata sem custo de `COUNT(*)` indiscriminado; auditoria de componentes antigos não montados em rotas ativas; certificação visual acessível com sessão de teste; formatos de exportação nominal seguem a política já estabelecida para cada produto.
