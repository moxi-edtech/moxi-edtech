# Backlog Executável — Virada de Ano Letivo K12

Base: `docs/PLAN_EVOLUTION_VIRADA_ANO_LETIVO_K12_SSOT.md`

## Sprint 1 — Segurança e Contrato

## Épico E1: Bloqueio de rollback em produção
- [x] T1.1 SQL: criar guard em `setup_active_ano_letivo` para negar ativação de ano menor que último ano com movimento. (Migration 20260510000004)
- [x] T1.2 SQL: permitir override apenas em ambiente dev/sandbox via flag explícita (`allow_rollback`).
- [ ] T1.3 API: propagar erro de negócio padronizado (`ANO_LETIVO_ROLLBACK_BLOCKED`).
- [ ] T1.4 Testes: casos `2025->2026` permitido, `2026->2025` bloqueado em produção.

Critério DoD:
- Rollback bloqueado em produção em 100% das chamadas oficiais.

## Épico E2: Corrigir contrato de `matriculas`
- [x] T2.1 Refactor API `onboarding/session/[sessionId]/reassign` para usar `session_id`.
- [x] T2.2 Refactor API `onboarding/session/[sessionId]` (delete/force) para `session_id`.
- [x] T2.3 Busca estática: remover referências ativas a `matriculas.ano_letivo_id` no backend.
- [ ] T2.4 Testes de integração de reassign/delete.

Critério DoD:
- Zero referência ativa a `matriculas.ano_letivo_id` em `apps/web/src/app/api/**`.

## Sprint 2 — Backfill e Integridade de Dados

## Épico E3: Backfill `session_id` em turmas/matrículas
- [x] T3.1 SQL: script de diagnóstico e backfill preparado. (Migration 20260510000005)
- [ ] T3.2 SQL: executar em produção (KLASSE).
- [ ] T3.3 SQL: validar contagens pós-backfill.
- [ ] T3.4 SQL: gerar relatório de exceções não mapeáveis em tabela de staging.
- [ ] T3.5 API admin: endpoint read-only de prévia de correção por escola.

Critério DoD:
- `session_id` nulo = 0 para turmas/matrículas nas escolas elegíveis.

## Épico E4: Regras de consistência contínua
- [ ] T4.1 SQL trigger: impedir insert/update de matrícula ativa sem `session_id`.
- [ ] T4.2 SQL trigger: impedir turma sem `session_id` quando `ano_letivo_id` definido.
- [ ] T4.3 Índices: compostos por `escola_id, session_id` para consultas críticas.

Critério DoD:
- Novos registros inconsistentes rejeitados no banco.

## Sprint 3 — Cutover Atômico

## Épico E5: Serviço de virada transacional
- [ ] T5.1 SQL/RPC: criar `cutover_ano_letivo(...)` com etapas auditáveis.
- [ ] T5.2 Etapa pré-check: calendário, períodos, pendências financeiras/acadêmicas, cobertura de sessão.
- [ ] T5.3 Etapa snapshot obrigatório: integração com `historico_set_snapshot_state`.
- [ ] T5.4 Etapa ativação + rematrícula por sessão.
- [ ] T5.5 Etapa pós-validação: reconciliação de contagens por domínio.

Critério DoD:
- Cutover finaliza consistente ou aborta com rollback e relatório.

## Épico E6: Lock operacional de janela
- [ ] T6.1 API middleware: bloquear escritas sensíveis durante cutover (`secretaria`, `financeiro`).
- [ ] T6.2 Mensageria UI: status de manutenção curto com motivo e ETA.
- [ ] T6.3 Auto-unlock no término/erro.

Critério DoD:
- Nenhuma escrita concorrente durante etapa crítica.

## Sprint 4 — Observabilidade e Gate

## Épico E7: Painel de saúde da virada
- [ ] T7.1 View/materialização de métricas por escola: ano ativo, sessão, nulos, distribuição por sessão.
- [ ] T7.2 API `GET /admin/cutover/health` com status `OK|WARN|BLOCKED`.
- [ ] T7.3 UI operacional com drill-down por escola.

Critério DoD:
- Time operacional consegue validar prontidão sem query manual.

## Épico E8: Gate de produção
- [ ] T8.1 Job de validação pré-release (checks críticos).
- [ ] T8.2 Bloqueio de deploy se escola com estado `BLOCKED`.
- [ ] T8.3 Emissão automática de evidência de conformidade por execução.

Critério DoD:
- Release bloqueado quando há risco de inconsistência de virada.

## Dependências
1. E1 e E2 antes de E3.
2. E3 antes de E5.
3. E5 antes de E6.
4. E6 antes de E8.

## Priorização de execução imediata
1. E2 (corrigir contrato de `matriculas` no código).
2. E1 (anti-rollback produção).
3. E3 (backfill KLASSE + escolas piloto).

## Status Atual (2026-05-10)
- Concluído:
  - Base técnica de E1 (Harden RPC) e E2 (Refactor API) implementada no repositório.
  - Validações de sessão corrigidas para comparar com `resolvedEscolaId`.
  - Script de backfill E3 preparado para execução em produção.
  - Base SSOT de monitoramento em `operacoes-academicas`.
  - Health SSOT ajustado para contagens sem limites artificiais e com erros técnicos bloqueantes.
- Em aberto:
  - T1.3/T1.4 e T2.4: propagação padronizada de erro e testes de integração.
  - Execução de backfill em produção e validação final de dados órfãos.
  - Fase 3: Cutover atômico e Lock operacional.

## Plano de execução KLASSE (piloto)
- P1: rodar diagnóstico E3.1.
- P2: executar backfill E3.2/E3.3.
- P3: validar contagens por sessão/tabela.
- P4: simular cutover dry-run (sem escrita final).
- P5: executar cutover assistido com auditoria.

## Checklist de aceite final por escola
1. Ano ativo único e coerente com operação viva.
2. Turmas/matrículas 100% com `session_id`.
3. Snapshot histórico concluído.
4. Financeiro e acadêmico reconciliados pós-cutover.
5. Relatório auditável arquivado.
