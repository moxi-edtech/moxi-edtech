# Command Center / Balcão — documentação de produto

**Última revisão: 23/10/2026.** A consolidação do Command Center [#252](https://github.com/moxi-edtech/moxi-edtech/pull/252) e a integração do Workspace/Balcão [#253](https://github.com/moxi-edtech/moxi-edtech/pull/253) estão na `main`. O deployment do merge #253 está **READY**. As **11 migrations** do Command Center foram instaladas no Supabase; **nenhuma escola tem isolamento por polo ativado**. O CI verde não substitui homologação autenticada.

> **Leia primeiro:** [Estado atual, implementação, implantação e pendências — 23/10/2026](estado-atual-20261023.md). Os roteiros de PRs abaixo são **históricos de 22/10** e não descrevem branches ainda pendentes.

## Por onde começar

1. **[Backlog histórico em 22/10](estado-backlog-20261022.md)** — retrato anterior à consolidação; o que já existe, o que falta, bloqueios confirmados, critérios de aceite, dependências e decisões de produto.
2. **[Graciosidade no KLASSE](../product/graciosidade.md)** — norma obrigatória de contexto, clareza, recuperação e separação entre estados intermediários e confirmação persistida.
3. **[PR 1: segurança e continuidade](pr1-security-continuity-gates.md)** — retorno do Balcão, privacidade da sessão e replay SQL histórico.
4. **[PR 3: acções e exportação](pr3-actions-export-decisions.md)** — política de exportação por escola, desactivada por omissão.
5. **[PR 4: desempenho e observabilidade](../performance/command-center-20261022.md)** — consultas, contagens, erros, capturas de fixture e limitações dos benchmarks.

## P1 e P2 — histórico das frentes de implementação

- **[PR #240 — ordenação completa e protecção das pesquisas](https://github.com/moxi-edtech/moxi-edtech/pull/240):** nome A–Z/Z–A antes de paginar, cursores determinísticos, throttle por operador/escola com memória local limitada; **não é protecção distribuída**. SQL numa nova migration opcional, sem aplicação de produção.
- **[PR #241 — P2 acessibilidade e observabilidade](https://github.com/moxi-edtech/moxi-edtech/pull/241):** scroll contextual único, teclado, 40 vistas e 24 breadcrumbs retidos, erros correlacionados e testes sintéticos.
- **[PR #243 — backlogs operacionais P1/P2](https://github.com/moxi-edtech/moxi-edtech/pull/243):** [contratos, dados canónicos, ações existentes e gates](pr5-backlogs-operational-20261022.md). Filtros de sinalização documental e de propina realmente vencida, prioridade estável, limitador partilhado, acesso a seis operações por capacidade e CSV auditado, **OFF até aprovação por escola**.

O filtro de matrícula incompleta, documentos obrigatórios por escola, exportação habilitada e medições reais/AA completas continuam dependentes de decisão e homologação. Estas PRs não reabrem CC-001.

## Roteiro histórico de PRs empilhadas (pré-#252)

```text
main
└── #234  exploradores (draft, não integrado)
    └── #236  P0: sessão, acesso, continuidade (CI 6/7; replay bloqueado)
        └── #237  pesquisa SQL/cursores (7/7 no HEAD conferido)
            └── #238  acções/alertas/exportação (6/6 no HEAD conferido)
                └── #239  performance/observabilidade/visual (12/12 no HEAD conferido)
```

**Atenção:** esse diagrama é histórico e foi superado pelo merge #252; representa a relação **pretendida** à data. As bases reais das PRs superiores ainda apontam a commits anteriores das branches inferiores e precisam ser reconciliadas antes do aceite. Os checks mencionados são os observados nos commits listados no [estado verificado](estado-backlog-20261022.md), antes de commits exclusivamente documentais.

## Restrições

- Dados de alunos, encarregados, documentos, notas e pagamentos reais: **proibidos** em fixtures, logs, capturas e exemplos.
- Nenhuma migration de produção deve ser executada para resolver o replay, e nenhuma migration já aplicada pode ser alterada.
- Não alterar ou contornar RLS, guards fiscais, estado académico ou a separação «aprovado pela Secretaria» / «liquidado».
- Exportação bloqueada por defeito e filtragem por polo recusada enquanto a relação canónica não estiver comprovada.
- Merges #252 e #253 e deployment já ocorreram; **não** ativar políticas/funcionalidades gated sem autorização explícita e homologação.
