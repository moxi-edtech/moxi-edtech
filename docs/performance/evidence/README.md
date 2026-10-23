# Evidências de desempenho — Balcão (fixtures)

Estas 105 imagens JPEG mostram somente aluno, escola e pagamentos **sintéticos**. Foram produzidas pelo Playwright executando componentes React reais no servidor local de visual fixtures, sem acessar produção, Supabase real ou dados de crianças.

Cobertura: Visão geral, Matrícula, Rematrícula, Pagar, Documento, Perfil, Nota; viewports **1366×768, 1536×864, 1920×1080, 768×1024, 390×844**; zoom **CSS** 100%, 125%, 150%. A rotina marcou **zero overflow horizontal da página**. Zoom CSS não substitui teste do zoom nativo do navegador.

Reproduzir com `PERF_CAPTURE=1` e `PERF_ITERATIONS=12` no script `apps/web/scripts/performance/balcao-benchmark.mjs`. Os nomes incluem aba, dimensão e fator de zoom. O JSON `balcao-resultado.json` contém os valores de overflow correspondentes.
