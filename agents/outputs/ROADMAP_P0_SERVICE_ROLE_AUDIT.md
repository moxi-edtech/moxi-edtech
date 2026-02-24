# Roadmap — P0 Item 2 (Service-role Ban + Audit Trail)

**Referências**
- `agents/specs/performance.md` (writes instantâneos + idempotência)
- `agents/specs/FEATURES_PRIORITY.json` (P0 Secretaria/Admin)
- `agents/outputs/ROADMAP_REAL_DATA_IMPLEMENTATION.md`

---

## Objetivo
Eliminar `service_role` em endpoints humanos (UI) e garantir audit trail imutável em ações críticas, mantendo performance e consistência operacional.

---

## Escopo
**Portais:** Secretaria, Admin, Financeiro

**Ações críticas mínimas**
- Pagamento/estorno/fecho/conciliação
- Matrícula/movimentação de aluno
- Emissão de documentos oficiais
- Criação/edição de currículo, períodos e turmas

---

## Diagnóstico (Estado Atual)

### Evidências de uso de `service_role` em endpoints humanos
- ✅ `apps/web/src/app/api/escolas/[id]/admin/alunos/[alunoId]/route.ts` (refatorado)
- ✅ `apps/web/src/app/api/escolas/[id]/admin/alunos/[alunoId]/archive/route.ts` (refatorado)
- ✅ `apps/web/src/app/api/escolas/[id]/admin/alunos/[alunoId]/restore/route.ts` (refatorado)
- ✅ `apps/web/src/app/api/matriculas/massa/route.ts` (refatorado)
- ✅ `apps/web/src/app/api/matriculas/massa/por-turma/route.ts` (refatorado)
- ✅ `apps/web/src/app/api/escolas/[id]/semestres/route.ts` (refatorado)
- ✅ `apps/web/src/app/api/escolas/[id]/onboarding/preferences/route.ts` (refatorado)
- ✅ `apps/web/src/app/api/escolas/[id]/onboarding/curriculum/apply/route.ts` (refatorado)
- ✅ `apps/web/src/app/api/escolas/[id]/onboarding/curriculum/apply-matrix/route.ts` (refatorado)
- ✅ `apps/web/src/app/api/escolas/[id]/onboarding/core/finalize/route.ts` (refatorado)
- ✅ `apps/web/src/app/api/escolas/[id]/configuracoes/status/route.ts` (refatorado)
- ✅ `apps/web/src/app/api/super-admin/*` (refatorado)
- ✅ `apps/web/src/app/api/escolas/[id]/onboarding/session/*` (refatorado)
- ✅ `apps/web/src/app/api/escolas/[id]/onboarding/draft/route.ts` (refatorado)
- ✅ `apps/web/src/app/api/escolas/[id]/semestres/[semestreId]/route.ts` (refatorado)
- ✅ `apps/web/src/app/api/escolas/[id]/admin/maintenance/*` (refatorado)
- ✅ `apps/web/src/app/api/escolas/[id]/academico/*` (refatorado)
- ✅ `apps/web/src/app/api/financeiro/orcamento/matricula` (refatorado)
- ✅ `apps/web/src/app/api/financeiro/tabelas-mensalidade` (refatorado)
- ⚠️ `apps/web/src/app/api/financeiro/pagamentos/mcx/webhook` (webhook sem sessão)

> Observação: alguns endpoints acima podem ser **apenas admin/maintenance**; precisam ser reclassificados (UI vs job).

### Evidências de audit trail parcial
- Audit trail no balcão/pagamentos/fecho/conciliação com `recordAuditServer`.
- Audit log adicionado em mutações onboarding/matrícula/semestres e super‑admin.
- Maintenance/academico (wipe/backfill/refresh/partitions) auditados.

---

## Plano de Execução (4 Fases)

### Fase 0 — Inventário e classificação (D0)
- Listar endpoints com `service_role` e classificar:
  - **Human UI (banir)**
  - **Job/cron/internal (permitido)**
- Mapear ações críticas sem `audit_logs` obrigatório.
- Resultado esperado: matriz `endpoint → tipo → ação → audit`.

**Status:** ✅ inventário atualizado; rotas UI principais já refatoradas.

### Fase 1 — Substituição de service role (D1–D3)
- Trocar chamadas UI `service_role` por `supabaseServer` + RLS.
- Ajustar policies/indices quando RLS retornar vazio.
- Remover uso de `createAdminClient` em rotas humanas.

**Critério de aceite**
- Nenhuma rota UI usa `SUPABASE_SERVICE_ROLE_KEY`.
- Todas as rotas UI validam `resolveEscolaIdForUser`.

**Status:** ✅ rotas de sessão/onboarding legacy, manutenção e financeiro sem `service_role`.

### Fase 2 — Audit trail obrigatório (D3–D5)
- Definir **helper único** de audit: `logAudit({ portal, entity, action, entity_id, details })`.
- Inserir audit em ações críticas (pagamentos, estornos, matrícula, docs, currículo, períodos).
- Garantir `escola_id`, `user_id`, `origin`, `payload_hash`.

**Critério de aceite**
- 100% das mutações críticas geram `audit_logs`.
- Evidência via testes/requests com logs consistentes.

**Status:** 🟡 em progresso (mutações novas cobertas; legacy ainda pendente).

### Fase 3 — Performance & idempotência (D5–D7)
- Para rotas críticas, exigir `Idempotency-Key`.
- Implementar retry seguro (Big Tech Performance).
- Marcar writes como `no-store` + feedback otimista.

**Critério de aceite**
- Nenhuma mutação crítica sem idempotência.
- Sem duplicidade após retry.

**Status:** ✅ pagamentos/fecho/conciliação/estorno com idempotência.

---

## Checklist de Aderência (P0)
- [x] Rotas humanas sem `service_role` (webhooks excluídos).
- [ ] RLS ajustada para rotas humanas essenciais.
- [x] `resolveEscolaIdForUser` em todas as rotas humanas críticas.
- [x] `audit_logs` obrigatório em ações críticas cobertas.
- [x] `Idempotency-Key` em pagamentos/estornos/fecho.

---

## Pendências Atuais (Prontas para execução)

### Service-role ban (UI)
- Concluído para onboarding/session, onboarding/draft, semestres, manutenção e financeiro (orcamento/tabelas).
- Exceção controlada: webhook `mcx` (sem sessão de usuário).

### Audit trail (cobertura total)
- Pagamentos, fecho e conciliação com `audit_logs`.
- Maintenance/academico (wipe/backfill/refresh/partitions) auditados.
- Matrícula/movimentação (aprovação, conversão, transferência) auditados.
- Emissão de documentos oficiais (secretaria + recibos) auditada.

### Idempotência
- Pagamentos, fecho, conciliação e estorno com `Idempotency-Key`
- Dedupe via `meta.idempotency_key` / estado atual

---

## Plano de Execução (S1–S2)

### S1 — Limpeza de rotas UI (service_role ban)
- Concluído: sessão/onboarding, semestres, manutenção, financeiro.

### S2 — Auditoria e idempotência (hard gate)
- Introduzir helper único `logAudit` e aplicar em mutações críticas.
- Exigir `Idempotency-Key` em pagamentos/estornos/fecho.
- Evidência: logs consistentes + dedupe sem duplicidade.

---

## Backlog Técnico (Ordem sugerida)

1. **Padronizar audit helper**
   - Criar util e aplicar em pagamentos, estornos, matrícula, docs.
2. **Idempotência**
   - Pagamentos, fecho, estorno (server) + UI feedback.

---

## Observações
- Endpoints de manutenção e seed podem manter `service_role` **desde que** isolados fora da UI e protegidos por role/feature flag.
- Webhooks de gateway (ex.: `financeiro/pagamentos/mcx/webhook`) podem manter `service_role` por não terem sessão de usuário.
- RLS precisa de índices para não degradar performance.

---
