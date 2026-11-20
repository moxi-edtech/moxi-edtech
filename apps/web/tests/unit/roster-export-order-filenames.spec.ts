import assert from "node:assert/strict";
import test from "node:test";
import { selectAndSortNominalMatriculas, type NominalMatricula } from "../../src/lib/documentos/listaNominalService";
import {
  parseNominalNameOrder, nominalExportFilename, nominalContentDisposition,
  downloadFilenameFromDisposition,
} from "../../src/lib/documentos/nominalExportOptions";

const matriculas: NominalMatricula[] = [
  ["m1", "Zuleica Alberto", 2],
  ["m2", "Álvaro Chissola", 4],
  ["m3", "Ana de Sousa", 1],
  ["m4", "ana de Sousa", 3],
  ["m5", null, 5],
].map(([id, nome, chamada]) => ({
  id: String(id), turma_id: "t1", numero_chamada: Number(chamada),
  ativo: true, status: "ativo",
  alunos: { id: String(id), nome: nome as string | null, numero_processo: String(chamada) },
}));

const names = (order: "nome_asc" | "nome_desc") =>
  selectAndSortNominalMatriculas(matriculas, {
    mode: "operacional", isClasseScope: false, order,
    turmaById: new Map([["t1", { nome: "6ª A" }]]),
  }).sortedMatriculas.map(row =>
    (Array.isArray(row.alunos) ? row.alunos[0] : row.alunos)?.nome ?? null
  );

test("A–Z e Z–A ordenam por nome com collation portuguesa sem alterar chamadas", () => {
  assert.deepEqual(names("nome_asc"), ["Álvaro Chissola", "Ana de Sousa", "ana de Sousa", "Zuleica Alberto", null]);
  assert.deepEqual(names("nome_desc"), ["Zuleica Alberto", "Ana de Sousa", "ana de Sousa", "Álvaro Chissola", null]);
  assert.equal(matriculas[0].numero_chamada, 2);
  assert.equal(parseNominalNameOrder(null), "nome_asc");
  assert.equal(parseNominalNameOrder("nome_desc"), "nome_desc");
  assert.equal(parseNominalNameOrder("chamada"), null);
});

test("ficheiros têm nomes legíveis, sem separadores inseguros nem UUID", () => {
  const filename = nominalExportFilename({
    scope: "turma", classe: "6ª Classe", turma: "Turma A", ano: "2026/2027", extension: "pdf",
  });
  assert.equal(filename, "Lista de Turma - 6ª Classe - Turma A - 2026-2027.pdf");
  assert.equal(downloadFilenameFromDisposition(nominalContentDisposition(filename)), filename);
  const unsafe = nominalExportFilename({
    scope: "classe", classe: "5ª/Classe:\\E", ano: "2026/2027", extension: "xlsx",
  });
  assert.equal(unsafe.includes("/"), false);
  assert.equal(unsafe.includes("\\"), false);
  assert.equal(unsafe.endsWith(".xlsx"), true);
  assert.equal(downloadFilenameFromDisposition('attachment; filename="../../etc/passwd"'), null);
});
