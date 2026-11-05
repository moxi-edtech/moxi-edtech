# Moxi UI — plano de migração

**Data:** 2026-10-06  
**Estratégia:** migrar padrões e intenções, não fazer troca cega de classes.

## Princípios

1. PR visual não altera regra de negócio.
2. Não misturar migração visual com RLS, permissões, faturação, RAA ou lógica fiscal.
3. Cada superfície migrada recebe capture REA antes/depois.
4. Preferir substituir composição repetida por um padrão, não apenas trocar classes.
5. A identidade do produto permanece; a gramática de interação passa a ser Moxi.
6. Cada fatia deve ser pequena, reversível e visualmente revisável.

## P0 — fundações

### MUI-001 — fundações semânticas

Estado: iniciado nesta branch.

Entregas:
- escala de spacing;
- papéis tipográficos;
- papéis de radius;
- níveis de elevação;
- recipes de superfícies;
- mapeamento do tema KLASSE;
- exports antigos mantidos para compatibilidade.

Aceitação:
- @moxi/design-tokens faz typecheck;
- imports existentes continuam válidos;
- a fundação pode ser mergeada sem mudança visual global escondida.

### MUI-002 — contrato PageHeader

Objetivo:
DashboardHeader passa a ser a implementação KLASSE do PageHeader Moxi.

Regras:
- breadcrumb/contexto;
- título + descrição curta;
- máximo de três ações visíveis;
- overflow para ações adicionais;
- prioridade preservada no mobile.

Primeiras migrações:
- dashboard da Secretaria;
- Financeiro;
- lista de Alunos;
- lista de Matrículas.

### MUI-003 — superfícies estáticas vs interativas

Objetivo:
Card partilhado ganha variantes semânticas explícitas.

Não alterar o default atual globalmente no mesmo PR.

Sequência:
1. código novo declara intenção;
2. Balcão/Command Workspace;
3. dashboard da Secretaria;
4. Financeiro;
5. Portal do Aluno.

Aceitação:
- static não eleva no hover;
- interactive tem semântica acessível de interação;
- selected usa action do produto;
- overlay não reutiliza a elevação de card normal.

### MUI-004 — hierarquia de ações

Reduzir intenção exposta a feature para:
- primary;
- secondary;
- ghost;
- destructive;
- link.

Tones antigos permanecem temporariamente por compatibilidade, mas não devem crescer.

Aceitação:
- uma primária por tarefa;
- nenhum tone arbitrário novo;
- ação icon-only no desktop precisa de label acessível e motivo de compactação.

## P1 — padrões KLASSE

### MUI-101 — Balcão / EntityWorkspace

Usar o workspace atual de pagamento como benchmark.

Estrutura:
- contexto do aluno;
- navegação de ações;
- tarefa ativa;
- revisão/confirmação;
- um único CTA primário ativo.

Correção específica:
quando Pagar é a tarefa atual, Regularizar dívida não pode competir visualmente com
Confirmar pagamento.

Estados a auditar:
- visão geral;
- matrícula;
- pagamento;
- documento;
- rematrícula;
- perfil;
- nota.

### MUI-102 — Secretaria

Consolidar:
- DashboardHeader;
- RadarOperacional;
- StatCard;
- quick actions;
- avisos;
- feedback/loading.

Objetivos:
- reduzir card dentro de card;
- reduzir variantes de radius/elevação;
- skeletons consistentes;
- limitar ações no header.

### MUI-103 — Financeiro

Prioridade:
- workspace financeiro principal;
- pagamentos;
- cobranças;
- conciliação;
- radar financeiro.

Objetivos:
- FilterBar partilhado;
- DataTablePage partilhado;
- hierarquia monetária consistente;
- aviso separado de ação;
- urgência financeira não cria sombra decorativa.

### MUI-104 — Portal do Aluno

Preservar personalidade mobile sem manter fundações paralelas.

Normalizar:
- radius de controlo;
- focus;
- estados;
- card por tipo de interação;
- prioridade de CTA;
- loading/vazio/erro.

Exceções explícitas:
- hero do aluno;
- identidade da escola;
- navegação mobile;
- visualizações académicas específicas.

Raios arbitrariamente grandes saem salvo exceção documentada.

## P1 — adoção FEXA

### MUI-151 — camada semântica CSS

Antes de expandir o CRM:
- criar custom properties com papéis Moxi;
- mapear a paleta atual do FEXA para esses papéis;
- preservar aparência atual na primeira passagem.

Papéis mínimos:
- surface;
- surface-muted;
- border;
- border-strong;
- text;
- text-muted;
- brand;
- action;
- focus;
- success;
- warning;
- danger;
- radius-control;
- radius-surface;
- radius-overlay;
- elevation-raised;
- elevation-floating;
- elevation-overlay.

### MUI-152 — primitivas FEXA

Extrair:
- Button;
- Field;
- Badge/Status;
- Panel;
- Tabs;
- ConversationListItem;
- ChatBubble.

ChatBubble mantém raio assimétrico como exceção de domínio.

### MUI-153 — PageHeader e shell do CRM

Alinhar contexto e prioridade de ações com a gramática Moxi sem copiar navegação ou
branding do KLASSE.

## P2 — enforcement

### MUI-201 — gate em linhas alteradas

O checker rejeita novo:
- radius arbitrário em UI operacional;
- shadow arbitrário;
- hex de marca KLASSE fora de tema/tokens;
- radius/elevação fora da escala em código operacional.

Não falhar o repo por dívida histórica. O gate verifica apenas novas linhas/alterações.

### MUI-202 — evidência visual

Cada migração de padrão regista:
- rota/cenário;
- viewport;
- Evidence ID REA;
- hash da screenshot;
- diferenças intencionais;
- observações de acessibilidade.

### MUI-203 — inventário de componentes

Manter tabela com:
- componente/padrão;
- responsável;
- produtos consumidores;
- estado: experimental / estável / deprecated;
- substituto de componente deprecated.

## Ordem recomendada de PRs

1. MUI-001 — fundações + documentação.
2. MUI-101 — Balcão como benchmark.
3. MUI-002 — PageHeader.
4. MUI-003 — Card/Surface.
5. MUI-004 — hierarquia de ações.
6. MUI-102 — Secretaria.
7. MUI-103 — Financeiro.
8. MUI-104 — Portal do Aluno.
9. FEXA MUI-151/152/153 no repositório FEXA.
10. MUI-201/202 reforçados após pelo menos dois padrões grandes estarem migrados.

## Programa concluído quando

- módulos operacionais KLASSE usam a mesma gramática de página/tarefa;
- Portal do Aluno continua reconhecível sem possuir fundações contraditórias;
- FEXA usa os mesmos papéis semânticos;
- novas features deixam de inventar radius, elevação e CTA;
- numa revisão visual é possível responder claramente: “qual padrão Moxi é este?”.
