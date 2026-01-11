# GO_LIVE_CHECKLIST.md — Piloto (3–5 escolas)

## 1) Observabilidade (Dia 0)
1. Diagnostics UI mostra outbox/cron sem erro.
2. `cron.job_run_details` com execuções recentes.
3. Alerts básicos (cron falhou, outbox backlog > 30m).
4. Auditoria GF4 habilitada com before/after.

## 2) Fluxo Financeiro
5. `finance_payment_intents` como SSOT (manual + webhook).
6. Confirmação idempotente (repetir 5x → 1 efeito).
7. `pagamentos` com unique `(escola_id, transacao_id_externo)`.
8. Outbox `FINANCE_PAYMENT_CONFIRMED` emitido e processado.

## 3) Tenant & RLS
9. `escola_id` NOT NULL em core tables.
10. Índices `(escola_id, ...)` nas consultas críticas.
11. RLS ativo + policies completas (`select/insert/update/delete`).
12. Triggers de consistência tenant nos fluxos principais.

## 4) Matrícula & Notas
13. Matrícula única ativa por aluno/ano.
14. Notas/avaliações auditadas (before/after + actor).
15. Frequências com unique key por partição.

## 5) Operação & Suporte
16. Logging com `escola_id` e `user_id` (sem PII sensível).
17. Backups/snapshots confirmados.
18. Plano de rollback (ou quarentena de importações).
19. Processo de suporte com SLA interno (24–48h).
20. Checklist de “primeiro dia” com 1 escola piloto.

## Ordem de execução (1 dia)

1) Confirmar cron/outbox/diagnostics
2) Validar fluxo de pagamento (manual + replay)
3) Validar RLS/tenant e constraints
4) Rodar GF4 nos fluxos caros
5) Abrir piloto com 1 escola
