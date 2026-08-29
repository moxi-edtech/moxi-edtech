# Aplicação — QR WAHA estável durante pareamento

run_id: WAHA-QR-STABLE-20260829
timestamp: 2026-08-29T01:20:00-03:00

## Problema confirmado

O portal chamava a rota de QR a cada 5 segundos mesmo com um QR já exibido, permitindo que o código apresentado fosse substituído durante a leitura.

## Correcção

Suspender o polling da imagem assim que um QR válido for carregado; a renovação passa a ser manual pelo botão `Atualizar QR`.

## Reversão

Reverter o commit desta correcção com `git revert`.
