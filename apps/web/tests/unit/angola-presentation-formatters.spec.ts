import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatDate,
  formatDateTime,
  schoolDaysPastDue,
  formatKwanza,
  monthName,
  SCHOOL_LOCALE,
  SCHOOL_TIME_ZONE,
} from "../../src/lib/formatters";
import { mensalidadeDueState } from "../../src/lib/aluno/mensalidade-due";
import { normalizeDossier } from "../../src/lib/aluno/normalize";
import { formatAnoLetivoDisplay } from "../../src/utils/formatters";

test("school calendar date never shifts with the viewer's time zone", () => {
  assert.equal(SCHOOL_LOCALE, "pt-AO");
  assert.equal(SCHOOL_TIME_ZONE, "Africa/Luanda");
  assert.equal(formatDate("2026-09-01"), formatDate("2026-09-01T00:00:00Z"));
  assert.equal(formatDate("2026-11-21T23:30:00Z"), formatDate("2026-11-22"));
  assert.equal(formatDate("2026-02-30"), "—");
  assert.equal(formatDate(null), "—");
  assert.equal(formatDate("invalid"), "—");
});

test("instants and wall-clock datetimes are presented in Luanda time", () => {
  assert.match(formatDateTime("2026-11-21T23:30:00Z"), /00:30/);
  assert.match(formatDateTime("2026-11-22T00:30:00"), /00:30/);
  assert.equal(formatDateTime("2026-11-22"), formatDate("2026-11-22"));
  assert.equal(formatDateTime("invalid"), "—");
});

test("Kwanza amounts, invalid values and month names use shared formatters", () => {
  assert.notEqual(formatKwanza(0), "—");
  assert.equal(formatKwanza(null), "—");
  assert.equal(formatKwanza(Number.NaN), "—");
  assert.equal(formatKwanza(Number.POSITIVE_INFINITY), "—");
  assert.equal(monthName(1).toLowerCase(), "janeiro");
  assert.equal(monthName(13), "—");
  assert.equal(monthName(1.5), "—");
});

test("academic year uses start/end civil dates and never rewrites the start year", () => {
  assert.equal(formatAnoLetivoDisplay({ ano: 2026, data_inicio: "2026-09-01", data_fim: "2027-08-31" }), "2026/2027");
  assert.equal(formatAnoLetivoDisplay(2026), "2026/2027");
  assert.equal(formatAnoLetivoDisplay(null), "—");
  assert.equal(formatAnoLetivoDisplay({ ano: null }), "—");
  assert.equal(formatAnoLetivoDisplay({ ano: "" }), "—");
  assert.equal(formatAnoLetivoDisplay("invalid"), "—");
  assert.equal(formatAnoLetivoDisplay({ ano: 2026, data_inicio: "2026-09-01T00:00:00Z", data_fim: "2027-08-31T00:00:00Z" }), "2026/2027");
});


test("school due dates respect Luanda midnight, not browser time or elapsed hours", () => {
  assert.equal(schoolDaysPastDue("2026-11-24", new Date("2026-11-24T22:59:59Z")), 0);
  assert.equal(schoolDaysPastDue("2026-11-24", new Date("2026-11-24T23:00:00Z")), 1);
  assert.equal(schoolDaysPastDue("2026-11-25", new Date("2026-11-24T22:59:59Z")), -1);
  assert.equal(schoolDaysPastDue(null), null);
  assert.equal(schoolDaysPastDue("2026-02-30"), null);
});

test("only open collectible balances show active overdue labels", () => {
  const now = new Date("2026-11-25T12:00:00Z");
  const due = { vencimento:"2026-11-24", saldo:5000 };
  for (const status of ["pago","isento","cancelado","em_verificacao"]) {
    assert.deepEqual(mensalidadeDueState({...due,status},now),{open:false,days:null,overdue:false});
  }
  for (const status of ["pendente","atrasado","pago_parcial"]) {
    assert.deepEqual(mensalidadeDueState({...due,status},now),{open:true,days:1,overdue:true});
    assert.equal(mensalidadeDueState({...due,status,saldo:0},now).overdue,false);
    assert.equal(mensalidadeDueState({...due,status,vencimento:"2026-11-25"},now).overdue,false);
    assert.equal(mensalidadeDueState({...due,status,vencimento:"2026-11-26"},now).overdue,false);
  }
});

test("dossier normalization excludes paid, exempt and canceled installments from active arrears", () => {
  const rows = ["pago","isento","cancelado","pendente","atrasado","pago_parcial"].map((status,i)=>({
    id:String(i),mes:1,ano:2020,valor:5000,pago:status==="pago_parcial"?2500:0,status,vencimento:"2020-01-01"
  }));
  const dossier=normalizeDossier("student",{perfil:{nome:"Aluno"},financeiro:{mensalidades:rows}});
  assert.ok(dossier);
  assert.deepEqual(dossier.financeiro.mensalidades.map(m=>m.atrasada),[false,false,false,true,true,true]);
  assert.deepEqual(dossier.financeiro.mensalidades_atrasadas.map(m=>m.status),["pendente","atrasado","pago_parcial"]);
  assert.equal(dossier.financeiro.mensalidades[5]?.saldo,2500);
});
