import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMensalidadesPreview,
  normalizeCompetenciasPrefix,
} from "../../src/lib/financeiro/mensalidades-preview";

test("preview normal exclui o mês final do ano letivo", () => {
  const rows = buildMensalidadesPreview({
    dataInicio: "2026-11-01",
    dataFim: "2027-08-31",
    isClasseExame: false,
    valorMensalidade: 50000,
    diaVencimento: 10,
    today: new Date("2026-10-05T12:00:00Z"),
  });

  assert.equal(rows[0]?.competencia, "2026-11");
  assert.equal(rows.at(-1)?.competencia, "2027-07");
  assert.equal(rows.length, 9);
});

test("classe de exame inclui o mês final", () => {
  const rows = buildMensalidadesPreview({
    dataInicio: "2026-11-01",
    dataFim: "2027-08-31",
    isClasseExame: true,
    valorMensalidade: 50000,
    diaVencimento: 10,
    today: new Date("2026-10-05T12:00:00Z"),
  });

  assert.equal(rows.at(-1)?.competencia, "2027-08");
  assert.equal(rows.length, 10);
});

test("preview começa no mês anterior à entrada quando o ano já está em curso", () => {
  const rows = buildMensalidadesPreview({
    dataInicio: "2026-02-01",
    dataFim: "2026-12-20",
    isClasseExame: false,
    valorMensalidade: 45000,
    diaVencimento: 5,
    today: new Date("2026-10-05T12:00:00Z"),
  });

  assert.deepEqual(rows.map((row) => row.competencia), ["2026-09", "2026-10", "2026-11"]);
});

test("Curtume em outubro mantém setembro como primeira competência", () => {
  const rows = buildMensalidadesPreview({
    dataInicio: "2026-09-01",
    dataFim: "2027-08-31",
    isClasseExame: false,
    valorMensalidade: 2500,
    diaVencimento: 10,
    today: new Date("2026-10-06T12:00:00Z"),
  });

  assert.equal(rows[0]?.competencia, "2026-09");
  assert.equal(rows[0]?.data_vencimento, "2026-09-10");
  assert.equal(rows.at(-1)?.competencia, "2027-07");
  assert.equal(rows.length, 11);
});

test("preview não reabre cobrança depois do fim da janela", () => {
  const rows = buildMensalidadesPreview({
    dataInicio: "2026-09-01",
    dataFim: "2027-08-31",
    isClasseExame: true,
    valorMensalidade: 2500,
    diaVencimento: 10,
    today: new Date("2027-09-01T12:00:00Z"),
  });

  assert.deepEqual(rows, []);
});

test("desconto é refletido no valor previsto sem alterar o valor base", () => {
  const [row] = buildMensalidadesPreview({
    dataInicio: "2026-11-01",
    dataFim: "2027-02-28",
    isClasseExame: false,
    valorMensalidade: 50000,
    descontoPercentual: 20,
    today: new Date("2026-10-05T12:00:00Z"),
  });

  assert.equal(row?.valor_base, 50000);
  assert.equal(row?.valor, 40000);
});

test("normalização converte seleção dispersa em prefixo cronológico", () => {
  const rows = buildMensalidadesPreview({
    dataInicio: "2026-11-01",
    dataFim: "2027-05-31",
    isClasseExame: false,
    valorMensalidade: 50000,
    today: new Date("2026-10-05T12:00:00Z"),
  });

  assert.deepEqual(
    normalizeCompetenciasPrefix(rows, ["2027-02"]),
    ["2026-11", "2026-12", "2027-01", "2027-02"],
  );
});
