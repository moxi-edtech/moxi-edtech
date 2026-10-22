# Command Center / Balcão — documentação de produto

**Última revisão:** 22/10/2026 · **Estado:** código em PRs de revisão, sem homologação funcional completa.

## Por onde começar

1. **[Estado verificado e backlog priorizado](estado-backlog-20261022.md)** — fonte de verdade de acompanhamento: o que já existe, o que falta, bloqueios confirmados, critérios de aceite, dependências e decisões de produto.
2. **[Graciosidade no KLASSE](../product/graciosidade.md)** — norma obrigatória de contexto, clareza, recuperação e separação entre estados intermediários e confirmação persistida.
3. **[PR 1: segurança e continuidade](pr1-security-continuity-gates.md)** — retorno do Balcão, privacidade da sessão e replay SQL histórico.
4. **[PR 3: acções e exportação](pr3-actions-export-decisions.md)** — política de exportação por escola, desactivada por omissão.
5. **[PR 4: desempenho e observabilidade](../performance/command-center-20261022.md)** — consultas, contagens, erros, capturas de fixture e limitações dos benchmarks.

## Roteiro de PRs empilhadas

```text
main
└── #234  exploradores (draft, não integrado)
    └── #236  P0: sessão, acesso, continuidade (CI 6/7; replay bloqueado)
        └── #237  pesquisa SQL/cursores (7/7 no HEAD conferido)
            └── #238  acções/alertas/exportação (6/6 no HEAD conferido)
                └── #239  performance/observabilidade/visual (12/12 no HEAD conferido)
```

**Atenção:** esse diagrama representa a relação **pretendida**. As bases reais das PRs superiores ainda apontam a commits anteriores das branches inferiores e precisam ser reconciliadas antes do aceite. Os checks mencionados são os observados nos commits listados no [estado verificado](estado-backlog-20261022.md), antes de commits exclusivamente documentais.

## Restrições

- Dados de alunos, encarregados, documentos, notas e pagamentos reais: **proibidos** em fixtures, logs, capturas e exemplos.
- Nenhuma migration de produção deve ser executada para resolver o replay, e nenhuma migration já aplicada pode ser alterada.
- Não alterar ou contornar RLS, guards fiscais, estado académico ou a separação «aprovado pela Secretaria» / «liquidado».
- Exportação bloqueada por defeito e filtragem por polo recusada enquanto a relação canónica não estiver comprovada.
- Sem merge na `main`, sem deploy manual e sem activar políticas/funcionalidades gated sem autorização explícita.
