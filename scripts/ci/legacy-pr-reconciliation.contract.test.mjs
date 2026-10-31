import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";

const repo = new URL("../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, repo), "utf8");

/**
 * These gates protect the newer production contracts during reconciliation of
 * legacy PRs #236-238, #200-204, #181/#116 and #123/#124/#182/#184.
 * Source-contract checks are NOT authenticated E2E tests.
 */
test("Command Center preserves explorer state only inside the same auth/tenant scope", () => {
  const state = read("apps/web/src/lib/command-center/explorer-return-context.ts");
  for (const property of ["userId", "escolaId", "poloId", "academicYearId", "portal"]) {
    assert.match(state, new RegExp(`a\\.${property}\\s*===\\s*b\\.${property}`), property);
  }
  assert.match(state, /MAX_AGE_MS/);
  assert.match(state, /MAX_EXPLORER_VIEWS/);
  assert.match(state, /clearExplorerReturnContext/);
});

test("Command Center roster is scoped and paginated by the current API, not the legacy RPC", () => {
  const route = read("apps/web/src/app/api/escolas/[id]/command-center/roster/route.ts");
  assert.match(route, /requireCommandCenterSchoolWideAccess/);
  assert.match(route, /resolveAcademicYearScope/);
  assert.match(route, /command_center_roster_operational_v1/);
  assert.match(route, /POLO_SCOPE_UNDEFINED/);
  assert.match(route, /cursorId/);
  const hook = read("apps/web/src/hooks/useExplorerRoster.ts");
  assert.match(hook, /useInfiniteQuery/);
  assert.match(hook, /signal/);
  assert.match(hook, /academicYearId/);
});

test("CSV export of student rosters is disabled by default, school-scoped and audit-gated", () => {
  const policy = read("apps/web/src/lib/command-center/roster-export-policy.ts");
  assert.match(policy, /DEFAULT_ROSTER_EXPORT_POLICY[\\s\\S]*?enabled: false/);
  assert.match(policy, /safeCsvCell/);
  assert.match(policy, /serializeRosterCsv/);
  const route = read("apps/web/src/app/api/escolas/[id]/command-center/roster/export/route.ts");
  assert.match(route, /requireCommandCenterSchoolWideAccess/);
  assert.match(route, /resolveRosterExportPolicy/);
  assert.match(route, /rosterExportAudit/);
  const audit = route.indexOf("const { error: auditError }");
  const deny = route.indexOf("if (auditError) return deny", audit);
  const serialize = route.indexOf("serializeRosterCsv(rows", audit);
  assert.ok(audit !== -1 && deny > audit && serialize > deny, "CSV is sent only after audit success");
});

test("Student portal shares a single Notice component without replacing payment workflows", () => {
  const primitive = read("apps/web/src/components/ui/alert.tsx");
  assert.match(primitive, /export function Notice/);
  assert.match(primitive, /export \\{ Alert, AlertTitle, AlertDescription \\}/);
  assert.equal(existsSync(new URL("apps/web/src/components/ui/notice.tsx", repo)), false,
    "Do not restore an independently diverging Notice component from PR #204");
  for (const file of [
    "apps/web/src/components/aluno/home/RematriculaBanner.tsx",
    "apps/web/src/components/aluno/home/FinanceAlertBanner.tsx",
    "apps/web/src/components/aluno/dashboard/AvisosRecentesCard.tsx",
  ]) assert.match(read(file), /components\\/ui\\/alert/, file);
  const rematricula = read("apps/web/src/components/aluno/home/RematriculaBanner.tsx");
  assert.match(rematricula, /comprovativo/);
  assert.match(rematricula, /paymentIntent/);
});

test("Student grades are released only after authorization, with the latest payment UI", () => {
  const grades = read("apps/web/src/components/aluno/tabs/TabNotas.tsx");
  assert.match(grades, /json\\.is_liberado\\s*\\?\\s*json\\.disciplinas\\s*\\?\\?\\s*\\[\\]\\s*:\\s*\\[\\]/);
  assert.match(grades, /ServicePaymentDrawer/);
  assert.match(grades, /accessPresentation/);
  assert.match(read("apps/web/src/lib/aluno/gradesPresentation.ts"), /isSubjectOffered/);
  const dashboard = read("apps/web/src/components/aluno/dashboard/DashboardLoader.tsx");
  assert.match(dashboard, /buildStudentAttention/);
});

test("MED official source governs the academic rollover, never a guessed next year", () => {
  const route = read("apps/web/src/app/api/secretaria/operacoes-academicas/virada/sessions-target/route.ts");
  assert.match(route, /prepareCanonicalMedCalendar/);
  assert.match(route, /calendarios_oficiais_anos/);
  assert.match(route, /CANONICAL_CALENDAR_SELECTION_REQUIRED/);
  assert.doesNotMatch(route, /resolvePublishedAcademicCalendar/);
  const canonical = read("apps/web/src/lib/academico/prepare-canonical-calendar.ts");
  assert.match(canonical, /buildCanonicalMedCalendarPlan/);
  assert.match(canonical, /ACADEMIC_YEAR_CALENDAR_MISMATCH/);
});

test("Operational receipt recovery is payment-identified, idempotent and tenant-scoped", () => {
  const writer = read("apps/web/src/app/api/secretaria/balcao/pagamentos/route.ts");
  assert.match(writer, /IDEMPOTENCY_KEY_CONFLICT/);
  assert.match(writer, /financeiro_registrar_pagamento_secretaria/);
  assert.match(writer, /emitir_recibo/);
  const lookup = read("apps/web/src/app/api/secretaria/recibos/consultar/route.ts");
  assert.match(lookup, /pagamento_id/);
  assert.match(lookup, /findConsolidatedReceipt/);
  assert.match(lookup, /\\.eq\\("escola_id", escolaId\\)\\.eq\\("aluno_id", alunoId\\)/);
  assert.match(lookup, /Não repita o pagamento/);
});
