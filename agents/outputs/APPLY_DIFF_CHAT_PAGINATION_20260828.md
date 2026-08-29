# Aplicação — paginação do agente WhatsApp

run_id: CHAT-PAGINATION-20260828
timestamp: 2026-08-28T10:00:00-03:00

## Problema confirmado

O agente consultava apenas `limit=100&offset=0`, deixando 78 dos 178 chats fora do processamento.

## Correcção

Consultar páginas consecutivas, deduplicar por `chat.id`, parar quando a página vier incompleta e impor máximo configurável de 20 páginas.

## Reversão

Reverter o commit desta correcção com `git revert` e reconstruir o container `klasse-sales-agent`.
