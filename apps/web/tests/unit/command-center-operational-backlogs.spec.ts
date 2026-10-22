import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_ROSTER_EXPORT_POLICY, resolveRosterExportPolicy, serializeRosterCsv,
} from "../../src/lib/command-center/roster-export-policy";
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
