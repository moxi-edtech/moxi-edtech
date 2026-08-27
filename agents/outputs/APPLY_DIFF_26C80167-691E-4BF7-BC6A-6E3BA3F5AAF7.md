# KLASSE — Apply Diff
run_id: 26C80167-691E-4BF7-BC6A-6E3BA3F5AAF7
timestamp: 2026-07-26T11:18:25Z
ficheiro: apps/web/src/lib/assistant/klasse-brain.ts

## P0_CHECKLIST

Todos os itens estão marcados como concluídos (`[x]`).

## Alteração proposta

```diff
+ adicionar `fallbackReason` tipado ao contrato `AssistantResponse`
+ marcar falta de permissão como `permission_denied`
+ marcar ausência de conhecimento como `knowledge_not_found`
+ marcar indisponibilidade do provider como `provider_unavailable`
- remover `suggestions` e `actions` dos fallbacks
- impedir que uma pergunta directa falhada reinjecte os mesmos botões de ajuda
```

## Reversibilidade

Alteração isolada num único ficheiro, reversível num único `git revert`.

## Meta p95

Sem impacto mensurável; remove trabalho de criação e renderização de sugestões no fallback.
