# Plano — Secretaria × Financeiro (Balcão 30s)

## Resumo Executivo
- SSOT de pagamentos consolidado em `public.pagamentos` (cash=settled; tpa/transfer/mcx=pending).
- Fecho cego com snapshot no momento da declaração e conciliação separada.
- Audit Trail unificado via `audit_logs` com contexto de aluno/matrícula.
- APIs finas para secretaria (registrar), financeiro (settle) e fecho (declarar).

## Status Atual (Implementado)
- `BalcaoAtendimento` e `PagamentoModal` usam `/api/secretaria/balcao/pagamentos`.
- Conciliação usa `/api/financeiro/conciliacao/settle` e cria pagamento + liquidação.
- Audit trail no balcão filtrado por aluno (sem joins pesados).

## Patch Cirúrgico Aplicado
- Endpoints criados: `/api/financeiro/dashboard/resumo`, `/api/financeiro/inadimplencia/top`, `/api/financeiro/pagamentos/recentes`, `/api/financeiro/fecho/aprovar`.
- Conciliação UI atualizada para `POST /api/financeiro/conciliacao/settle`.
- Novo pagamento (financeiro/secretaria) agora usa `financeiro_registrar_pagamento_secretaria`.
- Fecho UI com declaração cega + aprovação via RPC.
- Migração adicionada: `20260308000002_financeiro_fecho_aprovar.sql`.
- Componentes alterados: `financeiro/page.tsx`, `financeiro/fecho/page.tsx`, `RegistrarPagamentoButton.tsx`, `ModalPagamentoRapido.tsx`.
- `GET /api/financeiro/fecho` agora lê `public.pagamentos` (SSOT) para o extrato do dia.
- Fecho cego da Secretaria criado em `/secretaria/fecho` com declaração via `/api/financeiro/fecho/declarar`.
- Pagamentos `kwik` suportados no SSOT e UI (método adicional).

## Objetivo
Implementar o fluxo Balcão 30s com SSOT em `public.pagamentos`, separação entre serviço e pagamento, e fecho cego com regras Angola (cash/TPA/transfer/mcx).

## Escopo Técnico
- **DB (Supabase):** criar tabelas, RLS e RPCs atômicas.
- **Frontend (Secretaria):** modais de serviço, pagamento e bloqueio com RPCs.
- **Fecho:** manter cego e sem cache; operador controla visão (self/all).

## Modelo de Dados (DDL)
1. `public.pagamentos` (SSOT)
   - Status/Metodos: `pending|settled|rejected|voided` e `cash|tpa|transfer|mcx`.
   - Campos obrigatórios por método (`reference` para TPA; `evidence_url` para Transfer).
   - `day_key` para fecho diário e `meta` para auditoria.
2. `public.fecho_caixa`
   - Declaração cega + snapshot do sistema no momento da declaração.
3. `public.conciliacao_uploads`
   - Âncora do extrato/banco para conciliação e auditoria.

## RLS + Policies
- `pagamentos`: secretaria vê apenas seus pagamentos; financeiro/admin vê todos da escola.
- `fecho_caixa`: secretaria vê/declara seus fechos; financeiro/admin vê/ aprova.
- `conciliacao_uploads`: financeiro/admin gerenciam uploads.

## RPCs Atômicas (SSOT pagamentos)
1. `financeiro_registrar_pagamento_secretaria`
   - Cria pagamento; cash=settled, outros=pending.
   - Valida campos obrigatórios por método.
2. `financeiro_settle_pagamento`
   - Conciliação: pending → settled + metadata.
3. `financeiro_fecho_declarar_e_snapshot`
   - Fecho cego: declara e captura snapshot do sistema.

## Integração Frontend
- **BalcaoServicoModal**: mantém decisão do serviço.
- **PagamentoModal**: registra pagamento em `public.pagamentos` via API (`/api/secretaria/balcao/pagamentos`).
- **BalcaoAtendimento**: usa `public.pagamentos` para mensalidades (SSOT) + audit trail via `audit_logs`.

## Regras Angola (Hard)
- TPA/Transfer/MCX = `pending` até conciliação.
- Transfer exige comprovativo (evidence).
- TPA exige referência.
- Cash liquida na hora.

## Fecho Cego
- Operador declara antes de ver totais.
- Sem cache/ISR.
- Snapshot do sistema no momento da declaração.

## Nota (KPIs Financeiro)
- O "Realizado" estava maior que o "Previsto" porque a MV somava `public.pagamentos` (inclui serviços avulsos) enquanto o previsto vinha de `mensalidades`.
- Ajuste aplicado para calcular "Realizado" a partir de `mensalidades.valor_pago_total`, alinhando propinas com previsto.

## Migrations Criadas / Ajustadas
- `20260308000000_balcao_audit_enrichment.sql` (audit com aluno/matrícula)
- `20260308000001_financeiro_harmony_contract.sql` (pagamentos/fecho/conciliacao + RPCs + RLS)
- `20260202008000_fix_financeiro_kpis_mv_refresh.sql` (refresh MV KPI apontando schema correto + cron)
- `20260202009100_rebuild_financeiro_kpis_mes.sql` (rebuild MV KPI com status `settled`)
- `20260202009200_financeiro_kpis_mes_use_mensalidades.sql` (realizado baseado em mensalidades)
- `20260202010000_fix_aggregates_financeiro_null_aluno.sql` (permite aluno_id NULL e upsert escola/mês)
- `20260202010100_fix_aggregates_financeiro_totals_logic.sql` (totais do resumo via débitos pagos)
- `20260202010200_fix_current_tenant_escola_id.sql` (fallback em `escola_users`)
- `20260202010300_fix_pagamentos_status_refresh.sql` (refresh MV pagamentos status + cron)
- `20260202011000_backfill_pagamentos_aluno_id.sql` (backfill aluno_id em pagamentos)
- `20260202011100_fix_financeiro_pagamentos_aluno_id.sql` (garante aluno_id em novos pagamentos)
- `20260202011200_pagamentos_fill_defaults.sql` (trigger para preencher aluno_id/created_by)
- `20260202012000_create_financeiro_templates_cobranca.sql` (tabela de templates de cobrança + RLS)

## Próximos Passos
- Limpar dados legados para validar constraints (TPA sem referência, transfer sem comprovativo).
- Ajustar conciliação para chamar `financeiro_settle_pagamento`.
- Popular `servicos_escola` por escola.

## Backlog Técnico
- Criar backfill de `reference`/`evidence_url` em pagamentos antigos para permitir validar constraints.
- Ajustar upload de conciliação para preencher `conciliacao_uploads.range_start/range_end`.
- Adicionar UI de conciliação com status `pending→settled/rejected/voided`.
- Normalizar legacy `metodo_pagamento` para `metodo` (enum-like) em relatórios antigos.
- Conectar listagem do fecho ao snapshot `public.fecho_caixa` (sem cálculo ao vivo).

## Gaps Restantes (Portal)
- Admin dashboards ainda usam `vw_pagamentos_status`/views legadas.
- Extrato do aluno ainda não mostra `pending/settled` diretamente de `public.pagamentos`.
- Fecho diário ainda usa `GET /api/financeiro/fecho` legado para lista/itens.
- Padronizar exibição de KWIK nos relatórios financeiros.
