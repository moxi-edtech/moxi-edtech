# Aplicação — correcção do agente WhatsApp

run_id: FIX-LATEST-OUTBOUND-20260828
timestamp: 2026-08-28T09:52:00-03:00

## Problema confirmado

O agente publicado na VPS chamava `latestOutbound(messages)` sem a função existir, gerando `[CHAT_ERROR] latestOutbound is not defined` e impedindo qualquer resposta.

## Correcção

Adicionar a função que selecciona a mensagem mais recente enviada pelo agente, ordenando por timestamp.

## Reversão

Reverter o commit desta correcção com `git revert` e reconstruir o container `klasse-sales-agent`.
