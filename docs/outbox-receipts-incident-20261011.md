# P1 · Recuperação do outbox de recibos (11/10/2026)

## Diagnóstico verificado em produção (SELECT apenas)

- `outbox_events.next_attempt_at` está definido como `timestamptz NOT NULL DEFAULT now()`.
- `trigger_pagamento_recibo_outbox` não fornece `next_attempt_at` e, portanto, usa o default correto no INSERT.
- A implementação anterior de `markEvent`, em `/api/jobs/outbox`, tentava gravar **NULL** nessa coluna após sucesso e após transição para **dead**, causando PostgreSQL `23502`.
- O consumidor podia ter executado o efeito (emitido recibo) antes de falhar na atualização do estado. Assim, repetir cegamente um evento pode duplicar documentos.
- Na leitura agregada, **nenhum evento está efetivamente em `dead`**; 25 eventos de recibo constavam como `failed` com `attempts=max_attempts=5`, e 13 outros em `failed` com `attempts=1`. Havia 309 pendentes. Estes números são um instantâneo, não uma lista de identificadores.
- `claim_outbox_events` ignora os `failed` saturados (`attempts >= max_attempts`). Não modificar estados de produção nesta sessão.

## Proteção de idempotência

1. Para recibos de mensalidade, a RPC `emitir_recibo_system` procura documento existente; a base contém índice único `uq_documentos_recibo_por_mensalidade` (mensalidade_id, tipo recibo).
2. Para recibos de pagamento sem mensalidade, o consumidor agora usa chave determinística `pagamento_recibo:<pagamento_id>` em `documentos_emitidos.idempotency_key`; existe índice único `ux_documentos_emitidos_escola_idempotency` para (escola_id, idempotency_key) não nula. Também consulta documentos legados pelo snapshot. Em conflitos 23505, somente considera idempotente depois de encontrar o documento correspondente.
3. A RPC que devolve `ok=false` não é tratada como emissão bem-sucedida.
4. Nenhum consumidor externo/fornecedor de mensagens é executado pelo script gated; apenas um evento passa a pending, sujeito à proteção de idempotência ao processar.

## Entrega e passos gated

- O código do worker pode ser publicado sem migration: corrige a atualização de `next_attempt_at` para sent/dead/failed.
- A migration `20261011133652_outbox_receipt_retry_gate.sql` é **preparada, não aplicada**. Reafirma o default e corrige a RPC genérica que ainda referia a coluna inexistente `next_run_at`, bloqueando replay de recibos por essa RPC. **Requer aprovação expressa e execução controlada** no projeto `wjtifcpxxxotsbmvbgoq`.
- O script `supabase/ops/scripts/replay_receipt_outbox_GATED.sql` é **preparado, não executado em produção**. Ele rejeita replay sem `approval=OWNER_APPROVED_RECEIPT_REPLAY`, exige `event_id` individual, verifica documento existente e só então reencaminha o evento.
- Antes de autorizar reprocesso, selecionar em produção **apenas IDs e estados em ambiente restrito**, inspecionar documentos associados, validar os candidatos com operador autorizado e aprovar individualmente. Não copiar dados pessoais para tickets, comentários ou logs.
- Reconciliar à parte os `failed` saturados; **não executar correção em massa**. A política de dead-letter requer confirmação do operador para cada recibo. Assegurar que nenhum recibo já emitido é recriado.

## Validação

- `node --test --import tsx apps/web/tests/unit/outbox-receipts.spec.ts` verifica sucesso, backoff, dead e chave determinística.
- CI `Outbox Receipt Integrity` usa PostgreSQL 17 descartável e aplica somente o SQL preparado nesse ambiente, incluindo teste de replay seguro de evento sintético sem documento e bloqueio quando existe documento.
- Nenhuma RLS, role, grant, guarda BILL-001..003/009 ou política de faturação foi alterada.
