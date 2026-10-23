# KLASSE Command Center — redesign de produto dos cinco exploradores

**Estado:** implementação inicial em branch isolada, sem merge na main e sem deploy.
**Data de referência:** 23/10/2026. **Ámbito:** Curso, Classe, Turma, Professor e Disciplina.
**Fonte de verdade:** código da main de origem (99cdcd20), contratos das rotas e estrutura corrente do Supabase; todos os números abaixo são fotografias agregadas, não invariantes.
**Decisão posterior e prevalecente (23/10/2026):** [currículo por ano letivo e versão, sem segunda lista de matrizes inativas](./DECISAO-ESCOPO-CURRICULAR.md). A implementação EX-006 da Disciplina já segue a decisão na branch; CI e homologação autenticada continuam pendentes. Manter draft.
**Principais ficheiros:** apps/web/src/components/secretaria/command-center/*ContextView.tsx, apps/web/src/lib/command-center/, apps/web/src/app/api/escolas/[id]/command-center/ e apps/web/src/hooks/.

## 1. Objetivo de produto

Transformar diretórios académicos em ferramentas operacionais contextuais sem criar uma segunda área de gestão. Cada explorador deve responder:

1. Que entidade é esta, em que escola, ano e condição?
2. Como está relacionada com as restantes entidades, com evidência verificável?
3. Que anomalias operacionais exigem atenção e como posso abrir a ação autorizada?
4. Como regresso ao meu ponto anterior sem perder pesquisa, paginação, foco ou contexto?

Não redesenhar tudo com cartões iguais. A estrutura base e semântica devem ser partilhadas; o conteúdo principal muda conforme a tarefa. Não duplicar operações já implementadas no Balcão. Ações de escrita continuam nos fluxos canónicos, sujeitos a validação de permissões e revalidação do ano.

## 2. Auditoria por entidade — antes de redesenhar

| Entidade | O que já existe | Problemas / oportunidade | Experiência-alvo |
|---|---|---|---|
| **Curso** | Resumo, classes, turmas, ocupação, percurso para Classe/Turma | Turmas limitadas a 100 sem paginação contextual; classes reutilizadas podem desaparecer do resumo porque a RPC compara ano de criação; ausência de matriz/cobertura | Mapa académico e curricular com progresso de vínculo Curso → Classe → Turma → Disciplina e capacidade |
| **Classe** | Indicadores, turmas, docentes, disciplinas, alunos com paginação e ações | Ordem atual dispersa a atenção antes da lista operacional; resumos podem ser parciais, ocupação agregada não identifica em que turma há vagas; contextualização do vínculo por curso/ano | Visão de coordenação; turmas e pendências; cobertura curricular; alunos e ação contextual |
| **Turma** | Perfil, capacidade, alunos, filtros, atribuições e ações; retorno ao aluno | Indicadores de pendências visíveis sobretudo no modo pesquisa; secção operacional concorre com painel de disciplinas; duplicidade potencial de controlo de scroll; matrizes inativas antes indistinguíveis | Centro operacional: alunos em foco, filtros válidos, ação e retorno persistente, disciplinas e docentes como painel secundário |
| **Professor** | Turmas, disciplinas, horários efetivamente publicados | Listas textuais escondem relação turma × disciplina; carga e conflitos não verificados não podem ser inventados | Mapa de atribuições e agenda legível, vínculos atuais separados do histórico; ações abrem gestão existente |
| **Disciplina** | Catálogo, matriz, turmas e professores | Matriz ≠ atribuição ≠ docente ≠ horário. Classe reutilizada noutro ano podia ser omitida; avisos e cobertura ficam difusos em três listas | Cobertura curricular por Curso/Classe/Turma, com origem, atribuição e docente qualificados e anomalias comprovadas |

### Pontos fortes a preservar

- Escopo explícito de escola + ano letivo nas rotas e nas chaves de cache React Query.
- Validação do papel por escola no servidor; identidade/links da pesquisa global não substituem autorização.
- Paginação da lista, pesquisa e filtros operacionais no PostgreSQL antes do limite, com cursor determinístico.
- Distinção entre capacidade desconhecida e zero; indicadores parciais identificados.
- Históricos de matrícula não devem ser tratados como atuais; pagamentos/BI/dados pessoais permanecem nas áreas autorizadas.
- Horários de professor entram apenas se a versão for publicada.
- Ações de aluno verificam capacidades e encaminham às operações existentes, não duplicam formulários.
- Retenção efémera de contexto do explorador limitada por utilizador, escola, polo, portal e ano.

## 3. Estrutura real e regras canónicas

| Relação | Fonte preferencial | Semântica e cuidado |
|---|---|---|
| Curso–Classe | classes.curso_id + turmas do ano | classes.ano_letivo_id não é exclusiva: uma classe pode ser reutilizada em anos seguintes |
| Classe–Turma | turmas.classe_id e ano_letivo_id | A turma efetivamente vinculada ao ano prevalece sobre a data de criação da classe; validar escola e curso |
| Curso–Turma | turmas.curso_id | Não inferir curso a partir do nome de turma ou de uma classe de outra escola |
| Curso/Classe–Disciplina | curso_curriculos (escola, ano UUID, versão, status) → curso_matriz por curso_curriculo_id | Não resolver o currículo só por ativo de curso_matriz: linha publicada pode estar inativa; a versão/ano são determinantes. Previsto ≠ atribuído à turma |
| Turma–Disciplina | turma_disciplinas via curso_matriz_id | Podem existir vínculos históricos para matrizes hoje inativas; conservar e classificar, não apagar |
| Turma–Docente | turma_disciplinas.professor_id e turma_disciplinas_professores | Professor de uma disciplina numa turma não deve ser atribuído a todas as turmas onde a disciplina exista |
| Horário publicado | quadro_horarios + horario_versoes.status=publicada | A versão draft/arquivada não comprova atividade letiva atual |
| Turma–Aluno | matriculas com escola, ano, turma, status e ativo | Não contar cancelados/transferidos como inscritos. Evitar duplicar um mesmo aluno por múltiplas linhas de matrícula |
| Professor–Identidade | professores.profile_id + profiles.user_id | Professor é entidade académica distinta de um resultado genérico “utilizador” no Command Center |

### Vocabulário de relações, único nos cinco exploradores

1. **Prevista na matriz:** existe um vínculo curricular ativo, não prova oferta da turma.
2. **Atribuída à turma:** existe associação da disciplina à turma, não prova professor.
3. **Professor atribuído:** vínculo docente verificado; não prova aula ministrada.
4. **Horário publicado:** a aula aparece em versão publicada, não prova presença.
5. **Linha de matriz inativa:** não confundir com uma versão histórica curricular. Preservar a prova e o acesso de auditoria; **não criar segunda lista de matrizes inativas na vista operacional**. Consultar currículo do ano/versão selecionados.
6. **Não confirmado:** dados incompletos ou fontes não relacionadas; não traduzir automaticamente para ausência de relação.

**Implementação inicial:** academic-relations.ts centraliza ano, reutilização de classe, fusão de estados de matriz e nomenclatura de evidência. Interfaces preservam vínculos históricos; o explorador de Turma passa a qualificar explicitamente matriz inativa. Nenhuma operação escreve no Supabase. **Alinhado na branch:** Disciplina usa currículo publicado por ano e versão; CI e homologação ainda pendentes.

## 4. Fotografia do Supabase (consultas apenas de leitura)

Os valores abaixo vieram de consultas agregadas aos dados atualmente instalados; não contêm identificadores pessoais:

- 15 cursos, 49 classes, 139 turmas, 866 linhas da matriz curricular, 1.770 vínculos turma–matriz e 21 vínculos docentes registados na tabela turma_disciplinas_professores (fonte legada).
- 32 classes aparecem com turmas em mais de um ano.
- 6 turmas estão num ano diferente do ano registado na sua classe. Todas estas ocorrências estavam em anos **inativos**.
- 146 vínculos turma–matriz apontam a linhas de matriz **inativa**, também em anos inativos.
- **Nova confirmação por ano/versão:** 309 linhas inativas: 259 associadas a currículos de 2025 e 50 a 2026; 218 pertencem a currículos `published` e 91 a `archived`. Ao agrupar por escola/disciplina/curso/classe **e ano letivo**, há 50 combinações mistas no mesmo ano e 218 combinações que só têm linha inativa naquele ano. Logo, a correspondência ativa que aparece ao ignorar o ano **não** autoriza inferir duplicidade curricular.
- **Alerta de integridade, sem correção automática:** 486 vínculos entre turmas e matrizes de currículos com `ano_letivo_id` diferente; 50 desses links envolvem linhas inativas. Exigem reconciliação por escola, ano e versão antes de tratar como anomalia ou legado válido.
- 1 referência direta a professor não resolve uma entidade de professor; no ano inativo.
- 6 combinações disciplina/classe têm metadados pedagógicos diferentes em linhas ativas e inativas da matriz. A rota de Classe já filtra as inativas: **não** afirmar que ambas aparecem hoje nessa interface.
- Não se verificaram divergências de escola nas relações turma–classe/matrícula–turma, nem divergência curso-turma-classe, nem matrícula ativa duplicada entre turmas do mesmo ano, segundo os critérios consultados.
- Todas as turmas têm curso e classe. Não foi identificada turma atual acima da capacidade registada na amostra examinada.

**Não executar correções de dados automaticamente.** Vínculo histórico é evidência, não necessariamente defeito. Relacionar cada ocorrência com ano e origem antes de propor migração ou limpeza.

## 5. Direção visual e interativa

**Padrão transversal:** nome e identidade da entidade, ano letivo claramente visível, estado (histórico/parcial/ativo), indicadores semânticos compactos, secções de informação progressiva, links de exploração com significado, mensagens de ausência distintas de erro/sem permissão e um percurso de retorno consistente.

**Turma:** cabeçalho compacto com Curso > Classe > Turma; capacidade, alunos e vagas; lista de alunos em primeiro plano (pesquisa, filtros confirmados, ações de atendimento); disciplinas/docentes num segundo painel. Não acrescentar montantes financeiros à listagem. Pendências apenas quando verificadas.

**Classe:** título contextual por curso/ano; blocos de turmas agrupáveis por turno/capacidade, cobertura de disciplinas/professores; lista de alunos; indicadores de classes agregadas sempre distintos dos problemas de uma turma específica.

**Curso:** mapa de classes e turmas com navegação direta, currículo e cobertura por classe; paginação/retrieval de turmas além das primeiras 100; anos históricos reconhecem classes reutilizadas. Não aumentar LIMIT para mascarar problema.

**Professor:** matriz Turma × Disciplina × Tipo de vínculo e agenda legível por dia. Separar “vínculo”, “horário publicado” e histórico; conflitos de horário só após regra de choque por dia/slot/ano e dados completos.

**Disciplina:** cobertura com Curso > Classe > Turma e estados “na matriz”, “atribuída”, “docente”, “horário publicado”. A matriz visível respeita **o currículo versionado do ano selecionado**, sem painel paralelo de linhas inativas. A falta de professor numa lista truncada não pode originar alerta definitivo. Evitar inferir cobertura a partir de mera existência no catálogo.

**Responsividade:** funcionamento em notebooks 1280–1440px com zoom 100–150%; painel central sem scroll duplo; mobile com colunas empilhadas; fluxo de teclado/aria-current, foco restaurado, sem avatares ilustrados e sem mais um painel global. Tokens semânticos compatíveis com eventual Light/Dark Mode, mas **sem implementar tema nesta branch**.

## 6. Backlog detalhado e ordem de entrega

| ID | Prioridade | Entrega | Critério de aceite |
|---|---|---|---|
| EX-001 | P0 | Contrato puro para ano letivo e proveniência académica | Testes para UUID vs ano numérico, classe reutilizada, matriz inativa, professor e horário |
| EX-002 | P0 | Padrão visual comum para indicadores | Cinco exploradores usam o mesmo formato semânticamente legível; nulo ≠ zero; parcial ≠ total |
| EX-003 | P0 | Bloqueio explícito da pesquisa histórica operacional | Nenhum pedido à RPC rejeitada em ano fechado; paginação histórica mantém-se disponível |
| EX-004 | P0 | Redesign operacional de Turma | Ação sobre 3 alunos consecutivos e retorno com scroll/página/pesquisa/foco sem perder sessão |
| EX-005 | P1 | Prova de reutilização Classe em Curso/Disciplina | Se há turma elegível no ano, Classe aparece no contexto correto sem perturbar histórico |
| EX-006 | P1 | Escopo curricular por ano letivo e versão, sem listas duplicadas | Disciplina usa curso_curriculos.ano_letivo_id/version/status para resolver o conjunto; não apresenta curriculoHistorico operacional; vínculos históricos permanecem auditáveis sem falsificar cobertura do ano |
| EX-007 | P1 | Pesquisa/paginação Curso além de 100 turmas | Sem lista incompleta disfarçada de vazio; totais e janelas calculados no servidor |
| EX-008 | P1 | Redesign Classe e Curso | Ações e relações em contexto, sem duplicação de cartões, contagens comparáveis |
| EX-009 | P1 | Professor: matriz atribuições e agenda | Sem atribuições presumidas nem horários não publicados |
| EX-010 | P1 | Disciplina: cobertura verificável | Distinção visual e funcional entre matriz, turma, professor, horário |
| EX-011 | P1 | Auditoria de cache, retorno e scroll | Um dono do scroll; trocas de aluno, escola, polo, ano e papel não reaproveitam estado |
| EX-012 | P2 | A11y, teclado, zoom, alto contraste | Testes de foco, modal, NVDA/VoiceOver, 1280px e 150% zoom |
| EX-013 | P2 | Observabilidade e performance | Percentis p50/p95 por rota e regressão de render por escola/ano sem dados privados |
| EX-014 | P2 | Revisão controlada de produto | Screenshots e critérios de aceite reais da Secretaria/Direção em homologação |

### Critérios de não regressão / limites

- Não modificar CC-001, modelos de pagamento, matrículas, fiscalidade ou RLS nesta fase.
- Não ativar CC-003/polo; o Supabase de produção permanece a referência para esquemas.
- Não executar migrações históricas numa cópia sintética esperando equivalência perfeita ao ambiente instalado.
- Não expor nomes/valores de estudantes em snapshots, logs ou fixtures de CI.
- Se os dados forem truncados, mostrar explicitamente “parcial”, não “sem vínculos”.
- Não executar correções de histórico por mera aparência de divergência.

## 7. Escopo codado neste primeiro incremento

- EX-001: funções canónicas puras usadas nos compositores Classe/Professor/Disciplina.
- EX-002: ExplorerMetric reutilizado nos cinco exploradores, com valor acessível, parcial e desconhecido.
- EX-003: indicadores de histórico, lista histórica paginada e procura operacional não disparada quando o ano está fechado (as ações abertas noutros módulos continuam sujeitas a revalidação).
- EX-005 (código e migration na branch, **não aplicada**): a vista Disciplina reconhece o currículo publicado do ano; a RPC de Curso passa a incluir classes reutilizadas se houver turma ativa do ano ou currículo publicado desse ano. Migração posterior à criação original da função, sujeita a teste em PostgreSQL descartável e aplicação controlada após aprovação.
- EX-006 (Disciplina alinhada): currículo `published` por UUID do ano, sem segunda lista; vínculos históricos e atividade preservados. Homologação autenticada ainda pendente.
- EX-011 (parcial): a seleção de Classe/Turma no explorador de Curso agora é isolada por escola, curso e ano letivo; filtros restaurados inválidos não geram falsos estados de lista vazia. Testes cobrem mudança de contexto e turma fora da classe selecionada.
- EX-004 (base implementada, **homologação pendente**): Turma conserva página/pesquisa/filtro/aluno e restaura scroll/foco no contêiner que pertence ao Command Palette, depois de a lista chegar; teste sintético de três alunos consecutivos e escopo de escola/ano. O comportamento autenticado com três atendimentos ainda não foi validado.
- EX-011 (incremento adicional): Classe e Turma partilham agora o mesmo dono de scroll; durante o debounce, não apresentam resultados de outra pesquisa como se fossem atuais; a seleção de Curso continua isolada por escola/curso/ano.
- Testes novos para invariantes; restantes EX-007–010 e EX-012–014 continuam trabalho futuro nesta mesma branch.

A implementação deste primeiro incremento **não** constitui o redesign completo e **não** deve ser enviada à main ou à produção antes de testes de integração, smoke autenticado e revisão de produto.

### Incremento já codado: vínculos históricos e resultados parciais (23/10/2026)

> **Nota de substituição de contrato (23/10/2026):** a opção de expor `curriculoHistorico` numa segunda secção era uma etapa provisória e **não é a direção aprovada**. O [documento de decisão](./DECISAO-ESCOPO-CURRICULAR.md) prevalece. Este registo descreve uma etapa provisória já substituída no código da PR #261, sem apagar vínculos.

- **Estado do vínculo e estado da matriz são independentes.** A evidência de atribuição à turma, professor e horário publicado prevalece na classificação operacional; uma matriz atualmente inativa fica sinalizada separadamente. Num ano CLOSED, **não inferir** que estivesse inativa nesse ano.
- **Disciplina — implementação provisória substituída:** a rota resolve agora `curso_curriculos` por escola/ano/versão publicada, com uma única coleção curricular e sem segunda lista de inativas. Nenhum dado foi apagado.
- **Turma:** exibe o vínculo preservado e o aviso de matriz inativa em campos separados, mesmo que haja professor atribuído.
- **Resultados limitados:** indicadores são limites inferiores, nunca totais exatos; Curso/Classe/Turma/Professor/Disciplina não anunciam ausência comprovada quando faltam registos por truncagem. “Professor não encontrado nos vínculos consultados” não equivale a “sem professor”.
- **Testes de regressão:** cobrem prioridade de evidência, estado de matriz em ano CLOSED, coexistência de linhas ativas/inativas, totais apenas de matrizes ativas, zero parcial e mensagens de ausência. É necessária validação de CI e homologação autenticada antes da integração.
- **Não resolvido neste incremento:** paginação de Curso e cobertura completa no servidor; os limites de consulta continuam existindo e devem continuar explícitos.

## 8. Homologação obrigatória antes de integrar

1. Escolas A/B e atores Secretaria, Direção, professor e operador sem permissão: não permitir acesso cruzado.
2. Curso → Classe → Turma → aluno → Balcão → retorno; repetir com três alunos e diferentes filtros/páginas.
3. Um curso com >100 turmas: mostrar contagem real, limite da lista, acesso ao resto quando implementado.
4. Classe reutilizada em dois anos e com turma atual; metadados do ano antigo não escondem a relação atual.
5. Duas versões de currículo (mesmo curso/classe/disciplina) em anos distintos ou no mesmo ano; published/archived com linha `ativo=false`, professor órfão e horário draft/publicado. Conferir versão do ano, sem mostrar lista duplicada.
6. Ano CLOSED: nenhum pedido à pesquisa operacional (409 esperado da API); lista histórica e paginação continuam.
7. Nulos: capacidade desconhecida, professor ainda não atribuído, horário não publicado e resposta parcial — sem estados inventados.
8. Rede lenta, 401/403/404/409, 429, troca de portal/escola e cancelamento de requisições pendentes.
9. Typecheck, ESLint, testes unitários, CI e inspeção visual real em notebooks/mobile.
10. Não modificar dados reais no teste: usar escolas e identidades fictícias no ambiente próprio.

## 9. Referências

- Código: apps/web/src/components/secretaria/command-center/{Course,Classe,Turma,Professor,Disciplina}ContextView.tsx
- Contratos: apps/web/src/lib/command-center/{academic-relations,classe-explorer,professor-explorer,disciplina-explorer,turma-explorer-policy}.ts
- Rotas: apps/web/src/app/api/escolas/[id]/command-center/
- Hook de roster: apps/web/src/hooks/useExplorerRoster.ts
- Auditoria original: docs/command-center-exploradores-auditoria-20261022.md
- Contexto/modal: docs/command-center-contextual-modal.md
- Decisão de produto obrigatória: docs/command-center/explorers-redesign/DECISAO-ESCOPO-CURRICULAR.md
- Estado de release: docs/command-center/estado-atual-20261023.md (na PR documental #260; integrar com cuidado)

### Alinhamento EX-006 — versão publicada do ano (23/10/2026)

A rota, compositor, contrato TypeScript, vista e testes da Disciplina foram alinhados diretamente na PR #261. O currículo é resolvido por ano UUID, escola e versão publicada. As linhas atualmente inativas pertencentes à versão publicada são qualificadas **inline**, não numa segunda lista. Versões concorrentes publicadas geram 409. Os vínculos históricos não foram reescritos. CI completa, integração autenticada e revisão das 486 ligações entre anos continuam pendentes.

### Regressões CI e vínculo de professor (23/10/2026)

- O CI anterior da PR #261 registou duas falhas em `disciplina-contextual-explorer.spec.ts`: fixtures sem ID/versão e um teste que apagava o vínculo de professor sem perfil. Código e testes foram corrigidos — **o novo CI continua como gate de validação**.
- Disciplina preserva a atribuição docente na turma, mas não inventa perfil navegável quando a identidade está ausente, desativada ou inacessível. O indicador conta **professores identificados** e o aviso apresenta identidades indisponíveis.
- A seleção de Curso não reutiliza filtros de classe/turma de outro contexto de escola/curso/ano; filtros sem correspondência são ignorados, evitando “sem turmas” enganoso.
- A PR continua draft; sem alteração na `main`, produção ou dados Supabase.

### Evidência de Classe reutilizada e EX-005 (23/10/2026)

- Auditoria **apenas de leitura**, distinguindo `ano_letivo_id IS NULL` de ano realmente diferente: em **2026**, das 35 classes com turmas ativas, 29 têm ano de criação `NULL` (que a RPC antiga já inclui), 6 foram criadas no próprio ano e **0** têm ano não nulo diferente. Em **2025**, das 46 classes com turmas ativas, 36 têm `NULL`, 4 pertencem ao próprio ano e **6** estão ligadas a outro ano não nulo. Uma comparação do escopo Curso/Classe/ano pela regra antiga e pela nova encontrou **43 vs. 49 classes em 2025** e **35 vs. 35 em 2026**. Logo, as omissões confirmadas neste levantamento são de 2025; não afirmar que as 29 de 2026 estavam ocultas.
- Criada `supabase/migrations/20271015100001_command_center_course_reused_classes.sql` como **migração forward**, depois do arquivo que originalmente cria a RPC. Preserva permissões, invoker e escopo de escola/curso/ano; usa existência de turma ativa do ano ou currículo publicado desse ano, não versões arquivadas.
- A regressão `supabase/ops/tests/regression_command_center_course_overview.sql` cobre classes reutilizadas com turma atual, classes de currículo publicado sem turma, versões apenas arquivadas, totais e isolamento multi-escola. O CI contextual executa a migração em **Postgres descartável**, nunca em dados reais.
- **Estado:** código no GitHub; testes e homologação ainda necessários; **nenhuma migração aplicada ao Supabase**.

### Continuidade EX-004/EX-011 (23/10/2026)

- Command Palette é o único dono do scroll. Turma e Classe restauram no contêiner correto após carregar a lista; guardam página, filtros, pesquisa, aluno selecionado e scroll numa referência efémera e isolada por escola/ano.
- Ao atualizar a pesquisa, os resultados do termo anterior são ocultados enquanto o `useDebounce` não estabiliza. Ausência, erro e carregamento têm mensagens diferentes. O aluno antes selecionado pode não constar da página/filtros sem que se infira mudança de matrícula.
- Testes simulam três alunos sucessivos, retorno de estado, rejeição de outra escola e contratos de scroll/roster. Teste autenticado e inspeção visual continuam requisitos para marcar EX-004 completamente aceite.
