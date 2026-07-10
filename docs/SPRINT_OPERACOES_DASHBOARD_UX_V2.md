# Sprint — Operações Dashboard UX v2

Data: 2026-07-10
Escopo: `apps/web/src/app/escola/[id]/(portal)/operacoes/dashboard`, `apps/web/src/components/layout/operacoes/**`, `apps/web/src/components/layout/escola-admin/**`, `apps/web/src/lib/sidebarNav.ts`

## Objetivo

Evoluir `/operacoes/dashboard` para um cockpit de trabalho do perfil `admin_financeiro`, preservando uma UI minimalista, profissional e focada em execução diária.

O dashboard deve deixar de parecer uma home administrativa genérica e passar a responder à pergunta:

> O que precisa de ação agora na escola?

## Princípios de Produto

- Trabalho antes de métrica.
- Filas acionáveis antes de gráficos.
- Pouca cor, alto significado.
- Densidade controlada, sem ruído visual.
- Navegação sempre preservando `/operacoes/**`.
- Cada bloco deve ter dono operacional claro: académico, secretaria, financeiro, comunicação ou sistema.

## Direção Visual

### Base

- Fundo: `slate-50`
- Superfícies: `white`
- Bordas: `slate-200`
- Texto principal: `slate-900`
- Texto secundário: `slate-500` / `slate-600`
- Sombras: mínimas ou ausentes
- Border radius: até `8px`, exceto componentes já padronizados

### Cores Semânticas

- Verde: pronto, resolvido, conectado
- Âmbar: atenção, pendente, fila operacional
- Vermelho suave: bloqueante, falha, risco
- Azul discreto: informação neutra

Não usar gradientes, cards muito coloridos, hero visual, orbs ou decoração sem função.

## Estrutura Alvo

### 1. Cabeçalho Operacional

Conteúdo:

- Nome da escola
- Data operacional
- Estado geral do dia
- Última atualização
- Ação discreta de refresh

Critérios:

- Altura compacta
- Sem hero
- Sem copy comercial
- Sem excesso de badges

### 2. Resumo de Estado

Quatro blocos pequenos:

| Bloco | Função |
|---|---|
| Pendências | Total de itens que exigem ação |
| Académico | Turmas, horários, notas, calendário |
| Financeiro | Pagamentos, cobranças, inadimplência |
| Comunicação | WhatsApp, avisos, mensagens falhadas |

Cada bloco deve ter:

- Número principal
- Label curta
- Estado semântico
- Link para a fila correspondente

### 3. Prioridades de Trabalho

Componente principal da tela.

Formato recomendado: lista compacta com linhas acionáveis.

Exemplos:

- Turmas sem horário publicado
- Matrículas/admissões aguardando revisão
- Pagamentos pendentes de confirmação
- Alunos sem acesso ao portal
- Documentos oficiais em processamento ou falha
- WhatsApp desconectado ou mensagens falhadas
- Configuração escolar incompleta

Cada linha deve conter:

- Ícone pequeno
- Título objetivo
- Descrição curta
- Severidade
- CTA primário ou chevron
- Link em `/operacoes/**`

### 4. Painel Lateral

Blocos compactos:

- Saúde operacional
- Status do WhatsApp
- Próximos eventos críticos
- Atalhos contextuais

Evitar duplicar o sidebar. Os atalhos devem aparecer por contexto, não como lista fixa grande.

### 5. Atividade Recente

Segunda dobra da tela.

Itens:

- Matrícula criada
- Pagamento confirmado
- Documento emitido
- Horário publicado
- Mensagem WhatsApp enviada/falhada
- Aluno com acesso liberado

Critérios:

- Lista simples
- Timestamp relativo
- Sem feed infinito pesado
- Limite inicial: 8 a 12 itens

## Backlog Técnico

### Fase 1 — Modelo de Dados do Cockpit

- [ ] Revisar `OperacoesDashboardData`
- [ ] Normalizar tipos para filas: `priority`, `area`, `status`, `href`
- [ ] Criar modelo `OperationalWorkItem`
- [ ] Garantir todos os `href` em `/operacoes/**`
- [ ] Incluir status WhatsApp no resumo operacional
- [ ] Incluir pagamentos/cobranças sem puxar o utilizador para `/financeiro/**`

Critério de saída:

- O dashboard recebe uma estrutura única de dados para renderizar filas, resumo e atividade.

### Fase 2 — Redesenhar Layout

- [ ] Criar cabeçalho compacto
- [ ] Substituir KPIs decorativos por resumo de estado
- [ ] Criar lista `Prioridades de trabalho`
- [ ] Criar painel lateral discreto
- [ ] Reposicionar atividade recente para segunda dobra
- [ ] Remover cards redundantes ou excessivamente visuais

Critério de saída:

- Primeira viewport mostra o que precisa de ação sem scroll excessivo.

### Fase 3 — Ações Contextuais

- [ ] `Sem horário publicado` → `/operacoes/horarios/quadro?turmaId=...`
- [ ] `Pagamentos pendentes` → `/operacoes/recebimentos`
- [ ] `Alunos sem acesso` → `/operacoes/acessos`
- [ ] `Documentos pendentes` → `/operacoes/documentos-oficiais`
- [ ] `WhatsApp desconectado` → `/operacoes/configuracoes/comunicacao`
- [ ] `Mensagens falhadas` → `/operacoes/comunicacao/whatsapp`
- [ ] `Setup incompleto` → `/operacoes/configuracoes`

Critério de saída:

- Nenhuma ação do dashboard operacional deve trocar sidebar/topbar para `admin`, `secretaria` ou `financeiro`.

### Fase 4 — Polimento UI

- [ ] Reduzir sombras fortes
- [ ] Padronizar bordas e espaçamentos
- [ ] Limitar badges por linha
- [ ] Garantir textos curtos e escaneáveis
- [ ] Remover gradientes e cores decorativas
- [ ] Validar responsividade mobile
- [ ] Validar que textos não quebram botões/cards

Critério de saída:

- Interface limpa, densa o suficiente para operação e sem poluição visual.

### Fase 5 — Verificação

- [ ] `pnpm --filter web typecheck`
- [ ] ESLint focado nos ficheiros alterados
- [ ] Verificação manual de navegação em `/operacoes/dashboard`
- [ ] Testar clique em cada prioridade
- [ ] Confirmar persistência de sidebar/topbar de `Operações`
- [ ] Confirmar links de WhatsApp e configuração WAHA

Critério de saída:

- O utilizador `admin_financeiro` permanece em `Operações` ao executar todos os fluxos do dashboard.

## Componentes Sugeridos

| Componente | Responsabilidade |
|---|---|
| `OperacoesHeader` | Cabeçalho compacto do cockpit |
| `OperationalSummaryStrip` | Quatro blocos pequenos de estado |
| `WorkPriorityList` | Lista principal de filas acionáveis |
| `WorkPriorityItem` | Linha reutilizável de prioridade |
| `OperationalHealthPanel` | Saúde operacional lateral |
| `ContextualShortcuts` | Atalhos derivados do estado |
| `RecentOperationalActivity` | Atividade recente |

## Critérios de Aceite

- [ ] Dashboard não usa layout de landing page.
- [ ] Primeira viewport comunica prioridades reais de trabalho.
- [ ] Cores são semânticas e discretas.
- [ ] Não há cards aninhados.
- [ ] Não há gradientes decorativos.
- [ ] Todos os CTAs preservam `/operacoes/**`.
- [ ] WhatsApp KLASSE aparece no fluxo operacional.
- [ ] Configuração WhatsApp fica acessível por `/operacoes/configuracoes/comunicacao`.
- [ ] UI funciona em desktop e mobile sem sobreposição.
- [ ] Typecheck passa.

## Fora de Escopo

- Refactor físico completo de `admin/**` para `operacoes/**`
- Mudanças de schema SQL
- Novas MVs
- Redesenho do módulo financeiro completo
- Mudança de permissões RLS

## Riscos

| Risco | Mitigação |
|---|---|
| Dashboard virar tela visual demais | Priorizar listas e filas de ação |
| Excesso de métricas | Limitar resumo superior a 4 blocos |
| Links voltarem para módulos legados | Usar helper contextual e teste de navegação |
| Duplicação de componentes admin | Reaproveitar dados, mas criar composição visual própria em `operacoes` |
| Poluição de cor | Usar cor apenas para estado |

## Resultado Esperado

Um cockpit operacional minimalista onde `admin_financeiro` consegue, em menos de 30 segundos, entender:

- o que está bloqueado;
- o que precisa ser feito hoje;
- onde clicar para resolver;
- se comunicação, financeiro, horários e acessos estão saudáveis.

