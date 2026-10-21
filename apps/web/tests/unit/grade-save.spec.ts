import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MAX_GRADE_WRITE_BATCH, saveGradesInChunks } from "../../src/lib/secretaria/grade-save";

const context = {
  turma_id: "synthetic-turma",
  ano_letivo_id: "synthetic-academic-year",
  turma_disciplina_id: "synthetic-assignment",
  disciplina_id: "synthetic-discipline",
  trimestre: 2,
  tipo_avaliacao: "MAC",
  is_isento: false,
};

test("operator saves 107 grades in three canonical batches, each at most 50", async () => {
  const calls: Array<{ headers: Record<string, string>; payload: Record<string, unknown> }> = [];
  let key = 0;
  await saveGradesInChunks(
    async (url, init) => {
      assert.equal(url, "/api/secretaria/notas");
      calls.push({ headers: init.headers, payload: JSON.parse(init.body) });
      return { ok: true, json: async () => ({ ok: true, data: { ok: true } }) };
    },
    context,
    Array.from({ length: 107 }, (_, index) => ({ aluno_id: "synthetic-" + index, valor: 12 })),
    () => "write-" + (++key),
  );
  assert.deepEqual(calls.map((call) => (call.payload.notas as unknown[]).length), [
    MAX_GRADE_WRITE_BATCH, MAX_GRADE_WRITE_BATCH, 7,
  ]);
  assert.deepEqual(calls.map((call) => call.headers["idempotency-key"]), ["write-1", "write-2", "write-3"]);
  for (const call of calls) {
    assert.equal(call.payload.turma_id, context.turma_id);
    assert.equal(call.payload.ano_letivo_id, context.ano_letivo_id);
    assert.equal(call.payload.turma_disciplina_id, context.turma_disciplina_id);
    assert.equal(call.payload.tipo_avaliacao, "MAC");
    assert.equal(call.payload.trimestre, 2);
  }
});

test("operator failure stops further grade writes and surfaces exact server failure", async () => {
  let calls = 0;
  await assert.rejects(
    saveGradesInChunks(
      async () => {
        calls++;
        return { ok: false, json: async () => ({ ok: false, error: "Período fechado para lançamento." }) };
      },
      context,
      Array.from({ length: 110 }, (_, index) => ({ aluno_id: "synthetic-" + index, valor: 12 })),
      () => "unique",
    ),
    /Período fechado/,
  );
  assert.equal(calls, 1);
});

test("RPC-level rejection cannot be reported as success by the frontend", async () => {
  await assert.rejects(
    saveGradesInChunks(
      async () => ({ ok: true, json: async () => ({
        ok: true, data: { ok: false, error: "Matrícula não corresponde à turma." },
      }) }),
      context,
      [{ aluno_id: "synthetic", valor: 10 }],
      () => "request-1",
    ),
    /não corresponde/,
  );
});

test("invalid academic or assignment scope fails before network request", async () => {
  let calls = 0;
  await assert.rejects(
    saveGradesInChunks(
      async () => { calls++; return { ok: true, json: async () => ({ ok: true }) }; },
      { ...context, ano_letivo_id: "" },
      [{ aluno_id: "synthetic", valor: 15 }],
      () => "x",
    ),
    /Faltam informações/,
  );
  assert.equal(calls, 0);
});

test("blank grade is rejected before any request; empty component is not persisted", async () => {
  let calls = 0;
  const fetcher = async () => {
    calls++;
    return { ok: true, json: async () => ({ ok: true }) };
  };
  await assert.rejects(
    saveGradesInChunks(fetcher, context, [{ aluno_id: "synthetic", valor: null }], () => "key"),
    /sem valor/,
  );
  await saveGradesInChunks(fetcher, context, [], () => "key");
  assert.equal(calls, 0);
});

test("explicit exemption writes numeric zero through existing canonical endpoint", async () => {
  let payload: Record<string, unknown> | undefined;
  await saveGradesInChunks(
    async (_url, init) => {
      payload = JSON.parse(init.body);
      return { ok: true, json: async () => ({ ok: true }) };
    },
    { ...context, is_isento: true },
    [{ aluno_id: "synthetic", valor: 0 }],
    () => "exempt-1",
  );
  assert.deepEqual(payload?.notas, [{ aluno_id: "synthetic", valor: 0 }]);
  assert.equal(payload?.is_isento, true);
});

// Both Secretaria surfaces must use the same canonical writer and must not
// send empty evaluation slots as SQL NULL values.
test("Balcão and full Secretariat grades never forward null components", () => {
  const sources = [
    "src/components/secretaria/PautaRapidaModal.tsx",
    "src/app/secretaria/(portal-secretaria)/notas/page.tsx",
  ];
  for (const path of sources) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /saveGradesInChunks/);
    assert.match(source, /isentos\.map\(\(row\) => \(\{ aluno_id: row\.id, valor: 0 \}\)\)/);
    assert.match(source, /activeRows\.flatMap\(/);
    assert.doesNotMatch(source, /valor: row\[campo\] \?\? null/);
  }
  const api = readFileSync("src/app/api/secretaria/notas/route.ts", "utf8");
  assert.match(api, /valor: z\.number\(\)\.finite\(\)\.min\(0\)\.max\(100\)/);
});
