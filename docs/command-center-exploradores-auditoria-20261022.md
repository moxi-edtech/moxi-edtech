# KLASSE — Auditoria e evolução operacional dos exploradores do Command Center

**Registo:** 22/10/2026 · **Tipo:** auditoria de produto, engenharia, segurança e plano de evolução · **Estado:** documentação; implementação e homologação pendentes.

**Escopo:** pesquisa global e exploradores de **Curso, Classe, Turma, Disciplina e Professor**, para Secretaria, Administração e Operações. Este documento é um complemento autónomo à [especificação do modal contextual](./command-center-contextual-modal.md), não a substitui.

> **Proveniência e grau de certeza.** Os achados e os agregados da Escola Curtume abaixo foram fornecidos no relatório de auditoria anterior. Nesta actualização documental foi confirmado no GitHub que a `main` parte de `25aeb54917f1d1118418ab9837d8ac4b7b52d05d`, integrando a correção de Turmas da [PR #230](https://github.com/moxi-edtech/moxi-edtech/pull/230); a [PR #231](https://github.com/moxi-edtech/moxi-edtech/pull/231) permanece **aberta e não integrada**. Não se repetiram consultas à Vercel, Supabase ou testes autenticados nesta branch. Assim, valores de produção, logs e agregados são um retrato relatado, não nova verificação independente.

## 1. Ponto de partida: publicação não equivale a homologação

| Item | Evidência / interpretação |
| --- | --- |
| Deployment relatado | `dpl_s1Rrk7ujBEVRQcaYyPcGqHJoDZMT`, READY, commit `25aeb549`. A prontidão do deployment foi relatada, não novamente consultada nesta documentação. |
| Correção Turma | [PR #230](https://github.com/moxi-edtech/moxi-edtech/pull/230) integrada na `main`; resolve a falha de FK ambígua na leitura. |
| Erros Turma | 14 ocorrências indicadas para o deployment anterior; ausência de novas ocorrências no agrupamento relatado **não prova** sucesso de navegação real. |
| Pesquisa professor | [PR #231](https://github.com/moxi-edtech/moxi-edtech/pull/231) aberta; inclui tipos da Secretaria e descreve encaminhamento ao `ProfessorContextView` no modal, ainda não publicado pela `main`. |
| Balcão | Falha isolada relatada de auditoria no endpoint de pesquisa de alunos; investigar num fluxo separado para não misturar escopos. |
| Principal gate | Testes autenticados de permissões, navegação, dados históricos, isolamento multi-tenant, mobile e teclado ainda sem evidência conclusiva. |

**Regra de evidência:** `READY` comprova deployment; CI verde comprova checks automatizados; **homologado** exige testes efetivos por perfil, escola, dados e dispositivo.

## 2. Riscos e fragilidades prioritários

| ID | Severidade | Constatação / hipótese técnica | Correção e prova exigida |
| --- | --- | --- | --- |
| SEC-01 | **P0 — risco a validar** | `search_global_entities` usa `SECURITY DEFINER`, verifica vínculo à escola, mas a matriz de tipos pesquisáveis foi identificada no frontend, sem autorização equivalente por tipo no corpo da função. **Exposição efetiva ainda não demonstrada.** | Autorizar cada `p_types` no servidor/banco conforme utilizador, papel, portal e tipo de dado; rever owner, grants, `search_path` e views; testes de chamadas diretas, inclusive categorias financeiras, com papéis distintos e duas escolas. |
| PRIV-01 | **P0** | Histórico de recentes em `localStorage` separado por escola e portal, não por utilizador; potencial reaparecimento em computador partilhado. | Preferir histórico somente em memória de sessão; ou chave por identidade com limpeza rigorosa no logout, troca de utilizador, escola/portal e expiração. Testar sessão A→logout→sessão B no mesmo navegador. Evitar persistir nomes de alunos sem necessidade. |
| MOB-01 | **P1** | Entrada `CommandPalette` dentro de `hidden md:flex` na Topbar; nenhum acesso mobile equivalente identificado no relatório. | Entrada visível e acessível no mobile, sem duplicar lógica/pesquisa; teste de ecrã pequeno e teclado virtual. |
| SRCH-01 | **P1** | 8 resultados por lote; `loadMore` no hook não utilizado pelo modal. | `Ver mais resultados`, cursor estável, cancelamento de buscas obsoletas e identificação contextual de homónimos; preservar escopo da escola e resultado atual. |
| SRCH-02 | **P1** | Exceções reduzidas a listas vazias após log no console. | Estados separados `loading`, `empty`, `error`, `forbidden`; retry e termo mantido; logs estruturados com request ID, sem PII. |
| NAV-01 | **P1** | Fluxo de resultado de Professor pode ir para página, em vez do modal; PR #231 aberta. | Validar clique/Enter abrindo visão contextual por portal autorizado; fallback de página apenas explícito ou quando visão indisponível, nunca em caso de 403. |
| NAV-02 | **P1** | Em Curso, é necessário selecionar a linha e depois `Explorar turma`. | A linha abre diretamente Turma, com `Abrir página` secundário; evitar alvos clicáveis aninhados. |
| NAV-03 | **P1** | `Todas as classes` limpa seleção local, mas pode não sincronizar callbacks do Command Palette. | Estado único do filtro e restauração consistente, inclusive ao voltar do subexplorador. |
| NAV-04 | **P1** | Vista anterior desmonta na navegação; filtros, página e posição de leitura podem perder-se. | Pilha de contexto com preservação/restauração de filtros, seleção, paginação e scroll, escopada por escola/ano/utilizador. |
| A11Y-01 | **P1** | Fecho visível e gestão explícita de foco não demonstrados no explorador. | Botão fechar, foco inicial, Tab/Shift+Tab confinados, Escape, retorno ao disparador, `aria` apropriados, leitores de ecrã e movimento reduzido. Referência: [WAI-ARIA modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/). |
| OBS-01 | **P2** | Erros PostgREST podem surgir como `unexpected` em Classe, Professor e Disciplina. | Tratamento consistente das cinco rotas: status adequado, código/razão interna e ID de correlação, sem detalhes privados no cliente. |
| PERF-01 | **P2** | Classe pode carregar até 3.000 matrículas para agregações e devolver 20 alunos/página. | `COUNT`/agregações SQL indexadas por escola/ano/classe e paginação no banco; verificar plano e medir p95, bytes e carga. |

**Nota de prioridade:** SEC-01 exige avaliação imediata, mas o relatório não prova exploração nem vazamento. Não classificar como incidente confirmado sem teste por papéis.

## 3. Retrato agregado — Escola Curtume, ano letivo ativo de 2026

| Indicador relatado | Quantidade |
| --- | ---: |
| Turmas | 22 |
| Matrículas ativas | 507 |
| Turmas com mais de 20 alunos | 12 |
| Maior turma | 55 alunos |
| Turmas sem matrículas ativas | 4 |
| Turmas sem professor identificado **nas fontes consultadas pelo explorador** | 20 |
| Turmas sem horário publicado **nas fontes consultadas pelo explorador** | 22 |

Estes números são uma **fotografia agregada reportada**, não um conjunto de dados extraído para esta documentação. Ausência de vínculo nas fontes consultadas **não demonstra** ausência real de docentes ou horários. Antes de criar alertas acionáveis, validar fontes de verdade, vigência por ano, matrículas ativas/canceladas/transferidas, alocação docente e publicação de horários. Evitar mostrar pendências falsas.

## 4. Contrato de produto: identificar → compreender → agir

O Command Center deve ser **camada de orientação contextual**, não outro dashboard ou segundo Balcão. Cada entidade apresenta: identificação inequívoca (nome, código, escola, ano); indicadores com fonte/estado; pendências **verificáveis**; ação já existente que permite resolvê-las; navegação reversível. **Todas as escritas permanecem nas áreas canónicas** e passam pelas permissões, validações, RLS e auditoria dessas áreas.

| Explorador | Capacidade identificada | Evolução operacional prevista |
| --- | --- | --- |
| **Curso** | Alunos, classes, turmas, totais e navegação contextual. | Nome do curso proeminente; ocupação por turma; classes sem turmas apenas quando consulta completa; linha da turma abre direto o contexto. |
| **Classe** | Turmas, alunos, capacidade, disciplinas e professores. | Turmas com zero alunos ou vagas, atribuições docentes ausentes quando verificadas; pesquisa de aluno no escopo da classe com paginação no banco. |
| **Turma** | Lista de alunos paginada, disciplinas/professores, turno e capacidade. | Vagas (se capacidade válida), disciplina sem professor **apenas após verificação**, `Atender no Balcão`, seleção direta de professor e gestão de atribuição no módulo existente. |
| **Professor** | Turmas, disciplinas e horários publicados. | Agenda semanal legível; separar `sem atribuição`, `sem horário publicado` e `dados incompletos`; ação no módulo de gestão autorizado. |
| **Disciplina** | Professores, turmas e matriz curricular. | Distinguir `consta na matriz`, `atribuída à turma` e `tem docente`, respeitando escola e ano; links para atribuição existente. |

### Estrutura de referência: Turma

1. **Cabeçalho:** nome da turma; Curso · Classe · Ano letivo · Turno; botão fechar.
2. **Indicadores:** alunos reais · capacidade aplicável · vagas (= máximo entre capacidade menos ocupação e zero, apenas se capacidade conhecida; quando lotada, indicar lotação sem ocultar excedente).
3. **Precisa de atenção:** pendências suportadas por fonte confiável, com estado `não publicado` distinto de `não cadastrado` ou `desconhecido`; cada aviso com destino operacional.
4. **Alunos:** pesquisar nesta turma; lista paginada; selecionar aluno e abrir atendimento no Balcão, se autorizado.
5. **Disciplinas e professores:** relações, abrir docente no modal; gerenciar atribuição na página existente.
6. **Percurso:** breadcrumbs e voltar preservando filtros, página e scroll; opção secundária `Abrir página`.

**Estados obrigatórios:** loading, vazio verdadeiro, erro, proibido, dados parciais e contexto histórico. Nunca converter falha de consulta em zero/vazio; evitar prometer vagas quando capacidade não foi configurada.

## 5. Plano de execução e critérios de aceitação

### Fase 0 — Segurança e privacidade (bloqueia a próxima release funcional)

- [ ] Inventariar função `public.search_global_entities`, views usadas, grants de `EXECUTE`, owner, `SECURITY DEFINER`, `search_path` e configurações reportadas pelo Security Advisor. Avaliar invoker quando viável; não remover definer sem validar RLS e regressões.
- [ ] Aplicar autorização de tipo por perfil **no servidor**; política `deny by default` também para `p_types` vazios, inválidos, repetidos e mistos; limitar paginação/cursor, impedir tipos não autorizados e evitar erros informativos que revelem existência de entidade.
- [ ] Testes com sessão real: Secretaria, Administração, Operações, papel mínimo e utilizador sem vínculo; escola A vs B; categorias académicas, financeiras e administrativas, chamadas diretas à RPC; confirmar ausência de dados e de bypass.
- [ ] Desligar persistência transversal de recentes (preferencial) e limpar cache em logout/login, troca de escola/ano/portal e alteração de sessão. Testar navegador partilhado com duas contas.
- [ ] Nenhum dado pessoal em snapshots de CI, logs ou documentação.

### Fase 1 — Fiabilidade e navegação

- [ ] Reconciliar PR #231 com a `main` antes de implementar outra correção de Professor; não duplicar o mesmo comportamento.
- [ ] Garantir clique e Enter de Professor no contexto modal; fallback autorizado e explícito.
- [ ] Resultados com `Ver mais`, nome + contexto suficiente para distinguir homónimos; erro ≠ vazio; retry.
- [ ] Entrada mobile, fecho e foco acessíveis.
- [ ] Persistir histórico contextual (filtro, página, seleção e scroll) sem carregar dados de outra escola/ano/sessão.
- [ ] Linha de turma no Curso abre direto; filtro `Todas as classes` sincronizado em todas as camadas.

### Fase 2 — Utilidade operacional

- [ ] Validar fonte e semântica de cada indicador e pendência antes de expor alertas.
- [ ] Curso: classes sem turmas, capacidade/ocupação e acesso rápido a turma.
- [ ] Classe: alunos pesquisáveis, vagas e vínculos docentes verificáveis.
- [ ] Turma: alunos, vagas e fluxo para Balcão; disciplinas → professores selecionáveis.
- [ ] Professor: agenda e estados de atribuição/publicação separados.
- [ ] Disciplina: matriz × atribuição à turma × docente, com destinos operacionais existentes.

### Fase 3 — Consistência e desempenho

- [ ] Unificar cabeçalho, tipografia, densidade, estados vazios/erro e ações; sem cartões supérfluos, modais aninhados ou animações complexas.
- [ ] Fazer agregação no PostgreSQL, paginar no banco e medir `EXPLAIN (ANALYZE, BUFFERS)` em réplica segura, p95, payload e regressão em turmas de 50+ alunos.
- [ ] Observabilidade homogénea para as cinco rotas, correlacionada com UI e logs, sem PII.

## 6. Matriz de homologação obrigatória

| Cenário | Casos mínimos | Resultado exigido |
| --- | --- | --- |
| Autenticação/autorização | Sessão ausente, expirada, papel sem acesso, perfis Admin/Secretaria/Operações; RPC direta e APIs | `401/403` corretos e nenhum payload privado ou fallback que contorne autorização. |
| Multi-tenant | Dois utilizadores, duas escolas; troca manual de IDs no URL/RPC | Sem resultados, caches ou detalhes cruzados; 404/403 conforme contrato. |
| Ano letivo | 2026 ativo e ano histórico; classes reutilizadas, turmas transferidas e matrículas canceladas | Contagens e relações coerentes com o ano e regras da fonte de verdade. |
| Volume | 0, 8, 9, 20, 21, 50, 55 e mais de 50 alunos/resultados | Paginação completa, contagens reais, sem duplicações nem truncagem silenciosa. |
| Navegação | Pesquisa→Curso→Classe→Turma→Professor/Disciplina→voltar; `Todas as classes` | Contexto preservado e restaurado sem filtro fantasma. |
| Acessibilidade | Clique, Enter, setas, Tab, Shift+Tab, Escape, leitor de ecrã e retorno ao disparador | Foco confinado ao diálogo, fecho visível, estado comunicado, sem aprisionamento após fechar. |
| Dispositivos | Desktop e mobile, teclado virtual, rotação e diferentes larguras | Pesquisa alcançável e operável em todas as vistas. |
| Rede/erros | Falha RPC, PostgREST, timeout, sessão expirada, erro inesperado, retry | Erro distinto de ausência de dados; mensagem útil sem PII; recuperação previsível. |
| Ações | Balcão e operações canónicas de docente, horários e matrícula | Autorização revalidada na escrita; sem edição duplicada no explorador. |

**Critério de saída:** testes unitários/integrados + DB/RLS + E2E autenticados verdes; métricas de runtime analisadas; validação com contas reais dos três portais e papel sem acesso, duas escolas, ano histórico, desktop/mobile e casos de 50+ alunos. Um resultado de CI ou deployment READY isoladamente **não fecha** este gate.

## 7. Rastreabilidade e dependências

- Referência de produto: [modal contextual](./command-center-contextual-modal.md), [roadmap da pesquisa global](./global-search-roadmap.md).
- Consolidação: [PR #229](https://github.com/moxi-edtech/moxi-edtech/pull/229); correção de Turma: [PR #230](https://github.com/moxi-edtech/moxi-edtech/pull/230); Professor/Secretaria pendente: [PR #231](https://github.com/moxi-edtech/moxi-edtech/pull/231).
- Código-alvo: `apps/web/src/hooks/useGlobalSearch.ts`, `apps/web/src/components/CommandPalette.tsx`, `apps/web/src/components/secretaria/command-center/CourseContextView.tsx`, `ClasseContextView.tsx`, `TurmaContextView.tsx`, `DisciplinaContextView.tsx`, `ProfessorContextView.tsx` e endpoints `apps/web/src/app/api/escolas/[id]/command-center/**`.
- SQL: `public.search_global_entities` e RPCs/views académicas correspondentes; confirmar permissões no banco efetivo antes de propor migrations.
- Acessibilidade: [W3C WAI-ARIA APG — Modal dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

## 8. Decisões e limites

**Aprovado como direção de produto:** explorador como camada de orientação contextual, leitura segura, pendências verificadas e atalhos para módulos existentes. **Não aprovado/implementado por esta documentação:** nova API, nova migration, alteração de RBAC/RLS, alterações visuais ou deploy.

**Próxima release:** não agregar novos widgets antes de fechar SEC-01, PRIV-01, MOB-01 e os fluxos críticos da Fase 1. O desenho da permissão por tipo deve ser validado no banco antes de afirmar que não existe exposição.