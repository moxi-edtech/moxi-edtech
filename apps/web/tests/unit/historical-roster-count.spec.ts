import assert from "node:assert/strict";
import test from "node:test";
import { loadHistoricalRosterCounts } from "../../src/lib/documentos/historicalRosterCount";

const escolaId = "a76b3468-0a31-484b-b9bf-4969b6fc39fe";
const turmaId = "8131dc14-6855-43e4-8c85-b0b25dcbe2ae";

type Enrollment = { id: string; turma_id: string; status: string; escola_id: string; ano_letivo: number };
function fakeClient(rows: Enrollment[]) {
  const calls: Record<string, unknown>[] = [];
  return {
    calls,
    from(table: string) {
      assert.equal(table, "matriculas");
      const filter: Record<string, unknown> = {};
      let cursor = "";
      let size = 500;
      const builder = {
        select(_: string) { return builder; },
        eq(key: string, value: unknown) { filter[key] = value; return builder; },
        in(key: string, value: unknown) { filter[key] = value; return builder; },
        order(_: string, __: unknown) { return builder; },
        limit(value: number) { size = value; return builder; },
        gt(_: string, value: string) { cursor = value; return builder; },
        then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
          calls.push({ ...filter, cursor, size });
          const allowed = new Set(filter.turma_id as string[]);
          const items = rows.filter((row) =>
            row.escola_id === filter.escola_id &&
            row.ano_letivo === filter.ano_letivo &&
            allowed.has(row.turma_id) &&
            row.id > cursor
          ).sort((a, b) => a.id.localeCompare(b.id))
            .slice(0, size)
            .map(({ id, turma_id, status }) => ({ id, turma_id, status }));
          return Promise.resolve({ data: items, error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
}

test("Contagens históricas percorrem todos os registos por cursor e excluem cancelados", async () => {
  const rows: Enrollment[] = Array.from({ length: 503 }, (_, i) => ({
    id: String(i + 1).padStart(8, "0"),
    turma_id: turmaId,
    escola_id: escolaId,
    ano_letivo: 2025,
    status: i === 0 ? "desistente" : i === 1 ? "cancelado" : "concluido",
  }));
  rows.push({ id: "99999999", turma_id: turmaId, escola_id: escolaId, ano_letivo: 2026, status: "concluido" });
  rows.push({ id: "99999998", turma_id: turmaId, escola_id: "outro-tenant", ano_letivo: 2025, status: "concluido" });
  const client = fakeClient(rows);
  const counts = await loadHistoricalRosterCounts(client, { escolaId, yearBase: 2025, turmaIds: [turmaId] });
  assert.equal(counts.get(turmaId), 502);
  assert.equal(client.calls.length, 2);
  assert.equal(client.calls[1].cursor, "00000500");
  assert.equal(client.calls[0].escola_id, escolaId);
  assert.equal(client.calls[0].ano_letivo, 2025);
});

test("Consultas de turmas vazias não acedem ao banco", async () => {
  const client = fakeClient([]);
  const counts = await loadHistoricalRosterCounts(client, { escolaId, yearBase: 2025, turmaIds: [] });
  assert.equal(counts.size, 0);
  assert.equal(client.calls.length, 0);
});
