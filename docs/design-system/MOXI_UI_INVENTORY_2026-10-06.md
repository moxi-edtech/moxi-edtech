# Moxi UI — inventário e auditoria visual

**Data:** 2026-10-06  
**Método:** captures REA + varredura estática de classes/tokens nos repositórios locais  
**Âmbito:** Tangram/RD como referência de disciplina; KLASSE e FEXA como produtos auditados

## 1. Método

A referência externa foi usada para entender consistência de sistema, não para copiar
a identidade visual da RD.

A home autenticada do RD Station não estava disponível na sessão do navegador: o URL
fornecido redirecionou para login. Portanto, não tratamos a aplicação privada como se
tivesse sido auditada. A análise reproduzível da RD foi feita sobre o Tangram, o design
system público da empresa.

O que extraímos como princípio:

- decisões visuais fechadas em tokens;
- componente tem anatomia e comportamento, não apenas aparência;
- elevação representa hierarquia/interação;
- PageHeader e navegação têm contrato;
- cor de ação e cor de estado têm papéis diferentes.

## 2. Evidências REA

| Capture | URL | Evidence ID | Screenshot SHA-256 |
|---|---|---|---|
| Tangram Card | https://tangram.rdstation.com.br/docs/components/card/ | ev_57875bf12a088da4778a575602f697f3257615a638a34cdb8752c48159766be0 | 6be8647aaa1d06e68e0973b40c569af99208c0cee0eec70684ecb2005fda0fd0 |
| Tangram PageHeader | https://tangram.rdstation.com.br/examples/components/pageheader/ | ev_f0a34041bbe8848391bd77913c5e1781b6cb0bd33c1a876d5c8249a2016ef66b | 250cd6c8f8ce0761c35915888b307a51a3f21734ecd57cfa796dd2f6affd02c3 |
| Tangram Navbar | https://tangram.rdstation.com.br/examples/components/navbar/ | ev_3a17ed8184a8fd3d04ba7f2662e7b18996807ab23088cde90465ac63cda929c6 | 8b00aa0601a7710be07fd5b29acf68c258ba500935d495dc83c8bd9f853fd070 |
| KLASSE Balcão/Pagamento | http://localhost:3017/ux-smoke?action=payment | ev_b8f1fa05cf540a8d4fac5df34e5bc4d0fac736099c961bae87a11dc14f5a24f2 | 400bc9857b5d467e3b6d557c95af1cadb21131c41ffdb8cee91a811decf71f1b |
| FEXA CRM login | http://127.0.0.1:4180/ | ev_c41796ab82eedd119a4c81b6952d06f395a8a75c722f5e8c62a2e1db97209bc8 | 55862174793db5065939e182777a14be9a218b45d4ba99b2ca7a5c6889c67cc2 |

Os módulos autenticados do KLASSE também foram auditados diretamente na árvore atual
de código. Assim, um redirect de login não é confundido com a UI real do produto.

## 3. Drift medido

Os números abaixo são ocorrências nas áreas analisadas, não quantidade de componentes.

### Secretaria

143 ficheiros.

Raio:
- rounded-xl: 744
- rounded-lg: 251
- rounded-2xl: 233
- rounded-full: 164
- rounded: 83
- rounded-md: 37
- rounded-3xl: 16

Elevação:
- shadow-sm: 215
- shadow-2xl: 43
- shadow-lg: 18
- shadow-xl: 18
- shadow-2xs: 18
- shadow-md: 15
- shadow-none: 14

Conclusão: a linguagem dominante já se aproxima do KLASSE desejado, mas há decisões
demais de raio e elevação para um único produto operacional.

### Financeiro

59 ficheiros.

Raio:
- rounded-xl: 187
- rounded-lg: 114
- rounded: 51
- rounded-full: 35
- rounded-2xl: 26
- rounded-md: 4

Elevação:
- shadow-sm: 90
- shadow-md: 17
- shadow: 16
- shadow-2xl: 4
- shadow-lg: 3
- shadow-xl: 2

Conclusão: Financeiro é visualmente mais contido, mas ainda deixa a feature escolher
geometria e elevação diretamente em vez de declarar intenção semântica.

### Balcão / Command Workspace

29 ficheiros.

Raio:
- rounded-xl: 304
- rounded-2xl: 79
- rounded-lg: 76
- rounded-full: 40
- rounded-md: 8

Elevação:
- shadow-sm: 62
- shadow-2xl: 11
- shadow-xl: 5
- shadow-xs: 4
- shadow-md: 3

Conclusões do capture REA de pagamento:

- a hierarquia da tarefa já é forte;
- o modelo em duas colunas é um bom candidato a EntityWorkspace;
- Regularizar dívida e Confirmar pagamento podem competir visualmente quando ambos
  recebem força de CTA;
- contexto do aluno + navegação de ações + tarefa ativa + revisão/confirmação já formam
  um padrão reutilizável.

### Portal do Aluno

86 ficheiros.

Raio:
- rounded-2xl: 118
- rounded-xl: 118
- rounded-full: 88
- rounded-3xl: 45
- rounded-lg: 34
- rounded-md: 5
- rounded-[2.5rem]: 5

Elevação:
- shadow-sm: 88
- shadow-2xs: 13
- shadow-xl: 8
- shadow-2xl: 7
- shadow-lg: 7
- shadow-md: 4

Conclusão: o portal tem personalidade mobile-first coerente, mas evoluiu para um
dialeto visual próprio. Grandes raios, pesos muito altos, gradients e micro-labels
devem tornar-se exceções de tema sobre primitivas Moxi, não novas fundações paralelas.

### FEXA CRM

3 ficheiros centrais da app web.

O CSS principal contém pelo menos:
6px, 7px, 8px, 10px, 12px, 20px, 50%, 0 e raios assimétricos das mensagens.

Tipografia inclui valores locais:
0.6875rem, 0.7rem, 0.75rem, 0.8125rem, 0.875rem, 0.9375rem, 1rem, 1.55rem e 1.7rem.

Conclusões REA:

- o login é limpo e credível;
- o uso de cor é contido;
- a consistência ainda está codificada diretamente em apps/web/style.css;
- a geometria assimétrica da bolha de chat é uma exceção válida de domínio;
- controlos e superfícies genéricas devem migrar para papéis semânticos partilhados.

## 4. Primitivas existentes que devem servir de âncora

O KLASSE já tem peças úteis:

- apps/web/src/components/ui/Card.tsx
- apps/web/src/components/ui/Button.tsx
- apps/web/src/components/ui/Badge.tsx
- apps/web/src/components/layout/DashboardHeader.tsx
- apps/web/src/components/shared/StatCard.tsx
- apps/web/src/components/shared/SecaoLabel.tsx
- apps/web/src/components/shared/AcaoRapidaCard.tsx
- apps/web/src/components/feedback/FeedbackSystem.tsx

O problema não é falta de reutilização. O problema é que as primitivas ainda expõem
decisões visuais demais e as features frequentemente criam a sua própria variante.

## 5. Inconsistências concretas

### Card padrão

Hoje, o recipe KLASSE de card normal inclui shadow-sm e hover:shadow-md.
Isso faz superfície não interativa comportar-se visualmente como se fosse clicável.

Modelo Moxi:

- static = flat;
- interactive = pode elevar;
- selected = estado action do produto;
- overlay = elevação própria.

Este primeiro trabalho não altera todos os consumidores de uma vez.

### Vocabulário de Button

Button.tsx atualmente aceita vários tones:
amber, blue, emerald, gray, green, gold, navy, neutral, ok, red, slate, teal, violet e warn.

Há aliases e cores de produto misturadas com intenção. Para código novo, a intenção
deve ser reduzida a primary, secondary, ghost, destructive e link. Estados semânticos
são tratados separadamente quando o domínio exigir.

### Badge

Badge partilhado usa rounded-md apesar de status/chip terem outra semântica.
Moxi define pill como geometria normal de status; a migração será faseada.

### PageHeader

DashboardHeader já possui a anatomia correta: breadcrumb, título/descrição e ações.
Ele deve tornar-se a implementação canónica do PageHeader Moxi no KLASSE em vez de
continuar como apenas mais uma variante local.

### Portal do Aluno

AlunoHeader e o dashboard usam expressão mobile mais forte. A identidade deve ser
preservada, mas geometria de controlos, estados, foco e prioridade de ações passam a
ser responsabilidade do Moxi UI.

## 6. O que continua específico de cada produto

### KLASSE

- verde institucional;
- dourado de ação;
- Sora;
- densidade académica/escolar;
- experiência mobile do aluno/professor.

### FEXA

- wordmark e paleta FEXA;
- arquitetura de informação de CRM/mensagens;
- bolha de conversa assimétrica;
- linguagem comercial da marca.

### Partilhado

- espaçamento;
- hierarquia;
- anatomia de controlos;
- prioridade de ações;
- estados semânticos;
- foco/acessibilidade;
- comportamento de overlays;
- tabelas;
- PageHeader;
- loading/vazio/erro.

## 7. Conclusão

O KLASSE já tem componentes partilhados suficientes para ser a primeira implementação
do Moxi UI sem reescrita.

O maior ganho vem de fechar escolhas semânticas, impedir novo drift e migrar padrões
em fatias controladas.

O FEXA tem menos superfície histórica. Por isso deve adotar as fundações Moxi agora,
antes de o CRM ganhar mais módulos e o custo de normalização crescer.
