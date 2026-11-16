import assert from "node:assert/strict";
import test from "node:test";
import { modoPadraoDaSessao, resumoExclusoes, selectMatriculasDaLista } from "../../src/lib/documentos/listaNominalPolicy";
const matriculas = [
  { id: "m1", status: "concluido", ativo: false },
  { id: "m2", status: "concluido", ativo: false },
  { id: "m3", status: "transferida", ativo: false },
  { id: "m4", status: "trancado", ativo: false },
  { id: "m5", status: "cancelada", ativo: false },
  { id: "m6", status: "pendente", ativo: false },
  { id: "m7", status: "ativo", ativo: true },
];
test("P0: ano anterior inclui concluidos, mesmo com activo falso", () => {
  const seleccao = selectMatriculasDaLista(matriculas, modoPadraoDaSessao(false));
  assert.deepEqual(seleccao.incluidos.map(m => m.id), ["m1", "m2", "m3", "m4", "m7"]);
  assert.equal(seleccao.incluidos.length + Object.values(seleccao.excluidos).reduce((a,b)=>a+b,0),7);
  assert.match(resumoExclusoes(seleccao.excluidos), /canceladas: 1/);
  assert.match(resumoExclusoes(seleccao.excluidos), /pendentes: 1/);
});
test("P0: lista operacional só inclui activas", () => {
  const seleccao = selectMatriculasDaLista(matriculas, modoPadraoDaSessao(true));
  assert.deepEqual(seleccao.incluidos.map(m => m.id), ["m7"]);
});
test("P0: consulta explícita inclui todos e conta", () => {
  const seleccao = selectMatriculasDaLista(matriculas,"ano_letivo",true);
  assert.equal(seleccao.incluidos.length,7);
  assert.equal(resumoExclusoes(seleccao.excluidos),"nenhuma");
});
