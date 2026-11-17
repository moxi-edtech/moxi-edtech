import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../../src/lib/documentos/listaNominalPdf.ts", import.meta.url), "utf8");
test("regressão P0: ano anterior não pode filtrar apenas active/ativo", () => {
  const concluidas = [{ status:"concluido",ativo:false },{status:"concluido",ativo:false}];
  const antigo = concluidas.filter(m=>m.ativo && ["ativo","ativa","active"].includes(m.status));
  assert.equal(antigo.length,0);
  assert.doesNotMatch(source, /\.eq\("ativo", true\)[\s\S]{0,80}\.in\("status", \["ativo", "ativa", "active"\]\)/);
  assert.match(source,/selectMatriculasDaLista/);
});
