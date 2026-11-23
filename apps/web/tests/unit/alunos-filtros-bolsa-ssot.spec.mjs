import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const src = (path) => readFileSync(new URL("../../src/" + path, import.meta.url), "utf8");
const service = src("lib/services/alunos.service.ts");
const schema = src("lib/schemas/aluno.schema.ts");
const admin = src("components/escola-admin/AlunosListClient.tsx");
const secretaria = src("components/secretaria/AlunosSecretariaPage.tsx");
const exportRenderer = src("lib/services/alunosExport.server.ts");
const exportAdmin = src("app/api/escolas/[id]/admin/alunos/exportar/route.ts");
const exportSecretaria = src("app/api/secretaria/alunos/exportar/route.ts");
const adminPage = src("app/escola/[id]/(portal)/admin/alunos/page.tsx");

test("os quatro filtros são aceites e validados na API", () => {
  assert.match(schema, /bolsa: z\.enum\(\["sim", "nao"\]\)/);
  assert.match(schema, /classeId: z\.string\(\)\.uuid\(\)/);
  assert.match(schema, /turno: z\.enum\(\["manha", "tarde", "noite"\]\)/);
  for (const key of ["bolsa", "classe_id", "turno", "turma_id"]) {
    assert.match(service, new RegExp('url\\.searchParams\\.get\\("'+key+'"\\)'));
  }
});

test("a bolsa é a matrícula SSOT no ano selecionado, nunca o valor de mensalidade", () => {
  assert.match(service, /"id, aluno_id, status, turma_id, created_at, updated_at, numero_chamada, session_id, bolsa_integral"/);
  assert.match(service, /\.from\("matriculas"\)/);
  assert.match(service, /\.eq\("escola_id", escolaId\)/);
  assert.match(service, /matriculasQuery = matriculasQuery\.eq\("session_id", options\.academicYearId\)/);
  assert.match(service, /matriculasQuery = matriculasQuery\.eq\("ano_letivo", targetAno\)/);
  assert.match(service, /row\.bolsa_integral === true/);
  assert.match(service, /row\.bolsa_integral === \(filters\.bolsa === "sim"\)/);
  assert.match(service, /bolsa_integral: null/); // sem matrícula não é "não bolseiro"
});

test("classe e turno derivam da turma correta, incluindo M/T/N", () => {
  assert.match(service, /classes \( nome \)/);
  assert.match(service, /classe_id: turma\?\.classe_id/);
  assert.match(service, /turnoCanonico\(row\.turno\) === filters\.turno/);
  assert.match(adminPage, /eq\("ano_letivo", Number\(anoAtivo\.ano\)\)/);
});

test("a paginação filtrada não perde alunos no meio do lote", () => {
  assert.match(service, /const remaining = pageLimit - items\.length/);
  assert.match(service, /mapped\.find\(\(row: AlunoListItem\) => row\.id === lastReturned\?\.id\)/);
  assert.match(service, /items = items\.concat\(enriched\.slice\(0, remaining\)\)/);
  assert.match(service, /throw new Error\("A exportação excede o limite seguro/);
});

test("Admin e Secretaria passam os mesmos filtros à listagem e exportação", () => {
  for (const page of [admin, secretaria]) {
    for (const key of ["bolsa", "classe_id", "turno", "turma_id"]) {
      assert.match(page, new RegExp('params\\.set\\("'+key+'"|searchParams\\.set\\("'+key+'"'));
    }
    assert.match(page, /Bolseiros/);
    assert.match(page, /Não bolseiros/);
    assert.match(page, /Todas as classes/);
    assert.match(page, /Todos os turnos/);
  }
  assert.match(exportAdmin, /listAllAlunos\(/);
  assert.match(exportSecretaria, /listAllAlunos\(/);
  assert.match(exportSecretaria, /academicYearId:/);
});

test("Excel e PDF incluem classe, turno e status real da bolsa", () => {
  assert.match(exportRenderer, /key: "classe_nome", label: "Classe"/);
  assert.match(exportRenderer, /key: "turno", label: "Turno"/);
  assert.match(exportRenderer, /key: "bolsa_integral", label: "Bolseiro"/);
  assert.match(exportRenderer, /value === true \? "Sim" : value === false \? "Não"/);
  assert.match(exportRenderer, /renderNominalA4\(/);
  assert.match(exportRenderer, /key: "bolsa", label: "Bolsa"/);
  assert.match(exportRenderer, /camposSensiveis: true/);
  assert.match(exportRenderer, /logoBytes: context\.logoBytes/);
});

test("PDF geral partilha template institucional da lista nominal e recebe dados da escola", () => {
  const nominal = src("lib/documentos/nominalA4.ts");
  const meta = src("lib/services/alunosExportPdfContext.server.ts");
  assert.match(nominal, /titulo\?: string/);
  assert.match(nominal, /colunas\?: readonly/);
  assert.match(nominal, /contexto\?: readonly string\[\]/);
  assert.match(nominal, /Gerado pelo KLASSE/);
  assert.match(nominal, /Assinatura da Direcção/);
  assert.match(nominal, /Página /);
  assert.match(meta, /\.from\("escolas"\)/);
  assert.match(meta, /\.eq\("id", escolaId\)/);
  assert.match(meta, /\.from\("anos_letivos"\)/);
  assert.match(exportAdmin, /loadAlunosPdfInstitutionalContext/);
  assert.match(exportSecretaria, /loadAlunosPdfInstitutionalContext/);
});
