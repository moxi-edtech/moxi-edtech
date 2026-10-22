import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_ROSTER_EXPORT_POLICY, resolveRosterExportPolicy, serializeRosterCsv, rosterExportAudit,
} from "../../src/lib/command-center/roster-export-policy";
import { resolveExplorerStudentCapabilities } from "../../src/lib/command-center/student-capabilities";
import {
  BALCAO_ACTION_REGISTRY, buildBalcaoActionHref, getStudentBalcaoActions,
} from "../../src/lib/balcao/action-registry";

test("P1 export stays off without an explicit per-school scoped policy", () => {
  const school = "00000000-0000-4000-8000-0000000000a1";
  assert.strictEqual(resolveRosterExportPolicy(school, undefined), DEFAULT_ROSTER_EXPORT_POLICY);
  assert.equal(resolveRosterExportPolicy(school, "{}").enabled, false);
  assert.equal(resolveRosterExportPolicy(school, JSON.stringify({
    [school]: { enabled: true, maxRows: 1000, roles: ["secretaria"] },
  })).enabled, false);
  assert.equal(resolveRosterExportPolicy(school, JSON.stringify({
    [school]: { enabled: true, maxRows: 50, roles: ["aluno"] },
  })).enabled, false);
  assert.equal(resolveRosterExportPolicy(school, JSON.stringify({
    [school]: { enabled: true, maxRows: 50, roles: ["secretaria"] },
  })).enabled, true);
  assert.equal(resolveRosterExportPolicy("other-school", JSON.stringify({
    [school]: { enabled: true, maxRows: 50, roles: ["secretaria"] },
  })).enabled, false);
});

test("P1 a three-column CSV never interprets formula text", () => {
  const result = serializeRosterCsv(
    [{ nome: "=2+2", numero: "+cmd", turma: "@sum" }],
    "synthetic-actor", "2026-10-22T00:00:00Z",
  );
  assert.ok(result.startsWith("\uFEFF"));
  assert.ok(result.includes('"\'=2+2"'));
  assert.ok(result.includes('"\'+cmd"'));
  assert.ok(result.includes('"\'@sum"'));
  assert.doesNotMatch(result, /encarregado|telefone|bi_numero/i);
});

test("P1 six existing operations are routed through one Balcão registry", () => {
  const expected = ["enrollment","reenrollment","payment","document","profile","grade"];
  const all = getStudentBalcaoActions();
  for (const id of expected) {
    const item = all.find((a) => a.id === id);
    assert.ok(item, `Missing existing action ${id}`);
    const href = buildBalcaoActionHref({
      escolaParam:"synthetic-school",portal:"secretaria",
      actionId:item!.id,alunoId:"synthetic-student",
    });
    assert.ok(href.includes("/secretaria/balcao"));
    assert.equal(href.includes("alunoId="), id !== "enrollment");
    assert.ok(BALCAO_ACTION_REGISTRY[item!.id].label);
  }
});

test("P1 school role controls the six operations without granting by portal alone", () => {
  const secretary = resolveExplorerStudentCapabilities("secretaria");
  assert.equal(secretary.enrollment, true);
  assert.equal(secretary.document, true);
  assert.equal(secretary.grade, true);
  assert.equal(secretary.payment, false);

  const financial = resolveExplorerStudentCapabilities("financeiro");
  assert.equal(financial.payment, true);
  assert.equal(financial.enrollment, false);
  const denied = resolveExplorerStudentCapabilities("unknown");
  assert.equal(Object.values(denied).some(Boolean), false);
  assert.equal(Object.values(resolveExplorerStudentCapabilities(null, true)).every(Boolean), true);
});

test("P1 audit stores filter and purpose, never the query or the exported student data", () => {
  const meta = rosterExportAudit({
    userId: "test-user", escolaId: "test-school", type: "classe", entityId: "test-class",
    count: 2, hasSearch: true, exportedAt: "2026-10-22T00:00:00Z",
    filter: "propinas_vencidas", sort: "pendencias_primeiro",
  });
  assert.equal(meta.purpose_code, "secretaria_atendimento");
  assert.equal(meta.filter_code, "propinas_vencidas");
  assert.equal(meta.sort_code, "pendencias_primeiro");
  assert.doesNotMatch(JSON.stringify(meta), /Aluno Sintético|valor_pago_total|numero_processo/i);
});
