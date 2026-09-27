# RELATÓRIO — Sessão de 2026-09-26/27 · Balcão, impressão e assistente

```
repo:        moxi-edtech
branch:      codex/reabertura-notas
HEAD:        8493b827d (2026-09-24) — 149 commits à frente de origin/main
estado:      trabalho desta sessão POR COMITAR (41 entradas em `git status`)
âmbito:      demonstração comercial — Escola KLASSE (f406f5a7-a077-431c-b118-297224925726)
contrato:    AGENTS.md v2.0.0
```

> **Como ler este documento.** A secção 5 separa explicitamente o que foi **executado e
> verificado** do que foi **executado mas não verificado**. Nada aqui deve ser lido como
> "provado" sem passar por essa secção. Os itens de backlog estão na secção 6.
>
> As afirmações da secção 6 foram reconferidas por `grep`/`sed` sobre os ficheiros reais depois
> de escritas. As da secção 5 são resultado de comandos executados.

---

## 1. Enquadramento

Duas frentes, ambas dentro do âmbito da demonstração comercial na Escola KLASSE:

1. **Expansão do assistente de IA** para perguntas de direcção operacional — frente mais antiga
   da sessão, coberta por testes unitários próprios.
2. **Revisão do balcão de atendimento** (`/escola/[id]/secretaria/balcao`) — 14 melhorias de
   UI/UX, impressão e fluxo, pedidas pelo utilizador depois de uma leitura de código. Plano
   aprovado em `~/.claude/plans/polished-wondering-comet.md`.

### Decisões tomadas com o utilizador

| Assunto | Decisão |
|---|---|
| Cabeçalho dos documentos | Componente partilhado, aplicado **só** aos documentos novos. Os 5 que já imprimiam ficam intactos. |
| Moeda | Unificar **só** nos ficheiros do balcão. Os outros 66 ficheiros não se tocam. |
| Caminhos de emissão (item 13) | Unificar os três. |
| Copy da rematrícula | Português corrente primeiro, termo técnico entre parênteses. |
| Sugestões estruturais | "Repara os 3", "todas as que omitem", "verificar mais fundo". |

---

## 2. Balcão de atendimento — os 14 itens

Todos implementados. Ficheiro principal: `apps/web/src/components/secretaria/BalcaoAtendimento.tsx`.

### Bloco 1 — Impressão que não perde documentos

| # | Item | Onde |
|---|---|---|
| 1 | Fila de impressão visível | `BalcaoAtendimento.tsx:1496-1532` |
| 1b | Recibo pago sem verificação | `:619-630` |
| 2 | Auto-impressão | `PrintTrigger` em `FinalDocumentPrint.tsx:31` |
| 3 | Identidade da escola | `secretaria/documentos/_print/PrintLetterhead.tsx` (novo) |

**Item 1:** `printQueue` era escrita em dois sítios e **nunca renderizada**. Um documento emitido —
por vezes já pago — ficava inalcançável. Agora é um painel no carrinho, com ligações normais: um
clique do utilizador não é bloqueado pelo browser.

**Item 1b:** era `window.open(json.recibo.print_url)` sem verificação nenhuma. Com popups
bloqueados, o comprovativo de um pagamento já recebido desaparecia em silêncio, sem caminho de
recuperação. Passa pela mesma função total, caindo na fila.

**Item 3:** o cabeçalho `font-serif` com logótipo centrado estava copiado em 5 ficheiros. Extraído
para componente partilhado e aplicado **apenas** ao `FinalDocumentPrint`, conforme a decisão.

### Bloco 2 — Números que não mentem

| # | Item | Onde |
|---|---|---|
| 4 | Badge de inadimplência | `api/secretaria/balcao/alunos/search/route.ts:77-110` |
| 5 | Resumo de caixa parado | `ResumoCaixaSecretaria.tsx` (`refreshKey`) + `BalcaoPageClient.tsx` |
| 6 | Duas moedas no mesmo ecrã | `formatKwanza` de `lib/formatters.ts` nos dois ficheiros do balcão |

**Item 4 foi reenquadrado por evidência.** O plano previa escolher entre um agregado ao vivo e
apagar o badge morto. A leitura de
`supabase/migrations/20261107000000_financeiro_inadimplencia_top_mv.sql` mostrou que já existe
pré-cálculo por aluno com todos os artefactos: `internal.mv_financeiro_inadimplencia_top`, índice
único `(escola_id, aluno_id)`, `refresh` com `CONCURRENTLY`, cron `*/10 * * * *`, e wrapper
`public.vw_financeiro_inadimplencia_top` com `security_invoker = true` limitado por `auth.uid()`
via `escola_users`. O badge era funcionalidade por ligar, não código morto — e ler pré-cálculo
respeita o "pré-cálculo > cálculo ao vivo" do contrato.

> **Armadilha:** a vista é `security_invoker`, portanto tem de ser lida **com JWT de utilizador**.
> Lida como superuser devolve 0 linhas e parece dados destruídos.

### Bloco 3 — O fluxo deixa de mentir ao operador

| # | Item | Onde |
|---|---|---|
| 7 | "Pago" num serviço por pagar | Extras e Documentos passaram ambos a `Cobrar`/`Adicionar` |
| 8 | Audit trail obsoleto | `useAuditTrail.alternarScope()` — ver §2.4 |
| 9 | Estado morto | `addingServicoId` removido (era `useState` sem setter) |
| 10 | Duas buscas, e o balcão usava a pior | `OmniSearchInput.tsx` (novo) — ver §2.3 |
| 11 | Copy da rematrícula | `ESTADO_OPERACAO` — ver §2.2 |

### Bloco 4 — Estrutura

| # | Item | Onde |
|---|---|---|
| 12 | Carrinho soterrado abaixo de 1280px | `lg:grid-cols-12`; `max-h-[620px]` confinado ao `xl` |
| 13 | Unificar caminhos de emissão | `lib/documentos/printUrl.ts` + `emissaoClient.ts` (novos) |
| 14 | Atalho de teclado | `Cmd/Ctrl+Enter` finaliza o pagamento |

### 2.1 O defeito de raiz: `window.open` com `noopener` devolve sempre `null`

`window.open(url, "_blank", "noopener,noreferrer")` devolve `null` **por especificação**,
independentemente de a janela ter aberto ou sido bloqueada. `noopener` corta exactamente a
referência que o valor de retorno transporta.

Isto parte o padrão do repositório em dois graus diferentes — e a distinção importa:

**Classe A — o código lê o valor de retorno.** O ramo "bloqueado" dispara **sempre**, logo o
caminho de sucesso é código morto. Quatro sítios:

| Ficheiro | Efeito real |
|---|---|
| `app/escola/[id]/(portal)/horarios/quadro/page.tsx:883-888` | **A impressão do quadro de horários nunca funcionou.** Abre uma aba em branco, `if (!printWindow)` dispara, mostra "Não foi possível abrir a janela de impressão" e faz `return` antes do `document.write`. A aba fica em branco e nada imprime. **O mais grave dos quatro.** |
| `components/secretaria/AdmissaoConversionSheet.tsx:547-551` | A notificação de WhatsApp falha sempre: mostra "O navegador bloqueou a abertura do WhatsApp", faz `return` cedo, portanto `setNotificationSent(true)` e o flag em `localStorage` **nunca** correm. O fluxo de seguimento de admissões nunca regista o envio. |
| `components/secretaria/alunos/FinalizarMatriculaButton.tsx:74-77` | O aviso "Permita pop-up para abrir impressão automática" aparece sempre, mesmo quando a aba abriu. A impressão funciona — mas a informação é sempre falsa. |
| `lib/documentos/emissaoClient.ts` (novo) | Este é o que corrigi. `abrirParaImpressao` abre **sem** `noopener` e limpa `opener` a seguir, distinguindo os dois casos. |

**Classe B — o código não lê o valor de retorno.** Funciona normalmente; quando o browser bloqueia,
o documento perde-se sem caminho de recuperação. É a classe do item 1b. Acontece em cerca de 20
sítios de `onClick`; o que importa é `components/secretaria/ModalPagamentoRapido.tsx:758`, onde se
perde o recibo de um pagamento já concluído.

### 2.2 Item 11 — os 15 estados da rematrícula

Os estados eram apresentados numa cadeia de ternários aninhados dentro do JSX, onde o diagnóstico
interno (`DEBT_BLOCKED`, `SOURCE_RECORD_REQUIRED`, …) fazia de título. Passaram a um
`Record<RematriculaCardState | "CHECKING", OperacaoCopy>` exaustivo, com título em português
corrente e o código interno em monoespaçado ao lado (`CodigoEstado`), para o operador o poder citar
ao suporte.

`RematriculaCardState` tem **14** membros; `CHECKING` é rótulo sintético do cliente para o intervalo
antes de a primeira leitura de elegibilidade responder.

Sobrepus todas as mensagens antigas, incluindo o texto sem acentos que tinha ficado
(`"Pagamento, atualizacao da matricula e comprovante"`).

### 2.3 Item 10 — a unificação das duas buscas

`OmniSearchInput` vivia dentro de `BuscaBalcaoRapido.tsx` e tinha setas/Enter/Escape, `autoFocus`,
BI e turma. O balcão tinha uma segunda implementação inline — sem nada disso — e era a que os
operadores realmente usavam.

Extraído para `components/secretaria/OmniSearchInput.tsx`, genérico sobre o tipo de resultado
(`OmniSearchAluno`) para que cada ecrã passe o seu. `BuscaBalcaoRapido.tsx` ficou só com uma
importação e uma deleção (o diff é remoção pura). O balcão usa-o com um adaptador que concentra a
diferença de nomes (`turma` → `turma_atual`, etc.).

Preservei a fotografia do aluno, que a unificação tinha feito perder — era o que distingue dois
alunos com o mesmo nome.

### 2.4 Item 8 — porque não bastava chamar `onRefresh`

Alternar "Ver todos"/"Ver aluno" mudava o rótulo e não recarregava. A correcção óbvia
(`setScope` seguido de `onRefresh`) usa o **âmbito antigo**, porque a `useCallback` fecha sobre o
valor anterior. Corrigido na origem com `alternarScope()`, que fixa o âmbito **e** relê, passando o
novo âmbito explicitamente a uma função de leitura sem âmbito.

### 2.5 Itens 2 e 3 — as 4 rotas, confirmadas por leitura

```
apps/web/src/app/secretaria/documentos/[docId]/certificado/print/page.tsx
apps/web/src/app/secretaria/documentos/[docId]/historico/print/page.tsx
apps/web/src/app/aluno/documentos/[docId]/certificado/print/page.tsx
apps/web/src/app/aluno/documentos/[docId]/historico/print/page.tsx
```

Todas passam pelo mesmo `FinalDocumentPrint`, portanto todas ganham `PrintTrigger` e
`PrintLetterhead`.

**Correcção de um erro meu:** afirmei repetidamente que "certificado, histórico e notas" não
imprimiam. `notas/print/page.tsx` é um re-export do boletim trimestral e já imprimia. É **um**
componente, **quatro** rotas.

### 2.6 Item 14 — o atalho, e a armadilha que fechei

`Cmd/Ctrl+Enter` finaliza. Um `keydown` em `window` (o foco tanto pode estar no valor recebido como
nos detalhes).

**Risco encontrado ao rever:** a caixa de busca de alunos também é um campo de texto, e lá dentro
`Cmd+Enter` lê-se como "procurar". Com itens no carrinho, isso **cobrava o aluno**. Como é uma acção
com dinheiro, a busca marca-se com `data-atalho-pagamento="off"` e o atalho não dispara a partir
dela. O atalho também fica desligado enquanto há um modal aberto — o ouvinte está em `window`, e o
`aria-modal` dos diálogos não o travaria.

### 2.7 Item 13 — porque a separação em dois ficheiros é obrigatória

- `printUrl.ts` — **puro**, sem `"use client"`.
- `emissaoClient.ts` — `"use client"`.

Não é estilístico: 11 módulos **server-side** constroem hoje URLs de impressão (incl.
`emitirComprovanteMatricula.ts` e várias rotas de `api/secretaria/**`). Um módulo `"use client"`
importado por um Server Component transforma os seus exports em referências de cliente e parte-os.

Duas divergências reais entre os dois clientes, modeladas explicitamente:

- O hub enviava `ano_letivo_id: null`, que o zod da rota rejeita (`.optional()`, não `.nullable()`)
  e devolvia o `error.format()` do zod — um objecto, que virava `"[object Object]"` na mensagem ao
  operador. O wrapper **omite a chave** quando nula.
- `ano_letivo` (numérico) é só do hub e só para boletim.

**Defeito adicional encontrado no desenho:** `getTipoDocumentoFromCodigo` pode devolver `"recibo"`,
que **não** está no enum da rota. Uma escola com um serviço `DOC_RECIBO` fazia o balcão POSTar
`tipoDocumento: "recibo"` e receber 400. Guardado por `isTipoDocumentoEmitivel` antes do POST.

---

## 3. Assistente de IA e restantes frentes da sessão

Registo por ficheiro. Esta frente tem testes unitários próprios (a passar).

| Ficheiro | Papel |
|---|---|
| `lib/assistant/derive-widget-context.ts` (novo) | Deriva o contexto do widget por ramos de rota |
| `lib/assistant/docs/regras-negocio-estrutura.md` (novo) | Regras de negócio, passa a fazer parte da KB |
| `lib/assistant/build-knowledge.ts`, `knowledge-base-data.json` | Módulos da KB e mapa documento → módulo |
| `lib/assistant/klasse-brain.ts`, `route-registry.ts` | Assistente e registo de rotas |
| `lib/klasse-help/help-topics.ts` | Tópicos de ajuda |
| `components/ui/ModalShell.tsx` | Suporte a modal por rota (`app/escola/[id]/(portal)/@modal/`) |
| `lib/admin/activityFeedDetails.ts` (novo) | Traduz payloads técnicos do feed em linguagem legível |

Testes novos (a passar):

- `tests/unit/assistant-widget-context.spec.ts` — inclui a regressão "a Oferta Formativa é
  reconhecida como académico nas duas portas de entrada" e "o ramo de estrutura vence os ramos mais
  largos de `/admin` e `/operacoes`".
- `tests/unit/assistant-kb-modules.spec.ts` — "todo o documento em `docs/` tem módulo declarado",
  "o mapa não declara documentos que já não existem", mais uma regressão dos documentos que a
  inferência por substring classificava mal.
- `tests/unit/activity-feed-details.spec.ts` — inclui "não expõe IDs nem chaves técnicas do payload".

Ficheiros de UI tocados na mesma passagem: `AlunoPerfilPage.tsx`, `AlunoDossierRouteModal.tsx`
(novo), `EscolaAdminDashboardContent.tsx`, `OperationalFeedSection.tsx`, `AppShell.tsx`,
`Topbar.tsx`, `PricingConfigurationModal.tsx` (novo), `docs/DEMO_ESCOLA_KLASSE.md`.

Também por comitar: assets da landing (`assets/draco/`, `klasse-laptop.glb`), `artifacts/`,
`docs/HANDOFF_KLASSE.md`, `docs/audits/`, `docs/sprints/`.

---

## 4. Ficheiros novos desta entrega

```
apps/web/src/lib/documentos/printUrl.ts                          (puro, cliente-servidor)
apps/web/src/lib/documentos/emissaoClient.ts                     ("use client")
apps/web/src/components/secretaria/OmniSearchInput.tsx           ("use client")
apps/web/src/app/secretaria/documentos/_print/PrintLetterhead.tsx (Server Component)
apps/web/tests/unit/activity-feed-details.spec.ts
apps/web/tests/unit/assistant-kb-modules.spec.ts
apps/web/tests/unit/assistant-widget-context.spec.ts
```

---

## 5. Verificação

### Executado e com resultado

| Verificação | Comando | Resultado |
|---|---|---|
| Tipos | `pnpm -C apps/web typecheck` | **Limpo.** Corrido 3×, incluindo um `tsc -p` directo depois das últimas edições. |
| Testes unitários | `node --test --import tsx tests/unit/*.spec.ts` (em `apps/web`) | **128/130.** |
| As 4 rotas do `FinalDocumentPrint` | leitura dos ficheiros | Confirmadas: uma componente, quatro rotas. |
| Artefactos da MV de inadimplência | leitura da migração `20261107000000` | Índice único, refresh `CONCURRENTLY`, cron e wrapper `security_invoker` com `escola_id` + `aluno_id` — todos presentes. |
| Sítios `window.open` com `noopener` | `grep` sobre `apps/web/src` | 4 de Classe A (o resultado é lido), ~20 de Classe B. Detalhe em §2.1. |
| Duplicação eliminada | `grep` | `DOC_PRINT_SEGMENT` existe só em `printUrl.ts`; o balcão já não chama `window.open`. |
| Código morto do §B-12 | `grep` | `RematriculaBalcaoCard.tsx` (311 linhas) sem importadores; `resolveReconciliation` exportado em `useRematriculaBalcao.ts:707` sem consumidor; `ERROR_MESSAGES` duplicado em `useRematriculaBalcao.ts:142` e `RematriculaBalcaoModal.tsx:96`. |

**As 2 falhas de teste são pré-existentes.** `tests/unit/operacoes-access-and-navigation.spec.ts`
importa `lib/permissions.ts`, `lib/roles.ts`, `lib/sidebarNav.ts` e `lib/navigation.ts` — nenhum
desses ficheiros tem alterações nesta sessão (`git status` limpo para os quatro). Falham por motivo
independente deste trabalho, e **não foram investigadas**.

### Executado mas NÃO verificado — não tratar como aprovado

| # | O que falta | Porque não foi feito |
|---|---|---|
| 4 | Comparar a dívida que a vista devolve com a que o dossiê mostra, para um aluno da Escola KLASSE | Precisa de **JWT de utilizador**. Não fui procurar credenciais. O código está verificado por leitura; o **dado** não. |
| 1, 1b | Checkout no browser com **popups bloqueados de propósito**: o documento tem de cair na fila, não desaparecer | Precisa de browser com sessão. É o teste que mais importa — é onde estava o defeito que perdia recibos. |
| 2, 3 | Abrir as 4 rotas e confirmar cabeçalho com logótipo/nome da escola e que a impressão dispara | Precisa de browser. |
| 13 | Confirmar que os URLs de impressão do balcão e do hub ficaram idênticos aos de antes | Verificado por leitura do mapa; sem diff de URL em execução. |
| 12 | A 1024px a ficha do aluno fica em ~620px de largura | Precisa de olho. Pode estar apertado. |
| 14 | Testar `Cmd/Ctrl+Enter` nos dois caminhos, incluindo na busca (não deve disparar) | Precisa de browser. |

### Não executado, de propósito

- `pnpm build` — **não correr com o dev server a correr**: partilham `apps/web/.next` e o dev server
  parte com ENOENT em `edge-instrumentation.js`.
- Nenhum `supabase db push`. `schema_migrations` não é fiável; verificar objectos reais.

---

## 6. Backlog

### P0 — funcionalidade partida, acção errada ou dados em risco

| ID | Item | Evidência |
|---|---|---|
| B-01 | **`horarios/quadro/page.tsx:883-888` — a impressão do quadro de horários nunca funcionou.** Abre aba em branco, o `if (!printWindow)` dispara sempre, mostra erro e faz `return` antes do `document.write`. | §2.1 Classe A |
| B-02 | **`AdmissaoConversionSheet.tsx:547-551` — o fluxo de WhatsApp de admissões nunca regista o envio.** O ramo "bloqueado" dispara sempre; `setNotificationSent(true)` e o flag em `localStorage` são inalcançáveis. | §2.1 Classe A |
| B-03 | **Verificar o item 4 contra dados reais** (§5). Sem isto, o badge pode mostrar 0 onde há dívida. | §5 |
| B-04 | **Verificar os itens 1/1b com popups bloqueados** (§5). É a verificação que valida a correcção mais importante da sessão. | §5 |

### P1 — informação errada ou recuperação em falta

| ID | Item | Evidência |
|---|---|---|
| B-05 | **`ModalPagamentoRapido.tsx:758`** — abre o recibo de um pagamento concluído sem verificação nem caminho de recuperação. Com popups bloqueados perde-se. Classe B, a mesma do item 1b. | §2.1 Classe B |
| B-06 | **`FinalizarMatriculaButton.tsx:74-77`** — o aviso "Permita pop-up para abrir impressão automática" aparece sempre, mesmo quando a aba abriu. A impressão funciona; a mensagem é que é sempre falsa. | §2.1 Classe A |
| B-07 | **`get_secretaria_caixa_hoje` não tem migração versionada no repositório** — o único sítio onde o nome aparece é `apps/web/src/app/api/secretaria/balcao/resumo-caixa/route.ts`, que a chama. Existe só em produção. Se a base for reconstruída, o resumo de caixa desaparece sem aviso. | `grep` |
| B-08 | **Dois testes a falhar** em `operacoes-access-and-navigation.spec.ts`, pré-existentes e não investigados. | §5 |

### P2 — dívida técnica identificada, não corrigida

| ID | Item |
|---|---|
| B-09 | Reimpressão de documento antigo não existe: **não há endpoint que liste `documentos_emitidos`** (só leitura por `docId`). Construí-lo é funcionalidade nova. A fila do item 1 resolve o caso imediato, porque o URL vem na resposta do checkout. |
| B-10 | Migrar as 5 cópias antigas do cabeçalho de impressão para o `PrintLetterhead`. Exige verificação visual rota a rota. |
| B-11 | 66 ficheiros com formatação de moeda própria; 11 construtores server-side de URL de impressão a migrar para `printUrl.ts`. |
| B-12 | Código morto confirmado: `RematriculaBalcaoCard.tsx` (311 linhas, nunca importado), `resolveReconciliation` exportado sem consumidor, `ERROR_MESSAGES` duplicado. |
| B-13 | Estale closure em `useCheckout`: `onSuccess` é usado no corpo mas não está nas dependências de `checkout` (`[aluno, escolaId, academicYearId, error]`). Não causa defeito visível hoje porque `onPagamentoConcluido` é estável, mas é a mesma classe de armadilha do §2.4. |

### Pendente de decisão do utilizador

| ID | Item |
|---|---|
| B-14 | **Migração `supabase/migrations/20270826120000_fix_matriculas_session_id_on_creation.sql` por comitar** desde antes desta sessão. |
| B-15 | **Comitar o trabalho desta sessão.** As 41 entradas em `git status` continuam por comitar. |
| B-16 | **Registo de WARNs.** `agents/outputs/WARN_REGISTRY.md` **não existe**. O contrato `AGENTS.md` v2.0.0 diz que um WARN sem entrada no registo bloqueia PASS, e o formato pede `Ticket`, `Responsável` e `Prazo` — que só o utilizador pode dar. B-01, B-02, B-05, B-06 e B-08 são candidatos. |

---

## 7. Fora de âmbito, por decisão

- Nenhum dado de outras escolas foi lido ou tocado. Tudo o que se refere a dados é a Escola KLASSE.
- Não se contornou RLS nem se desactivou RLS. Não se usou service role no cliente.
- Não se alteraram preços, planos nem regras comerciais.
- Não se refactorizou fora do âmbito: os ficheiros dos B-01, B-02, B-05 e B-06 foram **reportados,
  não corrigidos**, apesar de o B-01 e o B-02 serem a mesma causa-raiz que motivou esta entrega.

---

## 8. Estado do contrato

Esta entrega **não emite PASS**: não foi corrida nenhuma varredura dos Agentes 1/2, e há findings
abertos (B-01, B-02) da mesma classe do defeito corrigido.

Artefactos do contrato, verificados:

| Artefacto | Estado |
|---|---|
| `agents/outputs/REPORT_SCAN.json` | Existe, de **2026-08-23** — anterior a esta sessão, não actualizado. |
| `agents/outputs/REPORT_SCAN_LAST_PASS.json` | **Ausente.** O contrato diz que sem ele "não há regressões a reportar" — portanto esta sessão não pode reportar regressões, nem as descartar. |
| `agents/outputs/WARN_REGISTRY.md` | **Ausente** (B-16). |
| `agents/exceptions/` | 4 ficheiros: `EXC-P0-SYLLABUS-A.md`, `EXC-SECRET-001.md`, `public-routes.md`, `service-role-allowed.md`. |

Se for preciso formalizar, o passo é correr os Agentes 1 e 2, gerar o
`REPORT_SCAN_LAST_PASS.json` e escrever o `WARN_REGISTRY.md` com tickets — não reescrever este
relatório.
