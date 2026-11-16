import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as XLSX from "xlsx";
import { renderNominalXlsx, safeNominalXlsxText } from "../../src/lib/documentos/listaNominalXlsx";

test("XLSX nominal inclui 55 alunos, cabeçalho, ano, modo e exclusões", () => {
  const rows = Array.from({ length: 55 }, (_, i) => ({
    chamada: i + 1,
    processo: String(1000 + i),
    nome: `Aluno Sintético ${i + 1}`,
    turma: "8ª A",
    ano: "2026/2027",
    situacao: i % 2 === 0 ? "ativa" : "concluida",
  }));
  const bytes = renderNominalXlsx({
    escola: "Escola Sintética",
    turma: "8ª A",
    ano: "2026/2027",
    mode: "ano_letivo",
    totalOrigem: 58,
    exclusoes: "canceladas: 3",
    rows,
  });
  const workbook = XLSX.read(bytes, { type: "buffer" });
  const sheet = workbook.Sheets["Lista nominal"];
  assert.ok(sheet, "deve conter aba nominal própria, não pauta digital");
  assert.equal(sheet["A1"].v, "KLASSE | LISTA NOMINAL");
  assert.equal(sheet["B3"].v, "8ª A");
  assert.equal(sheet["D3"].v, "2026/2027");
  assert.equal(sheet["B4"].v, "Lista do ano letivo (histórica)");
  assert.equal(sheet["B5"].v, 58);
  assert.equal(sheet["D5"].v, 55);
  assert.equal(sheet["F5"].v, 3);
  assert.equal(sheet["B6"].v, "canceladas: 3");
  assert.equal(sheet["B8"].v, "Nº de processo");
  assert.equal(sheet["B9"].t, "s");
  assert.equal(sheet["B9"].v, "1000");
  assert.equal(sheet["C63"].v, "Aluno Sintético 55");
  assert.equal(sheet["!autofilter"]?.ref, "A8:F63");
});

test("XLSX nominal vazio continua válido", () => {
  const bytes = renderNominalXlsx({
    escola: "Escola Sintética",
    turma: "8ª A",
    ano: "2026/2027",
    mode: "operacional",
    totalOrigem: 0,
    exclusoes: "nenhuma",
    rows: [],
  });
  const sheet = XLSX.read(bytes, { type: "buffer" }).Sheets["Lista nominal"];
  assert.equal(sheet["A8"].v, "Nº de chamada");
  assert.equal(sheet["!autofilter"]?.ref, "A8:F8");
  assert.equal(sheet["D5"].v, 0);
});

test("nomes que parecem fórmulas não executam no Excel", () => {
  for (const hostile of ["=1+1", " +SUM(1,2)", "-5+6", "@SUM(A1:A2)", "\t=HYPERLINK(\"https://bad.invalid\")"]) {
    assert.equal(safeNominalXlsxText(hostile).startsWith("'"), true);
    const bytes = renderNominalXlsx({
      escola: "Teste",
      turma: "A",
      ano: "2026/2027",
      mode: "operacional",
      totalOrigem: 1,
      exclusoes: "nenhuma",
      rows: [{
        chamada: 1, processo: "0001", nome: hostile,
        turma: "A", ano: "2026/2027", situacao: "ativa",
      }],
    });
    const cell = XLSX.read(bytes, { type: "buffer" }).Sheets["Lista nominal"]["C9"];
    assert.equal(cell.t, "s");
    assert.equal(cell.f, undefined);
    assert.equal(cell.v, "'" + hostile);
  }
});

test("rota XLSX limita escola/sessão, aplica seleção canónica e exige auditoria", () => {
  const route = readFileSync(new URL("../../src/app/api/secretaria/turmas/[id]/alunos/xlsx/route.ts", import.meta.url), "utf8");
  assert.match(route, /resolveEscolaIdForUser/);
  assert.match(route, /authorizeTurmasManage/);
  assert.match(route, /\.eq\("escola_id", escolaId\)/);
  assert.match(route, /\.eq\("session_id", turma\.session_id\)/);
  assert.match(route, /applyKf2ListInvariants/);
  assert.match(route, /selectMatriculasDaLista/);
  assert.match(route, /LISTA_NOMINAL_XLSX_EXPORTADA/);
  assert.match(route, /if \(auditError\) return deny/);
  assert.match(route, /polo_id/);
});
