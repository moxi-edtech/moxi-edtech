# Densidade responsiva — Dashboard de Operações (22-10-2026)

## Contexto e limites

Correção isolada no modo `operacoes`, a partir da `main` `9fae0e0786dbc67e93356804115565608e351c14`. O padrão de comportamento é [graciosidade.md](./graciosidade.md). A PR #242 reduziu espaçamento sem corrigir a relação entre largura útil e grelha. Não se altera banco, motor financeiro, RLS, autorização, Balcão, portal do aluno, topbar ou sidebar.

Os dados das imagens, indicadores e testes são **exclusivamente sintéticos**. Não inserir dados reais de alunos (frequentemente menores), responsáveis, notas ou pagamentos nas evidências.

## Implementação

- `operations-density.css`: contêiner CSS nomeado `operations` com `container: operations / inline-size`. A grelha responde **à largura interna do painel** (já descontados sidebar e paddings), em vez da largura da janela: 1 coluna abaixo de 500px; 2 colunas entre 500–869px; 4 colunas a partir de 870px. Browser alvo Chrome recente (container queries nativas são suportadas desde Chrome 105). Não é necessário ResizeObserver, evitando flash/hidratação e layout shift.
- `KpiSection` e `KpiCard`: mesmas métricas, links e variantes, com alturas mínimas de 92px apenas no modo compacto responsivo; letras dos rótulos e descrições de 12px; foco visível. Os outros modos continuam com classes anteriores.
- `EstadoVitalBanner` + `RadarOperacional`: reutilizados na mesma superfície horizontal/compacta. Alertas começam recolhidos no modo inline, com controlo para expandir e aceder às ações; estado limpo continua em linha e não ocupa um cartão autónomo.
- `OperationsFinanceSummary`: resumo de caixa recebido, previsto, percentual, barra de progresso, competência liquidada e decomposição mensalidades/dívidas antigas/serviços. **Caixa recebido, competência liquidada e aprovação pela secretaria nunca são equivalentes**. Progressbar apresenta 100% de preenchimento máximo mesmo quando a meta de caixa foi ultrapassada, mas o rótulo mantém o valor real (ex.: 101%). A versão `admin` preserva o cartão anterior.
- `AppShell`, `Sidebar` e `Topbar`: intocados. O ganho foi demonstrado com a redistribuição exclusiva do dashboard; não compensa o risco de alteração global (P2-6).

## Método de medição reproduzível

Reutiliza Vite + Playwright do repositório, sem nova dependência de produção. Para reproduzir a execução equivalente ao CI:

```bash
pnpm install --frozen-lockfile
mkdir -p /tmp/klasse-visual
npm --prefix /tmp/klasse-visual install --no-save @playwright/test@1.57.0 vite@6.4.0
/tmp/klasse-visual/node_modules/.bin/playwright install --with-deps chromium
/tmp/klasse-visual/node_modules/.bin/vite --config apps/web/visual-harness/vite.config.mjs --host 127.0.0.1 --port 6006 &
PLAYWRIGHT_MODULE=/tmp/klasse-visual/node_modules/playwright/index.mjs LAYOUT_REPEATS=2 node apps/web/scripts/visual/operations-density.mjs
```

Fixture independente: `apps/web/visual-harness/operations-density.html`, sem importar a cena global `main.tsx` (também tocada por PRs #213, #216 e #239). Conflito resolvido por **entrada isolada**, sem sobrescrever trabalho alheio.

Matriz: 1280×720, 1366×768, 1440×900, 1536×864, 1920×1080, 2560×1440, 768×1024, 390×844. Zoom 100%, 125%, 150%. Estados: pendências, limpo, sem dados, carregando, erro. Relógio fixo: 2026-10-22 09:00 UTC. Fontes prontas antes da captura. Asserções de overflow da página, colunas por largura do contêiner, cards sem sobreposição, texto visível ≥ 11px, controlos interativos ≥30px e dobra de 1366×768/1440×900: fundo dos KPIs até H−12 e início financeiro até H−36.

## Baseline / depois — fixture sintética, Chrome a 100%

Medições do artefacto GitHub Actions `operations-dashboard-layout-evidence` da execução de diagnóstico #39857558993. **A coluna antes é uma reprodução controlada da geometria antiga**, não screenshot histórico autenticado. Valores em pixels desde o topo do viewport; `financeTop` é o ponto de início da caixa financeira.

| Viewport | Largura útil | Colunas antes → depois | Fundo dos KPIs antes → depois | Início do financeiro antes → depois | Overflow antes/depois |
| --- | ---: | :---: | ---: | ---: | :---: |
| 1280×720 | 1024 | 4 → 4 | 619 → 427 (−192) | 631 → 430 (−201) | 0 / 0 |
| 1366×768 | 1099 | 4 → 4 | 620 → 428 (−192) | 631 → 431 (−200) | 0 / 0 |
| 1440×900 | 1152 | 4 → 4 | 619 → 431 (−188) | 631 → 433 (−198) | 0 / 0 |
| 1536×864 | 1152 | 4 → 4 | 619 → 431 (−188) | 631 → 433 (−198) | 0 / 0 |
| 1920×1080 | 1152 | 4 → 4 | 619 → 430 (−189) | 631 → 433 (−198) | 0 / 0 |
| 2560×1440 | 1152 | 4 → 4 | 620 → 430 (−190) | 631 → 433 (−198) | 0 / 0 |
| 768×1024 | 512 | 2 → 2 | 805 → 590 (−215) | 816 → 592 (−224) | 0 / 0 |
| 390×844 | 366 | 2 → 1 | 898 → 810 (−88) | 908 → 812 (−96) | 0 / 0 |

Estas são medições de DOM do fixture real de componentes com shell sintético, não estimativas de uma captura. As capturas estão no artefacto do CI, em `apps/web/visual-evidence/operations-density/`; `measurements.json` contém a matriz completa com posições, overflow, fontes, alvos e anomalias. A execução diagnóstica inicial falhou por classificar texto deliberadamente `sr-only` como texto visual cortado; o teste foi corrigido para excluir **somente** texto visualmente oculto destinado a leitores de ecrã. O gate continua a falhar por texto cortado visível.

## Riscos e delimitação da prova

Este harness monta os **componentes de produção reais** (KPI, radar, estado académico e resumo financeiro) numa composição sintética com dimensões do shell KLASSE. **Não substitui homologação da rota autenticada completa** para detectar interferências de estilos de outras áreas, carregamento da aplicação ou funcionalidades não importadas na fixture. A verificação da suite completa / build e as repetições do job visual devem ser consultadas na PR antes de marcar verde; não se assume verde antecipadamente.

Não há migration, deploy manual ou merge nesta PR.
