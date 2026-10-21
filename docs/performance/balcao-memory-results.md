# N4 — Evolução de memória numa sessão simulada

Teste real de componentes React no Vite + Playwright Chrome por **210 ciclos de atendimento**: seis abas visitadas por ciclo e alternância entre alunos sintéticos A/B. O servidor Next.js e Supabase Auth reais **não** estão envolvidos. As 210 iterações simulam mudanças de contexto de um dia, **não representam oito horas de relógio**. Resultados disponíveis em JSON e no gráfico [curvas de memória](balcao-memory-curves.svg).

| Medição | Heap JS após GC (MiB), início → final | Nós DOM | Listeners globais ativos | Painéis no fim do ciclo |
|---|---:|---:|---:|---:|
| PR #213 (antes) | 9.29 → 10.64 | 40 → 40 | 0 → 0 | 1 |
| Nice (depois) | 9.97 → 11.29 | 84 → 84 | 0 → 0 | 1 |

- Heap estabiliza após o aquecimento (40 ciclos), sem crescimento ilimitado nos ciclos seguintes.
- DOM manteve-se estável dentro de cada variante; N1/N2 adicionam elementos de UI, logo 40→84 nós entre variantes é custo fixo, não vazamento.
- Listeners de **window/document** permanecem em zero (saldo add/remove), sem timers/intervalos persistentes próprios. Listeners ligados a elementos temporários desmontados são recolhidos pelo GC e não devem ser contados como vazamento de listeners globais.
- A fronteira de retenção por utilizador, escola, polo e aluno desmonta painéis do contexto anterior; máximo autorizado de sete por atendimento. O teste amostra no fim do ciclo, quando o aluno novo inicia só com a aba Visão geral; não é um perfil de pico intra-ciclo.
- Orçamento de regressão permanente: após GC, heap final <= 150% do valor após aquecimento + 6 MB; DOM final <= 140% do aquecimento + 90 nós; listeners globais <= 150% do aquecimento + 50; máximo 7 painéis; nenhum erro JS. CI executa >=100 ciclos para equilíbrio entre custo e ruído; provas anexas usam 210 ciclos.
- Como não houve crescimento sem limite, uma LRU que descarte formulários pendentes geraria **risco de perda de rascunhos sem benefício medido**. Não foi introduzida.

**Limites:** Chrome headless e fixture não provam memory leaks em sessão real de oito horas, nor capturam memória nativa total de extensões/processos. Nenhuma informação identificável foi gerada.
