# Aplicação — compatibilidade de evento WAHA

run_id: WAHA-MESSAGE-EVENT-20260829
timestamp: 2026-08-29T00:10:00-03:00

## Problema confirmado

A sessão WAHA foi configurada para emitir `message`, mas a rota inbound tratava apenas `message.received`, impedindo a alimentação da fila.

## Correcção

Aceitar `message` e `message.received` para mensagens inbound, preservando o tratamento de mensagens outbound.

## Reversão

Reverter o commit desta correcção com `git revert`.
