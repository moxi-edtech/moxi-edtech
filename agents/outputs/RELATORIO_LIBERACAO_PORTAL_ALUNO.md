# Relatório — Liberação de acesso (Portal do Aluno/Encarregado)

Data: 2026-03-02T15:28:02Z

## Objetivo
Validar se escolas com portal do aluno concedido conseguem liberar acesso dos alunos e se a liberação é efetivada no backend.

## Verificações realizadas

1. **Gate de portal concedido na API de liberação**
   - Endpoint: `POST /api/secretaria/alunos/liberar-acesso`
   - Validação adicionada: consulta `escolas.aluno_portal_enabled` e bloqueio com `409` quando desativado.

2. **Autorização por escola e usuário**
   - A rota exige usuário autenticado.
   - Resolve `escolaId` via `resolveEscolaIdForUser(...)`.
   - Valida permissão com `authorizeEscolaAction(...)`.

3. **Liberação real no backend**
   - A rota chama `rpc('request_liberar_acesso', ...)`.
   - A função SQL `request_liberar_acesso` chama `liberar_acesso_alunos_v2`.
   - `liberar_acesso_alunos_v2` atualiza `alunos.acesso_liberado = true`, define `codigo_ativacao`, `data_ativacao` e enfileira notificação (`outbox_notificacoes`).
   - `request_liberar_acesso` também enfileira evento de provisionamento (`outbox_event`).

## Resultado
- **Escola com portal concedido (`aluno_portal_enabled = true`)**: consegue executar a liberação, desde que tenha permissão de ação na escola.
- **Escola sem portal concedido (`aluno_portal_enabled = false`)**: recebe bloqueio explícito (`409`) antes da RPC.
- **Efetivação da liberação**: ocorre no banco (marca acesso liberado e gera código), com processamento assíncrono adicional via filas.

## Observação operacional
O status retornado pela API permanece como `queued`, indicando que parte do fluxo (notificação/provisionamento) é assíncrona, embora a marcação principal de liberação no aluno já seja persistida no banco.
