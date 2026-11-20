import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const from = (file: string) =>
  readFileSync(new URL("../../src/" + file, import.meta.url), "utf8");

test("a lista nominal simples não exige plano com QR", () => {
  for (const file of [
    "app/api/secretaria/turmas/[id]/alunos/pdf/route.ts",
    "app/api/secretaria/classes/[id]/alunos/pdf/route.ts",
  ]) {
    const route = from(file);
    assert.match(route, /if \(enableQr/);
    assert.match(route, /authorizeNominalExport/);
    assert.doesNotMatch(route, /await requireFeature\("doc_qr_code"[^;]+;\n\n    const authz/);
  }
  const service = from("lib/documentos/listaNominalService.ts");
  assert.match(service, /authorizeTurmasManage/);
  assert.match(service, /resolveEscolaIdForUser/);
  const renderer = from("lib/documentos/listaNominalPdf.ts");
  assert.match(renderer, /enableQr = false/);
  assert.match(renderer, /enableQr \? randomUUID\(\) : undefined/);
});

test("a execução não duplica cliques e tem erro recuperável", () => {
  const component = from("components/secretaria/ImprimirListaTurmaButton.tsx");
  assert.match(component, /if \(ocupado\.current\) return/);
  assert.match(component, /response\.ok/);
  assert.match(component, /aria-busy=/);
  assert.match(component, /Tentar de novo/);
  assert.match(component, /PDF pronto/);
});

test("detalhe de Turmas aplica as margens partilhadas como expressões JSX", () => {
  const detail = from("components/secretaria/TurmaDetailClient.tsx");
  assert.equal((detail.match(/className=\{`\$\{PORTAL_PAGE_HORIZONTAL_INSET\}/g) ?? []).length, 3);
  assert.doesNotMatch(detail, /className="\$\{PORTAL_PAGE_HORIZONTAL_INSET\}/);
});

test("a impressão directa aparece nas listas e no detalhe", () => {
  const list = from("components/secretaria/TurmasListClient.tsx");
  const detail = from("components/secretaria/TurmaDetailClient.tsx");
  assert.ok((list.match(/<ImprimirListaTurmaButton/g) ?? []).length >= 2);
  assert.match(detail, /<ImprimirListaTurmaButton/);
  assert.match(list, /canPrint &&/);
  assert.match(detail, /canPrint &&/);
});

test("todos os atalhos individuais utilizam a mesma ordem nominal explícita", () => {
  const button = from("components/secretaria/ImprimirListaTurmaButton.tsx");
  const list = from("components/secretaria/TurmasListClient.tsx");
  const detail = from("components/secretaria/TurmaDetailClient.tsx");
  assert.match(button, /order = "nome_asc"/);
  assert.match(button, /encodeURIComponent\(order\)/);
  assert.match(button, /\[turmaId, order\]/);
  assert.ok((list.match(/order=\{nominalOrder\}/g) ?? []).length >= 2);
  assert.match(list, /nominalOrder=\{nominalOrder\}/);
  assert.match(list, /Ordem dos alunos na impressão/);
  assert.match(detail, /order=\{nominalOrder\}/);
  assert.match(detail, /params\.set\("order", nominalOrder\)/);
  assert.match(detail, /Ordenar alunos por nome na lista da turma/);
});
