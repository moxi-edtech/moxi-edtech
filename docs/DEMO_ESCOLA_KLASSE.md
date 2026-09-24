# Demo — Escola KLASSE

> Levantamento de 2026-09-23, revisto e **executado** em 2026-09-24 contra a base de produção.
> Escola: **Escola KLASSE** · `escola_id = f406f5a7-a077-431c-b118-297224925726`
> Ano letivo ativo: **2026** (`1952fd7b-4094-487c-8ff6-9a700edfad48`), trimestre 1 (01/08–30/11).
> Ano 2025 (`d76df1a3-eb56-416c-8503-c3e5a8b59fed`) **arquivado**, legível como histórico.

---

## 1. Guião recomendado

A ordem importa: começa pelo que está sólido, deixa o académico para o fim.

### Acto 1 — Secretaria

| Passo | Registo a usar |
|---|---|
| Dashboard | Abre direto. MV: 23 alunos, 36 matrículas, 47 turmas (§3.4) |
| Pesquisa de aluno | **Casimiro Gundja** · nº processo `000022` · ESG-8-M-A |
| Ficha do aluno | Encarregado, contacto, BI, acesso ao portal |
| Admissões | **42 candidaturas** — 16 pendentes, 22 matriculadas, 2 aguardando pagamento |

### Acto 2 — Financeiro (o mais forte)

| Passo | Registo a usar |
|---|---|
| Radar de inadimplência | **44 linhas** / **923.500 Kz** vencidos · **20 devedores** — medido a 24/09 depois de §4.3 |
| Maior devedor (topo do radar) | **Elias Kambundo** · ESG-9-M-A · 4 linhas · **96.000 Kz** (ver §3.3) |
| 2.º / 3.º | **Mulemba Cunha** (ENF-10ª, 60.000 Kz) · três empatados a 48.000 Kz: **Graciano Saske**, **Caroline Caliye** e **Honorato Sabino Gonçalves** (todos ESG-9-M-A) |
| Carteira 2026 | 83 pendentes = **1.845.000 Kz** · 115 pagas = 2.401.200 Kz · 12 isentas — medido a 24/09 |
| Recibos recentes | **#40 Mbemba Lopes**, **#39 e #38 Adilson Mavinga** (emitidos hoje 03:11–03:14) |
| Documentos emitidos | 176: 146 recibos, 13 declarações, 9 boletins, 8 comprovativos |

> O radar lê uma MV que refresca **a cada 30 min** (`:03` e `:33`). Os números acima são os
> que estão na MV agora. Não prometas um valor exacto no minuto — mostra o ecrã.

### Acto 3 — Portal do aluno

Login: **`alvid@klasse.ao`** → **Alvid Caliye Namaliiongo Chocalie** (`000004`, ESG-8-M-A).
É o melhor caso: tem **4 mensalidades em dívida (94.000 Kz)** *e* as **4 notas de 2026**
(Química e Matemática, trimestre 1) — cobre dívida e académico num só login.

Alternativa só para a dívida: **`gunja@klasse.ao`** → **Casimiro Gundja** (`000022`),
11 mensalidades pendentes = **258.500 Kz**, mas **zero notas**.

### Acto 4 — Académico (fino, mas agora coerente — §3.1)

Só **uma** turma serve: **ESG-8-M-A** (`501fc032-ec7b-478e-96c6-0d480b7e80c4`), 10 alunos,
12 disciplinas. As notas de 2026 são só nesta turma, só em **Química** e **Matemática**,
só no **trimestre 1** — 12 notas, 3 alunos.

| Passo | Registo |
|---|---|
| Pauta da turma | ESG-8-M-A → disciplina **Química** → trimestre **1** |
| Alunos com notas | **Graciano Honorato** (10/14) · **Nadina Chitecululo** (8/3) · **Alvid Caliye** (20/18) |
| Portal do professor | `teacher@klasse.ao` (**Klasse Teacher**) vê Matemática e Química **com as notas** |

---

## 2. Credenciais de demonstração

| Papel | Email |
|---|---|
| Admin escola | `colegio@klasse.com` |
| Admin financeiro | `klasseadmin@klasse.ao` |
| Financeiro | `klassefin@klasse.ao` |
| Secretaria | `secretaria@klasse.ao` |
| Professor | `teacher@klasse.ao` (Klasse Teacher) |
| Aluno | `alvid@klasse.ao` (recomendado) · `gunja@klasse.ao` |

> As passwords não estão aqui. **Continua por confirmar que cada uma abre** — não testei login.

---

## 3. Riscos que vão aparecer no ecrã

### 3.1 O professor não via as notas — **CORRIGIDO em 2026-09-24**

Era o risco mais alto. Cada disciplina da ESG-8-M-A estava **triplicada** em
`turma_disciplinas` (36 linhas para 12 disciplinas, por causa das versões de currículo).
O professor estava atribuído a uma cópia; as avaliações e notas ficaram noutra.

Corrigido: 309 linhas alinhadas ao currículo vigente, 882 avaliações sem notas removidas.
A ESG-8-M-A passou de **36 para 12 linhas**, e o Klasse Teacher passou a ter, em 2026:

| Disciplina | Avaliações | Notas |
|---|---|---|
| Matemática | 2 | **6** |
| Química | 2 | **6** |
| Biologia | 0 | 0 |
| História | 0 | 0 |

Entrar como `teacher@klasse.ao` e abrir o livro de notas **já mostra as notas**. A demo
pode incluir este passo — antes não podia.

### 3.2 Frequências: zero registos

A tabela `frequencias` está **vazia** para esta escola. Nenhuma demo de assiduidade,
mapa de faltas ou "aluno em risco por faltas" é possível. Não prometer.

### 3.3 O maior devedor do radar tem matrícula do ano arquivado

**Elias Kambundo** (`000003`, ESG-9-M-A) é o topo do radar com 96.000 Kz, mas a única
matrícula ativa dele é de **2025** (arquivada). As mensalidades em dívida são de 2026.
Se clicares do radar para o registo dele, o contexto de ano pode não bater.

O mesmo acontece com **4 dos 19 devedores**. É pré-existente, não foi criado nesta sessão.

**Recomendação:** usa o radar para mostrar o *painel*, e para abrir a ficha de um devedor
usa os que têm matrícula de 2026 — **Mulemba Cunha**, **Caroline Caliye** ou
**Nadina Chitecululo**.

### 3.4 O dashboard conta 23 alunos; só 22 estão ativos

A MV `mv_secretaria_dashboard_counts` não filtra `deleted_at`, portanto conta o aluno
apagado. A pesquisa de alunos **esconde-o** corretamente (o RPC filtra). Consequência:
o dashboard diz 23, a lista mostra 22. Não é bug novo nem desta sessão.

Nota: `turmas_total = 47` e `matriculas_total = 36` contam **os dois anos** — 25 turmas são
de 2026 (15 com matrícula ativa).

### 3.5 Ano 2025 tem os dados ricos, mas é histórico

915 notas em 2025 contra 12 em 2026. Se pedirem "mostre uma pauta com notas", a resposta
honesta é o ano 2025 — que a app mostra como *"· histórico"* e em modo leitura.

O seletor de ano letivo existe na topbar de todos os portais, mas os três clientes de
`/api/professor/atribuicoes` não passam `ano_letivo_id` — o portal do professor fica preso
ao ano ativo mesmo trocando o seletor.

### 3.6 Duplicação de disciplinas: corrigida em 2026, mantém-se em 2025

O ecrã de detalhe da turma usa `get_turma_disciplinas_pedagogico`, que não desduplica.
Em **2026 está limpo** (12 linhas por turma). Em **2025 continuam 79 pares duplicados** —
deliberadamente intocados, porque essas linhas carregam 915 notas e não têm contrapartida
correta (o currículo publicado de 2025 não existe). **Não abrir turmas de 2025 no detalhe.**

### 3.7 Aluno apagado aparece na pauta (por decisão)

**Nadina Chitecululo** (`000002`) tem `deleted_at` preenchido desde 2026-03-21 mas matrícula
**ativa** em ESG-8-M-A. Aparece na pauta e nas exportações — decisão tomada nesta sessão,
porque escondê-la deixaria as linhas do radar sem nome de turma e criaria um salto na
numeração de chamada. O nome já não denuncia teste (§4).

A causa de fundo — a app **não filtra `deleted_at`** em ~15 caminhos de pauta/turma —
continua por corrigir. Ver §6.

### 3.8 Teta Beta Lando estava congelada no ano — **CORRIGIDO em 2026-09-24** (§4.3)

`ACL-11ª Classe-M-A`, único aluno ativo da turma. Tinha quatro mensalidades de 2026
(08 a 11) **pendentes a 0,00**, criadas pelo gerador. Não havia maneira de as pagar:
pagar 23.000,00 era recusado com *"Valor pago excede o valor previsto da mensalidade"*,
e pagar 0,00 com *"Valor de pagamento deve ser maior que zero"*. Como o 08/2026 ficava em
aberto, bloqueava também o 09, o 10 e o 11.

A causa era não existir **nenhuma** linha de preço para o curso Técnico de Análises
Clínicas em ano nenhum — os 23.000,00 que lhe foram efectivamente cobrados em 2025 não
estavam em `financeiro_tabelas` (as linhas dela têm `tabela_id` nulo, do RPC legado). O
valor de 2026 foi **reconstruído, não lido**: 23.000,00, escolhido pelo utilizador, com
vencimento ao dia 1 (as 10 mensalidades pagas dela são todas ao dia 1).

As quatro linhas de 0,00 foram apagadas (cópia em `public._bk_20260924b_mensalidades_teta`)
e regeradas a 23.000,00. O radar passou de 877.500,00 para **923.500,00** — estava a
subestimar a dívida dela em 46.000,00.

> **Não a usar como caso de demonstração.** Já está desbloqueada, mas o historial dela é
> pobre (uma turma com um aluno só, sem notas) e a história toda é uma correcção recente.

---

## 4. O que mudou nesta sessão (2026-09-24)

Duas escritas em produção, só na Escola KLASSE. Backups fora de transação, em
`public._bk_20260924_*` (nada foi apagado em definitivo).

### 4.1 Alinhamento de `turma_disciplinas` ao currículo vigente

| | antes | depois |
|---|---|---|
| `turma_disciplinas` 2026 | 558 | **249** |
| `turma_disciplinas` 2025 | 307 | **307** (intocado) |
| `avaliacoes` | 4402 | 3520 |
| `notas` | 927 | **927** |
| `curso_matriz` ativos | 558 | **249** |
| pares (turma, disciplina) duplicados em 2026 | 79 grupos | **0** |
| turmas de 2026 sem disciplinas | — | **0** |

Mapeadas 309 linhas, verificadas uma a uma: cada linha removida tinha destino na mesma
turma. `558 + 307 = 865` (backup) e `249 + 307 = 556` (atual) — conservação exacta.

**Âmbito:** o pedido era "todas as 29 turmas". Só 2026 foi migrado. As 307 linhas de 2025
têm 915 notas e **nenhum destino correcto** — apagá-las destruiria os únicos dados
académicos reais da escola. Ficaram intactas, com 79 pares duplicados.

### 4.2 Renomeação dos 3 alunos de teste

Os três primeiros alunos da escola tinham nomes que denunciavam teste, e apareciam em ecrã:
o radar mostrava *"Klasse Finance Teste"* como **maior devedor**.

| Processo | antes | depois |
|---|---|---|
| 000001 | Klasse Studantt | **Adilson Mavinga** |
| 000002 | Alunoklasse teste | **Nadina Chitecululo** |
| 000003 | Klasse Finance Teste | **Elias Kambundo** |

Renomeado em `alunos` (`nome`, `nome_completo`, `nome_busca`) e em `profiles.nome`.
As colunas de pesquisa (`tsv`, `search_text`, `secretaria_search_tsv`) são `GENERATED ALWAYS`
e recalcularam-se sozinhas. **Nenhum valor financeiro ou académico foi tocado** — os totais
do radar são os mesmos, só mudaram os nomes. MVs do radar, top, carteira e risco refrescadas.

Ficam por limpar três emails com sabor a teste — `aluno_teste@klasse.com`,
`klassealunoteste@klasse.com`, `kfinance@klasse.com` — visíveis na ficha do aluno. Não os
toquei: são credenciais de login, classe de risco diferente, e o guião não abre essas fichas.

### 4.3 Financeiro: o balcão e o gerador (2026-09-24, mais tarde)

Cinco commits, todos na Escola KLASSE, todos verificados contra o objecto real na base.

| Commit | O que estava errado |
|---|---|
| `aaf9b50ee` | `registrar_pagamento` procurava o lançamento no `financeiro_lancamentos` sem fixar a competência nem a matrícula, e apanhava o lançamento de outro mês. Pagar uma mensalidade podia abortar com "lançamento já está pago". Duas linhas que tinham ficado presas foram reconciliadas |
| `7185483fe` | Um serviço pago no balcão emitia só o recibo do pagamento, não o documento devido. O código do serviço (`DOC_DECLARACAO_FREQ`) não era reconhecido como tipo de documento — e a escola tem **dois** códigos para o mesmo documento (`DOC_DECLARACAO_FREQ` 11 pedidos e `DOC_DECLARACAO_FREQUENCIA` 1) |
| `01263d234` | O balcão anunciava **"2027/2028"** a um aluno ainda matriculado em 2025: o ano-alvo vinha do ano activo da escola + 1, sem consultar a matrícula do aluno. Passou a vir da última matrícula dele. **8 alunos corrigidos**, 16 inalterados |
| `a1ab21b2a` | O gerador de mensalidades criava cobranças de **0,00** quando nenhuma regra de preço cobria a turma. Essas linhas são impagáveis *e* bloqueiam todos os meses seguintes, porque o validador de ordem trata qualquer `status <> 'pago'` como mês em aberto independentemente do valor. Passou a não gerar e a devolver `sem_preco` |
| `885b50e62` | Teta Beta Lando (§3.8) |

Além disso, a **janela de rematrícula foi reaberta até 2026-10-15** (estava fechada desde
2026-09-20, e o balcão mostrava "período de matrícula fechado" a alunos que precisam mesmo
de se rematricular). Reversão: repor `data_fim = '2026-09-20 18:46:00+00'` na linha
`2d4a5b39-6d0f-4b95-9c91-754f6ad01428` de `rematricula_janelas`.

---

## 5. Pendências que não consegui fechar

- **Confirmar que as passwords dos logins abrem.** Não testei login nenhum.
- O RPC de detalhe da turma foi testado com identidade de `secretaria@klasse.ao` simulada
  por JWT (leitura, com rollback). **Não testei o ecrã renderizado no browser.**
- A emissão do documento no balcão (§4.3, `7185483fe`) foi corrigida por leitura de código
  e verificação de tipos — **o fluxo renderizado nunca foi exercido**. É o passo do Acto 1
  com menos confirmação por trás.
- O assistente de IA foi **mapeado, não expandido** (2026-09-24). Ficou por fazer a
  expansão para perguntas de direcção. O que o mapeamento deixou claro: a lacuna concreta é
  **"Estrutura"** — não tem documento, nem entrada no `route-registry`, nem ferramenta em
  `data-copilot/tool-registry.ts`, nem fragmentos na base de conhecimento. A base de
  conhecimento versionada (`knowledge-base-data.json`, 29 documentos, 173 fragmentos) está
  **desactualizada**: foi construída em 2026-07-26 e não tem nada do que se lhe seguiu, e o
  `kbCache` não é invalidado, por isso reconstruí-la exige reiniciar o servidor.
  `buildKnowledgeBase()` não está ligado a nenhum script npm.
- A sobrecarga **legada de 4 argumentos** de `gerar_mensalidades_lote`, ainda executável por
  `authenticated`, continua com o defeito das cobranças a 0,00. A sobrecarga viva (5
  argumentos, a que a app chama) é que foi corrigida. Fica reportada, não silenciada.

---

## 6. Dívida técnica que este trabalho expôs

Não corrigida — precisa de autorização explícita, e nenhuma é bloqueante para a demo.

1. **O trigger `tg_fill_turma_disciplinas` continua errado.** Insere uma linha por
   `curso_matriz` ativo, sem filtrar currículo nem ano. Foi neutralizado para esta escola
   (passo 6 do alinhamento deixou **uma só matriz ativa por disciplina** — verificado: uma
   turma nova criada hoje nasce limpa), mas o bug volta se outra versão de currículo for
   publicada com `ativo = true`. Migração `20260127020139_remote_schema.sql:7867`.
2. **A app não filtra `deleted_at`** em ~15 caminhos: `pauta-grid`, `pauta`, `mini-pauta(s)`,
   `pauta-trimestral`, `pauta-branca`, `detalhes`, listas de alunos da turma, e as exportações
   PDF/Excel. Só a pesquisa (`secretaria_list_alunos_kf2`) e 6 chamadas ad-hoc filtram.
   Um aluno apagado com matrícula ativa aparece em todos esses ecrãs.
3. **O portal do aluno bloqueia login de apagados mas não as leituras.** Só
   `api/jobs/auth-admin/route.ts:339` verifica `deleted_at`; `alunoContext.ts`,
   `portalAlunoAuth.ts`, `aluno/boletim` e `aluno/dashboard` não.
4. **A MV do radar ignora `mensalidades.turma_id`** e vai buscar o nome da turma à matrícula
   por `aluno_id`. Por isso é que tirar a matrícula deixa a linha sem turma, em vez de usar
   o `turma_id` que a própria mensalidade já tem.

---

## 7. O que não foi tocado

Nenhum dado de outra escola. Confirmei-o à escala da base: a única linha com nome de teste
fora da Escola KLASSE é a escola `Colegio Teste II` (`90bf899f…`), que ficou como estava.

RLS e permissões intactas em todo o trabalho — a verificação da pauta correu com
`set local role authenticated` e identidade real, dentro de `begin; … rollback;`.

Ficheiros do working tree que **não** são desta sessão e não foram varridos:
`apps/landing` (HeroSection, globals.css, package.json, `pnpm-lock.yaml`, `LaptopPreview`,
`LaptopScene`, `.glb`, `draco/`), `docs/audits/`, `docs/sprints/`.
