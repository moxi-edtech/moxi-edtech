# Moxi UI System v1

**Estado:** contrato canónico inicial  
**Data:** 2026-10-06  
**Âmbito:** KLASSE, FEXA e futuros produtos da Moxi  
**Responsável:** Produto + Engenharia Moxi

## 1. Objetivo

Moxi UI é a gramática comum dos produtos digitais da Moxi.

O objetivo não é fazer todos os produtos parecerem iguais. Cada produto mantém a sua
marca, logótipo, cores, ilustração e expressão comercial. O que deve ser familiar entre
produtos é a forma como hierarquia, espaçamento, ações, navegação, formulários,
feedback, tabelas, overlays e estados de interação funcionam.

Uma pessoa que aprende um produto Moxi deve reconhecer imediatamente como operar outro.

## 2. O que este sistema não pretende fazer

- Não copiar a identidade visual do RD Station ou Tangram.
- Não obrigar KLASSE e FEXA a usar a mesma paleta.
- Não redesenhar todas as telas de uma vez.
- Não esconder regras de domínio dentro de componentes genéricos.
- Não transformar todo agrupamento visual num card.
- Não usar decoração quando tipografia, espaçamento e hierarquia resolvem o problema.

## 3. Arquitetura

O Moxi UI tem quatro camadas:

1. **Fundações** — tipografia, espaçamento, raios, elevação, cores semânticas, movimento,
   breakpoints e acessibilidade.
2. **Componentes** — Button, Input, Select, Card, Badge, Tabs, Table, Modal, Drawer,
   Tooltip, EmptyState e primitivas de feedback.
3. **Padrões** — PageHeader, FilterBar, DataTablePage, EntityWorkspace,
   ConfirmationFlow, DashboardMetric, DetailPanel e CommandWorkspace.
4. **Tema do produto** — logótipo, cor de marca, cor de ação, fonte e expressão visual
   específica do produto.

Código de feature deve consumir a camada mais alta que resolver o problema. Uma página
financeira deve preferir um padrão Moxi em vez de voltar a decidir borda, raio e sombra.

## 4. Fundações

### 4.1 Espaçamento

Usar apenas a escala partilhada:

| Token | Valor | Uso típico |
|---|---:|---|
| 1 | 4px | micro-espaço entre ícone e texto |
| 2 | 8px | controlos compactos |
| 3 | 12px | elementos relacionados |
| 4 | 16px | espaçamento interno |
| 6 | 24px | padding normal de secção/card |
| 8 | 32px | separação entre secções |
| 10 | 40px | região ampla de página |
| 12 | 48px | separação estrutural |
| 16 | 64px | limite entre grandes áreas |
| 24 | 96px | hero/marketing, não UI operacional comum |

Valores arbitrários exigem uma exceção documentada.

### 4.2 Tipografia

A UI de produto trabalha com seis níveis de hierarquia. O produto pode trocar a
família tipográfica, mas não deve inventar uma nova escala por feature.

| Papel | Tamanho | Peso normal | Uso |
|---|---:|---:|---|
| caption | 12px | 500–700 | metadata, hints, labels compactos |
| body-sm | 14px | 400–600 | tabelas e UI densa |
| body | 16px | 400–600 | formulários e leitura principal |
| title-sm | 18px | 600 | título de card/secção |
| title | 24px | 600 | título de página |
| display | 32px | 600–700 | ênfase excecional |

Uppercase fica reservado a micro-labels curtos. Não usar font-black como mecanismo
normal de hierarquia.

### 4.3 Raio tem significado

Raio não é escolhido por gosto.

| Papel | Valor | Exemplos |
|---|---:|---|
| compact | 8px | controlo interno compacto |
| control | 12px | input, select, botão |
| surface | 12px | card/painel normal |
| surface-large | 16px | grande área agrupada |
| overlay | 20px | modal/drawer/sheet |
| pill | 9999px | badge, tag, avatar/chip |

Raios arbitrários, como 28px, 2rem ou 2.5rem, não entram em UI operacional sem uma
exceção explícita de produto.

### 4.4 Elevação tem significado

- **flat** — sem sombra; padrão para cards e painéis normais.
- **raised** — sombra pequena; superfície interativa/elevada.
- **floating** — dropdown/popover.
- **overlay** — modal/drawer.

Card não interativo não recebe elevação no hover.

### 4.5 Cores semânticas

Código de feature deve pensar em papéis, não em hexadecimais:

- brand — identidade;
- action — CTA e seleção;
- surface / surface-muted — agrupamento;
- text / text-muted — hierarquia de conteúdo;
- border / border-strong — separação;
- success, warning, danger, info — estado do sistema.

No KLASSE, brand mapeia para verde e action para dourado. No FEXA esses papéis são
mapeados para a sua própria marca. Uma cor de estado não deve ser usada como marca
apenas porque se parece com ela.

## 5. Componentes

### 5.1 Button

Cada região/tarefa deve ter no máximo uma ação primária.

Variantes:

- **primary** — avança a tarefa atual;
- **secondary** — alternativa útil sem competir com a primária;
- **ghost** — ação local de baixa prioridade;
- **destructive** — ação destrutiva;
- **link** — navegação de baixa densidade.

Regras:

- em desktop, ações importantes têm texto;
- ícone isolado exige label acessível e contexto compacto;
- não criar novas cores de botão para representar estado;
- loading preserva largura sempre que possível;
- foco de teclado permanece visível.

### 5.2 Card / Surface

Um container só vira card quando existe necessidade real de agrupamento visual.

Variantes:

- **static** — borda + superfície, sem elevação de hover;
- **interactive** — card inteiro clicável; pode reforçar borda/elevação;
- **selected** — estado de seleção usando action do produto;
- **muted** — informação secundária;
- **status** — estado semântico com cor subtil.

Não criar card dentro de card apenas para obter espaçamento.

### 5.3 Badge / Status

Badge comunica estado ou categoria curta e usa pill por padrão.
Não transformar badge em botão salvo quando for explicitamente um filter chip.

Vocabulário comum:
neutral, info, success, warning, danger.

### 5.4 Formulários

Input, Select e Textarea partilham:

- raio control;
- altura prática mínima de 40–44px;
- borda neutra;
- focus ring na cor action do produto;
- erro com cor + texto, nunca apenas cor.

Label fica acima do campo. Placeholder não substitui label.

### 5.5 Tabelas

Tabelas usam densidade, alinhamento e separadores. Evitar card por linha.
A ação principal da linha pode ficar visível; ações secundárias vão para overflow
quando o espaço exigir.

## 6. Padrões

### 6.1 PageHeader

Ordem canónica:

1. breadcrumb/contexto;
2. título;
3. descrição curta opcional;
4. ações alinhadas no lado oposto.

Máximo de três ações visíveis no desktop. Preferir primária + secundária + overflow.
No mobile a disposição pode mudar, mas a prioridade não.

### 6.2 FilterBar

Pesquisa, filtros e ordenação vivem numa região estável. Não espalhar filtros entre
PageHeader, tabela e cards independentes.

### 6.3 DataTablePage

PageHeader → FilterBar → resumo/estado quando útil → Table → paginação.

### 6.4 EntityWorkspace

Padrão para operações de alta frequência, como o Balcão KLASSE:

Contexto da entidade → navegação de ações → tarefa ativa → revisão/confirmação.

Pode usar duas colunas, mas apenas a tarefa ativa possui CTA primário.

### 6.5 ConfirmationFlow

A área de confirmação deixa imediatamente claro:

- o que vai mudar;
- o impacto/total;
- a única ação que confirma.

Avisos não competem visualmente com o CTA da tarefa ativa.

### 6.6 DashboardMetric

Métricas existem para leitura rápida. Superfície contida, número com hierarquia
consistente e cor de estado apenas quando a métrica realmente representa estado.

### 6.7 Empty / Loading / Error

Loading, vazio e erro também são design system. Skeletons, mensagens e retry devem
seguir patterns partilhados.

## 7. Contrato do tema de produto

Um tema fornece:

- brand;
- brand-strong;
- action;
- action-hover;
- focus;
- logótipo/wordmark;
- família tipográfica opcional.

O tema não redefine spacing, significado de raio, anatomia de componente ou hierarquia
de ações.

## 8. Tema KLASSE

- Brand: #1F6B3B.
- Action: #E3B23C.
- Navegação escura: slate-950.
- Fonte de produto: Sora.
- Biblioteca de ícones: Lucide.
- Dourado significa ação/seleção, não decoração.
- Verde significa identidade, não success genérico.

## 9. Regra de adoção

Toda UI nova deve usar as fundações Moxi imediatamente.

UI existente é migrada padrão por padrão. Não fazer substituição em massa de radius
ou shadow sem validação visual. A sequência está em MOXI_UI_MIGRATION_PLAN.md.

## 10. Critério de pronto de uma tela migrada

Uma tela só está migrada quando:

- a hierarquia corresponde a um padrão documentado;
- não há radius ou shadow arbitrário sem exceção;
- a ação primária é inequívoca;
- estados usam papéis semânticos;
- foco de teclado é visível;
- mobile preserva prioridade da tarefa;
- loading, vazio e erro seguem feedback partilhado;
- existe capture REA antes/depois;
- nenhuma regra de negócio, permissão ou RLS foi alterada como efeito colateral.

## 11. Implementação

As fundações executáveis ficam em @moxi/design-tokens.

Exports antigos do KLASSE permanecem durante a migração para evitar uma alteração
visual global escondida. Código novo deve preferir os tokens Moxi e declarar a intenção
do componente explicitamente.
