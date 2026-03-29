# Plano Técnico — Integração Financeiro -> Fiscal (KLASSE)

## Objetivo
Garantir que todos os processos financeiros elegíveis da escola emitam documento fiscal pelo motor fiscal único, com idempotência, rastreabilidade e operação segura para a equipa financeira.

## Estado de implementação (2026-03-29)
1. Concluído: adapter único `apps/web/src/lib/fiscal/financeiroFiscalAdapter.ts`.
2. Concluído: estratégia `tipoFluxoFinanceiro: "immediate_payment" | "deferred_payment"`.
3. Concluído (Fase 1): pagamento imediato emite `FR`.
4. Concluído: fallback fiscal de cliente final no adapter (`nif=999999999`, `nome=Consumidor final`).
5. Concluído: integração do adapter em:
6. `/api/financeiro/pagamentos/registrar`
7. `/api/financeiro/recibos/emitir`
8. `/api/financeiro/itens/venda`
9. Concluído: persistência de vínculo em `financeiro_fiscal_links`.
10. Concluído: `payload_snapshot` obrigatório para rastreabilidade forense.
11. Concluído: estado fiscal explícito em `pagamentos` e `mensalidades` (`pending|ok|failed`).
12. Concluído: lock de origem por `insert` + `UNIQUE(origem_tipo, origem_id)` com retorno `409 FISCAL_ORIGEM_LOCKED`.
13. Concluído: backfill controlado executado e reconciliado para escola/empresa piloto.
14. Concluído: reprocessamento assíncrono operacional para o financeiro da escola (UI + API + worker Inngest).
15. Concluído: tabela de jobs `fiscal_reprocess_jobs` aplicada em remoto.

## Arquitetura operacional atual
1. Evento financeiro -> endpoint financeiro integrado.
2. Endpoint financeiro cria lock em `financeiro_fiscal_links` (status `pending`).
3. Endpoint chama adapter fiscal único.
4. Adapter chama `/api/fiscal/documentos` e retorna `documento_id`, `numero_formatado`, `hash_control`, `key_version`.
5. Endpoint financeiro atualiza vínculo e estado fiscal (`ok` ou `pending/failed`).
6. Pendências são tratadas por job assíncrono disparado pelo cockpit fiscal (utilizador financeiro da escola).

## Regra crítica (ativa)
1. Nenhum documento fiscal pode ser gerado fora do adapter fiscal para fluxos financeiros integrados.
2. Emissão direta fora do fluxo adapter é inválida para operação e auditoria.

## Componentes implementados
1. Adapter fiscal:
2. `apps/web/src/lib/fiscal/financeiroFiscalAdapter.ts`
3. Endpoints financeiros integrados:
4. `apps/web/src/app/api/financeiro/pagamentos/registrar/route.ts`
5. `apps/web/src/app/api/financeiro/recibos/emitir/route.ts`
6. `apps/web/src/app/api/financeiro/itens/venda/route.ts`
7. Operação de reprocessamento para utilizador financeiro:
8. `apps/web/src/app/api/fiscal/financeiro/reprocess/route.ts`
9. `apps/web/src/components/fiscal/FiscalPendingReprocessCard.tsx`
10. Worker Inngest:
11. `apps/web/src/inngest/functions/fiscal-financeiro-reprocess.ts`

## Base de dados (estado final desta fase)
1. `financeiro_fiscal_links` com:
2. `UNIQUE(origem_tipo, origem_id)`
3. `UNIQUE(idempotency_key)`
4. `payload_snapshot jsonb NOT NULL`
5. `status in ('pending','ok','failed')`
6. `pagamentos.status_fiscal`, `pagamentos.fiscal_documento_id`, `pagamentos.fiscal_error`
7. `mensalidades.status_fiscal`, `mensalidades.fiscal_documento_id`, `mensalidades.fiscal_error`
8. `fiscal_reprocess_jobs` para operação assíncrona por escola:
9. `status in ('queued','processing','completed','failed')`
10. contadores de processamento (`total`, `processed`, `success`, `failed`)
11. auditoria operacional (`requested_by`, `started_at`, `completed_at`, `error_message`, `metadata`)

## Backfill e reconciliação (executado)
1. Script de dry-run:
2. `tools/fiscal/backfill-financeiro-fiscal-dry-run.ts`
3. Script de apply:
4. `tools/fiscal/backfill-financeiro-fiscal-apply.ts`
5. Script de reprocessamento:
6. `tools/fiscal/reprocess-financeiro-fiscal-pending.ts`
7. Resultado da execução piloto:
8. histórico elegível marcado e reconciliado
9. fila de pendências zerada para o recorte executado

## Escopo operacional coberto
1. Mensalidades/propinas pagas.
2. Recibos emitidos no financeiro.
3. Vendas avulsas (itens/serviços).

## Itens pendentes (próxima fase)
1. Formalizar fluxo `deferred_payment` com regra determinística:
2. obrigação `FT` + liquidação `RC` sem refactor estrutural.
3. Automatizar execução recorrente de reconciliação (job agendado) além do acionamento manual na UI.
4. Expandir evidência operacional contínua (SLO de pendências por escola).

## Rollout
1. Produção ativa para operação manual pelo financeiro da escola.
2. Reprocessamento disponível no cockpit fiscal via botão com confirmação.
3. Bloqueio de concorrência ativo por origem para evitar dupla emissão.

## Critérios de sucesso (GO operacional)
1. 100% dos novos eventos elegíveis geram vínculo em `financeiro_fiscal_links`.
2. 0 dupla emissão por origem (comprovado por constraint + lock).
3. `payload_snapshot` persistido em 100% das emissões integradas.
4. Todos os pagamentos/mensalidades integrados com estado fiscal explícito.
5. Reprocessamento assíncrono acessível à equipa financeira da escola sem uso de CLI.

## Riscos residuais e mitigação
1. Falha de KMS ou validação fiscal -> job fica `failed` com erro explícito + retry operacional.
2. Divergência financeiro x fiscal -> reconciliação por pendências e vínculo obrigatório.
3. Crescimento de backlog por escola -> monitorar `fiscal_reprocess_jobs` e definir SLA de resolução.
