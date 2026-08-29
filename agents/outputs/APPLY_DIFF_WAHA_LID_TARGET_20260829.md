# Aplicação — destino LID para respostas WhatsApp

run_id: WAHA-LID-TARGET-20260829
timestamp: 2026-08-28T23:30:00-03:00

## Problema confirmado

O chat listado como `@c.us` tinha mensagens recebidas com `from` em `@lid`; o envio para o `chat.id` `@c.us` retornava WAHA 403.

## Correcção

Usar o `from` da última mensagem recebida como destino de resposta quando esse identificador termina em `@lid`. O `chat.id` original continua sendo usado para contexto, estado e etiquetas.

## Reversão

Reverter o commit desta correcção com `git revert` e reconstruir o container `klasse-sales-agent`.
