import assert from "node:assert/strict";
import test from "node:test";
import {
  CanonicalPeriodReadError, verifyCanonicalPeriodsRead, type MedPeriod,
} from "../../src/lib/academico/verify-canonical-periods-read";

const ids = ["40000000-0000-0000-0000-000000000001",
  "40000000-0000-0000-0000-000000000002",
  "40000000-0000-0000-0000-000000000003"];
const templateId = "40000000-0000-0000-0000-000000000004";

const periods: MedPeriod[] = ids.map((id, index) => ({
  numero: index + 1, tipo: "TRIMESTRE",
  data_inicio: ["2026-09-01", "2027-01-04", "2027-04-01"][index],
  data_fim: ["2026-12-18", "2027-03-26", "2027-06-30"][index],
  peso: 30, offering_id: null, source_template_id: templateId,
  source_item_id: id, source_version: "FINAL-ACTUALIZADO",
}));

const official = {
  ano_base: 2026, data_inicio: "2026-09-01",
  data_fim: "2027-06-30", versao_documento: "FINAL-ACTUALIZADO",
  estado: "PUBLICADO",
};
const profile = {
  id: templateId, ano_base: 2026, calendario_canonico_ano: 2026,
  data_inicio: official.data_inicio, data_fim: official.data_fim,
  versao_documento: official.versao_documento, is_oficial: true,
  estado: "PUBLICADO",
  items: periods.map((row) => ({
    id: row.source_item_id, tipo: "PERIODO_LETIVO", numero: row.numero,
    data_inicio: row.data_inicio, data_fim: row.data_fim, peso: row.peso,
  })),
};

function dbMock(calendar: unknown = official, template: unknown = profile) {
  const tables: string[] = [];
  const db = {
    from(table: string) {
      tables.push(table);
      const builder: any = {
        select() { return builder; },
        eq() { return builder; },
        async maybeSingle() {
          return { data: table === "calendarios_oficiais_anos" ? calendar : template, error: null };
        },
      };
      return builder;
    },
  };
  return { db, tables };
}

const scope = {
  escolaId: "40000000-0000-0000-0000-000000000010",
  anoLetivoId: "40000000-0000-0000-0000-000000000011",
  yearBase: 2026,
};

test("A correctly published MED calendar authorizes all three linked trimester reads", async () => {
  const { db, tables } = dbMock();
  await verifyCanonicalPeriodsRead(db, { ...scope, periods });
  assert.deepEqual(tables, ["calendarios_oficiais_anos", "calendario_templates"]);
});

test("Historical academic years remain readable without MED provenance", async () => {
  const { db, tables } = dbMock();
  await verifyCanonicalPeriodsRead(db, { ...scope, yearBase: 2025, periods: [] });
  assert.deepEqual(tables, []);
});

test("Missing terms, cross-offering rows, duplicated sources and forged versions fail closed", async () => {
  const cases: MedPeriod[][] = [
    periods.slice(0, 2),
    periods.map((p, i) => i === 0 ? { ...p, offering_id: ids[0] } : p),
    periods.map((p, i) => i === 2 ? { ...p, source_item_id: ids[0] } : p),
    periods.map((p, i) => i === 1 ? { ...p, source_version: "other" } : p),
    periods.map((p, i) => i === 1 ? { ...p, data_inicio: "2026-11-01" } : p),
    periods.map((p, i) => i === 2 ? { ...p, source_template_id: ids[0] } : p),
  ];
  for (const rows of cases) {
    const { db } = dbMock();
    await assert.rejects(
      verifyCanonicalPeriodsRead(db, { ...scope, periods: rows }),
      (e: unknown) => e instanceof CanonicalPeriodReadError && e.status === 409,
    );
  }
});

test("Dates must match the published MED source items, not just contain a source ID", async () => {
  const { db } = dbMock(official, {
    ...profile, items: profile.items.map((item, index) =>
      index === 1 ? { ...item, data_fim: "2027-03-25" } : item),
  });
  await assert.rejects(
    verifyCanonicalPeriodsRead(db, { ...scope, periods }),
    (e: unknown) => e instanceof CanonicalPeriodReadError,
  );
});

test("Unpublished or missing canonical years block 2026/2027 reads", async () => {
  for (const calendar of [null, { ...official, versao_documento: "OLD" }]) {
    const { db } = dbMock(calendar);
    await assert.rejects(verifyCanonicalPeriodsRead(db, { ...scope, periods }),
      (e: unknown) => e instanceof CanonicalPeriodReadError);
  }
});
