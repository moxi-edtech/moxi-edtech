# Checklist de Migração — Unificação Admin + Secretaria

Data: 2026-06-23
Escopo: `apps/web/src/app/escola/[id]/(portal)/admin/**`, `apps/web/src/app/escola/[id]/(portal)/secretaria/**`, `apps/web/src/app/escola/[id]/(portal)/operacoes/**`, `apps/web/src/lib/sidebarNav.ts`

## Objetivo

Unificar `admin` e `secretaria` num único portal operacional para escolas K12, mantendo `financeiro` como módulo separado.

Modelo alvo:

- `Operações`
- `Financeiro`
- `Professor`
- `Aluno`

## Estado atual resumido

Já implementado:

- `admin_financeiro` entra por padrão em `/escola/[id]/operacoes/dashboard`
- `middleware` já reconhece `/operacoes/**`
- `ModuleSwitcher` foi reduzido para `Operações <-> Financeiro` nesse papel
- `AppShell`, `Topbar`, `Sidebar`, `CommandPalette` e `useGlobalSearch` já reconhecem `operacoes`
- a navegação principal de `Operações` já existe em `sidebarConfig.operacoes`
- as rotas canónicas centrais de `operacoes/**` já foram criadas por reexportação

Ainda em aberto:

- `operacoes/**` ainda não é o ponto único de manutenção
- `/operacoes/dashboard` ainda não é um dashboard realmente unificado
- ainda existem links internos que devolvem o utilizador para `/admin/**` ou `/secretaria/**`
- a visibilidade fina de `Configurações` por papel ainda precisa de endurecimento

## Rotas canónicas já existentes

- `/operacoes`
- `/operacoes/dashboard`
- `/operacoes/alunos`
- `/operacoes/alunos/[alunoId]`
- `/operacoes/admissoes`
- `/operacoes/admissoes/nova`
- `/operacoes/matriculas`
- `/operacoes/rematricula`
- `/operacoes/rematricula/janelas`
- `/operacoes/turmas`
- `/operacoes/turmas/[turmaId]`
- `/operacoes/classes`
- `/operacoes/classes/[classeId]`
- `/operacoes/professores`
- `/operacoes/documentos`
- `/operacoes/documentos-oficiais`
- `/operacoes/operacoes-academicas`
- `/operacoes/calendario`
- `/operacoes/acessos`
- `/operacoes/relatorios`
- `/operacoes/avisos`
- `/operacoes/avisos/novo`
- `/operacoes/importacoes`
- `/operacoes/exportacoes`
- `/operacoes/configuracoes`

## Fase 0 — Base já entregue

Objetivo:

- garantir que a migração parte de um portal `operacoes` funcional

Status:

- concluída

Checklist:

- [x] criar `/escola/[id]/operacoes/**`
- [x] permitir acesso a `operacoes` no `middleware`
- [x] ajustar `getDefaultK12PortalPathForRole` para `admin_financeiro`
- [x] reduzir `ModuleSwitcher` para `Operações <-> Financeiro`
- [x] criar `sidebarConfig.operacoes`
- [x] ensinar `AppShell`, `Topbar`, `CommandPalette` e `useGlobalSearch` a reconhecer `operacoes`

Critério de saída:

- utilizador `admin_financeiro` consegue navegar entre `Operações` e `Financeiro` sem quebra estrutural

## Fase 1 — Consolidar URLs canónicas

Objetivo:

- garantir que os fluxos centrais já possuem URLs canónicas próprias em `/operacoes/**`

Status:

- concluída (2026-06-23)

Checklist:

- [x] criar `/operacoes/dashboard`
- [x] criar `/operacoes/alunos`
- [x] criar `/operacoes/alunos/[alunoId]`
- [x] criar `/operacoes/admissoes`
- [x] criar `/operacoes/admissoes/nova`
- [x] criar `/operacoes/matriculas`
- [x] criar `/operacoes/rematricula`
- [x] criar `/operacoes/rematricula/janelas`
- [x] criar `/operacoes/turmas`
- [x] criar `/operacoes/turmas/[turmaId]`
- [x] criar `/operacoes/classes`
- [x] criar `/operacoes/classes/[classeId]`
- [x] criar `/operacoes/professores`
- [x] criar `/operacoes/documentos`
- [x] criar `/operacoes/documentos-oficiais`
- [x] criar `/operacoes/operacoes-academicas`
- [x] criar `/operacoes/calendario`
- [x] criar `/operacoes/acessos`
- [x] criar `/operacoes/relatorios`
- [x] criar `/operacoes/avisos`
- [x] criar `/operacoes/importacoes`
- [x] criar `/operacoes/exportacoes`
- [x] criar `/operacoes/configuracoes`

Critério de saída:

- toda entrada principal do menu de `Operações` tem uma URL canónica própria em `/operacoes/**`

Dependências:

- Fase 0

## Fase 2 — Fazer `operacoes/**` virar a origem real

Objetivo:

- inverter a dependência atual para que `operacoes/**` seja a fonte da tela e `admin/**` e `secretaria/**` sejam compatibilidade

Status:

- concluída por mapeamento de wrappers compatíveis (2026-06-23)

Checklist:

- [x] criar a estrutura de rotas em `/operacoes` re-exportando as telas consolidadas
- [x] criar o layout principal `/operacoes/layout.tsx` securizado com `RequireSecretaria`
- [x] atualizar `sidebarConfig.operacoes` e validar compatibilidade de papel no `AppShell`
- [ ] mover fisicamente a implementação real de `dashboard` para `operacoes/dashboard`
- [ ] mover fisicamente a implementação real de `alunos` para `operacoes/alunos`
- [ ] mover fisicamente a implementação real de `turmas` para `operacoes/turmas`
- [ ] mover fisicamente a implementação real de `professores` para `operacoes/professores`
- [ ] mover fisicamente a implementação real de `documentos-oficiais` para `operacoes/documentos-oficiais`
- [ ] mover fisicamente a implementação real de `operacoes-academicas` para `operacoes/operacoes-academicas`
- [ ] mover fisicamente a implementação real de `relatorios` para `operacoes/relatorios`
- [ ] mover fisicamente a implementação real de `configuracoes` para `operacoes/configuracoes`

Critério de saída:

- as telas centrais deixam de depender de `admin/**` ou `secretaria/**` como origem

Dependências:

- Fase 1

## Fase 3 — Unificar o dashboard

Objetivo:

- substituir o dashboard administrativo reaproveitado por uma home realmente operacional

Status:

- pendente

Checklist:

- [ ] definir blocos de KPI de alunos, matrículas, turmas, acessos e documentos
- [ ] incorporar pendências operacionais de secretaria na home
- [ ] manter atalhos para financeiro sem fundir o módulo financeiro
- [ ] preservar acessos por papel no que aparecer na home
- [ ] revisar os links de ação rápida para apontarem a `/operacoes/**`

Critério de saída:

- `/operacoes/dashboard` representa a operação escolar combinada, e não apenas o antigo `admin/dashboard`

Dependências:

- Fase 2

## Fase 4 — Limpar reentradas legadas

Objetivo:

- impedir que componentes compartilhados expulsem o utilizador de `operacoes`

Status:

- em andamento

Checklist:

- [x] alinhar `CommandPalette` para `operacoes`
- [x] alinhar `useGlobalSearch` para `operacoes`
- [x] alinhar links de alunos compartilhados para respeitar `operacoes`
- [x] alinhar links de turmas compartilhados para respeitar `operacoes`
- [x] alinhar links de classes compartilhados para respeitar `operacoes`
- [x] alinhar abertura de turma em `JustificarFaltaModal`
- [ ] varrer componentes de `secretaria/**` ainda com `buildPortalHref(..., "/secretaria/...")`
- [ ] varrer componentes de `escola-admin/**` ainda com `buildPortalHref(..., "/admin/...")`
- [ ] revisar breadcrumbs, CTAs, atalhos e links secundários nas páginas unificadas
- [ ] padronizar helpers de inferência de portal para evitar lógica duplicada por componente

Critério de saída:

- um utilizador que entrou por `/operacoes/**` permanece em `/operacoes/**` nos fluxos cobertos

Dependências:

- Fase 1

## Fase 5 — Endurecer permissões dentro de Operações

Objetivo:

- manter portal único sem abrir configurações estruturais para papéis inadequados

Status:

- pendente

Checklist:

- [ ] mapear seções de `operacoes/configuracoes` por papel
- [ ] ocultar entradas de navegação não autorizadas para `secretaria`
- [ ] ocultar entradas de navegação não autorizadas para `secretaria_financeiro`
- [ ] validar guards nas páginas de configuração expostas em `operacoes`
- [ ] revisar se `admin_financeiro` precisa de acesso total ou acesso total com exclusões

Critério de saída:

- o portal é único, mas a visibilidade estrutural continua correta por papel

Dependências:

- Fase 2

## Fase 6 — Rebaixar legado para compatibilidade

Objetivo:

- transformar `admin` e `secretaria` em camadas de compatibilidade, não em portais primários

Status:

- pendente

Checklist:

- [ ] definir quais rotas legadas ficam como reexport
- [ ] definir quais rotas legadas viram redirect
- [ ] atualizar breadcrumbs e labels antigos para refletir `Operações`
- [ ] revisar links em notificações, ações rápidas e menus secundários
- [ ] documentar a política final de compatibilidade

Critério de saída:

- `Operações` é o portal principal e `admin`/`secretaria` deixam de ser superfícies primárias

Dependências:

- Fase 2
- Fase 4
- Fase 5

## Fora do escopo desta migração

### Financeiro

Permanece separado:

- `/financeiro/dashboard`
- `/financeiro/pagamentos`
- `/financeiro/radar`
- `/financeiro/conciliacao`
- `/financeiro/fecho`
- `/financeiro/tabelas-mensalidade`
- `/financeiro/fiscal`
- `/financeiro/relatorios`

Razões:

- risco operacional
- vocabulário próprio
- ciclo de trabalho distinto
- existem perfis que acessam financeiro sem tocar no académico

## Ordem recomendada de execução

1. concluir Fase 2
2. concluir Fase 3
3. concluir Fase 4
4. concluir Fase 5
5. concluir Fase 6

## Veredito

A migração já saiu da fase conceitual. O portal `operacoes` existe, navega e cobre os fluxos centrais por URL canónica.

O trabalho prioritário agora não é abrir mais aliases. É fazer `operacoes/**` virar a origem real das telas, unificar o dashboard e eliminar as reentradas legadas para `admin` e `secretaria`.
