# Auditoria — padronização visual do portal de Operações

Data: 2026-09-22
Escopo medido: `apps/web/src/app/escola/[id]/(portal)/operacoes/**` (77 ficheiros `.tsx`),
`apps/web/src/components/layout/operacoes/**`, `components/layout/escola-admin/**`,
`components/shared/**`, `components/ui/**`, `packages/design-tokens/**`

Método: contagem por `grep` sobre a árvore actual. Nenhuma conclusão depende de inspecção
visual — nada foi renderizado.

---

## Correcção — 2026-09-23

**Duas partes deste documento estão erradas. Uma delas é o método.**

1. O §3 dizia que existiam **3** páginas com `<main>` aninhado. São **26**, em 33 tags.
2. O §1 e o §2 foram medidos sobre uma pasta que é **88% re-exports**. Ver abaixo.

### O erro de método

O escopo declarado acima é `operacoes/**`, 77 ficheiros `.tsx`. Medido hoje, no mesmo sítio:

```
77 .tsx em operacoes/
75 são page.tsx
68 são re-exports de 2 a 5 linhas
```

**68 dos 77 ficheiros auditados são stubs.** Não têm markup nenhum — são uma linha
`export { default } from "…"`. O código real vive em `admin/**`, `secretaria/**` e
`financeiro/**`, fora da pasta que foi medida.

Consequência: as contagens do §1 (`Card` 0, `Badge` 0, `SecaoLabel` 0) e do §2
(`rounded-2xl` 7, `p-5 md:p-6` em 4 páginas) foram tiradas, quase todas, sobre ficheiros
sem conteúdo. **Os números não estão errados por pouco — foram medidos no sítio errado.**
Precisam de ser refeitos sobre o alvo de cada re-export.

Repositório inteiro, para escala: **421 `page.tsx`, dos quais 132 são re-exports** (31%).

### A regra que isto deixa

Nesta base, rota e ficheiro **não** são a mesma coisa. Uma auditoria que percorre uma pasta de
rotas mede, na melhor das hipóteses, a casca de navegação — e falha exactamente onde a
duplicação de portais acontece, que é onde os defeitos se acumulam. O mesmo padrão que faz uma
correcção valer por dois portais faz uma auditoria por rota falhar.

### O segundo erro de método, um nível acima

Corrigir o primeiro não chegou. Mesmo medindo os alvos certos, o §1 continuava a dar `0`: mediu
**que ficheiros, dentro de `app/`, importam o primitivo** — e o portal não é uma pasta, é uma
árvore de render. Os primitivos são importados a nível 4, 5 e 6, em `components/`.

A página `operacoes/dashboard/page.tsx` importa `OperacoesDashboard`; esse importa
`./OperacoesDashboardData`; esse importa `./EscolaAdminDashboardContent`; e é **esse** que
importa `SecaoLabel`. Quatro saltos, três deles por caminho relativo. Uma medição que só olha
para a pasta onde a rota vive vê zero.

A unidade de medida certa é a **clausura transitiva de imports** a partir das páginas do
portal: 74 páginas → 335 ficheiros. Foi assim que o §1 e o §2 foram refeitos.

Duas armadilhas de implementação, registadas porque voltam a aparecer: seguir só imports `@/`
perde as cadeias relativas, que nesta base são a maioria dos saltos; e cortar a clausura a uma
profundidade fixa corta exactamente os níveis onde a adopção vive (o `StatCard` está a nível 5).

## Sumário

O portal de Operações não reutiliza nenhum dos primitivos partilhados do repo. O
`docs/design-tokens.md` já especifica a casca canónica; o portal escreve a sua própria.

Este documento é levantamento. Não propõe alterações de comportamento, destino, permissão
ou dados.

## 1. Adopção dos primitivos (medida)

**Refeito em 2026-09-23 (item F).** A versão original dizia `0` em todas as linhas da coluna
"Na rota de Operações". Era falso, e por duas razões empilhadas: mediu stubs (§ Correcção, no
topo) e mediu **uma pasta**, quando o portal é uma **árvore de render**.

O portal de Operações renderiza **74 páginas** — 67 alvos de re-export mais 7 páginas próprias.
Essas 74 puxam, transitivamente, **335 ficheiros** (profundidade máxima 6). Os primitivos são
importados lá dentro, não nas páginas:

| Primitivo | Importadores no repo | Na árvore de render do portal |
|---|---|---|
| `components/ui/Card.tsx` | 27 | **7** |
| `components/ui/Badge.tsx` | 29 | **10** |
| `components/ui/StatusPill.tsx` | 3 | **3** |
| `components/shared/SecaoLabel.tsx` | 7 | **5** |
| `components/shared/StatCard.tsx` | 3 | **2** |
| `components/shared/AcaoRapidaCard.tsx` | 3 | **2** |

`components/shared/` tem 3 componentes no total: `StatCard`, `SecaoLabel`, `AcaoRapidaCard`.
Não existe casca de cartão, cabeçalho de página, pill de estado, estado vazio nem tabela
partilhados.

Os três primitivos que o §6 dava como reutilizados pelo dashboard — `StatCard`, `SecaoLabel`,
`AcaoRapidaCard` — **estão lá, a nível 5 e 6**: `EscolaAdminDashboardContent` →
`OperacoesPainelHub` → `AulasOperacionaisPanel`. A afirmação do §6 confirma-se; era a medição
do §1 que não a conseguia ver.

Conclusão que sobrevive: a adopção é **baixa**, não nula. `ui/Card` chega a 7 dos 335 ficheiros
da árvore; a maior parte das superfícies é markup próprio.

## 2. Divergências medidas

**Refeito em 2026-09-23 (item F).** Medido agora sobre as **74 páginas** que o portal
renderiza, não sobre a pasta de rotas. A coluna "antes" é o que este capítulo dizia.

| Eixo | O que coexiste | Antes | Agora |
|---|---|---|---|
| Raio da casca | `rounded-2xl` vs `rounded-xl` | 7 vs 5 | **40** (9 ficheiros) vs **167** (24) |
| Padding do cartão | `p-4` vs `p-5 md:p-6` | 4 páginas | **5 ocorrências, todas em 1 página** |
| Largura máxima | `max-w-6xl` / `max-w-7xl` / `max-w-5xl` | 3 / 2 / — | **10** (5) / **8** (7) / **4** (4) |
| Grafia de cor | `emerald-*` vs `klasse-green` | 25 vs 17 | **104** (12) vs **43** (8) |
| Grafia de cor | `amber-*` vs `klasse-gold` | 15 vs 35 | **99** (12) vs **123** (14) |

Duas consequências para o item B:

1. **A divergência de raio é muito maior do que se dizia** — 40 contra 167, não 7 contra 5 — e
   corre no sentido oposto ao suposto: `rounded-xl`, que é o token, já é a maioria. O trabalho
   de B é converter 40 ocorrências em 9 ficheiros, não uma dúzia dispersa.
2. **A linha do padding estava errada nos dois sentidos, e a segunda vez foi erro meu.** A
   auditoria dizia "4 páginas". A minha primeira correcção disse "0". Nenhum dos dois: são **5
   ocorrências numa só página**, `operacoes/aulas/[aulaId]/page.tsx`.

   O erro foi de método: procurei a substring `p-5 md:p-6` e na página real está escrito
   `p-5 shadow-sm md:p-6`, com o `shadow-sm` no meio. Medido por **tokens** do `className` em vez
   de por substring, aparecem as 5. Regra para a próxima: neste repo, comparar classes por
   token, nunca por substring — a ordem dentro do `className` não é estável.

O `docs/design-tokens.md` fixa `rounded-xl` para cards e `p-4 md:p-6` para padding de página. A
primeira linha é violação do spec; a segunda não tem infractor nas páginas.

Verificação que a remoção do `hover` do token (B) vale pouco: `hover:shadow-md` aparece **2
vezes** nas 74 páginas (`financeiro/radar`, `admin/configuracoes/sistema`). O pré-requisito de
B existe, mas mexe em quase nada.

## 3. Defeito: `<main>` aninhado

**Corrigido em 2026-09-23** — 33 tags `<main>` em 26 ficheiros passaram a `<div>`.

### O `AppShell` tem três pontos de entrada, não um

| Layout | |
|---|---|
| `app/escola/[id]/(portal)/layout.tsx` | `<AppShell>` |
| `app/secretaria/client-layout.tsx:28` | `<AppShell>` |
| `app/super-admin/layout.tsx` | `<AppShell>` |

Todos com o mesmo `<main className="p-4 md:p-6">` (`components/layout/klasse/AppShell.tsx:420`).
A versão original deste capítulo conhecia apenas o primeiro.

### Alcance real

```
26 ficheiros com <main> próprio dentro de uma das 3 árvores
33 tags <main>
22 variantes distintas de className
```

| Variante | Nº |
|---|---|
| `space-y-6 p-4 md:p-6` | 3 |
| `space-y-6` | 3 |
| **`min-h-screen bg-slate-50 p-4 md:p-6`** | 3 |
| `space-y-5`, `p-6 space-y-4`, `p-6 max-w-7xl mx-auto space-y-6`, `p-6`, `mx-auto max-w-7xl space-y-6 p-6` | 2 cada |
| 14 outras | 1 cada |

### A variante que a versão original não viu

`min-h-screen` aparece **8 vezes em 6 ficheiros**. Seis dessas ocorrências estão no contentor
interno (4 ficheiros); as outras duas estão num wrapper à volta do conteúdo (2 ficheiros).

**No contentor interno (6 ocorrências, 4 ficheiros):**

- `escola/[id]/(portal)/admin/comunicacao/whatsapp/page.tsx`
- `escola/[id]/(portal)/financeiro/fiscal/page.tsx` (2 sítios)
- `escola/[id]/(portal)/financeiro/fiscal/retificar/[docId]/page.tsx` (2 sítios)
- `secretaria/(portal-secretaria)/rematricula/reconciliacao/page.tsx`

**Num wrapper exterior (2 ocorrências, 2 ficheiros):**

- `escola/[id]/(portal)/avaliacoes/page.tsx` — wrapper `flex` que envolve o conteúdo
- `secretaria/balcao/BalcaoPageClient.tsx` — wrapper do `<header>` sticky

O `AppShell` já fecha com `<div className="min-h-screen bg-slate-50">`
(`components/layout/klasse/AppShell.tsx:387`), portanto as 8 são redundantes em altura: um bloco
de 100vh dentro desse contentor — que ainda soma `p-4 md:p-6` — obriga a página a medir mais de
uma viewport mesmo com conteúdo curto. **Scroll garantido.**

**Corrigido em 2026-09-23.** Removida apenas a classe `min-h-screen` nos 8 sítios; mais nada em
cada `className`. `pnpm --filter web typecheck` passou (`EXIT=0`).

### O que foi corrigido, e o que não

A troca de `<main>` para `<div>` é semântica, não visual: no preflight do Tailwind e no
stylesheet do browser, ambos são `display: block` sem margem por omissão. Corrige HTML
inválido (dois `<main>` no mesmo documento) e a árvore de acessibilidade (duas landmarks
`main` por página).

Verificado antes de aplicar: nenhum CSS, global ou local, incluindo `@media print`, tem regra
que aponte a `main`; e os 26 ficheiros tinham abertura e fecho em igual número, pelo que a
troca preservou o equilíbrio. `pnpm typecheck` passou.

**O padding duplicado não foi tocado.** As 22 variantes continuam como estavam: é decisão de
produto, não correcção mecânica, e cada uma muda o layout de uma página.

## 4. Armadilha de leitura: cores aliasadas

`apps/web/tailwind.config.js:14` usa `theme.extend.colors` alimentado por
`klasseTailwindTheme.colors` (`packages/design-tokens/tailwind.cjs`), que contém:

```js
emerald: klasseColors.green,   // #1F6B3B
amber:   klasseColors.gold,    // #E3B23C
blue:    slate,
purple:  slate,
```

Verificado, com consequências:

- `bg-emerald-50` **é** o verde KLASSE (`#ECF5EF`). Não é desvio de marca.
- `bg-amber-100` **é** o dourado KLASSE, não o âmbar por omissão do Tailwind.
- `text-blue-600` renderiza **cinzento** (`slate-600`, `#475569`).

Isto não é defeito a corrigir — é armadilha a documentar. Quem escrever `text-blue-600` à
espera de azul obtém cinzento sem qualquer aviso.

### 4.1 O caso oposto: a paleta `moxinexa-*` **não existe**

Encontrado em 2026-09-23, ao tocar em `avaliacoes/page.tsx` (um dos 26 do §3).

`moxinexa-teal`, `moxinexa-dark`, `moxinexa-gray`, `moxinexa-navy`, `moxinexa-light` aparecem
**223 vezes em 18 ficheiros** e não estão definidas em lado nenhum:

- não constam de `klasseTailwindTheme.colors`, a única fonte de cor do `tailwind.config.js`;
- não constam de nenhum `.css` do repo (nem `@layer`, nem `@utility`);
- não aparecem no CSS compilado.

São classes mortas — a mesma família de `font-sora`, que aparece **68 vezes em 25 ficheiros** e
também não gera CSS (`tailwind.config.js` só define `fontFamily.sans` e `.mono`).

A diferença entre os dois casos é o que torna um inofensivo e o outro não: `font-sora` é
redundante, porque a fonte por omissão já **é** Sora (`fontFamily.sans: ["Sora", "sans-serif"]`)
— quem a escreve obtém o que queria, por acidente. Uma cor não tem omissão equivalente. Geram
**zero** CSS: `bg-moxinexa-teal` não pinta fundo, `text-moxinexa-dark` não pinta texto.

A consequência que interessa não é a ausência — é o par. O botão em
`avaliacoes/page.tsx:718` é `bg-moxinexa-teal text-white`: o fundo não existe e o texto é
branco, sobre o `bg-slate-50` que vem do `AppShell`. **Texto branco sem fundo.** O mesmo par
aparece na linha 221.

*Medido, não renderizado* — como o resto deste documento. O mecanismo (classe sem regra não
pinta) é certo pela cascata; o efeito visual na página é inferência, e confirma-se num clique.

Ficheiros mais afectados:

| Ficheiro | Ocorrências |
|---|---|
| `secretaria/(portal-secretaria)/alunos/novo/page.tsx` | 42 |
| `escola/[id]/(portal)/avaliacoes/page.tsx` | 37 |
| `secretaria/(portal-secretaria)/candidaturas/[id]/editar/page.tsx` | 24 |
| `super-admin/usuarios/novo/page.tsx` | 20 |

**Não corrigido.** São 223 sítios em 18 ficheiros, três deles fora do portal de Operações
(público, super-admin, auth). Escolher a cor de substituição é decisão de produto, não
correcção mecânica. Fica registado, não mexido.

### 4.2 A outra metade: `klasse-*` removido (item C, feito)

Decisão de produto tomada em 2026-09-23: fica a grafia do Tailwind. `klasse-green` → `emerald`,
`klasse-gold` → `amber`, em todo o repo.

```
257 ficheiros, 2517 ocorrências
0 klasse-green|gold restantes
tokens intactos (packages/design-tokens/tailwind.cjs, md5 inalterado)
```

Não havia uma única comparação de igualdade nem chave de objecto sobre estas strings — todas as
2517 estavam dentro de strings de classe. `emerald: klasseColors.green` e
`amber: klasseColors.gold` são o objecto completo, tom a tom, portanto **a troca não muda um
pixel**: `emerald-500` e `klasse-green-500` eram ambos `#1F6B3B`.

**E é exactamente isso que torna esta decisão perigosa.** Antes do C, escrever `klasse-green`
dizia a quem lê que a cor é da marca. Agora nada o diz, e a armadilha do topo deste capítulo
deixa de ter antídoto:

- `emerald-500` **não é** o `#10b981` do Tailwind. É `#1F6B3B`.
- `amber-400` **não é** o `#fbbf24` do Tailwind. É `#E3B23C`.
- `amber-50` é `#FFF7E0`, não `#fffbeb`.

Um leitor novo, ou uma ferramenta de migração, que siga a convenção do Tailwind obtém outra cor.
O C uniformizou a grafia e, ao fazê-lo, tornou a §4 uma regra sem excepção nem sinal.

**Assimetria que a decisão não viu.** Os números que sustentaram a escolha eram do portal (74
páginas). Repo-inteiro, a realidade é mista:

| | `klasse-*` | `emerald`/`amber` |
|---|---|---|
| verde | 1052 | **1199** |
| dourado | **1465** | 1132 |

No verde a grafia escolhida era maioria por pouco; no dourado era **minoria**, e converteu-se a
maioria (801 `bg-klasse-gold` sem tom → `bg-amber`).

**Achado lateral, e é grave:** o sed não tocou — nem devia — em `klasse-blue-*` e
`klasse-slate`. `klasseColors` só tem `green` e `gold`, portanto essas também não geram CSS.

```
klasse-blue-700   9
klasse-blue-600   2
klasse-blue-100   1
klasse-slate      3
                 --
                 15
```

Repete o padrão perigoso do §4.1: `components/secretaria/DocumentosAprovacoesQueue.tsx:80` é
`bg-klasse-blue-600 ... text-white` — no botão **"Aprovar"**. Fundo morto, texto branco. Mesma
família do `moxinexa-*`, e agora a terceira paleta morta encontrada nesta auditoria.

## 5. Conflito resolvido: `klasseSurface` vs a sua própria doc

`packages/design-tokens/src/index.ts:30`:

```ts
card:        "rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
cardInteractive: "rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md"
cardCompact: "rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
cardMuted:   "rounded-xl border border-slate-100 bg-slate-50/50"
```

O `transition hover:shadow-md` **não consta** do `docs/design-tokens.md`, que diz
"Sombras: use pouco. Cards: `shadow-sm`". O `docs/SPRINT_OPERACOES_DASHBOARD_UX_V2.md` diz
"Sombras: mínimas ou ausentes".

O `EstadoVitalBanner` é exactamente `cardCompact` **sem** `transition hover:shadow-md`.

Conclusão: não é preciso escolher entre "aderir ao design system" e "manter o look limpo". A
casca limpa está alinhada com a documentação; o `hover` do token é que é o outlier. Remover
o `hover` do token resolve os dois lados.

## 6. Nota sobre o registo do sprint

`docs/SPRINT_OPERACOES_DASHBOARD_UX_V2.md`, actualização de 2026-08-17, afirma:
"Estado: **concluído para a camada visual compartilhada**", com "cards, espaçamento, bordas e
estados consistentes" e "`StatCard`, `SecaoLabel` e `AcaoRapidaCard` reutilizados nos blocos
equivalentes".

A versão original deste capítulo acusava o registo de exagerar: dizia que `SecaoLabel` tinha
"0 importações em toda a rota `operacoes/**`", e que raio e padding continuavam divergentes.

**Refeito em 2026-09-23 (item F). A acusação estava errada e o registo do sprint estava certo.**

Na árvore de render do portal, `SecaoLabel` aparece em **5** ficheiros, `StatCard` em **2** e
`AcaoRapidaCard` em **2** — a nível 5 e 6, dentro de `EscolaAdminDashboardContent`,
`OperacoesPainelHub` e `AulasOperacionaisPanel`. A frase "`StatCard`, `SecaoLabel` e
`AcaoRapidaCard` reutilizados nos blocos equivalentes" **verifica-se**.

O que não existia era a medição. "0 importações em toda a rota" era verdade sobre uma pasta de
68 stubs, não sobre o produto — e continuou a parecer verdade depois de corrigido o erro dos
stubs, porque a unidade de medida ainda era uma pasta (ver Correcção, no topo).

Sobre a divergência de raio e padding: o §2 refeito mostra que a divergência é maior do que se
dizia num eixo (`rounded-2xl` 40 contra `rounded-xl` 167) e **inexistente** no outro
(`p-5 md:p-6` não ocorre nenhuma vez nas páginas reais).

## 7. Ordem de execução proposta

| # | Acção | Alcance | Depende de |
|---|---|---|---|
| A | ~~Remover os `<main>` aninhados~~ — **feito** 2026-09-23, troca para `<div>` | 26 ficheiros | — |
| B | Converter `rounded-2xl` e `p-5 md:p-6` para o token | ~7 ficheiros — **a remedir** | remover o `hover` do token |
| C | ~~Escolher uma grafia e uniformizar~~ — **feito** 2026-09-23, `klasse-green/gold` → `emerald/amber` | 2517 ocorrências / 257 ficheiros | — |
| D | ~~Convenção de página: uma só largura~~ — **feito** 2026-09-23, `max-w-6xl` no portal | 21 ficheiros | — |
| E | ~~Tirar `min-h-screen`~~ — **feito** 2026-09-23, só a classe, mais nada | 8 sítios / 6 ficheiros | — |
| F | ~~Refazer o §1 e o §2~~ — **feito** 2026-09-23, sobre a árvore de render | 74 páginas / 335 ficheiros | — |

A, D, E e F estão feitas. **B e C já têm números** (§1, §2):

| # | Números reais, agora medidos |
|---|---|
| B | `rounded-2xl` **40×** em **9 ficheiros** (o token `rounded-xl` já é maioria: 167×). `p-5 md:p-6` **5×**, todas em `operacoes/aulas/[aulaId]`. `hover:shadow-md` só em **2** páginas. |
| C | `emerald-*` **104×** vs `klasse-green` **43×**; `amber-*` **99×** vs `klasse-gold` **123×**. Divergência real, ~2,4× maior do que se dizia. **Feito** — ver §4.2. |
| D | **Corrigido em 2026-09-23.** A medição anterior (`max-w-6xl` 10×, `max-w-7xl` 8×, `max-w-5xl` 4×) mediu os ficheiros `page.tsx` — e 68 dos 77 são stubs. **Terceira ocorrência do mesmo erro de método.** Ver §7.1. |

### 7.1 — O erro de método, terceira vez (D)

As larguras não estão nos `page.tsx`: estão nos ficheiros que cada página **renderiza**. Seguindo
a cadeia de re-export e depois os componentes renderizados, as 74 páginas do portal recebem
largura de **38 ficheiros**. Distribuição antes da correcção:

| Largura | Ficheiros fornecedores |
|---|---|
| `max-w-4xl` | 6 |
| `max-w-5xl` | 11 |
| `max-w-6xl` | 9 |
| `max-w-7xl` | 11 |

Quatro larguras, não três. A afirmação "54 páginas sem largura nenhuma" era falsa: eram stubs
sem `max-w` no próprio ficheiro, e o contentor vivia no alvo. **Não são 54 páginas — é 1 ficheiro
a servir 9 páginas (`ConfigSystemShell`) e 37 a servir 1 cada.**

Segunda armadilha, idêntica à do B: dos hits de `max-w-*`, vários **não são wrappers de página** —
`modal-extrato-aluno` (`rounded-2xl max-w-4xl max-h-[90vh] shadow-2xl`), `AdmissaoWizardClient`,
`AdmissoesInboxClient` e `rematricula/page` são **modais**; `fechamento-academico` e
`alunos/[id]/editar` são **estados vazios**; `AcademicSetupWizard` é um **cabeçalho centrado**.
Uniformizar por varrimento cego teria estreitado modais.

**Executado:** 21 ficheiros levados a `max-w-6xl` — o `ConfigSystemShell` (9 páginas de uma vez),
os 4 irmãos de `admin/configuracoes/*` que não usam o shell, e 16 wrappers de página com um único
hit de `max-w-*` (inequívoco). Distribuição depois: **`max-w-6xl` 31 ficheiros**, `max-w-4xl` 5,
`max-w-5xl` 5, `max-w-7xl` 2.

**Não executado, por não ser seguro:** 7 ficheiros com múltiplos hits (`horarios/quadro`,
`TurmaDetailClient`, `AcademicSetupWizard`, `alunos/[id]/editar`, `rematricula/page`,
`fechamento-academico/page`, `migracao/alunos/wizard`) e os 4 modais — precisam de revisão
individual, ficheiro a ficheiro, para separar wrapper de modal. `horarios/quadro` é um quadro
de horários: o `max-w-7xl` pode ser deliberado.

**Padding:** esta passagem uniformizou **largura apenas**. O `ConfigSystemShell` e os 3 irmãos de
`configuracoes` receberam também `px-6 py-8` (a goteira da referência); os outros 16 mantêm o
padding que já tinham. Uma passagem de goteira fica por fazer e deve ser decidida à parte.

## Estado da dashboard

Para contraste: `/operacoes/dashboard` foi limpa em 2026-09-22 e converge com
`klasseSurface.cardCompact` — `StatCard`, `SecaoLabel` e `AcaoRapidaCard` reutilizados, cartões
`rounded-xl border-slate-200 bg-white p-4 shadow-sm`, sem hover lift, sem selos decorativos.
É hoje a superfície mais coerente com o design system dentro do portal de Operações.
