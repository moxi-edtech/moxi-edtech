# GO_LIVE_CHECKLIST.md — Pilot Readiness (3–5 escolas)

## 🔴 P0 — Segurança, Tenant e Consistência (BLOCKER)

- [ ] `escola_id` NOT NULL nas tabelas core.
- [ ] Índices iniciando por `escola_id` nas tabelas core.
- [ ] Triggers/constraints bloqueiam cross-tenant write.
- [ ] RLS validado por role (secretaria, professor, aluno, admin).
- [ ] Service role fora do fluxo humano (apenas jobs/workers/provisioning).

## 🔴 P1 — Fluxos Críticos End-to-End

- [ ] Candidatura confirmada cria matrícula (idempotente).
- [ ] 1 matrícula ativa por aluno/ano/escola.
- [ ] Rematrícula em massa idempotente.
- [ ] Pagamento manual confirma mensalidade e outbox/audit.
- [ ] Idempotência de pagamentos por `transacao_id_externo`.

## 🔴 P2 — Operação Diária (Secretaria/Professor)

- [ ] SSOT definido para presença/frequência.
- [ ] Chave única por partição em frequência/presença.
- [ ] Professor lança nota e aluno consulta com RLS.
- [ ] Consolidação mínima de boletim (view/RPC) ou WARN explícito.

## 🟡 P3 — Suporte ao Crescimento

- [ ] Endpoint de transferência de turma com auditoria.
- [ ] Importação CSV idempotente.
- [ ] Aprovação de importação idempotente.

## 🟢 Eventos Mínimos (Outbox)

- [ ] `AUTH_PROVISION_USER` com `escola_id` e `user_id`.
- [ ] `FINANCE_PAYMENT_CONFIRMED` com `escola_id` e `pagamento_id`.
- [ ] Payload inclui `timestamp` e `dedupe_key`.
