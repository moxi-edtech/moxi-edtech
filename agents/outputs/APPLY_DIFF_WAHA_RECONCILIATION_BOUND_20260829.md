# Aplicação — limite da reconciliação WhatsApp

run_id: WAHA-RECONCILIATION-BOUND-20260829
timestamp: 2026-08-29T00:35:00-03:00

## Problema

Uma reconciliação completa de 179 chats bloqueava temporariamente o consumo da fila.

## Correcção

Limitar a reconciliação a 50 chats mais recentes, mantendo a fila como caminho principal e evitando que a recuperação bloqueie os eventos novos.

## Reversão

Reverter o commit desta correcção com `git revert` e reconstruir o container `klasse-sales-agent`.
