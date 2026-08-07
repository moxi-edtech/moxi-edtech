import test from "node:test";
import assert from "node:assert/strict";

import {
  ACADEMIC_YEAR_PARAM,
  AcademicYearContextError,
  getAcademicYearStatus,
  resolveAcademicYearContext,
} from "../../src/lib/academic-year/context";

const ACTIVE = {
  id: "00000000-0000-4000-8000-000000000001",
  ano: 2026,
  data_inicio: "2026-09-01",
  data_fim: "2027-07-31",
  ativo: true,
};
const CLOSED = {
  id: "00000000-0000-4000-8000-000000000002",
  ano: 2025,
  data_inicio: "2025-09-01",
  data_fim: "2026-07-31",
  ativo: false,
};

function fakeSupabase(rows = [ACTIVE, CLOSED]) {
  const matches = (item: (typeof ACTIVE), filters: Record<string, unknown>) =>
    Object.entries(filters).every(([key, value]) => key === "escola_id" || item[key as keyof typeof item] === value);
  return {
    rpc: async () => ({ data: "school-1", error: null }),
    from: () => {
      const query: any = {
        filters: {} as Record<string, unknown>,
        select() { return query; },
        eq(column: string, value: unknown) { query.filters[column] = value; return query; },
        order() { return query; },
        limit() { return query; },
        async maybeSingle() {
          const row = rows.find((item) => matches(item, query.filters));
          return { data: row ?? null, error: null };
        },
        then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) {
          const filtered = rows.filter((item) => matches(item, query.filters));
          return Promise.resolve({ data: filtered, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  } as any;
}

test("usa o ano ativo como estado ACTIVE", () => {
  assert.equal(getAcademicYearStatus({ ativo: true, data_inicio: null }), "ACTIVE");
});

test("classifica ano futuro sem ativação como PLANNED", () => {
  assert.equal(
    getAcademicYearStatus({ ativo: false, data_inicio: "2030-09-01" }, new Date("2030-01-01T00:00:00Z")),
    "PLANNED",
  );
});

test("classifica ano não ativo iniciado como CLOSED", () => {
  assert.equal(
    getAcademicYearStatus({ ativo: false, data_inicio: "2025-09-01" }, new Date("2026-08-06T00:00:00Z")),
    "CLOSED",
  );
});

test("mantém um único parâmetro canónico", () => {
  assert.equal(ACADEMIC_YEAR_PARAM, "ano_letivo_id");
});

test("leitura sem ano resolve o ano ativo", async () => {
  const context = await resolveAcademicYearContext(fakeSupabase(), { userId: "user-1", operation: "READ" });
  assert.equal(context.anoLetivoId, ACTIVE.id);
  assert.equal(context.resolvedFrom, "ACTIVE_DEFAULT");
});

test("leitura explícita respeita ano encerrado", async () => {
  const context = await resolveAcademicYearContext(fakeSupabase(), {
    userId: "user-1",
    requestedAcademicYearId: CLOSED.id,
    operation: "READ",
  });
  assert.equal(context.mode, "HISTORICAL_READ");
  assert.equal(context.status, "CLOSED");
});

test("escrita sem ano é bloqueada", async () => {
  await assert.rejects(
    resolveAcademicYearContext(fakeSupabase(), { userId: "user-1", operation: "WRITE" }),
    (error: unknown) => error instanceof AcademicYearContextError && error.code === "ACADEMIC_YEAR_REQUIRED",
  );
});

test("escrita em ano encerrado é bloqueada", async () => {
  await assert.rejects(
    resolveAcademicYearContext(fakeSupabase(), {
      userId: "user-1",
      requestedAcademicYearId: CLOSED.id,
      operation: "WRITE",
    }),
    (error: unknown) => error instanceof AcademicYearContextError && error.code === "ACADEMIC_YEAR_CLOSED",
  );
});
