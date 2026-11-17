import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as XLSX from "xlsx";
import { renderNominalXlsx, safeNominalXlsxText, sortClasseNominalRows } from "../../src/lib/documentos/listaNominalXlsx";

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

test("XLSX da classe inteira preserva 55 alunos, turmas e processos distintos", () => {
  const unsorted = Array.from({ length: 55 }, (_, i) => ({
    chamada: i === 54 ? null : (i % 20) + 1,
    processo: String(10000 + i).padStart(6, "0"),
    nome: i < 2 ? "Nome Repetido" : "Aluno " + (i + 1),
    turma: i % 3 === 0 ? "8.ª C" : i % 3 === 1 ? "8.ª A" : "8.ª B",
    ano: "2026/2027",
    situacao: i % 2 === 0 ? "ativo" : "concluida",
  }));
  const rows = sortClasseNominalRows(unsorted);
  const workbook = XLSX.read(renderNominalXlsx({
    escola: "Escola Sintética", classe: "8.ª Classe", turma: "Todas as turmas",
    quantidadeTurmas: 3, ano: "2026/2027", mode: "ano_letivo",
    totalOrigem: 57, exclusoes: "pendentes: 2", rows,
  }), { type: "buffer" });
  const sheet = workbook.Sheets["Lista nominal"];
  assert.equal(sheet["A3"].v, "Classe");
  assert.equal(sheet["B3"].v, "8.ª Classe");
  assert.equal(sheet["D3"].v, "2026/2027");
  assert.equal(sheet["C4"].v, "Turmas");
  assert.equal(sheet["D4"].v, 3);
  assert.equal(sheet["B5"].v, 57);
  assert.equal(sheet["D5"].v, 55);
  assert.equal(sheet["F5"].v, 2);
  assert.equal(sheet["!autofilter"]?.ref, "A8:F63");
  assert.equal(rows[0].turma, "8.ª A");
  assert.equal(rows.at(-1)?.turma, "8.ª C");
  assert.equal(rows.find((row) => row.chamada === null)?.chamada, null);
  assert.equal(rows.filter((row) => row.nome === "Nome Repetido").length, 2);
  const sheetRows = XLSX.utils.sheet_to_json<Array<string | number>>(sheet, { header: 1 }) as Array<Array<string | number>>;
  assert.equal(sheetRows.length, 63);
  assert.equal(sheetRows.slice(8).filter((row) => String(row[1] ?? "").startsWith("0")).length, 55);
  assert.equal(new Set(sheetRows.slice(8).map((row) => String(row[3]))).size, 3);
  assert.equal(sheetRows.slice(8).find((row) => row[1] === "010054")?.[0] ?? "", "");
});

test("rota XLSX de classe inteira tem limites de escola, classe, ano, sessão e auditoria", () => {
  const route = readFileSync(new URL("../../src/app/api/secretaria/classes/[id]/alunos/xlsx/route.ts", import.meta.url), "utf8");
  for (const guard of [
    "resolveEscolaIdForUser", "authorizeTurmasManage",
    '.eq("escola_id", escolaId)', '.eq("classe_id", classeId)',
    '.eq("ano_letivo", year)', '.eq("session_id", sessionId)',
    '.in("turma_id", turmaIds)', "selectMatriculasDaLista",
    "applyKf2ListInvariants", "sortClasseNominalRows",
    "LISTA_NOMINAL_XLSX_EXPORTADA", "if (auditError) return deny",
    "Cache-Control", "polo_id", "sessionIds.size !== 1",
  ]) {
    assert.ok(route.includes(guard), "guard ausente na rota por classe: " + guard);
  }
  assert.doesNotMatch(route, /bi_numero|data_nascimento|naturalidade/);
});

test("Central de Documentos permite Excel da classe sem depender de aluno selecionado", () => {
  const hub = readFileSync(new URL("../../src/components/secretaria/QuickDocHub.tsx", import.meta.url), "utf8");
  assert.match(hub, /buildClasseDocUrl\(selectedClasse\.id, anoLetivo, includeAllStatus, modoLista, format\)/);
  assert.match(hub, /format === "excel" \? "xlsx" : "pdf"/);
  assert.match(hub, /downloadNominalExcel\(url,/);
  assert.doesNotMatch(hub, /Lista nominal por classe não tem versão Excel/);
  assert.doesNotMatch(hub, /current === "excel" \? "pdf_individual"/);
});
