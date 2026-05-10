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
- [x] T5.1 SQL/RPC: criar `cutover_ano_letivo_v3(...)` com etapas auditáveis. (Migration 20260510000014)
- [x] T5.2 Etapa pré-check: calendário, períodos, pendências financeiras/acadêmicas, cobertura de sessão.
- [x] T5.3 Etapa snapshot obrigatório: bloqueia cutover sem `historico_snapshot_locks` fechado.
- [x] T5.4 Etapa ativação + rematrícula por sessão.
- [ ] T5.5 Etapa pós-validação: reconciliação de contagens por domínio.
- [ ] T5.6 Testes de integração para sucesso, rollback e blockers reais.

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
- [x] T7.1 Helper SSOT de métricas por escola: ano ativo, sessão, nulos, distribuição por sessão.
- [x] T7.2 API `GET /api/secretaria/operacoes-academicas/virada/health` com status `OK|WARN|BLOCKED`.
- [x] T7.3 UI operacional em `admin/operacoes-academicas` com cartões de métricas e ações corretivas.
- [ ] T7.4 Persistir evidência de cada resolução executada pelo painel.

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
  - Ações corretivas adicionadas ao painel: sessões, mensalidades órfãs, competência financeira, currículo, pautas e snapshots.
  - RPC `remediate_cutover_gaps` aplicada para remediar gaps financeiros/temporais com dry-run.
  - RPC `cutover_ano_letivo_v3` aplicada para virada transacional com pré-checks acadêmicos e preservação histórica.
  - Worker de pautas anuais corrigido para usar período letivo real e evitar duplicados por `periodo_letivo_id` inválido/nulo.
- Em aberto:
  - T1.3/T1.4 e T2.4: propagação padronizada de erro e testes de integração.
  - T5.5/T5.6: reconciliação pós-cutover e testes de integração.
  - E6: lock operacional contra escritas concorrentes durante a janela crítica.
  - KLASSE ainda bloqueada por 30 pautas anuais sem período correto, 19 status finais de matrículas e 19 snapshots históricos pendentes.

## Plano de execução KLASSE (piloto)
- P1: rodar diagnóstico no painel `admin/operacoes-academicas`.
- P2: executar ações corretivas disponíveis no painel até `BLOCKED = 0`.
- P3: validar pautas anuais oficiais, status final de matrículas e snapshots históricos.
- P4: simular cutover dry-run (sem escrita final).
- P5: executar `cutover_ano_letivo_v3` assistido com auditoria.

## Checklist de aceite final por escola
1. Ano ativo único e coerente com operação viva.
2. Turmas/matrículas 100% com `session_id`.
3. Snapshot histórico concluído.
4. Financeiro e acadêmico reconciliados pós-cutover.
5. Relatório auditável arquivado.
