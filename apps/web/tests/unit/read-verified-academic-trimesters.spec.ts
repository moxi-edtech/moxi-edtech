import assert from "node:assert/strict";
import test from "node:test";
import {
  CanonicalPeriodReadError,
} from "../../src/lib/academico/verify-canonical-periods-read";
import {
  readVerifiedAcademicTrimesters,
  reportCalendarReconciliationFailure,
  requireVerifiedTrimester,
  verifiedTrimesterForDate,
} from "../../src/lib/academico/read-verified-academic-trimesters";

const escolaId = "40000000-0000-0000-0000-000000000010";
const anoLetivoId = "40000000-0000-0000-0000-000000000011";
const templateId = "40000000-0000-0000-0000-000000000004";
const items = [1, 2, 3].map((numero) => ({
  id: "40000000-0000-0000-0000-00000000000" + numero,
  numero, tipo: "TRIMESTRE",
  data_inicio: ["2026-09-01", "2027-01-04", "2027-04-01"][numero - 1],
  data_fim: ["2026-12-18", "2027-03-26", "2027-06-30"][numero - 1],
  peso: 30, trava_notas_em: null, offering_id: null,
  source_template_id: templateId,
  source_item_id: "40000000-0000-0000-0000-00000000000" + numero,
  source_version: "FINAL-ACTUALIZADO",
}));

const sourceYear = {
  ano_base: 2026, estado: "PUBLICADO", data_inicio: "2026-09-01",
  data_fim: "2027-06-30", versao_documento: "FINAL-ACTUALIZADO",
};
const profile = {
  id: templateId, ano_base: 2026, calendario_canonico_ano: 2026,
  data_inicio: sourceYear.data_inicio, data_fim: sourceYear.data_fim,
  versao_documento: sourceYear.versao_documento, estado: "PUBLICADO",
  is_oficial: true,
  items: items.map(({ id, numero, data_inicio, data_fim, peso }) => ({
    id, numero, tipo: "PERIODO_LETIVO", data_inicio, data_fim, peso,
  })),
};
function fakeDb(rows: unknown[] = items) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
  const db = {
    from(table: string) {
      const next = (method: string, args: unknown[]) =>
        (calls.push({ table, method, args }), query);
      const query: any = {
        select: (...args: unknown[]) => next("select", args),
        eq: (...args: unknown[]) => next("eq", args),
        order: (...args: unknown[]) => next("order", args),
        limit: (...args: unknown[]) => {
          calls.push({ table, method: "limit", args });
          return Promise.resolve({ data: rows, error: null });
        },
        maybeSingle: async () => ({
          data: table === "calendarios_oficiais_anos" ? sourceYear : profile,
          error: null,
        }),
      };
      return query;
    },
  };
  return { db, calls };
}

test("Indirect consumers filter school + academic year + TRIMESTRE in PostgreSQL", async () => {
  const { db, calls } = fakeDb();
  const rows = await readVerifiedAcademicTrimesters(db, {
    escolaId, anoLetivoId, yearBase: 2026,
  });
  assert.equal(rows.length, 3);
  assert.deepEqual(
    calls.filter((entry) => entry.table === "periodos_letivos" && entry.method === "eq")
      .map((entry) => entry.args),
    [
      ["escola_id", escolaId],
      ["ano_letivo_id", anoLetivoId],
      ["tipo", "TRIMESTRE"],
    ],
  );
  assert.equal(requireVerifiedTrimester(rows, { numero: 3 }).id, items[2].id);
  assert.equal(requireVerifiedTrimester(rows, { id: items[0].id }).numero, 1);
});

test("Cross-year period IDs and invalid trimester numbers fail closed", async () => {
  const { db } = fakeDb();
  const periods = await readVerifiedAcademicTrimesters(db, {
    escolaId, anoLetivoId, yearBase: 2026,
  });
  for (const selector of [
    { id: "40000000-0000-0000-0000-000000000099" },
    { numero: 4 },
  ]) {
    assert.throws(() => requireVerifiedTrimester(periods, selector),
      (err: unknown) => err instanceof CanonicalPeriodReadError && err.status === 409);
  }
});

test("Attendance dates are matched to exactly one MED trimester", async () => {
  const { db } = fakeDb();
  const rows = await readVerifiedAcademicTrimesters(db, {
    escolaId, anoLetivoId, yearBase: 2026,
  });
  assert.equal(verifiedTrimesterForDate(rows, "2026-09-01").numero, 1);
  assert.equal(verifiedTrimesterForDate(rows, "2027-01-04").numero, 2);
  assert.equal(verifiedTrimesterForDate(rows, "2027-06-30").numero, 3);
  for (const date of ["2026-08-31", "2026-12-30", "2027-07-01", "2027-02-30", "hello"]) {
    assert.throws(() => verifiedTrimesterForDate(rows, date),
      (err: unknown) => err instanceof CanonicalPeriodReadError);
  }
});

test("Incomplete or foreign-offering academic periods are rejected before a consumer writes", async () => {
  for (const rows of [
    items.slice(0, 2),
    items.map((p, i) => i === 1
      ? { ...p, offering_id: "40000000-0000-0000-0000-000000000099" } : p),
  ]) {
    const { db } = fakeDb(rows);
    await assert.rejects(() => readVerifiedAcademicTrimesters(db, {
      escolaId, anoLetivoId, yearBase: 2026,
    }), (err: unknown) => err instanceof CanonicalPeriodReadError);
  }
});

test("Historical years do not require the 2026/2027 official document", async () => {
  const { db, calls } = fakeDb(items.slice(0, 2));
  const rows = await readVerifiedAcademicTrimesters(db, {
    escolaId, anoLetivoId, yearBase: 2025,
  });
  assert.equal(rows.length, 2);
  assert.equal(calls.some((entry) => entry.table === "calendarios_oficiais_anos"), false);
});

test("MED reconciliation warnings are structured, tenant-scoped, throttled and contain no pupil data", () => {
  const emitted: string[] = [];
  const capture = (message: string) => emitted.push(message);
  const input = {
    escolaId: "50000000-0000-0000-0000-000000000001",
    anoLetivoId: "50000000-0000-0000-0000-000000000002",
    yearBase: 2026,
  };
  assert.equal(reportCalendarReconciliationFailure(input, 2, 1000, capture), true);
  assert.equal(reportCalendarReconciliationFailure(input, 2, 2000, capture), false);
  assert.equal(reportCalendarReconciliationFailure(input, 3, 301001, capture), true);
  assert.equal(emitted.length, 2);
  const diagnostic = JSON.parse(emitted[0]);
  assert.equal(diagnostic.event, "academic_calendar_reconciliation_blocked");
  assert.equal(diagnostic.code, "OFFICIAL_CALENDAR_NOT_RECONCILED");
  assert.equal(diagnostic.escola_id, input.escolaId);
  assert.equal(diagnostic.ano_letivo_id, input.anoLetivoId);
  assert.equal(diagnostic.trimester_count, 2);
  assert.deepEqual(Object.keys(diagnostic).sort(), [
    "ano_base", "ano_letivo_id", "code", "escola_id",
    "event", "severity", "trimester_count",
  ]);
});
