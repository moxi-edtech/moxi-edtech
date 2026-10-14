import assert from "node:assert/strict";
import test from "node:test";
import { listGradeTurmas, GRADE_TURMAS_PAGE_SIZE, MAX_GRADE_TURMAS_OFFSET } from "../../src/lib/secretaria/grade-class-picker";

type QueryCall = { name: string; args: unknown[] };
function source(rows: Array<{ id: string; nome: string; turno: string | null }>, fail = false) {
  const calls: QueryCall[] = [];
  const query = {
    select(...args: unknown[]) { calls.push({ name: "select", args }); return this; },
    eq(...args: unknown[]) { calls.push({ name: "eq", args }); return this; },
    order(...args: unknown[]) { calls.push({ name: "order", args }); return this; },
    range(from: number, to: number) {
      calls.push({ name: "range", args: [from, to] });
      return Promise.resolve({ data: fail ? null : rows.slice(from, to + 1), error: fail ? { message: "fake failure" } : null });
    },
  };
  return {
    calls,
    client: {
      from(table: "turmas") { calls.push({ name: "from", args: [table] }); return query; },
    },
  };
}

test("class dropdown reads canonical turmas for verified school and academic session", async () => {
  const mock = source([{ id: "turma-test", nome: "7A", turno: "M" }]);
  const result = await listGradeTurmas(mock.client, "school-verified", "session-active");
  assert.deepEqual(result, { items: [{ id: "turma-test", nome: "7A", turno: "M" }], has_more: false });
  assert.deepEqual(mock.calls.find((entry) => entry.name === "from")?.args, ["turmas"]);
  assert.deepEqual(mock.calls.filter((entry) => entry.name === "eq").map((entry) => entry.args), [
    ["escola_id", "school-verified"],
    ["session_id", "session-active"],
  ]);
  assert.equal(mock.calls.some((entry) => entry.args.includes("ano_letivo")), false);
});

test("class picker paginates beyond first 50 and retains alphabetical ordering", async () => {
  const rows = Array.from({ length: 205 }, (_, i) => ({
    id: String(i + 1), nome: "Turma " + String(i + 1).padStart(3, "0"), turno: null,
  }));
  const mock = source(rows);
  const first = await listGradeTurmas(mock.client, "school", "session");
  const second = await listGradeTurmas(mock.client, "school", "session", GRADE_TURMAS_PAGE_SIZE);
  const third = await listGradeTurmas(mock.client, "school", "session", GRADE_TURMAS_PAGE_SIZE * 2);
  assert.equal(first.items.length, 100);
  assert.equal(first.has_more, true);
  assert.equal(second.items.length, 100);
  assert.equal(third.items.length, 5);
  assert.equal(third.has_more, false);
  assert.deepEqual(mock.calls.filter((entry) => entry.name === "order").slice(0, 2).map((entry) => entry.args[0]), ["nome", "id"]);
});

test("rejects invalid offsets, missing scope and propagates query failure", async () => {
  const mock = source([], true);
  await assert.rejects(listGradeTurmas(mock.client, "", "active"), /obrigatórios/);
  await assert.rejects(listGradeTurmas(mock.client, "school", "session", MAX_GRADE_TURMAS_OFFSET + 1), /inválida/);
  await assert.rejects(listGradeTurmas(mock.client, "school", "session"), /Não foi possível consultar/);
});

test("UI fetcher loads all class pages using session UUID, not calendar year", async () => {
  const rows = Array.from({ length: 241 }, (_, i) => ({
    id: "t" + String(i + 1), nome: "Turma " + String(i + 1), turno: "M",
  }));
  const captured: string[] = [];
  const fetcher = async (url: string) => {
    captured.push(url);
    const parsed = new URL(url, "https://localhost.test");
    const offset = Number(parsed.searchParams.get("offset"));
    assert.equal(parsed.searchParams.get("ano_letivo_id"), "active-session-uuid");
    assert.equal(parsed.searchParams.has("ano"), false);
    return {
      ok: true,
      json: async () => ({
        ok: true,
        ano_letivo_id: "active-session-uuid",
        items: rows.slice(offset, offset + GRADE_TURMAS_PAGE_SIZE),
        has_more: offset + GRADE_TURMAS_PAGE_SIZE < rows.length,
      }),
    };
  };
  const { loadAllGradeTurmas } = await import("../../src/lib/secretaria/grade-class-picker");
  const all = await loadAllGradeTurmas(fetcher, "active-session-uuid");
  assert.equal(all.length, rows.length);
  assert.equal(captured.length, 3);
});

test("UI rejects cross-year or unauthorized class list and shows upstream error", async () => {
  const { loadAllGradeTurmas } = await import("../../src/lib/secretaria/grade-class-picker");
  await assert.rejects(
    loadAllGradeTurmas(async () => ({ ok: true, json: async () => ({
      ok: true, ano_letivo_id: "wrong-year", items: [], has_more: false,
    }) }), "correct-session"),
    /outro ano letivo/,
  );
  await assert.rejects(
    loadAllGradeTurmas(async () => ({ ok: false, json: async () => ({ ok: false, error: "Sem permissão." }) }), "correct-session"),
    /Sem permissão/,
  );
});
