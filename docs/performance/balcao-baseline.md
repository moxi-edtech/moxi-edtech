# Baseline — desempenho do Balcão do KLASSE

Base: `main` em `8bd1ef57`; Chrome 155.0.8059.85; nove execuções por aba, fixture 100% sintética, endpoints simulados com latência controlada de 24–35 ms. A instrumentação de React Profiler usa os componentes reais do Workspace no Vite visual harness.

| Aba | Pintura mediana / p95 (ms) | Requisições por troca mediana / p95 | React commits mediana / p95 |
|---|---:|---:|---:|
| Visão geral | 78 / 412 | 8 / 8 | 7 / 7 |
| Matrícula | 81 / 130 | 0 / 0 | 1 / 1 |
| Rematrícula | 125 / 143 | 8 / 8 | 7 / 7 |
| Pagar | 77 / 95 | 0 / 0 | 3 / 3 |
| Documento | 72 / 93 | 0 / 0 | 2 / 2 |
| Perfil | 78 / 97 | 2 / 2 | 3 / 3 |
| Nota | 78 / 98 | 2 / 2 | 6 / 6 |

## Métricas adicionais

- JavaScript transferido pelo harness Vite (desenvolvimento): **7 201 354 bytes**; não equivale ao tamanho do bundle Next.js otimizado.
- LCP observado na fixture: **1 300 ms**; INP observado no browser: **664 ms** em 159 eventos instrumentados. Estes valores medem a fixture, não uma sessão real.
- Um minuto em repouso: **0 requisições**, projetando 0/hora no intervalo controlado. Não representa a sessão inteira de trabalho.
- Latência das requisições simuladas: mediana **38 ms**, p95 **42 ms**. Não há medição SQL real.
- **0 erros** JavaScript reportados no cenário de medição.

## Diagnóstico priorizado a partir da medição

1. **Remontagem + I/O repetido:** Visão geral e Rematrícula repetem 8 chamadas de rede a cada regresso; Perfil e Nota repetem 2.
2. **Renderizações:** Visão geral e Rematrícula exigem 7 commits React por troca, especialmente caras quando repetidas.
3. **Carregamento antecipado:** todas as superfícies do router Command Center são importadas estaticamente, com 7,2 MB de tráfego de módulos no harness de desenvolvimento; estudar divisão do bundle.
4. **Frescor de dados:** nunca otimizar repetições com cache de pagamentos sem invalidação confirmada ou dados separados por utilizador/escola/polo.

## Reprodutibilidade

A partir da raiz do repositório, sem acesso à produção:

```bash
npm install --prefix /tmp/klasse-perf-tools --no-save vite@6.4.0 playwright@1.57.0
/tmp/klasse-perf-tools/node_modules/.bin/playwright install chromium
/tmp/klasse-perf-tools/node_modules/.bin/vite --config apps/web/visual-harness/vite.config.mjs --host 127.0.0.1 --port 6016
# Noutro terminal, na raiz:
PLAYWRIGHT_MODULE=/tmp/klasse-perf-tools/node_modules/playwright/index.mjs PERF_ITERATIONS=9 PERF_IDLE_MS=60000 node apps/web/scripts/performance/balcao-benchmark.mjs
```

Opcional: `PERF_CHROME_PATH` aponta para o executável do Chrome; `PERF_CAPTURE=1` ativa as capturas de 5 viewports × 3 zooms. Os endpoints `fixture.invalid` e `/api` são interceptados e alimentados exclusivamente por dados fictícios. O tempo de pintura é calculado antes de um intervalo fixo de estabilização da contagem HTTP.

## Limitações explícitas

O benchmark exercita componentes reais sob o **Vite visual harness**, não o servidor Next.js autenticado com Supabase descartável. Também não mede o SQL real nem bundle otimizado do Next. A comparação antes/depois deve utilizar este mesmo script, ambiente e latência; não é prova de experiência em produção. A proteção de dados e as regras de domínio prevalecem sobre qualquer ganho de tempo.

## Sobreposição com PRs existentes

A PR #211 modifica o `CommandCenterPanel`, #212 introduz o copiloto; há trabalho paralelo de transferência e avisos. Este trabalho parte estritamente da `main` e não incorpora nem reimplementa essas PRs. O merge deve reconciliar os diffs; **nenhum merge ou deploy está autorizado**.
