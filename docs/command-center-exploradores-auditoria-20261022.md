# KLASSE — Auditoria e evolução operacional dos exploradores do Command Center

> **Atualização de estado — 23/10/2026:** esta auditoria é um retrato de 22/10, **não o estado atual do código**. A cadeia de exploradores foi consolidada pela [PR #252](https://github.com/moxi-edtech/moxi-edtech/pull/252), e a continuidade com o Balcão foi reconciliada na [PR #253](https://github.com/moxi-edtech/moxi-edtech/pull/253), ambas integradas na `main`. O deployment da #253 está READY; as 11 migrations do Command Center estão instaladas e a política opt-in de polo não está ativada em nenhuma escola. **Continuam pendentes as provas manuais/autenticadas descritas aqui.** Consulte [o estado atualizado](./command-center/estado-atual-20261023.md) antes de usar as classificações históricas de risco.

**Registo:** 22/10/2026 · **Tipo:** auditoria de produto, engenharia, segurança e plano de evolução · **Estado:** documentação; implementação e homologação pendentes.

**Direção consolidada (auditoria técnica + auditoria ergonómica do Claude):** o explorador só cumpre a sua função quando a pessoa consegue passar da pesquisa à operação e regressar ao mesmo ponto, sem refazer o percurso. **P0-UX (continuidade de trabalho)** e **P0-SEC (autorização e privacidade)** são gates independentes e igualmente bloqueantes. Não lançar melhorias cosméticas à frente destes gates.

**Escopo:** pesquisa global e exploradores de **Curso, Classe, Turma, Disciplina e Professor**, para Secretaria, Administração e Operações. Este documento é um complemento autónomo à [especificação do modal contextual](./command-center-contextual-modal.md), não a substitui.

> **Grau de evidência.** **C** = observado por leitura de código/consulta relatada; **H** = hipótese derivada da inspeção, sem reprodução autenticada; **P** = estado de produção reportado; **V** = comprovado por teste autenticado com resultado registado. Os novos achados de ergonomia foram comunicados como auditoria do Claude; não foi fornecida evidência nova de teste visual em produção. Escopo, severidade e critérios de teste abaixo não confundem achado estático com incidente reproduzido.

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
| UX-00 | **P0-UX — continuidade operacional** | Ao selecionar aluno e abrir o Balcão, o explorador pode perder a Turma/Classe de origem, o aluno, a página, o filtro e a posição da lista (auditoria ergonómica do Claude; reproduzir em sessão). | Garantir handoff e retorno contextual sem refazer pesquisa. **Teste de aceite:** atender sequencialmente alunos de uma turma com 45 matriculados, regressando exatamente à lista e ao ponto de leitura; revalidar permissões e dados após cada operação. |
| SEC-01 | **P0 — risco a validar** | `search_global_entities` usa `SECURITY DEFINER`, verifica vínculo à escola, mas a matriz de tipos pesquisáveis foi identificada no frontend, sem autorização equivalente por tipo no corpo da função. **Exposição efetiva ainda não demonstrada.** | Autorizar cada `p_types` no servidor/banco conforme utilizador, papel, portal e tipo de dado; rever owner, grants, `search_path` e views; testes de chamadas diretas, inclusive categorias financeiras, com papéis distintos e duas escolas. |
| PRIV-01 | **P0** | Histórico de recentes em `localStorage` separado por escola e portal, não por utilizador; potencial reaparecimento em computador partilhado. | Preferir histórico somente em memória de sessão; ou chave por identidade com limpeza rigorosa no logout, troca de utilizador, escola/portal e expiração. Testar sessão A→logout→sessão B no mesmo navegador. Evitar persistir nomes de alunos sem necessidade. |
| PRIV-02 | **P0 — impacto potencial, confirmar payload** | O histórico de recentes pode persistir identificadores pessoais, incluindo BI/número de processo, e não só nomes. Relatado pelo Claude; forma e extensão reais exigem inspeção do payload e reprodução entre sessões. | Inventariar campos de recentes e eliminar persistência de BI/processo e outros dados pessoais por defeito; limpar caches e testar contas alternadas em computador partilhado. |
| MOB-01 | **P1** | Entrada `CommandPalette` dentro de `hidden md:flex` na Topbar; nenhum acesso mobile equivalente identificado no relatório. | Entrada visível e acessível no mobile, sem duplicar lógica/pesquisa; teste de ecrã pequeno e teclado virtual. |
| SRCH-01 | **P1** | 8 resultados por lote; `loadMore` no hook não utilizado pelo modal. | `Ver mais resultados`, cursor estável, cancelamento de buscas obsoletas e identificação contextual de homónimos; preservar escopo da escola e resultado atual. |
| SRCH-02 | **P1** | Exceções reduzidas a listas vazias após log no console. | Estados separados `loading`, `empty`, `error`, `forbidden`; retry e termo mantido; logs estruturados com request ID, sem PII. |
| NAV-01 | **P1** | Fluxo de resultado de Professor pode ir para página, em vez do modal; PR #231 aberta. | Validar clique/Enter abrindo visão contextual por portal autorizado; fallback de página apenas explícito ou quando visão indisponível, nunca em caso de 403. |
| NAV-02 | **P1** | Em Curso, é necessário selecionar a linha e depois `Explorar turma`. | A linha abre diretamente Turma, com `Abrir página` secundário; evitar alvos clicáveis aninhados. |
| NAV-03 | **P1** | `Todas as classes` limpa seleção local, mas pode não sincronizar callbacks do Command Palette. | Estado único do filtro e restauração consistente, inclusive ao voltar do subexplorador. |
| NAV-04 | **P1** | Vista anterior desmonta na navegação; filtros, página e posição de leitura podem perder-se. | Pilha de contexto com preservação/restauração de filtros, seleção, paginação e scroll, escopada por escola/ano/utilizador. |
| DATA-01 | **P1** | O rótulo `Vagas totais definidas` pode confundir capacidade registada com vagas **disponíveis**. Não é apenas copy: são métricas distintas. | Exibir `Capacidade`, `Alunos matriculados`, `Vagas disponíveis` separadamente; capacidade desconhecida ≠ zero, ocupação excessiva ≠ zero excedente. Confirmar regras e base das matrículas antes do rótulo. |
| LINK-01 | **P1** | Atalhos de trabalho podem apontar para páginas genéricas, por exemplo configuração, e não para a operação concreta (achado do Claude; auditar href e permissões). | Inventário ação→destino→papéis→pré-requisitos; deep link para operação existente com entidade/ano preservados; se não existir ação canónica, mostrar `Abrir módulo` sem prometer execução direta. |
| BREAD-01 | **P1** | Histórico contextual invisível ou repetitivo dificulta localizar posição e voltar de Professor/Disciplina/Turma (Claude). | Breadcrumb único e completo, significativo e navegável; `Voltar` retorna ao último contexto correto e acessível; sem duplicar títulos ou migalhas. |
| SCROLL-01 | **P1 — ergonomia** | Até três camadas de scroll relatadas; lista longa dentro de modal, especialmente em ecrãs pequenos, pode produzir scroll preso e perda de orientação. | Definir um scroll principal para conteúdo contextual, listas virtualizadas/paginadas apenas se necessário, header e ações previsíveis; ensaiar touch/teclado e posições longas. |
| KBD-01 | **P1** | Atalhos anunciados nem sempre funcionam em todas as vistas (Claude); não confundir descrição UI com atalho real. | Tabela oficial comando→vista→foco; cada atalho anunciado tem handler e teste, ou deixa de ser exibido; não capturar teclas ao digitar nem competir com o browser. |
| PRINT-01 | **P1 — a validar como requisito** | Secretarias podem precisar de pesquisa, ordenação, filtro e impressão/exportação de listas, mas não há prova de autorização nem fluxo adequado. | Especificar filtros e ordenação no banco; impressão/exportação **somente com permissão explícita**, escopo e contagem corretos, logs de auditoria e minimização de PII; não ativar exportação global por defeito. |
| A11Y-01 | **P1** | Fecho visível e gestão explícita de foco não demonstrados no explorador. | Botão fechar, foco inicial, Tab/Shift+Tab confinados, Escape, retorno ao disparador, `aria` apropriados, leitores de ecrã e movimento reduzido. Referência: [WAI-ARIA modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/). |
| DS-01 | **P2** | Componentes de métricas com variantes e semânticas inconsistentes (Claude). | Um contrato de Metric no design system: label, valor, unidade, fonte/estado, ausência de dados e variante semântica; não introduzir componente novo se já houver equivalente. |
| LANG-01 | **P2** | Linguagem mistura PT-BR, PT-AO e inglês em superfícies operacionais (Claude). | Definir glossário PT-AO de produto: `propina`, `turma`, `classe`, `matrícula`, `ano letivo`; revisão com utilizadores angolanos, sem substituir termos legais/canónicos sem validação. |
| MOTION-01 | **P2 — efeito a medir** | Transições encadeadas podem acrescentar atraso percebido mesmo quando a API é rápida. Falta medição visual autenticada. | Medir latência de clique→contexto interativo, separar rede/render/transição e respeitar `prefers-reduced-motion`; reduzir apenas onde houver impacto comprovado. |
| OBS-01 | **P2** | Erros PostgREST podem surgir como `unexpected` em Classe, Professor e Disciplina. | Tratamento consistente das cinco rotas: status adequado, código/razão interna e ID de correlação, sem detalhes privados no cliente. |
| PERF-01 | **P2** | Classe pode carregar até 3.000 matrículas para agregações e devolver 20 alunos/página. | `COUNT`/agregações SQL indexadas por escola/ano/classe e paginação no banco; verificar plano e medir p95, bytes e carga. |

**Priorização resultante:** **P0-UX** (atendimento sem perda de contexto), **P0-SEC/PRIV** (autorização por categoria, exposição de recentes/identificadores), **P1** (navegação/destinos, dados semânticos, pesquisa/listas, teclado, mobile e scroll), **P2** (desenho, linguagem, transições e otimização medida). **Acessibilidade básica e autorização de exportação permanecem gates de P1**, não devem ser adiadas como decoração.

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

### Fluxo de trabalho central — Turma → Aluno → Balcão → Turma (P0)

**Cenário de aceite:** uma funcionária abre uma turma com **45 alunos**, aplica `Apenas pendências documentais`, ordena por nome, chega à página 2 e seleciona o aluno 23. Abre o Balcão, resolve a pendência e volta. Deve reencontrar **a mesma turma, o mesmo filtro, ordenação, página, aluno destacado e posição de leitura**, com o estado documental revalidado. A seguir atende o aluno 24 sem repetir a pesquisa global.

**Contrato técnico a implementar (sem presumir que já existe):**

1. **Estado de navegação efémero por sessão autenticada**: `schoolId`, `academicYearId`, `portal`, identificador do utilizador, pilha de entidades (tipo/id), filtros, ordenação, cursor/página, `selectedStudentId` e âncora de leitura. Guardar apenas identificadores mínimos; **não** guardar BI, número de processo, documentos, notas ou pagamentos no `localStorage`.
2. **Transição controlada de contexto**: ao abrir atendimento, preservar no controlador do Command Center um `returnContext` validado; preferir passagem explícita ao Balcão existente, sem duplicar o Balcão e sem criar dois modais inacessíveis sobrepostos. Se a navegação exigir página, definir retorno seguro por estado/deep link *autorizado*, não por URL que conceda acesso.
3. **Após concluir/cancelar**: voltar à mesma posição e repor foco na linha de origem ou próxima linha válida. Se a matrícula tiver mudado de turma/ano ou for removida, mostrar aviso e recomputar os resultados; não forçar seleção de aluno inválido.
4. **Cache e dados**: preservar apenas **estado de visualização**, nunca tratar dados anteriores como atuais. Revalidar dados após alterações no Balcão; não manter resultados de sessão anterior ou escola diferente.
5. **Limites e exceções**: sessão expirada, mudança de utilizador/escola/ano/portal, tab fechada, URL alterada, aluno eliminado, matrícula transferida, filtros que já não abrangem o aluno, paginação deslocada. Nestes casos limpar contexto privado e oferecer retorno explícito seguro, não reabrir dados sem permissão.
6. **Caminho de retorno visível**: breadcrumb contextual e ação `Voltar à turma` / `Continuar atendimento nesta turma`, com rótulos que descrevem a consequência real. Não manter um fluxo operacional preso ao botão `Voltar` do browser.

**Fonte de verdade:** estado da interface para posição/filtros; Supabase/autorização atual para matrículas, documentos e pendências. **Não tratar `returnContext` como permissão.** Nunca reabrir o Balcão por deep link sem autorização atual.

### Contratos de apresentação e ação

- **Capacidade vs vagas:** `capacity = null` → `Não definida`; `available = max(capacity - activeEnrollmentCount, 0)` só quando capacidade e contagem estão verificadas no mesmo escopo; `overcapacity = max(activeEnrollmentCount - capacity, 0)` exibido à parte. Capacidade **não** é total disponível.
- **Links operacionais:** cada CTA deve declarar destino e resultado esperados; se apenas abre gestão geral, usar `Abrir gestão`, não `Atribuir professor` ou `Resolver pendência` sem o formulário/painel no contexto correto.
- **Breadcrumb:** `Pesquisa → Curso → Classe → Turma` como hierarquia quando o percurso de origem existir; para entrada direta em Professor/Disciplina, não inventar ancestrais que não fizeram parte da navegação.
- **Scroll:** uma região principal de leitura com cabeçalho e ações estáveis; permitir paginação/âncora da lista sem rolagens aninhadas involuntárias em desktop e mobile.
- **Teclado:** só anunciar comandos disponíveis; `Escape` deve obedecer às ações/estados do diálogo, sem fechar inadvertidamente outro workspace. Validar `Tab`, `Shift+Tab`, Enter, setas e foco após retorno.
- **Listas e impressão:** busca por aluno no conjunto total da turma, filtros e ordenação aplicados na consulta SQL antes da paginação; imprimir/exportar apenas o subconjunto explicitamente autorizado, com acesso auditado e minimização de dados.
- **Idioma:** interface operacional consistente em português de Angola; não alterar termos usados em documentos oficiais sem revisão.

### Estrutura de referência: Turma

1. **Cabeçalho:** nome da turma; Curso · Classe · Ano letivo · Turno; botão fechar.
2. **Indicadores:** alunos reais · capacidade aplicável · vagas (= máximo entre capacidade menos ocupação e zero, apenas se capacidade conhecida; quando lotada, indicar lotação sem ocultar excedente).
3. **Precisa de atenção:** pendências suportadas por fonte confiável, com estado `não publicado` distinto de `não cadastrado` ou `desconhecido`; cada aviso com destino operacional.
4. **Alunos:** pesquisar nesta turma; lista paginada; selecionar aluno e abrir atendimento no Balcão, se autorizado.
5. **Disciplinas e professores:** relações, abrir docente no modal; gerenciar atribuição na página existente.
6. **Percurso:** breadcrumbs e voltar preservando filtros, página e scroll; opção secundária `Abrir página`.

**Estados obrigatórios:** loading, vazio verdadeiro, erro, proibido, dados parciais e contexto histórico. Nunca converter falha de consulta em zero/vazio; evitar prometer vagas quando capacidade não foi configurada.

## 5. Plano de execução e critérios de aceitação

### Fase 0A — Continuidade operacional (P0-UX; bloqueia a próxima release funcional)

- [ ] Implementar controlador de percurso Turma→Aluno/Balcão→Turma, sem remount destrutivo, modais aninhados nem persistência de dados sensíveis.
- [ ] Preservar escola, ano, portal, cadeia de entidades, filtro, ordenação, página/cursor, seleção e âncora do scroll; impedir contaminação entre sessões e escolas.
- [ ] Revalidar dados e permissões após cada atendimento; tratar aluno transferido, eliminado, cancelado, sessão terminada e ano alterado sem perder orientação nem mostrar cache inválida.
- [ ] Criar fluxo visível `Voltar à turma` e `Continuar atendimento`, com foco devolvido à lista.
- [ ] Homologar sequência de **pelo menos três atendimentos** na mesma turma com 45+ alunos, filtros e paginação, incluindo um registo que muda durante o atendimento.

### Fase 0B — Segurança e privacidade (P0-SEC/PRIV; bloqueia igualmente a próxima release funcional)

- [ ] Inventariar função `public.search_global_entities`, views usadas, grants de `EXECUTE`, owner, `SECURITY DEFINER`, `search_path` e configurações reportadas pelo Security Advisor. Avaliar invoker quando viável; não remover definer sem validar RLS e regressões.
- [ ] Aplicar autorização de tipo por perfil **no servidor**; política `deny by default` também para `p_types` vazios, inválidos, repetidos e mistos; limitar paginação/cursor, impedir tipos não autorizados e evitar erros informativos que revelem existência de entidade.
- [ ] Testes com sessão real: Secretaria, Administração, Operações, papel mínimo e utilizador sem vínculo; escola A vs B; categorias académicas, financeiras e administrativas, chamadas diretas à RPC; confirmar ausência de dados e de bypass.
- [ ] Inspecionar payload persistido para BI/número de processo, além de nomes e termos; eliminar campos pessoais e verificar se o browser partilhado ainda consegue recuperar os registos antigos.
- [ ] Desligar persistência transversal de recentes (preferencial) e limpar cache em logout/login, troca de escola/ano/portal e alteração de sessão. Testar navegador partilhado com duas contas.
- [ ] Nenhum dado pessoal em snapshots de CI, logs ou documentação.

### Fase 1 — Fiabilidade e navegação

- [ ] Reconciliar PR #231 com a `main` antes de implementar outra correção de Professor; não duplicar o mesmo comportamento.
- [ ] Garantir clique e Enter de Professor no contexto modal; fallback autorizado e explícito.
- [ ] Resultados com `Ver mais`, nome + contexto suficiente para distinguir homónimos; erro ≠ vazio; retry.
- [ ] Entrada mobile, fecho e foco acessíveis.
- [ ] Persistir histórico contextual (filtro, página, seleção e scroll) sem carregar dados de outra escola/ano/sessão.
- [ ] Linha de turma no Curso abre direto; filtro `Todas as classes` sincronizado em todas as camadas.
- [ ] Auditar *todos* os CTAs e respetivos hrefs: rótulo, entidade, destino, permissões, contexto preservado e comportamento de fallback.
- [ ] Breadcrumb único e não repetitivo com percurso verdadeiro, retorno e foco restaurado.
- [ ] Definir e testar uma única região principal de scroll do contexto; remover encadeamento de três scrolls quando reproduzido.
- [ ] Inventariar atalhos anunciados por vista; corrigir handlers ou remover promessa; validar conflitos com input e browser.

### Fase 2 — Utilidade operacional

- [ ] Validar fonte e semântica de cada indicador e pendência antes de expor alertas.
- [ ] Curso: classes sem turmas, capacidade/ocupação e acesso rápido a turma.
- [ ] Classe: alunos pesquisáveis, vagas e vínculos docentes verificáveis.
- [ ] Turma: alunos, vagas e fluxo para Balcão; disciplinas → professores selecionáveis.
- [ ] Corrigir semântica de capacidade, ocupação, vagas disponíveis e excedente; `Não definida` em vez de zero inventado.
- [ ] Busca local, filtros e ordenação sobre a lista **total** no servidor antes da paginação; resultados estáveis ao voltar do Balcão.
- [ ] Definir se impressão/exportação de listas é apropriada por papel, escola e finalidade; **não exportar PII sem autorização explícita, minimização e auditoria**.
- [ ] Professor: agenda e estados de atribuição/publicação separados.
- [ ] Disciplina: matriz × atribuição à turma × docente, com destinos operacionais existentes.

### Fase 3 — Consistência e desempenho

- [ ] Unificar cabeçalho, tipografia, densidade, estados vazios/erro e ações, incluindo contrato único de `Metric`; sem cartões supérfluos, modais aninhados ou animações complexas.
- [ ] Rever terminologia com glossário PT-AO e testes de linguagem com a Secretaria.
- [ ] Medir custo de transições/animações separadamente do tempo de rede; simplificar atrasos comprovados e respeitar movimento reduzido.
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
| **Continuidade P0** | Turma com 45 alunos, filtro e ordenação, página 2, atender 3 alunos sucessivos no Balcão e regressar | Mesmo contexto, scroll, foco e seleção; pendência atualizada; sem nova pesquisa nem cache indevido. |
| Mudança de matrícula | Enquanto o Balcão está aberto, aluno é transferido/cancelado, permissões mudam ou sessão termina | Retorno seguro e dados revalidados; sem seleção fantasma ou leitura fora do escopo. |
| Capacidade | Capacidade nula, igual à ocupação, acima/abaixo da ocupação, alunos transferidos | Indicadores distintos e coerentes de capacidade, ocupação, vagas e excedente. |
| Ações/CTAs | Abrir atribuição, horário, docente e Balcão a partir de cada explorador | Cada ação chega ao contexto correto, ou é rotulada como gestão geral, sem falsa promessa. |
| Scroll e teclado | Três scrolls relatados, teclas anunciadas por vista, mobile e ecrã estreito | Rolagem previsível, atalhos reais e foco restaurado após regressar do Balcão. |
| Listas e exportação | Pesquisa/filtro/ordenação em mais de 50 alunos, impressão/exportação por papel | Operação sobre universo completo, sem truncagem; exportação autorizada e auditada, sem PII extra. |
| Acessibilidade | Clique, Enter, setas, Tab, Shift+Tab, Escape, leitor de ecrã e retorno ao disparador | Foco confinado ao diálogo, fecho visível, estado comunicado, sem aprisionamento após fechar. |
| Dispositivos | Desktop e mobile, teclado virtual, rotação e diferentes larguras | Pesquisa alcançável e operável em todas as vistas. |
| Rede/erros | Falha RPC, PostgREST, timeout, sessão expirada, erro inesperado, retry | Erro distinto de ausência de dados; mensagem útil sem PII; recuperação previsível. |
| Ações | Balcão e operações canónicas de docente, horários e matrícula | Autorização revalidada na escrita; sem edição duplicada no explorador. |

**Critério de saída:** ambos gates P0 (continuidade e autorização/privacidade) executados e documentados; testes unitários/integrados + DB/RLS + E2E autenticados verdes; métricas de runtime analisadas; validação com contas reais dos três portais e papel sem acesso, duas escolas, ano histórico, desktop/mobile e casos de 50+ alunos. Um resultado de CI ou deployment READY isoladamente **não fecha** este gate.

## 7. Rastreabilidade e dependências

- Referência de produto: [modal contextual](./command-center-contextual-modal.md), [roadmap da pesquisa global](./global-search-roadmap.md).
- Consolidação: [PR #229](https://github.com/moxi-edtech/moxi-edtech/pull/229); correção de Turma: [PR #230](https://github.com/moxi-edtech/moxi-edtech/pull/230); Professor/Secretaria pendente: [PR #231](https://github.com/moxi-edtech/moxi-edtech/pull/231).
- Código-alvo: `apps/web/src/hooks/useGlobalSearch.ts`, `apps/web/src/components/CommandPalette.tsx`, `apps/web/src/components/secretaria/command-center/CourseContextView.tsx`, `ClasseContextView.tsx`, `TurmaContextView.tsx`, `DisciplinaContextView.tsx`, `ProfessorContextView.tsx` e endpoints `apps/web/src/app/api/escolas/[id]/command-center/**`.
- SQL: `public.search_global_entities` e RPCs/views académicas correspondentes; confirmar permissões no banco efetivo antes de propor migrations.
- Acessibilidade: [W3C WAI-ARIA APG — Modal dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

## 8. Decisões e limites

**Aprovado como direção de produto:** explorador como camada de orientação contextual, leitura segura, pendências verificadas e atalhos para módulos existentes. **Não aprovado/implementado por esta documentação:** nova API, nova migration, alteração de RBAC/RLS, alterações visuais ou deploy.

**Próxima release:** não agregar novos widgets antes de fechar UX-00, SEC-01, PRIV-01/PRIV-02, MOB-01 e os fluxos críticos da Fase 1. **A experiência principal é atender vários alunos sem reconstruir a navegação; é um requisito funcional de release, não um refinamento estético.** O desenho da permissão por tipo deve ser validado no banco antes de afirmar que não existe exposição.

## 9. Execução de engenharia de 22/10/2026 — implementação P0/P1 em PR separada

**Implementação:** [PR #234 — continuidade do explorador e segurança da pesquisa](https://github.com/moxi-edtech/moxi-edtech/pull/234), branch `feat/command-center-operational-p0-20261022`, a partir da `main` `25aeb549`. **Documentação:** esta [PR #233](https://github.com/moxi-edtech/moxi-edtech/pull/233) permanece separada. A PR #231 continua dependência de reconciliação (a PR #234 inclui a ampliação da pesquisa de entidades na Secretaria).

**Convenções:** `CÓDIGO` = alterado e versionado; `TESTE SINTÉTICO` = validado em fixture/CI, **não** homologação real; `PENDENTE` = não implementado ou não validado. Nenhum dos estados equivale automaticamente a `PRODUÇÃO`.

### Entregas versionadas

- **UX-00 / NAV-04 (CÓDIGO):** preservação do contexto de Turma/Classe ao passar um aluno ao Balcão modal existente; sinal de fecho do Balcão na Topbar reabre o explorador; estado de página, aluno selecionado e scroll por Turma/Classe é guardado no componente principal. Após o fecho do Balcão ocorre invalidação de queries; nenhuma autorização nasce do contexto de retorno.
- **MOB-01 (CÓDIGO):** entrada da pesquisa deixa de estar oculta em ecrãs abaixo de `md`. Responsividade real ainda por validar.
- **PRIV-01/PRIV-02 (CÓDIGO):** eliminação da escrita de recentes em `localStorage`; limpeza dos `klasse:global-search:recent:*` legados; recentes limitados à memória da instância, sem `highlight` (BI/processo); cache de resultados isolada por instância e invalidada em troca de sessão/escola/portal; gerações de pesquisa e `abortSignal` impedem que respostas obsoletas se sobreponham.
- **SRCH-01/SRCH-02 (CÓDIGO):** `Ver mais resultados`, erro visível distinto de vazio e `Tentar novamente` no modal; regresso do professor à vista contextual em Secretaria via tipos pesquisáveis.
- **NAV-02/NAV-03/BREAD-01 (CÓDIGO):** turma selecionada diretamente a partir da linha no Curso; `Todas as classes` sincroniza callback; percurso contextual com breadcrumb e botão fechar.
- **DATA-01 (CÓDIGO):** capacidade definida, alunos, vagas disponíveis e excedente diferenciados na Turma; Classe deixa de chamar `Vagas` ao agregado de capacidades.
- **SEC-01 (CÓDIGO + TESTE SINTÉTICO):** migração `supabase/migrations/20271022130000_command_center_search_role_authorization.sql`, com allowlist por papéis de `escola_users` na RPC `SECURITY DEFINER`, `deny by default` para tipos nulos, desconhecidos ou mistos e manutenção do escopo por escola. CI `Command Center Search Authorization` aplica a migração em PostgreSQL 17 descartável com dados fictícios e valida Secretaria, Financeiro, Professor, Administração e dois tenants. **Não foi aplicada ao Supabase de produção.** O acesso amplo a alunos por Professor/Aluno é negado até haver regra de visibilidade individual/por turma.
- **Testes de regressão (CÓDIGO):** `apps/web/tests/unit/command-center-operational-continuity.spec.ts` e `supabase/ops/tests/regression_command_center_search_authorization.sql`, integrados em workflows GitHub Actions. Os testes estáticos de continuidade não substituem E2E.

### Backlog vivo pós-implementação

| Prioridade | ID | Estado | Próxima entrega / critério de aceite |
| --- | --- | --- | --- |
| **P0-SEC** | SEC-01 | **CÓDIGO + TESTE SINTÉTICO; NÃO APLICADO** | Provar a matriz com sessões autenticadas reais (Admin, Secretaria, Financeiro, Professor, Aluno, sem acesso) e duas escolas; conferir compatibilidade com perfis `profiles` sem vínculo em `escola_users`; aplicar migração pelo pipeline só depois dos gates, reconfirmar `pg_proc`, grants e advisors. |
| **P0-UX** | UX-00 | **CÓDIGO; E2E PENDENTE** | Homologar três atendimentos consecutivos numa Turma com 45+ alunos, sem perda de filtro, página, scroll e foco; cobrir aluno transferido/cancelado, ausência no lote, troca de escola e sessão expirada. |
| **P0-PRIV** | PRIV-01/02 | **CÓDIGO; BROWSER PENDENTE** | Testar duas contas seguidas no mesmo navegador, incluindo recuperação de armazenamento legado; confirmar que BI/processo não aparecem no armazenamento nem em caches persistentes. |
| **P1** | NAV-01 | **CÓDIGO; PR #231 A RECONCILIAR** | Evitar duplicar commits da #231 e testar clique/Enter/fallback de Professor, Classe e Curso na Secretaria com permissões reais. |
| **P1** | MOB-01, A11Y-01, KBD-01 | **PARCIAL** | E2E desktop/mobile: foco inicial, Escape, Tab/Shift+Tab, regresso ao disparador, leitor de ecrã e teclado virtual; todos os atalhos mostrados devem funcionar na vista onde aparecem. |
| **P1** | NAV-04, BREAD-01, SCROLL-01 | **PARCIAL** | Completar pilha com estados por entidade e scroll ao navegar Professor/Disciplina, reduzir scroll aninhado em Classe/Curso e verificar breadcrumb sem contexto duplicado. |
| **P1** | SRCH-01/02 | **CÓDIGO; REGRESSÃO E2E PENDENTE** | Cobrir 0/8/9/50+ resultados, homónimos, falha RPC, timeout, mudanças rápidas de query, paginação e sucessivas pesquisas. |
| **P1** | LINK-01 | **PENDENTE** | Inventariar e testar cada CTA até à operação real; renomear atalhos genéricos para não prometer navegação direta inexistente. |
| **P1** | DATA-01 | **PARCIAL** | Verificar contagens e limites históricos/cancelados/transferidos; documentar capacidade nula, zero, lotação completa e excedente nas cinco vistas. |
| **P1** | PRINT-01 | **PENDENTE** | Pesquisa, filtros e ordenação server-side em Turma/Classe; especificar impressão/exportação com RBAC, escopo de escola, minimização de PII e auditoria antes de habilitar. |
| **P2** | PERF-01 | **PENDENTE** | Migrar agregação de 3.000 matrículas da Classe para SQL/paginação no banco; comparar `EXPLAIN`, p95 e payload. |
| **P2** | OBS-01 | **PENDENTE** | Uniformizar erros PostgREST das cinco rotas e IDs de correlação sem expor informação sensível. |
| **P2** | DS-01, LANG-01, MOTION-01 | **PENDENTE** | Reutilizar Metric existente, glossário PT-AO e medir impacto de transições antes de alterá-las. |

**Gates para merge/publicação:** CI relevante verde no **HEAD** da PR #234, SQL testado sinteticamente, autorização com sessões reais e duas escolas, testes do ciclo do Balcão e mobile/teclado. A aplicação da migração de segurança e o deployment exigem coordenação para evitar alterar o contrato SQL em produção antes do frontend. Não confundir merge da documentação com deploy do produto.
