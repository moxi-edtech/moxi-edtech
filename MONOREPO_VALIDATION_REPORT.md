# KLASSE — Relatório de Validação de Contratos
> Gerado em: 2026-06-28T19:25:28.123Z  
> Contratos: agents/specs/performance.md v1.1 · agents/ops/PILOT_CHECKLIST.md v1.2 · agents/specs/FEATURES_PRIORITY.json v1.2

## Sumário

| Status | Count |
|--------|-------|
| ✅ PASS | 4 |
| ⚠️ WARN | 3 |
| 🟡 PARTIAL | 0 |
| 🔴 FAIL | 3 |
| 🚨 CRITICAL | 0 |

## Pilot Readiness: 🔴 NO-GO

### Blockers activos
- **[SHARED-P0.3]** Service Role banida de endpoints humanos — Status: `FAIL`
- **[PILAR-A-EXACT-COUNT]** Pilar A — zero count: 'exact' em produção — Status: `FAIL`
- **[PLAN_GUARD]** Controlo de planos — backend guard + UI guard obrigatórios em simultâneo — Status: `FAIL`

---

## Checks Detalhados

### 🔴 [SHARED-P0.3] Service Role banida de endpoints humanos
**Status:** `FAIL`  
**Contrato:** agents/specs/FEATURES_PRIORITY.json → SHARED-P0.3

🔴 `apps/web/src/app/api/super-admin/users/list/route.ts`
> Service Role detectada em endpoint humano — vulnerabilidade de cross-tenant
> **Fix:** Substituir por cliente autenticado com RLS activo

🔴 `apps/web/src/app/api/health/route.ts`
> Service Role detectada em endpoint humano — vulnerabilidade de cross-tenant
> **Fix:** Substituir por cliente autenticado com RLS activo

🔴 `apps/web/src/app/api/fiscal/saft/export/[exportId]/download/route.ts`
> Service Role detectada em endpoint humano — vulnerabilidade de cross-tenant
> **Fix:** Substituir por cliente autenticado com RLS activo

🔴 `apps/web/src/app/api/escolas/[id]/turmas/[turmaId]/delete/route.ts`
> Service Role detectada em endpoint humano — vulnerabilidade de cross-tenant
> **Fix:** Substituir por cliente autenticado com RLS activo

🔴 `apps/web/src/app/api/escolas/[id]/matriculas/novo/route.ts`
> Service Role detectada em endpoint humano — vulnerabilidade de cross-tenant
> **Fix:** Substituir por cliente autenticado com RLS activo


### 🔴 [PILAR-A-EXACT-COUNT] Pilar A — zero count: 'exact' em produção
**Status:** `FAIL`  
**Contrato:** agents/specs/performance.md → Pilar A

🔴 `apps/web/src/app/api/super-admin/marketing/summary/route.ts`
> count: 'exact' detectado — proibido em produção (usar MV de contagem)
> **Fix:** Substituir por SELECT COUNT(*) na MV correspondente ou remover contagem

🔴 `apps/web/src/app/api/super-admin/influencers/[id]/members/route.ts`
> count: 'exact' detectado — proibido em produção (usar MV de contagem)
> **Fix:** Substituir por SELECT COUNT(*) na MV correspondente ou remover contagem

🔴 `apps/web/src/app/api/secretaria/rematricula/janelas/route.ts`
> count: 'exact' detectado — proibido em produção (usar MV de contagem)
> **Fix:** Substituir por SELECT COUNT(*) na MV correspondente ou remover contagem

🔴 `apps/web/src/app/api/secretaria/dashboard/route.ts`
> count: 'exact' detectado — proibido em produção (usar MV de contagem)
> **Fix:** Substituir por SELECT COUNT(*) na MV correspondente ou remover contagem

🔴 `apps/web/src/app/api/secretaria/dashboard/summary/route.ts`
> count: 'exact' detectado — proibido em produção (usar MV de contagem)
> **Fix:** Substituir por SELECT COUNT(*) na MV correspondente ou remover contagem

🔴 `apps/web/src/app/api/secretaria/admissoes/radar/route.ts`
> count: 'exact' detectado — proibido em produção (usar MV de contagem)
> **Fix:** Substituir por SELECT COUNT(*) na MV correspondente ou remover contagem

🔴 `apps/web/src/app/api/migracao/alunos/importar/route.ts`
> count: 'exact' detectado — proibido em produção (usar MV de contagem)
> **Fix:** Substituir por SELECT COUNT(*) na MV correspondente ou remover contagem

🔴 `apps/web/src/app/api/matriculas/massa/route.ts`
> count: 'exact' detectado — proibido em produção (usar MV de contagem)
> **Fix:** Substituir por SELECT COUNT(*) na MV correspondente ou remover contagem

🔴 `apps/web/src/app/api/matriculas/massa/por-turma/route.ts`
> count: 'exact' detectado — proibido em produção (usar MV de contagem)
> **Fix:** Substituir por SELECT COUNT(*) na MV correspondente ou remover contagem

🔴 `apps/web/src/app/api/jobs/outbox/route.ts`
> count: 'exact' detectado — proibido em produção (usar MV de contagem)
> **Fix:** Substituir por SELECT COUNT(*) na MV correspondente ou remover contagem

🔴 `apps/web/src/app/api/formacao/admissoes/route.ts`
> count: 'exact' detectado — proibido em produção (usar MV de contagem)
> **Fix:** Substituir por SELECT COUNT(*) na MV correspondente ou remover contagem

🔴 `apps/web/src/app/api/fiscal/financeiro/reprocess/route.ts`
> count: 'exact' detectado — proibido em produção (usar MV de contagem)
> **Fix:** Substituir por SELECT COUNT(*) na MV correspondente ou remover contagem

🔴 `apps/web/src/app/api/fiscal/compliance/status/route.ts`
> count: 'exact' detectado — proibido em produção (usar MV de contagem)
> **Fix:** Substituir por SELECT COUNT(*) na MV correspondente ou remover contagem

🔴 `apps/web/src/app/api/financeiro/dashboard/resumo/route.ts`
> count: 'exact' detectado — proibido em produção (usar MV de contagem)
> **Fix:** Substituir por SELECT COUNT(*) na MV correspondente ou remover contagem


### ✅ [PILAR-C-FORCE-CACHE] Pilar C — force-cache ausente em rotas operacionais
**Status:** `PASS`  
**Contrato:** agents/specs/performance.md → Pilar C

Nenhum problema detectado. ✅

### ⚠️ [NO_STORE_AUDIT] Cache — auditoria de no-store em layouts e configs
**Status:** `WARN`  
**Contrato:** agents/specs/performance.md → Pilar C (tabela de cache por tipo de dado)

| Ficheiro | Recomendação |
|----------|-------------|
| `apps/web/src/components/super-admin/UsuariosListClient.tsx` | Substituir por revalidate: 300 (layout/branding) ou revalidate: 60 (status) |
| `apps/web/src/components/aluno/tabs/TabHorario.tsx` | Substituir por revalidate: 300 (layout/branding) ou revalidate: 60 (status) |

### ✅ [MV_CHECK] Materialized Views — artefactos obrigatórios (MV + INDEX + refresh + wrapper + cron)
**Status:** `PASS`  
**Contrato:** agents/specs/performance.md → Pilar A + Regras operacionais para MVs

| MV | INDEX | Refresh Fn | Wrapper | Cron | Status |
|---|---|---|---|---|---|
| `mv_radar_inadimplencia` | ✅ | ✅ | ✅ | ✅ | `PASS` |
| `mv_pagamentos_status` | ✅ | ✅ | ✅ | ✅ | `PASS` |
| `mv_secretaria_dashboard_counts` | ✅ | ✅ | ✅ | ✅ | `PASS` |
| `mv_secretaria_matriculas_status` | ✅ | ✅ | ✅ | ✅ | `PASS` |
| `mv_secretaria_matriculas_turma_status` | ✅ | ✅ | ✅ | ✅ | `PASS` |

### 🔴 [PLAN_GUARD] Controlo de planos — backend guard + UI guard obrigatórios em simultâneo
**Status:** `FAIL`  
**Contrato:** agents/specs/FEATURES_PRIORITY.json → SHARED-P0.2 + SEC-P0.2

⚠️ `apps/web/src/components/financeiro/ReciboImprimivel.tsx`
> UI guard ausente para feature 'fin_recibo_pdf' — utilizador pode ver UI de feature que não tem
> **Fix:** Adicionar usePlanFeature('fin_recibo_pdf') e condicionar renderização

🔴 `apps/web/src/app/api/secretaria/turmas-simples/route.ts`
> Backend guard ausente para feature 'doc_qr_code' — bypassável via HTTP directo
> **Fix:** Adicionar: const planCheck = await requireFeature(supabase, escolaId, 'doc_qr_code')
if (!planCheck.allowed) return NextResponse.json({ ok: false, error: 'Plano não inclui esta funcionalidade' }, { status: 403 })

🔴 `apps/web/src/app/api/secretaria/turmas/route.ts`
> Backend guard ausente para feature 'doc_qr_code' — bypassável via HTTP directo
> **Fix:** Adicionar: const planCheck = await requireFeature(supabase, escolaId, 'doc_qr_code')
if (!planCheck.allowed) return NextResponse.json({ ok: false, error: 'Plano não inclui esta funcionalidade' }, { status: 403 })

🔴 `apps/web/src/app/api/secretaria/turmas/[id]/transferir/route.ts`
> Backend guard ausente para feature 'doc_qr_code' — bypassável via HTTP directo
> **Fix:** Adicionar: const planCheck = await requireFeature(supabase, escolaId, 'doc_qr_code')
if (!planCheck.allowed) return NextResponse.json({ ok: false, error: 'Plano não inclui esta funcionalidade' }, { status: 403 })

🔴 `apps/web/src/app/api/secretaria/turmas/[id]/pauta-grid/route.ts`
> Backend guard ausente para feature 'doc_qr_code' — bypassável via HTTP directo
> **Fix:** Adicionar: const planCheck = await requireFeature(supabase, escolaId, 'doc_qr_code')
if (!planCheck.allowed) return NextResponse.json({ ok: false, error: 'Plano não inclui esta funcionalidade' }, { status: 403 })

🔴 `apps/web/src/app/api/secretaria/turmas/[id]/pauta-geral/route.ts`
> Backend guard ausente para feature 'doc_qr_code' — bypassável via HTTP directo
> **Fix:** Adicionar: const planCheck = await requireFeature(supabase, escolaId, 'doc_qr_code')
if (!planCheck.allowed) return NextResponse.json({ ok: false, error: 'Plano não inclui esta funcionalidade' }, { status: 403 })

🔴 `apps/web/src/app/api/secretaria/turmas/[id]/pauta-geral/modelo/route.ts`
> Backend guard ausente para feature 'doc_qr_code' — bypassável via HTTP directo
> **Fix:** Adicionar: const planCheck = await requireFeature(supabase, escolaId, 'doc_qr_code')
if (!planCheck.allowed) return NextResponse.json({ ok: false, error: 'Plano não inclui esta funcionalidade' }, { status: 403 })

🔴 `apps/web/src/app/api/secretaria/turmas/[id]/pauta-anual/modelo/route.ts`
> Backend guard ausente para feature 'doc_qr_code' — bypassável via HTTP directo
> **Fix:** Adicionar: const planCheck = await requireFeature(supabase, escolaId, 'doc_qr_code')
if (!planCheck.allowed) return NextResponse.json({ ok: false, error: 'Plano não inclui esta funcionalidade' }, { status: 403 })

🔴 `apps/web/src/app/api/secretaria/turmas/[id]/horario/versao/route.ts`
> Backend guard ausente para feature 'doc_qr_code' — bypassável via HTTP directo
> **Fix:** Adicionar: const planCheck = await requireFeature(supabase, escolaId, 'doc_qr_code')
if (!planCheck.allowed) return NextResponse.json({ ok: false, error: 'Plano não inclui esta funcionalidade' }, { status: 403 })

🔴 `apps/web/src/app/api/secretaria/turmas/[id]/horario/pdf/route.ts`
> Backend guard ausente para feature 'doc_qr_code' — bypassável via HTTP directo
> **Fix:** Adicionar: const planCheck = await requireFeature(supabase, escolaId, 'doc_qr_code')
if (!planCheck.allowed) return NextResponse.json({ ok: false, error: 'Plano não inclui esta funcionalidade' }, { status: 403 })

🔴 `apps/web/src/app/api/secretaria/turmas/[id]/disciplinas/route.ts`
> Backend guard ausente para feature 'doc_qr_code' — bypassável via HTTP directo
> **Fix:** Adicionar: const planCheck = await requireFeature(supabase, escolaId, 'doc_qr_code')
if (!planCheck.allowed) return NextResponse.json({ ok: false, error: 'Plano não inclui esta funcionalidade' }, { status: 403 })

🔴 `apps/web/src/app/api/secretaria/turmas/[id]/disciplinas/[disciplinaId]/route.ts`
> Backend guard ausente para feature 'doc_qr_code' — bypassável via HTTP directo
> **Fix:** Adicionar: const planCheck = await requireFeature(supabase, escolaId, 'doc_qr_code')
if (!planCheck.allowed) return NextResponse.json({ ok: false, error: 'Plano não inclui esta funcionalidade' }, { status: 403 })

🔴 `apps/web/src/app/api/secretaria/turmas/[id]/detalhes/route.ts`
> Backend guard ausente para feature 'doc_qr_code' — bypassável via HTTP directo
> **Fix:** Adicionar: const planCheck = await requireFeature(supabase, escolaId, 'doc_qr_code')
if (!planCheck.allowed) return NextResponse.json({ ok: false, error: 'Plano não inclui esta funcionalidade' }, { status: 403 })

🔴 `apps/web/src/app/api/secretaria/turmas/[id]/atribuir-professor/route.ts`
> Backend guard ausente para feature 'doc_qr_code' — bypassável via HTTP directo
> **Fix:** Adicionar: const planCheck = await requireFeature(supabase, escolaId, 'doc_qr_code')
if (!planCheck.allowed) return NextResponse.json({ ok: false, error: 'Plano não inclui esta funcionalidade' }, { status: 403 })

🔴 `apps/web/src/app/api/secretaria/turmas/[id]/atribuir-professor/preview/route.ts`
> Backend guard ausente para feature 'doc_qr_code' — bypassável via HTTP directo
> **Fix:** Adicionar: const planCheck = await requireFeature(supabase, escolaId, 'doc_qr_code')
if (!planCheck.allowed) return NextResponse.json({ ok: false, error: 'Plano não inclui esta funcionalidade' }, { status: 403 })

🔴 `apps/web/src/app/api/secretaria/turmas/[id]/alunos/route.ts`
> Backend guard ausente para feature 'doc_qr_code' — bypassável via HTTP directo
> **Fix:** Adicionar: const planCheck = await requireFeature(supabase, escolaId, 'doc_qr_code')
if (!planCheck.allowed) return NextResponse.json({ ok: false, error: 'Plano não inclui esta funcionalidade' }, { status: 403 })


### ✅ [GF4] GF4 — Audit Trail (cobertura + schema padronizado)
**Status:** `PASS`  
**Contrato:** agents/specs/FEATURES_PRIORITY.json → SHARED-P0.4

- Audit log existe: ✅

### ✅ [KF2] KF2 — Pesquisa Global (Command Palette)
**Status:** `PASS`  
**Contrato:** ROADMAP.md → Busca global p95 ≤ 300ms

- Hook: `apps/web/src/hooks/useGlobalSearch.ts`
- Componente: `apps/web/src/components/GlobalSearch.tsx`

### ⚠️ [PILAR-C-SPINNER] Pilar C — sem spinner global em páginas de trabalho
**Status:** `WARN`  
**Contrato:** agents/specs/performance.md → Pilar C

ℹ️ `apps/web/src/components/super-admin/planos/PlanosComerciaisClient.tsx`
> Possível spinner global detectado — deve ser substituído por skeleton idêntico ao conteúdo
> **Fix:** Usar <Skeleton /> idêntico à tabela/lista. Loader2 apenas inline em botões.

ℹ️ `apps/web/src/components/super-admin/comissoes/PartnerCommissionsClient.tsx`
> Possível spinner global detectado — deve ser substituído por skeleton idêntico ao conteúdo
> **Fix:** Usar <Skeleton /> idêntico à tabela/lista. Loader2 apenas inline em botões.

ℹ️ `apps/web/src/components/secretaria/MigracaoPautasPage.tsx`
> Possível spinner global detectado — deve ser substituído por skeleton idêntico ao conteúdo
> **Fix:** Usar <Skeleton /> idêntico à tabela/lista. Loader2 apenas inline em botões.

ℹ️ `apps/web/src/components/secretaria/AlunosSecretariaPage.tsx`
> Possível spinner global detectado — deve ser substituído por skeleton idêntico ao conteúdo
> **Fix:** Usar <Skeleton /> idêntico à tabela/lista. Loader2 apenas inline em botões.

ℹ️ `apps/web/src/components/secretaria/AlunosListClient.tsx`
> Possível spinner global detectado — deve ser substituído por skeleton idêntico ao conteúdo
> **Fix:** Usar <Skeleton /> idêntico à tabela/lista. Loader2 apenas inline em botões.

ℹ️ `apps/web/src/components/financeiro/FiscalOperationsClient.tsx`
> Possível spinner global detectado — deve ser substituído por skeleton idêntico ao conteúdo
> **Fix:** Usar <Skeleton /> idêntico à tabela/lista. Loader2 apenas inline em botões.

ℹ️ `apps/web/src/components/escola-admin/AlunosListClient.tsx`
> Possível spinner global detectado — deve ser substituído por skeleton idêntico ao conteúdo
> **Fix:** Usar <Skeleton /> idêntico à tabela/lista. Loader2 apenas inline em botões.

ℹ️ `apps/web/src/app/super-admin/onboarding/page.tsx`
> Possível spinner global detectado — deve ser substituído por skeleton idêntico ao conteúdo
> **Fix:** Usar <Skeleton /> idêntico à tabela/lista. Loader2 apenas inline em botões.

ℹ️ `apps/web/src/app/super-admin/marketing/page.tsx`
> Possível spinner global detectado — deve ser substituído por skeleton idêntico ao conteúdo
> **Fix:** Usar <Skeleton /> idêntico à tabela/lista. Loader2 apenas inline em botões.

ℹ️ `apps/web/src/app/super-admin/influencers/page.tsx`
> Possível spinner global detectado — deve ser substituído por skeleton idêntico ao conteúdo
> **Fix:** Usar <Skeleton /> idêntico à tabela/lista. Loader2 apenas inline em botões.

ℹ️ `apps/web/src/app/super-admin/escolas/[id]/page.tsx`
> Possível spinner global detectado — deve ser substituído por skeleton idêntico ao conteúdo
> **Fix:** Usar <Skeleton /> idêntico à tabela/lista. Loader2 apenas inline em botões.

ℹ️ `apps/web/src/app/secretaria/(portal-secretaria)/rematricula/janelas/page.tsx`
> Possível spinner global detectado — deve ser substituído por skeleton idêntico ao conteúdo
> **Fix:** Usar <Skeleton /> idêntico à tabela/lista. Loader2 apenas inline em botões.

ℹ️ `apps/web/src/app/professor/calendario/page.tsx`
> Possível spinner global detectado — deve ser substituído por skeleton idêntico ao conteúdo
> **Fix:** Usar <Skeleton /> idêntico à tabela/lista. Loader2 apenas inline em botões.

ℹ️ `apps/web/src/app/influencers/[codigo]/page.tsx`
> Possível spinner global detectado — deve ser substituído por skeleton idêntico ao conteúdo
> **Fix:** Usar <Skeleton /> idêntico à tabela/lista. Loader2 apenas inline em botões.

ℹ️ `apps/web/src/app/escola/[id]/(portal)/financeiro/fiscal/page.tsx`
> Possível spinner global detectado — deve ser substituído por skeleton idêntico ao conteúdo
> **Fix:** Usar <Skeleton /> idêntico à tabela/lista. Loader2 apenas inline em botões.

ℹ️ `apps/web/src/app/escola/[id]/(portal)/financeiro/fiscal/retificar/[docId]/page.tsx`
> Possível spinner global detectado — deve ser substituído por skeleton idêntico ao conteúdo
> **Fix:** Usar <Skeleton /> idêntico à tabela/lista. Loader2 apenas inline em botões.

ℹ️ `apps/web/src/app/escola/[id]/(portal)/financeiro/fecho/page.tsx`
> Possível spinner global detectado — deve ser substituído por skeleton idêntico ao conteúdo
> **Fix:** Usar <Skeleton /> idêntico à tabela/lista. Loader2 apenas inline em botões.


### ⚠️ [PILAR-B-IDEMPOTENCY] Pilar B — Idempotency-Key em mutations críticas
**Status:** `WARN`  
**Contrato:** agents/specs/performance.md → Pilar B

⚠️ `apps/web/src/app/api/escola/[id]/admin/turmas/[turmaId]/fecho/route.ts`
> Mutation crítica sem Idempotency-Key — retry pode criar duplicados
> **Fix:** Adicionar: const idempotencyKey = req.headers.get('Idempotency-Key')
Verificar duplicado antes de processar.


---

## Plano de Acção

### Antes do Piloto (blockers)
- **[SHARED-P0.3]** Service Role banida de endpoints humanos
- **[PILAR-A-EXACT-COUNT]** Pilar A — zero count: 'exact' em produção
- **[PLAN_GUARD]** Controlo de planos — backend guard + UI guard obrigatórios em simultâneo

### Após o Piloto (melhorias)
- **[NO_STORE_AUDIT]** Cache — auditoria de no-store em layouts e configs — `WARN`
- **[PILAR-C-SPINNER]** Pilar C — sem spinner global em páginas de trabalho — `WARN`
- **[PILAR-B-IDEMPOTENCY]** Pilar B — Idempotency-Key em mutations críticas — `WARN`