# KLASSE AGENT SCAN REPORT (v2)

- **Date:** 2026-01-10
- **Mode:** SCAN
- **Hard Gates Failing:** 2 (`P0.1_TENANT_LEAK`, `P0.3_MATERIALIZED_VIEWS`)

---

## 1. Summary & Actionable Insights

The scan revealed **2 critical hard-gate failures** that require immediate attention. The primary concerns are a **critical tenant data leak vector (P0.1)** and a **missing performance optimization (P0.3)** for a key financial report. While the codebase has strong foundational elements like feature gating and a solid audit trail, these high-severity issues compromise security and scalability.

### Top 5 Suggested Pull Requests:

1.  **Fix (Critical): Isolate tenant data** by replacing 8 instances of insecure `escolaId` resolution with the `resolveEscolaIdForUser` helper.
2.  **Fix (High): Implement Materialized View for F18** (Cash/Tuition Report) to prevent live database aggregation and ensure dashboard scalability.
3.  **Fix (Medium): Add GIN/trigram indexes** to text columns on `profiles` and `turmas` to optimize common search operations.
4.  **Refactor (Medium): Replace hardcoded `.limit()` calls** in all data export routes with a paginated/streaming approach to prevent server timeouts.
5.  **Fix (Low): Improve audit logs for bulk operations** like `gerar_mensalidades_lote` to ensure the initiating human actor is always captured.

---

## 2. Detailed Findings

### 🔴 CRITICAL

| Code | Finding | Recommendation | Autofix |
| :--- | :--- | :--- |:---:|
| **P0.1_TENANT_LEAK** | **Hard Gate FAIL.** Found 8 instances of insecure tenant ID resolution, creating a critical data leak vector. | Immediately replace all instances of the insecure pattern with the `resolveEscolaIdForUser` helper. | ✅ Yes |

**Evidence:**
- `apps/web/src/components/layout/PortalLayout.tsx:103`
- `apps/web/src/app/escola/[id]/financeiro/relatorios/page.tsx:12`
- _...and 6 other locations._
- **Snippet:** `...from('profiles').select('escola_id').order('created_at', { ascending: false }).limit(1)` (Missing `.eq('user_id', ...)` scope)

---

### 🟠 HIGH

| Code | Finding | Recommendation | Autofix |
| :--- | :--- | :--- |:---:|
| **P0.3_MV_F18** | **Hard Gate FAIL.** The 'Relatório de Caixa/Propinas' (F18) does not use a materialized view, performing heavy, real-time aggregations. | Refactor the report's API to query a new, purpose-built materialized view that pre-aggregates the data. | ❌ No |

**Evidence:**
- `apps/web/src/app/api/financeiro/relatorios/propinas/route.ts:24`
- **Snippet:** The API queries `vw_financeiro_propinas_mensal_escola` and calls `get_propinas_por_turma`, both of which query live data.

---

### 🟡 MEDIUM

| Code | Finding | Recommendation | Autofix |
| :--- | :--- | :--- |:---:|
| **PERF_PAGINATION** | Data export routes use large, hardcoded `limit()` calls, risking server timeouts. | Refactor export routes to use streaming APIs and implement proper pagination on list endpoints. | ❌ No |
| **PERF_TRIGRAM_COVERAGE** | `ILIKE` searches are performed on several columns without GIN/trigram indexes, causing slow queries. | Add GIN/trigram indexes to `profiles.nome`, `turmas.nome`, and other searched text columns. | ✅ Yes |

---

### 🔵 LOW / VALIDATED

| Code | Finding | Status |
| :--- | :--- |:---:|
| **P0.2_KF2_INVARIANTS** | Global Search (KF2) backend and frontend invariants are met. | ✅ VALIDATED |
| **P0.4_AUDIT_TRAIL** | Audit trail is well-implemented but could improve actor attribution in bulk operations. | ✅ PARTIAL |
| **P0.5_PLAN_CONTROL** | Feature gating for paid plans is correctly implemented. | ✅ VALIDATED |
| **P1/P2_PERF** | Page weight, bundle splitting, and list virtualization are correctly implemented. | ✅ VALIDATED |
