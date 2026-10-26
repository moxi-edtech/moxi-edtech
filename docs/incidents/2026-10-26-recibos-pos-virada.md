# Incidente financeiro: recibos e matrícula de origem — 2026-10-26

## Âmbito e fontes

Auditoria read-only em produção Vercel/Supabase, com código do deployment `2f51880ce93e5ec78562f66d8a7ff33755caf194`. Runtime logs da Vercel Hobby só disponíveis no horizonte curto de retenção. Evidência decisiva extraída dos logs PostgreSQL e funções/constraints realmente instaladas, mais os fluxos no GitHub.

## Causa raiz 1 — recibos automáticos bloqueados por CHECK

- Erros SQLSTATE `23514` repetidos em 2026-10-26 07:03:24–07:03:52 UTC na tabela `public.documentos_emitidos`, com origem `pagamento_auto`.
- A tentativa de INSERT tinha `idempotency_key = pagamento_recibo:<pagamento_uuid>`, mas `idempotency_fingerprint = NULL`. A constraint `documentos_emitidos_idempotency_pair_chk` exige ambos nulos ou ambos preenchidos (key 8–200 chars; fingerprint 16–128 chars).
- Contrato violado em `apps/web/src/app/api/jobs/outbox/route.ts`, ramo `emitirReciboPagamento` que cria recibo automático sem mensalidade.
- Solução: enviar a dupla completa de forma atómica; fingerprint SHA-256 determinístico, escopado à escola + pagamento, mantendo índice único por `(escola_id,idempotency_key)`. Não remover/relaxar a constraint.
- Erros antigos terminavam `last_error=[object Object]` por rethrow de objeto PostgREST: a correção conserva message + SQLSTATE para diagnóstico.

## Causa raiz 2 — mensalidade pós-virada (um item)

- `/api/secretaria/pagamentos/processar`, ramo de um único item, delegava para `/api/secretaria/balcao/pagamentos` sem `meta.matricula_origem_id`.
- A rota de destino rejeita `origem=pos_virada` quando `meta.matricula_origem_id` não coincide com `mensalidades.matricula_id`: `409 POS_VIRADA_CONTEXT_MISMATCH`.
- Solução: preservar primeiro `item.origem_matricula_id`; só utilizar `matricula_id` global se faltar a origem. Não inventar ID quando ambos faltam. A validação no servidor mantém-se intacta.
- A RPC batch existente já tenta o `origem_matricula_id` específico por item antes do global; o defeito confirmado pelo código é na delegação singleton.

## Saúde operacional e dados históricos

- `outbox_events` do tópico `financeiro_recibo_pagamento`: 408 pending, 246 failed, 24 dead; último `sent` desse tópico observado em 2026-10-06. O worker da Vercel está configurado como cron diário em `apps/web/vercel.json`; ausência de novos `sent` exige verificar execução/claim sem presumir a causa do agendamento.
- Existem 316 mensalidades cujo `turma_id` diverge da turma atual na matrícula associada; nenhuma apresenta diferença de escola, aluno ou ano letivo. A divergência pode refletir transferências e históricos, não é autorização para alterar tabelas em massa.
- A função `enforce_mensalidade_matricula_scope` dispara em INSERT ou UPDATE de campos de identificação académica, **não** em mero UPDATE de `status`. Não atribuir a esses 316 registos a falha específica do checkout pós-virada sem reproduzir.
- O front/back de pagamento em lote emite um único recibo consolidado para o item final; mensalidades anteriores do lote podem não ter documento ligado individualmente. Portanto, `mensalidade.status='pago' AND NOT EXISTS(d.documento)` **não** comprova recibo em falta.
- Em produção também ocorreram emissões de recibo bem-sucedidas no mesmo dia via RPC `emitir_recibo`; a falha não atinge todos os caminhos.

## Salvaguardas e validação

- Testes unitários para fingerprint estável por escola/pagamento, comprimento exigido pela constraint, SQLSTATE legível, origem histórica prioritária, fallback e ausência de origem de serviço.
- Não efetuar reprocessamento global nem gerar recibos automaticamente durante a auditoria. O outbox pode conter operações já cobertas por recibos consolidados/síncronos: reconciliar com o snapshot antes de qualquer replay.
- Não atualizar vínculos académicos ou liquidações do banco para ocultar o erro; preservar RLS, authz, índices, auditoria e idempotência.
- Para fechamento operacional: CI verde, deployment da correção, teste autenticado com pagamento sintético/sandbox, verificação de ausência de `23514` em novo worker, e replay **seletivo** segundo `supabase/ops/scripts/replay_receipt_outbox_GATED.sql` após aprovação explícita.
