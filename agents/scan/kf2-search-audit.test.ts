import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { checkGlobalSearchContract } from "./kf2-search-audit-core";
import { readBalcaoStudentId, setBalcaoLocationContext } from "../../apps/web/src/lib/balcao/return-context";

const hookFile = "apps/web/src/hooks/useGlobalSearch.ts";
const sqlFile = "supabase/migrations/20990101000000_search_global.sql";
const globalSearchFile = "apps/web/src/components/GlobalSearch.tsx";
const commandPaletteFile = "apps/web/src/components/CommandPalette.tsx";

const goodHook = `
const debouncedQuery = useDebounce(effectiveQuery, 300);
const limit = Math.min(8, 50);
if (!escolaId || !q || q.length < 2) return;
await supabase.rpc("search_global_entities", {
  p_limit: limit,
  p_cursor_score: pageCursor?.score,
  p_cursor_updated_at: pageCursor?.updated_at,
  p_cursor_created_at: pageCursor?.created_at,
  p_cursor_id: pageCursor?.id,
});
await supabase.rpc("search_global_entities", {
  p_limit: Math.min(8, 50),
  p_cursor_score: cursor.score,
  p_cursor_updated_at: cursor.updated_at,
  p_cursor_created_at: cursor.created_at,
  p_cursor_id: cursor.id,
});
`;

const goodSql = `
create or replace function public.search_global_entities(...) returns table(...) as $$
declare
  v_query text := coalesce(trim(p_query), '');
  v_limit int := least(greatest(coalesce(p_limit, 10), 1), 50);
begin
  if not public.has_access_to_escola_fast(p_escola_id) then raise exception 'forbidden'; end if;
  if v_query = '' or length(v_query) < 2 then return; end if;
  with ranked as (
    select * from source b where b.escola_id = p_escola_id
  ), filtered as (
    select * from ranked
    where (score, updated_at, created_at, id)
      < (p_cursor_score, p_cursor_updated_at, p_cursor_created_at, p_cursor_id)
  ), candidates as (
    select * from filtered
    order by score desc, updated_at desc, created_at desc, id desc
    limit v_limit
  )
  select * from candidates c
  order by c.score desc, c.updated_at desc, c.created_at desc, c.id desc;
end;
$$;
`;

function run(overrides: Partial<Parameters<typeof checkGlobalSearchContract>[0]> = {}) {
  return checkGlobalSearchContract({
    hookFile,
    hookContent: goodHook,
    sqlFile,
    sqlContent: goodSql,
    globalSearchFile,
    globalSearchContent: "useGlobalSearch(escolaId)",
    commandPaletteFile,
    commandPaletteContent: "useGlobalSearch(escolaId)",
    ...overrides,
  });
}

test("accepts the documented KF2 global-search contract", () => {
  assert.deepEqual(run(), []);
});

test("fails when debounce leaves the 250-400ms contract", () => {
  const findings = run({ hookContent: goodHook.replace("300", "100") });
  assert.ok(findings.some((item) => item.error.includes("Debounce")));
});

test("fails when a RPC p_limit is not provably bounded to 50", () => {
  const findings = run({
    hookContent: goodHook.replace("p_limit: Math.min(8, 50)", "p_limit: requestedLimit"),
  });
  assert.ok(findings.some((item) => item.error.includes("p_limit sem limite superior")));
});

test("fails when the SQL RPC removes the server-side limit clamp", () => {
  const findings = run({
    sqlContent: goodSql.replace(
      "v_limit int := least(greatest(coalesce(p_limit, 10), 1), 50);",
      "v_limit int := coalesce(p_limit, 10);",
    ),
  });
  assert.ok(findings.some((item) => item.error.includes("clamp server-side")));
});

test("fails when deterministic ordering is removed", () => {
  const findings = run({
    sqlContent: goodSql.replace(
      "order by score desc, updated_at desc, created_at desc, id desc",
      "order by score desc",
    ),
  });
  assert.ok(findings.some((item) => item.error.includes("ORDER BY determinístico antes")));
});

test("fails when tenant isolation is removed", () => {
  const findings = run({
    sqlContent: goodSql.replace("where b.escola_id = p_escola_id", "where true"),
  });
  assert.ok(findings.some((item) => item.error.includes("tenant")));
});

test("topbar results keep name and identifier visible without nested action buttons", () => {
  const palette = readFileSync(commandPaletteFile, "utf8");
  const row = palette.match(/function SearchResultRow[\s\S]*?\n}\n\nexport function CommandPalette/)?.[0];
  assert.ok(row, "search results must use a shared, identifiable row");
  assert.match(row, /item\.label/);
  assert.match(row, /item\.highlight/);
  assert.match(row, /Processo\/BI:/);
  assert.match(row, /<Command\.Item/);
  assert.doesNotMatch(row, /<button\b/, "no interactive controls nested inside Command.Item");
  assert.equal((palette.match(/<SearchResultRow\b/g) ?? []).length, 2, "results and recents share the same row");
  assert.doesNotMatch(palette, /item\.actions\.map|actionIcon/, "action toolbar belongs in the Balcão");
});

test("student selection opens the existing modal workspace instead of navigating", () => {
  const palette = readFileSync(commandPaletteFile, "utf8");
  const topbar = readFileSync("apps/web/src/components/layout/klasse/Topbar.tsx", "utf8");
  const modal = readFileSync("apps/web/src/components/secretaria/BalcaoWorkspace.tsx", "utf8");
  const shell = readFileSync("apps/web/src/components/secretaria/command-center/CommandCenterShell.tsx", "utf8");

  assert.match(palette, /onStudentSelect\(\{ id: item\.id, label: item\.label \}\)/);
  assert.match(palette, /resolveCommandCenterSelection/);
  assert.match(topbar, /<BalcaoWorkspace/);
  assert.match(topbar, /onStudentSelect=\{\(student\) =>/);
  assert.match(topbar, /schoolId: escolaId/);
  assert.match(topbar, /selectedSearchStudent\?\.schoolId === escolaId/);
  assert.match(modal, /variant="modal"/);
  assert.match(modal, /alunoId=\{panelAction === "enrollment" \? null : selectedStudent\.id\}/);
  assert.match(modal, /setSelectedStudent\(\{ id: newAlunoId, label: "Aluno matriculado" \}\)/);
  assert.match(modal, /confirmLeavingEnrollment/);
  assert.match(shell, /hasStudent=\{Boolean\(student\)\}/, "other actions remain available during new enrollment");
});

test("Balcão return context survives enrollment, reload and accidental switches", () => {
  const id = "00000000-0000-4000-8000-000000000003";
  const current = new URLSearchParams({ alunoId: id, ano_letivo_id: "2026" });
  const during = setBalcaoLocationContext(current, id, "enrollment");
  assert.equal(during.get("alunoId"), null, "never associate the old student as enrollment target");
  assert.equal(during.get("atendimentoAlunoId"), id);
  assert.equal(during.get("action"), "enrollment");
  assert.equal(during.get("ano_letivo_id"), "2026");
  assert.equal(current.get("alunoId"), id, "input URL must not be mutated");
  assert.equal(readBalcaoStudentId(new URLSearchParams(during.toString()), "enrollment"), id);

  const back = setBalcaoLocationContext(during, readBalcaoStudentId(during, "enrollment"), "desk");
  assert.equal(back.get("alunoId"), id);
  assert.equal(back.has("atendimentoAlunoId"), false);
  assert.equal(back.has("action"), false);

  const switchToPayment = setBalcaoLocationContext(back, id, "payment");
  assert.equal(switchToPayment.get("alunoId"), id);
  assert.equal(switchToPayment.get("action"), "payment");

  const emptyEnrollment = setBalcaoLocationContext(new URLSearchParams(), null, "enrollment");
  assert.equal(readBalcaoStudentId(emptyEnrollment, "enrollment"), null);

  const newlyCreated = "00000000-0000-4000-8000-000000000004";
  const afterCompletion = setBalcaoLocationContext(during, newlyCreated, "desk");
  assert.equal(readBalcaoStudentId(afterCompletion, "desk"), newlyCreated);
  assert.equal(afterCompletion.has("atendimentoAlunoId"), false);
});

test("Balcão page uses persistent return context and switches to new student only on success", () => {
  const page = readFileSync("apps/web/src/app/secretaria/balcao/BalcaoPageClient.tsx", "utf8");
  assert.match(page, /readBalcaoStudentId\(/);
  assert.match(page, /setBalcaoLocationContext\(/);
  assert.match(page, /alunoId=\{panelAction === "enrollment" \? null : selectedAlunoId\}/);
  assert.match(page, /syncLocation\(\{ alunoId: newAlunoId, actionId: "desk" \}\)/);
  assert.doesNotMatch(page, /if \(actionId === "enrollment"\)[\s\S]{0,150}setSelectedAlunoId\(null\)/);
});

test("embedded admissions inside modal never rewrite the underlying dashboard URL", () => {
  const wizard = readFileSync("apps/web/src/components/secretaria/AdmissaoWizardClient.tsx", "utf8");
  const panel = readFileSync("apps/web/src/components/secretaria/command-center/CommandCenterPanel.tsx", "utf8");
  const modal = readFileSync("apps/web/src/components/secretaria/BalcaoWorkspace.tsx", "utf8");

  assert.match(modal, /<CommandCenterPanel[\s\S]*?\binModal\b/);
  assert.match(panel, /modalContext=\{inModal\}/);
  assert.match(wizard, /if \(modalContext\) \{[\s\S]*?setModalResumeId\(id\);[\s\S]*?return;/);
  assert.match(wizard, /if \(modalContext\) \{[\s\S]*?setModalResumeId\(null\);[\s\S]*?return;/);
});

test("modal and page show the same full student dossier, with editing secondary", () => {
  const panel = readFileSync("apps/web/src/components/secretaria/command-center/CommandCenterPanel.tsx", "utf8");
  const inline = readFileSync("apps/web/src/components/secretaria/command-center/CommandCenterStudentDossier.tsx", "utf8");
  const fullPage = readFileSync("apps/web/src/components/aluno/AlunoPerfilPage.tsx", "utf8");
  assert.doesNotMatch(panel, /profileDossier/, "the same interactive dossier must render regardless of entry point");
  assert.match(panel, /<CommandCenterStudentDossier[\s\S]*?refreshKey=\{profileRefreshKey \+ refreshRevision\}/);
  const standalone = readFileSync("apps/web/src/app/secretaria/balcao/BalcaoPageClient.tsx", "utf8");
  assert.doesNotMatch(standalone, /profileDossier=\{/, "standalone view must not bypass the interactive dossier");
  assert.match(panel, /<CommandCenterStudentDossier/);
  assert.match(panel, /<details[\s\S]*?<AlunoProfilePanel alunoId=\{alunoId\}/);
  assert.match(inline, /<DossierTabs/);
  assert.match(inline, /<DossierFinanceiroSection/);
  assert.match(inline, /<DossierHistoricoSection/);
  assert.match(inline, /<DossierDocumentosSection/);
  assert.match(fullPage, /loadAlunoDossierData\(/);
  assert.doesNotMatch(panel, /A preparar a ficha integral do aluno\.\.\./);
});

test("topbar command palette uses a single cmdk root and accessible dialog description", () => {
  const palette = readFileSync(commandPaletteFile, "utf8");
  assert.match(palette, /<Command\.Dialog[\s\S]*?shouldFilter=\{false\}/);
  assert.doesNotMatch(palette, /<Command(?:\s|>)/, "Command.Dialog already owns the cmdk root");
  assert.match(palette, /<DialogDescription className="sr-only">/);
});
