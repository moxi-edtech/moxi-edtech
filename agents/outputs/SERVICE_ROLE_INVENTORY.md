# Inventário — Uso de Service Role em Rotas Humanas

Fonte: varredura de `SUPABASE_SERVICE_ROLE_KEY` / `createAdminClient` em `apps/web/src/app/api`.

## Classificação
- **UI (BANIR)**: rota acionada por usuário humano (secretaria/admin/super-admin).
- **Job/Internal (OK)**: rota de manutenção, seed, debug ou job (não exposta em UI).
- **Ambígua (REVISAR)**: rota que parece manutenção mas pode estar exposta via UI.

---

## Rotas UI (BANIR)

### Matrículas em massa (Secretaria/Admin)
- ✅ `apps/web/src/app/api/matriculas/massa/route.ts` (refatorado)
- ✅ `apps/web/src/app/api/matriculas/massa/por-turma/route.ts` (refatorado)

### Admin Escola (alunos)
- ✅ `apps/web/src/app/api/escolas/[id]/admin/alunos/[alunoId]/route.ts` (refatorado)
- ✅ `apps/web/src/app/api/escolas/[id]/admin/alunos/[alunoId]/archive/route.ts` (refatorado)
- ✅ `apps/web/src/app/api/escolas/[id]/admin/alunos/[alunoId]/restore/route.ts` (refatorado)

### Admin Escola (onboarding/config)
- ✅ `apps/web/src/app/api/escolas/[id]/onboarding/preferences/route.ts` (refatorado)
- ✅ `apps/web/src/app/api/escolas/[id]/onboarding/curriculum/apply/route.ts` (refatorado)
- ✅ `apps/web/src/app/api/escolas/[id]/onboarding/curriculum/apply-matrix/route.ts` (refatorado)
- ✅ `apps/web/src/app/api/escolas/[id]/onboarding/core/finalize/route.ts` (refatorado, convites apenas para usuários existentes)
- ✅ `apps/web/src/app/api/escolas/[id]/semestres/route.ts` (refatorado)
- ✅ `apps/web/src/app/api/escolas/[id]/configuracoes/status/route.ts` (refatorado)

### Super Admin (UI)
- ✅ `apps/web/src/app/api/super-admin/diagnostics/route.ts` (refatorado)
- ✅ `apps/web/src/app/api/super-admin/escolas/onboarding/progress/route.ts` (refatorado)
- ✅ `apps/web/src/app/api/super-admin/escolas/list/route.ts` (refatorado)
- ✅ `apps/web/src/app/api/super-admin/escolas/repair-admins/route.ts` (refatorado; sem criação de usuário)
- ✅ `apps/web/src/app/api/super-admin/escolas/[id]/resend-invite/route.ts` (refatorado; link genérico)
- ✅ `apps/web/src/app/api/super-admin/escolas/[id]/delete/route.ts` (refatorado)
- ✅ `apps/web/src/app/api/super-admin/escolas/[id]/billing-email/route.ts` (refatorado)
- ✅ `apps/web/src/app/api/super-admin/users/list/route.ts` (refatorado)
- ✅ `apps/web/src/app/api/super-admin/users/reset-password/route.ts` (refatorado; reset via email)
- ✅ `apps/web/src/app/api/super-admin/users/update/route.ts` (refatorado)
- ✅ `apps/web/src/app/api/super-admin/users/delete/route.ts` (refatorado; sem Auth admin)
- ✅ `apps/web/src/app/api/super-admin/users/generate-login-number/route.ts` (refatorado)

### Criação de escola (UI)
- `apps/web/src/app/api/escolas/create/route.ts`

**Recomendação:** substituir por `supabaseServer` + RLS (ou RPC SECURITY DEFINER com validação + audit), mantendo `resolveEscolaIdForUser`.

---

## Rotas Job/Internal (OK)

### Jobs
- `apps/web/src/app/api/jobs/auth-admin/route.ts`
- `apps/web/src/app/api/jobs/outbox/route.ts`

### Seed / Debug / Teste
- `apps/web/src/app/api/seed-superadmin/route.ts`
- `apps/web/src/app/api/escolas/[id]/seed/academico/route.ts`
- `apps/web/src/app/api/test/seed/route.ts`
- `apps/web/src/app/api/debug/email/route.ts`

**Recomendação:** manter service role, mas proteger com flag/role e bloqueio de produção quando aplicável.

---

## Rotas Ambíguas (REVISAR)

### Manutenção / Backfill
- `apps/web/src/app/api/escolas/[id]/admin/maintenance/refresh/route.ts`
- `apps/web/src/app/api/escolas/[id]/admin/maintenance/partitions/route.ts`
- `apps/web/src/app/api/escolas/[id]/academico/offers/backfill/route.ts`
- `apps/web/src/app/api/escolas/[id]/academico/wipe/route.ts`
- `apps/web/src/app/api/escolas/[id]/semestres/[semestreId]/route.ts`
- `apps/web/src/app/api/escolas/[id]/onboarding/draft/route.ts`
- `apps/web/src/app/api/escolas/[id]/onboarding/session/[sessionId]/route.ts`
- `apps/web/src/app/api/escolas/[id]/onboarding/session/[sessionId]/reassign/route.ts`
- `apps/web/src/app/api/escolas/[id]/onboarding/session/repair-names/route.ts`

**Recomendação:** mover para job/internal com auth reforçada e esconder da UI; se exposto na UI, substituir por RPC restrita + auditoria.

---

## Próximas ações sugeridas
1. Confirmar quais rotas acima são realmente chamadas por UI.
2. Priorizar remoção de `service_role` das rotas UI.
3. Padronizar audit trail em todas as mutações críticas dessas rotas.
