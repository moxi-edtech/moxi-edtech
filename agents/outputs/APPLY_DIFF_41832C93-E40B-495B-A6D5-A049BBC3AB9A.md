# Apply Diff — Agent 3
run_id: 41832C93-E40B-495B-A6D5-A049BBC3AB9A
timestamp: 2026-07-18T20:08:11Z

## P0 Checklist

Todos os itens de `P0_CHECKLIST.md` estão em PASS.

## Acção proposta

Tratar o retorno anulável de `useSearchParams()` antes de ler os parâmetros de rastreabilidade do Insight IA.

## Diff proposto

```diff
- const aiInsightId = searchParams.get("aiInsightId");
- const requestedSelectionReason = searchParams.get("selectionReason") || "";
+ const aiInsightId = searchParams?.get("aiInsightId") ?? null;
+ const requestedSelectionReason = searchParams?.get("selectionReason") ?? "";
```

## Risco e reversão

Correção defensiva de tipos; preserva o comportamento quando existem parâmetros e usa valores vazios quando não há contexto de URL. Reversível com um único `git revert`.

