# KLASSE — Apply Diff
run_id: 324967B8-8BB2-4B7C-B8B3-3B094AE417FC
timestamp: 2026-07-26T11:26:16Z
ficheiro: apps/web/src/lib/assistant/data-copilot/query-matcher.ts

## P0_CHECKLIST

Todos os itens estão concluídos.

## Alteração proposta

Adicionar matcher determinístico comum com normalização, raízes, tolerância
limitada a gralhas e composição scope + diagnóstico.

## Reversibilidade

Novo ficheiro isolado e reversível num único `git revert`.

## Meta p95

Matching em memória abaixo de 1 ms p95 para queries de chat.
