import test from "node:test";
import assert from "node:assert/strict";
import { resolveGradeEntryAvailability } from "../../src/lib/academico/grade-entry-availability";
import type { GradePeriodRow } from "../../src/lib/academico/grade-period-context";

const periods: GradePeriodRow[] = [
  { id:"t1", numero:1, data_inicio:"2026-09-01", data_fim:"2026-12-18", trava_notas_em:null },
  { id:"t2", numero:2, data_inicio:"2027-01-04", data_fim:"2027-04-09", trava_notas_em:null },
  { id:"t3", numero:3, data_inicio:"2027-04-26", data_fim:"2027-06-18", trava_notas_em:null },
];
const base = {
  periods, trimestre:1, academicMode:"CURRENT" as const, turmaStatusFecho:"ABERTO",
  gradeMaxima:20, activeReopening:false,
};
const at = (iso:string, overrides:Partial<typeof base> = {}) =>
  resolveGradeEntryAvailability({ ...base, ...overrides, now:new Date(iso) });

test("antes do início e no período actual: mudança automática pelo fuso Africa/Luanda", () => {
  assert.equal(at("2026-08-31T22:00:00Z").canWrite, false); // 23h em Luanda
  assert.equal(at("2026-09-01T00:00:00Z").canWrite, true);
  assert.equal(at("2026-12-18T21:00:00Z").canWrite, true);
  assert.equal(at("2026-12-19T00:00:00Z").canWrite, false);
});

test("cada trimestre é elegível apenas no seu intervalo oficial", () => {
  for (const [start, n] of [["2026-09-15T12:00:00Z",1],["2027-02-15T12:00:00Z",2],["2027-05-15T12:00:00Z",3]] as const) {
    for (const candidate of [1,2,3]) {
      assert.equal(at(start,{trimestre:candidate}).canWrite,candidate===n);
    }
  }
});

test("turma fechada e ano histórico não são abertos automaticamente", () => {
  assert.equal(at("2026-10-01T12:00:00Z",{turmaStatusFecho:"FECHADO"}).canWrite,false);
  assert.equal(at("2026-10-01T12:00:00Z",{academicMode:"HISTORICAL_READ"}).canWrite,false);
  assert.equal(at("2026-10-01T12:00:00Z",{academicMode:"HISTORICAL_READ",activeReopening:true}).canWrite,false);
});

test("trava, fim do prazo, excepção e período futuro mantêm regras distintas", () => {
  const locked = [{ ...periods[0], trava_notas_em:"2026-10-01T08:00:00Z" },periods[1],periods[2]];
  const today = "2026-10-02T10:00:00Z";
  assert.equal(at(today,{periods:locked}).canWrite,false);
  assert.equal(at(today,{periods:locked}).canRequestReopen,true);
  assert.equal(at(today,{periods:locked,activeReopening:true}).canWrite,true);
  assert.equal(at("2027-01-01T10:00:00Z",{activeReopening:true}).canWrite,true); // fim do 1.º prazo
  assert.equal(at(today,{trimestre:2,activeReopening:true}).canWrite,false); // futuro nunca aberto
});
