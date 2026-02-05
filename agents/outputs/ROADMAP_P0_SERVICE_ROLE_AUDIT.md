# Roadmap — P0 Item 2 (Service-role Ban + Audit Trail)

**Referências**
- `docs/big-tech-performance.md` (writes instantâneos + idempotência)
- `agents/contracts/FEATURES_PRIORITY.json` (P0 Secretaria/Admin)
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
- ❗ `apps/web/src/app/api/escolas/[id]/onboarding/session/*` (pendente)
- ❗ `apps/web/src/app/api/escolas/[id]/onboarding/draft/route.ts` (pendente)
- ❗ `apps/web/src/app/api/escolas/[id]/semestres/[semestreId]/route.ts` (pendente)
- ❗ `apps/web/src/app/api/escolas/[id]/admin/maintenance/*` (manutenção)
- ❗ `apps/web/src/app/api/escolas/[id]/academico/*` (wipe/backfill)

> Observação: alguns endpoints acima podem ser **apenas admin/maintenance**; precisam ser reclassificados (UI vs job).

### Evidências de audit trail parcial
- Audit trail no balcão e pagamentos: `agents/outputs/PLAN_SECRETARIA_FINANCEIRO_HARMONY.md`.
- Audit log adicionado em mutações onboarding/matrícula/semestres e super‑admin.
- Ainda pendente nas rotas de sessão/onboarding legacy e manutenção/backfill.

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

**Status:** 🟡 pendente para rotas de sessão/onboarding legacy e manutenção.

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

**Status:** ⏳ pendente.

---

## Checklist de Aderência (P0)
- [ ] Rotas humanas sem `service_role`.
- [ ] RLS ajustada para rotas humanas essenciais.
- [ ] `resolveEscolaIdForUser` em todas as rotas humanas.
- [ ] `audit_logs` obrigatório em todas ações críticas.
- [ ] `Idempotency-Key` em pagamentos/estornos/fecho.

---

## Pendências Atuais (Prontas para execução)

### Service-role ban (UI)
- `apps/web/src/app/api/escolas/[id]/onboarding/session/*`
- `apps/web/src/app/api/escolas/[id]/onboarding/draft/route.ts`
- `apps/web/src/app/api/escolas/[id]/semestres/[semestreId]/route.ts`

### Rotas de manutenção (classificar)
- `apps/web/src/app/api/escolas/[id]/admin/maintenance/*` (definir UI vs job)
- `apps/web/src/app/api/escolas/[id]/academico/*` (wipe/backfill)

### Audit trail (cobertura total)
- Matrícula/movimentação com `audit_logs` obrigatório
- Emissão de documentos oficiais com `audit_logs`
- Estorno/fecho/conciliação com `audit_logs`

### Idempotência
- Pagamentos, estornos, fecho e conciliação com `Idempotency-Key`
- Retry seguro + dedupe no backend

---

## Plano de Execução (S1–S2)

### S1 — Limpeza de rotas UI (service_role ban)
- Refatorar rotas de sessão/onboarding e semestres `[semestreId]`.
- Garantir `resolveEscolaIdForUser` + RLS funcionando.
- Evidência: diff em cada rota com `supabaseServer`.

### S2 — Auditoria e idempotência (hard gate)
- Introduzir helper único `logAudit` e aplicar em mutações críticas.
- Exigir `Idempotency-Key` em pagamentos/estornos/fecho.
- Evidência: logs consistentes + dedupe sem duplicidade.

---

## Backlog Técnico (Ordem sugerida)

1. **Substituir service_role em rotas de cursos**
   - `apps/web/src/app/api/escolas/[id]/cursos/route.ts`
   - `apps/web/src/app/api/escolas/[id]/cursos/stats/route.ts`
2. **Substituir service_role em rotas de alunos/admin**
   - `apps/web/src/app/api/escolas/[id]/admin/alunos/[alunoId]/*`
3. **Padronizar audit helper**
   - Criar util e aplicar em pagamentos, estornos, matrícula, docs.
4. **Idempotência**
   - Pagamentos, fecho, estorno (server) + UI feedback.

---

## Observações
- Endpoints de manutenção e seed podem manter `service_role` **desde que** isolados fora da UI e protegidos por role/feature flag.
- RLS precisa de índices para não degradar performance.

---

- Refatorar rotas legacy `onboarding/session/*` + `onboarding/draft` + `semestres/[semestreId]`.
