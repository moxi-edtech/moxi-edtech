# #417 — Ocupação das turmas: contagem completa e paginação correta

## Causa raiz
`/api/secretaria/turmas/ocupacao` limitava a consulta a 50 linhas via `applyKf2ListInvariants(...defaultLimit: 50)`. Em seguida, devolvia `total_turmas: rows.length`, confundindo o número de registos na página com o universo de turmas filtrado. Grupos e médias também eram indevidamente interpretados como indicadores totais da escola.

## Fonte da verdade verificada
A vista `public.vw_ocupacao_turmas` usa `security_invoker=true`, filtra por `escola_users` e consulta `internal.mv_ocupacao_turmas`, que pré-calcula ocupação por turma. A correção lê essa mesma fonte existente, sem somar apenas uma página nem introduzir RPC/migração/refresh.

## Contrato novo
- `GET /api/secretaria/turmas/ocupacao?escola_id=<UUID>&page=<n>&page_size=<n>`, com tamanho 1–50 e default 25.
- Escola pedida é validada e autorizada no servidor. O backend aplica `.eq("escola_id", escolaId)` e mantém `authorizeTurmasManage` e o gate de feature já existentes.
- A chamada com `{count:"exact"}` conta **todos os registos autorizados correspondentes aos filtros** na vista pré-agregada, enquanto a resposta de linhas é limitada por `.range` via Kf2.
- `total_turmas` é o total exato filtrado; `resultados_na_pagina`, `pagina`, `tamanho_pagina`, `total_paginas` e `tem_mais` são metadados explícitos.
- `grupos` e `ocupacao_media` são **apenas da página**; a resposta declara `grupos_escopo:"pagina"`. A UI não apresenta médias de página como globais.
- Opções de Classe vêm da tabela `classes` da escola ativa, independentemente da página ou filtros aplicados; Turnos M/T/N e estados mantidos.
- Ordenação estável `classe, turno, nome, id`. Mudanças de filtros reiniciam a página, carregamentos antigos são abortados.
- O endpoint de compatibilidade deixa de tentar encaminhar para rota canónica inexistente antes de aplicar o contrato.

## Nota de frescura
Esta mudança garante contagem correta **em relação à materialized view consultada**. O ciclo de refresh da `internal.mv_ocupacao_turmas` e os critérios de `total_matriculas_ativas` não foram alterados; qualquer diferença com registos operacionais recentes deve ser investigada numa tarefa separada. Não se executa refresh global por solicitação de página.

## Validação
Testes para 0, 1, 50, 51 e 120 turmas, filtros, grupos em turnos diferentes, mais de uma escola, página fora do intervalo e rede lenta. CI, TypeScript, lint, segurança das permissões e smoke autenticado obrigatórios antes do merge/deploy. Nenhuma alteração SQL, RLS ou migração.
