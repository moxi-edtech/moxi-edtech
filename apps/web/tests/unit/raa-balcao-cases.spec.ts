import test from "node:test";
import assert from "node:assert/strict";
import { buildRaaBalcaoCases, raaBalcaoProgress } from "../../src/lib/rematricula/raa-balcao-cases";

test("a lista usa pedidos reais sem fabricar casos para completar o progresso", () => {
  const items=buildRaaBalcaoCases({
    action:"justificacao",title:"Retenção por faltas",
    faltas:[
      {id:"f1",data_falta:"2026-09-12",motivo:"Atestado apresentado",status:"pending"},
      {id:"f2",data_falta:"2026-09-18",motivo:"Pedido analisado",status:"approved"},
    ],
  });
  assert.equal(items.length,2);
  assert.deepEqual(raaBalcaoProgress(items),{total:2,registados:1,pendentes:1});
  assert.equal(items[0].referenceId,"f1");
});

test("não mostrar pedido deferido como autorização de rematrícula", () => {
  const items=buildRaaBalcaoCases({
    action:"reapreciacao",title:"Recurso académico",
    pedidos:[{id:"p1",protocolo_publico:"RAA-1",estado:"deferido",motivo:"Motivo"}],
    sessoes:[{id:"s1",tipo:"recurso",estado:"aberta",data_inicio:"2026-10-01"}],
  });
  assert.equal(items[0].estado,"registado");
  assert.equal(items[1].estado,"pendente");
  assert.equal(raaBalcaoProgress(items).pendentes,1);
});

test("bloqueio sem pedidos tem orientação, sem fingir que está resolvido", () => {
  for (const action of ["justificacao","reapreciacao","nota","disciplina","documentos","rever_resultado"] as const) {
    const cases=buildRaaBalcaoCases({action,title:"Decisão oficial"});
    assert.equal(cases.length,1);
    assert.equal(cases[0].estado,"pendente");
  }
});
