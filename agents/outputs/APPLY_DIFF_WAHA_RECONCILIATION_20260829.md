# Aplicação — reconciliação do agente WhatsApp

run_id: WAHA-RECONCILIATION-20260829
timestamp: 2026-08-29T00:25:00-03:00

## Problema

Mensagens recebidas antes da activação do webhook não existem na fila persistente.

## Correcção

Manter consumo da fila a cada ciclo e executar reconciliação limitada da lista WAHA apenas a cada 5 minutos, processando no máximo o limite de novos chats por ciclo.

## Reversão

Reverter o commit desta correcção com `git revert` e reconstruir o container `klasse-sales-agent`.
