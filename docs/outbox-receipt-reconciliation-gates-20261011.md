# Outbox de recibos: evidência, migração e reprocessamento gated

## A emissão não é prova de entrega

O consumidor `financeiro_recibo_pagamento` em `apps/web/src/app/api/jobs/outbox/route.ts`
emite/persiste documentos, mas **não confirma entrega física, e-mail, WhatsApp
ou download pelo destinatário**. `status='sent'` neste job significa execução
bem-sucedida do *handler*, não entrega do recibo ao destinatário.

Para cada evento falhado, classificar com evidência **correlacionada ao
pagamento exato**, sem basear a decisão apenas na existência de um documento:

- `JA_ENTREGUE`: recibo único correspondente e evidência positiva de entrega
  vinculada ao mesmo pagamento (identificador do provedor + estado entregue,
  ou prova operacional equivalente validada).
- `NUNCA_ENTREGUE`: ausência comprovada em **todos** os canais possíveis,
  existência e elegibilidade do pagamento verificadas, confirmação de que
  o pagamento não gerou recibo em outro sistema e recibo ausente.
- `INCERTO`: quaisquer provas ausentes ou contraditórias. Não alterar estado
  nem executar replay.

A reconciliação de eventos entregues só poderá ocorrer após auditoria dos
identificadores e preservação de `status,attempts,processed_at,next_attempt_at`,
com histórico do motivo. Reprocessar apenas eventos `NUNCA_ENTREGUE` em
lotes de até cinco, com dry-run, verificação de entrega unitária e interrupção
ao primeiro conflito. **Jamais executar diretamente o worker global para testar
um único recibo**: a rota tenta consumir também outros tópicos pendentes.

## Gate da migração existente

A migration `20261011133652_outbox_receipt_retry_gate.sql` é pré-existente
na main e não foi alterada. Ela:

1. Reafirma `outbox_events.next_attempt_at DEFAULT now()`; não altera a
   constraint `NOT NULL` nem nenhuma linha existente.
2. **Substitui** `retry_outbox_event(uuid)` (função SECURITY DEFINER):
   remove acesso ao replay direto dos recibos, usa `next_attempt_at`
   no lugar de `next_run_at`, acrescenta validação de status e limpeza de lock.
3. Não muda o worker HTTP, cujo erro `next_attempt_at=NULL` já foi
   corrigido anteriormente.

A função é **substituída**, portanto a migration não é puramente aditiva.
O script `supabase/ops/scripts/rollback_outbox_receipt_retry_gate.sql`
restaura a função antiga; isso **reintroduz** o bug de `next_run_at`. Essa
reversão só é aceitável como procedimento emergencial temporário, não como
estado final desejável.

A regressão SQL em PostgreSQL descartável verifica que a migration não
mexe nas linhas pré-existentes, que a autorização de replay de recibos
é recusada, que o retry genérico funciona, que a reversão restaura
a definição anterior e que a reaplicação recompõe a nova. Nenhum teste
altera o banco de produção.

**Não aplicar** até cumprir cumulativamente: histórico de migrations
conciliado com o repositório, revisão do comportamento substituído,
backup dos eventos antes de qualquer DDL, revisão de privilégio e
plano seguro de avanço/reversão aprovado.

## Execução e idempotência

Um índice UNIQUE de `(escola_id,idempotency_key)` protege a persistência
do documento. No caso de conflito `23505`, o consumidor só o aceita como
replay idempotente após confirmar um recibo com a mesma chave e tipo.
A nova regressão simula o mesmo pagamento duas vezes, inclusive concorrência,
e comprova um único documento. **Não comprova entrega externa**, que precisa
ser medida separadamente.

Não chamar `/api/jobs/outbox` sem análise: ele executa múltiplos tópicos
e não aceita um identificador único de recibo para dry-run.

## Bloqueios operacionais

- A aplicação das migrations exige correspondência completa das versões
  locais/remotas, com reconciliação aprovada dos desvios.
- A entrega dos recibos exige evidência de canal independente da tabela
  `documentos_emitidos`.
- A execução programada da Vercel precisa ser observada **após** um deploy,
  com verificação do log de invocação e dos estados do outbox.
