# KLASSE — Portais Drawer-First

**Registo de decisão, implementação e homologação · 26/11/2026**

- PR: [#498](https://github.com/moxi-edtech/moxi-edtech/pull/498)
- Branch: `feat/portals-drawer-first`; destino: `main`.
- Base: [`c0aa7aec`](https://github.com/moxi-edtech/moxi-edtech/commit/c0aa7aec8bcd4da7f43458308b7c6cd733fccff8).
- Snapshot de código documentado: [`e4a96d19`](https://github.com/moxi-edtech/moxi-edtech/commit/e4a96d193e865f92342124d1c824c2bf5b779232); 82 commits e 45 ficheiros alterados antes deste documento.
- Estado: implementado em branch de desenvolvimento, PR Draft. Não equivale a disponibilização em produção.
- Âmbito: dashboards dos portais do aluno e professor, componentes de operação e rotas directas que reutilizam esses componentes. Portais administrativos e secretaria fora do âmbito.

## 1. Decisão de produto

Adoptar **Drawer-First, não Drawer-Only**. A dashboard deixa de ser um catálogo de links e torna-se um espaço de trabalho contextual. Uma consulta ou operação que caiba num drawer deve ser aberta e concluída ali, sem redireccionar o utilizador a outra secção do portal. A navegação global pelo menu inferior, sidebar e rotas directas continua a ser navegação entre páginas. A página completa é reservada para tarefas que realmente precisam de área de trabalho extensa.

Motivação: reduzir trocas de contexto, cliques e perda da posição na dashboard; aproveitar a mesma experiência em telemóvel e computador; não duplicar motores de negócio, contratos, componentes ou regras de acesso.

Regras de decisão:

| Situação | Padrão |
|---|---|
| Consulta, lista, filtros, detalhe, formulário curto, confirmação, exportação | Drawer contextual |
| Sequência de operações relacionadas | Um drawer principal, frames de navegação ou subpainéis inline |
| Navegação global pelo menu | Rota dedicada preservada |
| Editor complexo com várias ferramentas, pré-visualização e composição extensa | Página completa |
| Pagamento de referência | Confirmação financeira isolada, sem mudar a rota |
| Impressão ou download de documento | Fluxo original autorizado; não simular emissão ou pagamento no cliente |

Design: identidade KLASSE, verde de marca e dourado para acções, superfícies e texto com tokens semânticos, cartões e controlos arredondados, foco visível, áreas de toque adequadas, hierarquia simples e layouts compactos. Em mobile usar bottom sheet; a partir de 1024px, o navegador usa painel lateral direito (até 46rem). O conteúdo deve caber no painel, não apenas na viewport. Evitar overlays sobrepostos, cabeçalhos de página duplicados e scroll da dashboard durante a operação. Compatibilidade com temas Claro/Escuro/Sistema; não introduzir cores neutras fixas em componentes operacionais.

## 2. Infraestrutura partilhada

Ficheiros sob `apps/web/src/components/portal/ui/`:

- `PortalDrawerNavigator.tsx`: recebe root, open, onClose e onChanged. Um PortalSheet por navegador. Cada frame tem id, title, description, content e size opcional. Pilha local permite avançar e voltar; pais mantêm-se montados mas escondidos, preservando estado. Captura posição de scroll e elemento iniciador; restaura ao voltar. Evita duplicar IDs na pilha. IDs e keys devem incluir o âmbito da escola/ano/aluno/turma conforme aplicável.
- `PortalDrawerPushButton` e `usePortalDrawerNavigation()`: entrada contextual e acesso às operações push, notifyChanged e estado busy/dirty. Não representam autorização.
- `usePortalDrawerGuard(dirty,busy)`: registo independente por frame e formulário (useId), com limpeza no desmontar. Busy bloqueia saída e avanço; dirty bloqueia avanço e exige confirmação de descarte ao voltar/fechar. A confirmação do browser é a implementação actual; não cobre por si só browser Back, navegação global ou mudança externa de âmbito.
- `PortalSheet.tsx`: mantém modalidade Radix, foco, Escape, controlo de encerramento e restauração de foco; acrescenta onBack, navigationKey, bodyRef e modo inline. InlinePortalPanel é uma região não modal com título/descrição acessíveis, foco e retorno. Preserva a modalidade normal fora do navegador.
- `app/globals.css`: responsividade e movimento lateral no desktop para o navegador; mantém bottom sheet no mobile.
- `notifyChanged()`: sinal de mutação confirmada; o callback onChanged permite actualizar a dashboard ao fechar. Não constitui confirmação de pagamento nem substitui resposta do servidor.

Padrão de extensão: extrair o workspace existente para componente reutilizável; manter página directa como wrapper; fornecer contexto explícito; usar importação dinâmica onde fizer sentido; eliminar cabeçalho e layout de ecrã completo apenas em embedded; reaproveitar o endpoint e tratamento de erros existentes. Adicionar guardas aos formulários e suboperações; usar frame com componente autónomo, evitando capturar ReactNode dependente de estado mutável de um pai (a pilha guarda o frame no momento do push). Não duplicar loaders, tabelas, regras de negócio ou writers. Validar resposta e âmbito antes de renderizar/alterar dados.

## 3. Portal do professor

Entrada: `app/professor/page.tsx`. A dashboard contém atalhos operacionais, agenda, turmas e indicadores. As rotas de frequências, planos, materiais, notas, calendário e horário da turma continuam disponíveis e delegam aos mesmos workspaces.

| Funcionalidade | Implementação no snapshot |
|---|---|
| Perfil da turma | Drawer com disciplinas atribuídas, atalhos de chamada, notas, plano, materiais e horário; roster autorizado |
| Agenda e aula | Detalhe da aula; acções de chamada, notas e plano mantêm o contexto turma/disciplina |
| Horário da turma | ProfessorTurmaHorario reutilizado pela rota e drawer; consulta com cancelamento de requisição |
| Chamada/presenças | ProfessorFrequenciasWorkspace: selecção contextual, marcações individuais/em lote, data, guarda, estados offline e tratamento de erro de fila; guardas de alterações e submissão |
| Planos de aula | ProfessorPlanosWorkspace: consulta, criação, edição e envio conforme estados existentes; filtros por atribuição, confirmação de descarte, foco no formulário |
| Materiais | ProfessorMateriaisWorkspace: pesquisa, consulta, criação e publicação/actualização conforme fluxo existente; formulário inline, selecção turma/disciplina, guardas |
| Calendário académico | ProfessorCalendarWorkspace: eventos, próximos marcos, eventos anteriores e respectivos detalhes |
| Calendário de avaliações | Vista específica, avaliações próximas, histórico filtrado por período e impressão pelo endpoint existente |
| Períodos lectivos | Vista do mesmo calendário, datas, estado temporal e fecho de notas |
| Consulta individual | Clique no roster abre ProfessorStudentGrades: leitura de MAC/NPP/NPT/média conforme componentes e escala, disciplina atribuída e trimestre, correspondência aluno + matrícula; sem dossier administrativo/financeiro |
| Lançamento de notas | ProfessorGradesWorkspace: selecção de turma/disciplina/trimestre, grelha compacta, lançamento manual/colagem Excel, autosave, guarda e conclusão conforme permissões |
| Pedidos académicos | Reabertura, análise de elegibilidade/RAA, reapreciação e exames/recurso reaproveitam o fluxo de notas já existente; subpainéis inline quando incorporados |
| Exportações | Configuração de mini-pauta de conferência no drawer, opção de colunas dos outros trimestres e PDF; calendário com impressão. Não é emissão de pauta final |
| Elaboração de provas | Excepção: atalho conserva rota de provas; editor/wizard, expressões matemáticas, reordenação, cotações e pré-visualização A4 justificam ecrã completo. A listagem de provas ainda não foi inventariada/convertida |

### Contexto e notas

`operationScope` combina escola e ano lectivo solicitado. Frames recebem turma/disciplina, quando presentes, sem transformar o URL da dashboard. Notas passam o ano à API de atribuições e verificam o contexto retornado; filtram atribuições quando incorporadas. A consulta de pauta usa o vínculo da disciplina e o ano/trimestre, mantendo a política canónica de disponibilidade de lançamento (resolveGradeEntryAvailability) e modo histórico de leitura. `pautaReady` depende de loadedPautaScope === raaScope. O writer de notas, chaves de idempotência e fila offline permanecem existentes.

GradeEntryGrid usa layout de cartões em compact, preserva tabela na rota normal; protege alterações pendentes e colagem não aplicada. Em drawer não inicia gravação adicional ao desmontar após descarte; a rota autónoma conserva comportamento anterior. Os controlos de mudança de contexto são bloqueados enquanto existirem rascunhos/submissões conforme guardas actuais. Solicitações de reabertura/reapreciação e resultados de exame têm estados busy. Notas sincronizadas e mutações de notas sinalizam actualização dos indicadores no fecho. Isto não substitui testes de concorrência real (autosave vs guardar, mudança de período, revogação da janela, offline e fecho). Não afirmar protecção transaccional nova: nenhuma API/writer foi alterado.

Consulta individual reutiliza a API de pauta da turma, que autoriza professor/disciplina; filtra a resposta por aluno_id **e** matricula_id na UI. A API continua a retornar a pauta autorizada, não uma projecção individual nova. Não executar N consultas para carregar toda a turma; carregar a consulta apenas ao seleccionar um aluno/disciplina. Futuro: avaliar endpoint de projecção individual caso medições justifiquem, mantendo autorização do servidor. Roster limitado a 200 pelo contrato existente; lista não garante totalidade acima desse limite. Calendário/roster/consulta individual preservam ano lectivo; ainda é necessário auditar propagação uniforme do ano em agenda, materiais, planos e chamada (em particular atribuições da chamada).

## 4. Portal do aluno

Entrada: `components/aluno/dashboard/DashboardLoader.tsx`. Cards de resumo e pendências accionáveis abrem drawers. `StudentDrawerWorkspace.tsx` carrega áreas académica, financeira e documental dinamicamente, mantendo AuditPageView; encaminhamentos entre áreas usam push ou callbacks locais, sem trocar a URL principal. As rotas directas e o menu inferior permanecem disponíveis.

| Funcionalidade | Implementação no snapshot |
|---|---|
| Avisos | Card, lista e detalhe em drawer; aviso recente na dashboard abre resumo, com acesso à lista completa; não confundir resumo com corpo integral |
| Próxima aula/horário | Vista diária; acesso à vista semanal por frame, no mesmo contexto |
| Notas/boletim | Card abre AcademicoWorkspace; separadores notas, disciplinas, faltas, documentos; detalhe de avaliação e situação académica inline |
| Disciplinas | Consulta no workspace académico existente |
| Faltas | Consulta, detalhe, motivo/justificação e submissão pelo contrato existente; confirmação de descarte e bloqueio durante envio |
| Reapreciação e melhoria | Formulários académicos inline, motivo, sessão aplicável e guardas; fallback autónomo de diálogo |
| Propinas e situação financeira | Card de propinas vencidas e pendências abre TabFinanceiro; selecção e consulta de mensalidades/serviços, detalhe, filtros por período |
| Comprovativos | PaymentDrawer e ServicePaymentDrawer suportam modo inline; preservam upload e lock contra submissão repetida, validação do serviço e estados de pagamento |
| Pagamento por referência | AppyPayReferenceButton mantém diálogo isolado, protecção de criação/verificação, sinal de alterações confirmadas sem redirecção |
| Documentos e serviços | Catálogo, pedidos, emissão conforme disponibilidade, pagamento e comprovativos existentes; transições financeiras para documentos e destes para notas/avisos |
| Rematrícula | Ainda na rota académica existente; não convertida nesta PR |

### Contexto e financeiro

O loader preserva parâmetros de aluno/ano no contexto e diferencia estados pelo drawerScope. AcademicoWorkspace em embedded muda separadores localmente sem pushState; bloqueia troca enquanto o navegador sinalizar busy/dirty. O bloqueio de notas/boletim, leitura histórica, matrícula e acesso às avaliações continuam regidos pelos contratos existentes. Faltas, notas, documentos e comprovativos reutilizam endpoints, políticas de liberação e fluxos prévios. TabFinanceiro mantém chave do aluno, abort/escopo de requisições, locks, polling existente e usa inert no conteúdo subjacente durante comprovativo; actualiza estado local e assinala mutações confirmadas para refresh do resumo após fecho. Não criar novo pagamento ao voltar ou reabrir; não marcar liquidado com base no simples envio de comprovativo. Emissão/download continua a usar a autorização do backend.

## 5. Segurança, performance e integridade

- Diff do snapshot: nenhuma alteração em migrations, API routes, policies RLS, dependências, ou esquema de dados. Isto limita o âmbito da mudança; não prova ausência de regressão de segurança.
- Autorização real é do servidor e RLS, nunca da ocultação de um botão nem de filtros React. Escola, ano, turma, matrícula, disciplina, vínculo e perfil precisam de validação no contrato existente. Dados de outras escolas/alunos não podem aparecer em transições, cache, respostas tardias ou durante carregamento.
- Preservar modo histórico, escala de avaliação, janela de lançamento, reabertura, documentos bloqueados e estados financeiros. Sem alteração das regras de acesso ou dos preços.
- Lazy loading de workspaces; não carregar todos os módulos de operação ao abrir dashboard; consultas de detalhes sob demanda; cancelamento/validação de respostas onde implementado. Pais mantidos montados implicam que polls/efeitos existentes podem continuar activos enquanto escondidos. Medir antes de aumentar concorrência e suspender trabalho de fundo desnecessário numa rodada própria.
- Confirmar rascunhos e bloquear fecho durante mutações; não duplicar writers, idempotência ou pagamentos. Guardas cliente são UX, não garantias transaccionais.
- Reutilização das rotas e componentes reduz duplicação e divergência. Não modificar o motor fiscal, cobrança de provas, autorização fiscal ou demais módulos externos a este sprint.

## 6. Evidências e evolução do CI

Rodadas:
1. Infraestrutura e primeiras operações do professor/aluno (turma/aula/horário, chamada, planos/materiais, avisos/horário).
2. Workspace académico, financeiro e documental do aluno; guardas agregadas, subpainéis inline e refresh contextual.
3. Calendário, períodos, avaliações, notas, consulta individual e mini-pauta do professor; layouts compactos, contexto e guardas de autosave.
4. Correcções de regressão: token de overlay dos materiais, testes apontando aos componentes extraídos, fixture visual de cards convertidos em botões (abre, fecha, preserva rota e foco); e remoção de expressão ternária órfã da antiga URL da agenda.

Evidência anterior: commit [3185c214](https://github.com/moxi-edtech/moxi-edtech/commit/3185c214e377c44fc848f2af84c38a16b0de9437) teve 11/11 workflows aprovados, antes da terceira rodada. Commit [9da1bb89](https://github.com/moxi-edtech/moxi-edtech/commit/9da1bb899c585d638dbb0b9022c54cac2484f3ba) teve 6 aprovados e 5 falhados; TypeScript e Vite apontaram à mesma expressão incompleta em professor/page.tsx. Correcção no snapshot e4a96d19.

**Consulta dos workflows do snapshot e4a96d19 durante a documentação:** 10 aprovados, 0 falhados/terminados sem sucesso, 1 pendentes/em execução, 11 encontrados. Estes resultados são históricos e não certificam commits subsequentes.

| Workflow | Resultado consultado | Evidência |
|---|---|---|
| Portal Visual Fixture Screenshots | in_progress | [Run 45912216269](https://github.com/moxi-edtech/moxi-edtech/actions/runs/45912216269) |
| Next.js Route Segment Integrity | success | [Run 45912216294](https://github.com/moxi-edtech/moxi-edtech/actions/runs/45912216294) |
| KF2 Search Audit | success | [Run 45912216403](https://github.com/moxi-edtech/moxi-edtech/actions/runs/45912216403) |
| Bolsa Integral SSOT · PostgreSQL 17 | success | [Run 45912216270](https://github.com/moxi-edtech/moxi-edtech/actions/runs/45912216270) |
| Legacy PR Reconciliation Guard | success | [Run 45912216337](https://github.com/moxi-edtech/moxi-edtech/actions/runs/45912216337) |
| Boletim Portal Contracts | success | [Run 45912216348](https://github.com/moxi-edtech/moxi-edtech/actions/runs/45912216348) |
| KLASSE Portal Consolidation | success | [Run 45912216305](https://github.com/moxi-edtech/moxi-edtech/actions/runs/45912216305) |
| Theme Switcher Guard | success | [Run 45912216313](https://github.com/moxi-edtech/moxi-edtech/actions/runs/45912216313) |
| Gracefulness Academic Carryovers | success | [Run 45912216316](https://github.com/moxi-edtech/moxi-edtech/actions/runs/45912216316) |
| Balcao academic operations | success | [Run 45912216314](https://github.com/moxi-edtech/moxi-edtech/actions/runs/45912216314) |
| Provas pedagógicas — segurança e impressão | success | [Run 45912216489](https://github.com/moxi-edtech/moxi-edtech/actions/runs/45912216489) |

Testes estáticos/contratos cobrem integração de triggers, wrappers, navegação, guardas, escopo, contratos de notas e pagamento; fixture visual verifica dashboard do aluno e acções reais de abrir/fechar avisos, académico e financeiro, mesma rota e retorno do foco; matrizes de viewports/zoom e temas. Testes sintéticos não equivalem a operação ponta a ponta com dados reais. Ver [checks actuais da PR](https://github.com/moxi-edtech/moxi-edtech/pull/498/checks).

## 7. Checklist de homologação e backlog

### Revisão da PR após o snapshot

| Área | Alteração e evidência |
|---|---|
| Navegação | Back/Forward percorrem as posições do drawer na mesma URL. O histórico contém apenas um identificador opaco e a profundidade. A instância com âmbito de escola e ano conserva os frames em memória. Foi acrescentado um percurso Back → Forward → Escape à fixture visual. |
| Notas | Guardar agora e autosave partilham a fila da grelha. A confirmação de um lote actualiza a pauta persistida sem substituir os dados iniciais da grelha durante a edição. Uma falha pode ser repetida pelo botão Guardar. A consulta de conclusão deixou de invalidar o resumo. |
| Chamada, planos e materiais | As mutações confirmadas sinalizam actualização no fecho. A chamada consulta as atribuições do ano pedido e bloqueia escrita histórica. Planos e materiais são operações do ano activo. |
| Provas | A consulta paginada usa a autorização, a ordenação e a projecção de resumos do endpoint existente. O filtro opcional por ID de ano é aplicado antes da paginação. A elaboração continua no editor completo. |
| Rematrícula | O cartão abre o fluxo existente no drawer. O estado `failed` permite corrigir o comprovativo na mesma intenção. Um envio pendente com comprovativo apresenta o estado de análise. A rematrícula opera sobre o aluno da sessão e a janela activa; o cartão é omitido quando existe selecção explícita de educando ou ano. |
| Avisos | A definição versionada em `populate_student_portal_life.sql` projecta `notices.conteudo AS resumo`. O detalhe já apresenta esse campo integral, enquanto o cartão limita visualmente o texto a duas linhas. A definição efectiva em produção requer confirmação. |

A homologação financeira real foi dispensada pelo responsável do produto nesta revisão. O ambiente local executou o percurso Back → Forward → Escape em Chromium com 390 e 1366 px. A fixture da grelha executou gravações sobrepostas nas escalas 10 e 20, manteve o valor da edição mais recente e repetiu o lote após uma resposta 409. Os pedidos dessa fixture são sintéticos.

A lista abaixo regista os critérios originais. Os testes académicos com contas de homologação e a concorrência entre sessões exigem evidência própria. A decisão de integrar depende dessa homologação.

Não considerar a PR pronta só porque testes de contrato passaram. Antes de merge/deploy:

- [ ] Novo SHA com todos os checks exigidos aprovados; validar TypeScript, lint e build de produção (sem presumir que cada job já os executou).
- [ ] Homologar os dois portais em mobile/desktop, temas, zoom, teclado virtual, foco, scroll, botão Voltar interno, Escape, toque exterior e controlos de 44px.
- [ ] Testar fluxos reais com contas de teste e dados autorizados: chamada online/offline e falha de fila; plano/material; notas autosave/manual/conclusão, fecho/reabertura, histórico, mudança de contexto, escala 0–10/0–20 e resultados de exame; exportação de mini-pauta e impressão de calendário.
- [ ] Testar aluno: notas bloqueadas/liberadas e histórica; justificação; pedidos de melhoria/reapreciação; filtros financeiros, pagamentos por referência, comprovativo aceite/rejeitado, repetição de submissão, documentos gratuitos/pagos e emissão/download.
- [ ] Testar troca de escola/aluno/ano e requisições fora de ordem; acesso indevido à turma/disciplina/matrícula; nenhum dado antigo visível nem rascunho aplicado a outro âmbito.
- [ ] Integrar comportamento browser Back/Forward, beforeunload e navegação global com guardas; evitar reabrir estado obsoleto ao regressar a um âmbito anterior; rever frames capturados e desmontagem forçada.
- [ ] Completar rematrícula do aluno (incluindo comprovativo rejeitado/pendente) sem inventar novo fluxo de negócio.
- [ ] Avaliar listagem/consulta simples de provas como drawer; manter editor complexo em página completa.
- [ ] Rever detalhes de aviso recente para abrir o conteúdo integral directamente; validar transições de documentos/serviços e painéis secundários restantes (ex.: desistência e diálogo de referência).
- [ ] Uniformizar refresh do professor após chamada/planos/materiais e auditar propagação do ano lectivo; confirmar guarda e UX de selecção em contexto histórico.
- [ ] Medir requisições, bundles, polling, memória e latência; não assumir ganho de performance sem números.
- [ ] Remover Draft, reconciliar main e aprovar merge somente após homologação. Deploy é etapa explícita posterior; não há migração desta PR.

## 8. Inventário exacto de ficheiros de código/testes

Comparação base...snapshot, anterior à documentação. Links apontam ao SHA documentado, para preservar a evidência. A tabela não inclui o presente ficheiro.

| Ficheiro | Alteração |
|---|---|
| [`apps/web/scripts/visual/portais-screenshot.mjs`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/scripts/visual/portais-screenshot.mjs) | modified (+27/−16) |
| [`apps/web/src/app/globals.css`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/src/app/globals.css) | modified (+14/−2) |
| [`apps/web/src/app/professor/calendario/page.tsx`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/src/app/professor/calendario/page.tsx) | modified (+10/−492) |
| [`apps/web/src/app/professor/frequencias/page.tsx`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/src/app/professor/frequencias/page.tsx) | modified (+8/−505) |
| [`apps/web/src/app/professor/materiais/page.tsx`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/src/app/professor/materiais/page.tsx) | modified (+2/−371) |
| [`apps/web/src/app/professor/notas/page.tsx`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/src/app/professor/notas/page.tsx) | modified (+7/−1310) |
| [`apps/web/src/app/professor/page.tsx`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/src/app/professor/page.tsx) | modified (+68/−42) |
| [`apps/web/src/app/professor/planos-aula/page.tsx`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/src/app/professor/planos-aula/page.tsx) | modified (+2/−99) |
| [`apps/web/src/app/professor/turmas/[turmaId]/horario/page.tsx`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/src/app/professor/turmas/%5BturmaId%5D/horario/page.tsx) | modified (+2/−102) |
| [`apps/web/src/components/aluno/academico/AcademicoWorkspace.tsx`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/src/components/aluno/academico/AcademicoWorkspace.tsx) | modified (+17/−9) |
| [`apps/web/src/components/aluno/academico/BoletimGradeGrid.tsx`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/src/components/aluno/academico/BoletimGradeGrid.tsx) | modified (+3/−1) |
| [`apps/web/src/components/aluno/dashboard/DashboardLoader.tsx`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/src/components/aluno/dashboard/DashboardLoader.tsx) | modified (+51/−18) |
| [`apps/web/src/components/aluno/dashboard/StudentDrawerWorkspace.tsx`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/src/components/aluno/dashboard/StudentDrawerWorkspace.tsx) | added (+36/−0) |
| [`apps/web/src/components/aluno/financeiro-portal/PaymentDrawer.tsx`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/src/components/aluno/financeiro-portal/PaymentDrawer.tsx) | modified (+8/−1) |
| [`apps/web/src/components/aluno/layout/ServicePaymentDrawer.tsx`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/src/components/aluno/layout/ServicePaymentDrawer.tsx) | modified (+9/−2) |
| [`apps/web/src/components/aluno/tabs/TabDocumentos.tsx`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/src/components/aluno/tabs/TabDocumentos.tsx) | modified (+9/−2) |
| [`apps/web/src/components/aluno/tabs/TabFaltas.tsx`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/src/components/aluno/tabs/TabFaltas.tsx) | modified (+10/−2) |
| [`apps/web/src/components/aluno/tabs/TabFinanceiro.tsx`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/src/components/aluno/tabs/TabFinanceiro.tsx) | modified (+13/−9) |
| [`apps/web/src/components/aluno/tabs/TabNotas.tsx`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/src/components/aluno/tabs/TabNotas.tsx) | modified (+34/−23) |
| [`apps/web/src/components/aluno/tabs/TabNotificacoes.tsx`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/src/components/aluno/tabs/TabNotificacoes.tsx) | modified (+16/−6) |
| [`apps/web/src/components/financeiro/AppyPayReferenceButton.tsx`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/src/components/financeiro/AppyPayReferenceButton.tsx) | modified (+8/−5) |
| [`apps/web/src/components/portal/ui/PortalDrawerNavigator.tsx`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/src/components/portal/ui/PortalDrawerNavigator.tsx) | added (+132/−0) |
| [`apps/web/src/components/portal/ui/PortalSheet.tsx`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/src/components/portal/ui/PortalSheet.tsx) | modified (+50/−7) |
| [`apps/web/src/components/professor/GradeEntryGrid.tsx`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/src/components/professor/GradeEntryGrid.tsx) | modified (+21/−9) |
| [`apps/web/src/components/professor/ProfessorCalendarWorkspace.tsx`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/src/components/professor/ProfessorCalendarWorkspace.tsx) | added (+505/−0) |
| [`apps/web/src/components/professor/ProfessorFrequenciasWorkspace.tsx`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/src/components/professor/ProfessorFrequenciasWorkspace.tsx) | added (+503/−0) |
| [`apps/web/src/components/professor/ProfessorGradesWorkspace.tsx`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/src/components/professor/ProfessorGradesWorkspace.tsx) | added (+1323/−0) |
| [`apps/web/src/components/professor/ProfessorMateriaisWorkspace.tsx`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/src/components/professor/ProfessorMateriaisWorkspace.tsx) | added (+393/−0) |
| [`apps/web/src/components/professor/ProfessorPlanosWorkspace.tsx`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/src/components/professor/ProfessorPlanosWorkspace.tsx) | added (+110/−0) |
| [`apps/web/src/components/professor/ProfessorStudentGrades.tsx`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/src/components/professor/ProfessorStudentGrades.tsx) | added (+81/−0) |
| [`apps/web/src/components/professor/ProfessorTurmaHorario.tsx`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/src/components/professor/ProfessorTurmaHorario.tsx) | added (+106/−0) |
| [`apps/web/src/components/professor/ProfessorTurmaRoster.tsx`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/src/components/professor/ProfessorTurmaRoster.tsx) | modified (+13/−6) |
| [`apps/web/tests/unit/aluno-accessibility-aa.spec.ts`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/tests/unit/aluno-accessibility-aa.spec.ts) | modified (+7/−5) |
| [`apps/web/tests/unit/audit-professor-assignments.spec.ts`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/tests/unit/audit-professor-assignments.spec.ts) | modified (+1/−1) |
| [`apps/web/tests/unit/grade-completion-notifications.spec.ts`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/tests/unit/grade-completion-notifications.spec.ts) | modified (+2/−2) |
| [`apps/web/tests/unit/matricula-desistencia-workflow.spec.ts`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/tests/unit/matricula-desistencia-workflow.spec.ts) | modified (+1/−1) |
| [`apps/web/tests/unit/portal-academic-mobile-language.spec.ts`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/tests/unit/portal-academic-mobile-language.spec.ts) | modified (+2/−2) |
| [`apps/web/tests/unit/portal-klasse-brand-academic-ux.spec.ts`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/tests/unit/portal-klasse-brand-academic-ux.spec.ts) | modified (+6/−4) |
| [`apps/web/tests/unit/portal-mobile-secondary-language.spec.ts`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/tests/unit/portal-mobile-secondary-language.spec.ts) | modified (+2/−2) |
| [`apps/web/tests/unit/portal-ui-standards.spec.ts`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/tests/unit/portal-ui-standards.spec.ts) | modified (+2/−2) |
| [`apps/web/tests/unit/portal-welcome-card.spec.ts`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/tests/unit/portal-welcome-card.spec.ts) | modified (+116/−7) |
| [`apps/web/tests/unit/professor-attendance-20261121.spec.ts`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/tests/unit/professor-attendance-20261121.spec.ts) | modified (+2/−2) |
| [`apps/web/tests/unit/professor-resource-ui.spec.ts`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/tests/unit/professor-resource-ui.spec.ts) | modified (+4/−3) |
| [`apps/web/tests/unit/ui-identity-mobile.spec.tsx`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/tests/unit/ui-identity-mobile.spec.tsx) | modified (+1/−1) |
| [`apps/web/tests/unit/ui-pr2-portals-completion.spec.tsx`](https://github.com/moxi-edtech/moxi-edtech/blob/e4a96d193e865f92342124d1c824c2bf5b779232/apps/web/tests/unit/ui-pr2-portals-completion.spec.tsx) | modified (+2/−2) |

**Direcção futura:** qualquer novo card de dashboard nos dois portais deve seguir este registo; a decisão de abrir uma página inteira precisa de ser justificada pela complexidade da tarefa, e não pela conveniência de reutilizar um link antigo. Preservar o menu global, o SSOT de operações e as fronteiras de autorização.
