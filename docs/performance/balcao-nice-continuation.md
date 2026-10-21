# PR empilhada — Nice-to-haves Balcão (N1–N5)

**Base obrigatória:** PR #213 `perf/balcao-measured-20261021`. Não fazer merge de qualquer PR nem deploy. Esta PR aplica melhorias pequenas à experiência do atendimento; a política de privacidade e os estados financeiros da PR #213 prevalecem.

| Item | Entrega | Teste/evidência |
|---|---|---|
| N1 | Marcador discreto **Por guardar** por aba, `aria-label` adicional com a expressão para leitor de tela; derivado unicamente de `BalcaoDraftState` (não depende de clique ou label do botão) | Playwright `balcao-nice-browser.mjs`: aparece ao editar e desaparece ao reverter |
| N2 | `Ctrl+Alt+Shift+F` pesquisar e `Ctrl+Alt+Shift+T` trocar aluno, com ajuda visível e toggle desativável, ignorando eventos de input/textarea, IME ou conflitos de modifiers; segue a confirmação existente de trabalho pendente | Playwright N1/N2: opt-out, ignore input, troca guardada |
| N3 | Dossiê integral e resumo financeiro com `Atualizando dados...`, hora da última leitura confirmada, sem desmontar a informação anterior; informação antiga fica **inerte** enquanto revalida ou em erro. Nunca confundir snapshot velho com pagamento liquidado. | Playwright `balcao-financial-refresh.mjs`: confirmação, atualização lenta, erro e bloqueio de ações |
| N4 | Perfil de 210 ciclos, baseline PR #213 e nova implementação, CDP JS heap pós-GC, DOM nodes, listeners globais; budget no CI >=100 ciclos. Sem LRU desnecessária quando não houve crescimento ilimitado. | [Curvas e limites](balcao-memory-results.md); [SVG](balcao-memory-curves.svg), JSON antes/depois |
| N5 | Métricas locais e anónimas apenas em buckets/categorias, opt-in por `NEXT_PUBLIC_BALCAO_ANONYMOUS_METRICS` e sem transportador de rede por motivos de privacidade. Não enviar IP ou identificadores. | [Privacy model](balcao-nice-telemetry-privacy.md), 3 testes unitários de payload hostile e rate limit |

## Restrições e números

Esta PR **não** introduz polling, prefetch ou endpoint de métricas: incremento de requisições por hora = **zero** em relação à base. Memória antes 9,29→10,64 MiB; depois 9,97→11,29 MiB (as interfaces adicionais usam memória fixa, sem crescimento significativo entre os ciclos 40 e 210). DOM 40→40 antes, 84→84 depois; listeners globais 0→0. São fixtures headless; não equivalem a observabilidade da escola em produção.

O pipeline `Balcao Nice-to-have Regression` executa os três tipos de regressão (atalhos/indicador, frescor financeiro e 100 ciclos memória) com dados exclusivamente sintéticos, além de typecheck/lint. Sem mudanças de schema, migrations, RLS, fiscal ou motor financeiro. Nenhuma imagem, teste ou log contém dados de menores.

## Gate externo ainda existente na PR #213

A homologação end-to-end com Auth real e policies RLS (M2/M3) **não** é declarada aprovada: os primeiros testes com todos os arquivos históricos de migrations em um Postgres descartável do GitHub encontram falhas legadas no replay, registadas em `docs/performance/balcao-m2-finance-integration.md`. A PR nice continua separada e não contorna esse gate. Requer uma iniciativa de reparação auditada do replay/migrations antes de aprovar merge/deploy.
