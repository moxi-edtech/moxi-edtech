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
    assert.match(route, /authorizeTurmasManage/);
    assert.match(route, /resolveEscolaIdForUser/);
    assert.doesNotMatch(route, /await requireFeature\("doc_qr_code"[^;]+;\n\n    const authz/);
  }
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

test("a impressão directa aparece nas listas e no detalhe", () => {
  const list = from("components/secretaria/TurmasListClient.tsx");
  const detail = from("components/secretaria/TurmaDetailClient.tsx");
  assert.ok((list.match(/<ImprimirListaTurmaButton/g) ?? []).length >= 2);
  assert.match(detail, /<ImprimirListaTurmaButton/);
  assert.match(list, /canPrint &&/);
  assert.match(detail, /canPrint &&/);
});
