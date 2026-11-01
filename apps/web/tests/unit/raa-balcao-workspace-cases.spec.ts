import test from "node:test";
import assert from "node:assert/strict";
import { buildRaaBalcaoWorkspaceCases, raaBalcaoProgress } from "../../src/lib/rematricula/raa-balcao-cases";

const source = {
  primaryAction: "justificacao" as const,
  title: "Retenção por faltas",
  disciplinaIds: ["d1"],
  faltas: [{ id: "f1", data_falta: "2026-09-12", status: "pending", motivo: "Por justificar" }],
  pedidos: [{ id: "p1", protocolo_publico: "RAA-1", estado: "em_analise", motivo: "Nota de recurso" }],
  sessoes: [{ id: "s1", tipo: "recurso", estado: "aberta", data_inicio: "2026-09-17" }],
  eventos: [{ id: "e1", categoria: "Indisciplina", estado: "em_analise", descricao: "Decisão pendente" }],
};
test("consolida evidências de faltas, notas, recurso e disciplina no mesmo processo", () => {
  const items = buildRaaBalcaoWorkspaceCases(source);
  assert.deepEqual(items.map((i) => i.kind), ["justificacao", "nota", "pedido", "exame", "disciplina"]);
  assert.equal(raaBalcaoProgress(items).total, 5);
  assert.equal(raaBalcaoProgress(items).registados, 0);
});
test("uma decisão administrativa não transforma a matrícula em aprovada", () => {
  const items = buildRaaBalcaoWorkspaceCases({
    primaryAction: "rever_resultado",
    title: "RAA não homologado",
    pedidos: [{ id: "p1", protocolo_publico: "R1", estado: "deferido", motivo: "Pedido deferido" }],
  });
  assert.equal(items.some((item) => item.kind === "orientacao"), true);
  assert.equal(items.some((item) => item.estado === "registado"), true);
  assert.equal(raaBalcaoProgress(items).pendentes, 1);
});
test("não inventa notas, faltas, sessões ou ocorrências sem registos", () => {
  const items = buildRaaBalcaoWorkspaceCases({ primaryAction: "nota", title: "Notas incompletas" });
  assert.deepEqual(items.map((item) => item.kind), ["orientacao"]);
  assert.equal(raaBalcaoProgress(items).registados, 0);
});


test("faltas têm trimestre do registo oficial; notas sem período não herdam o trimestre atual", () => {
  const items = buildRaaBalcaoWorkspaceCases({
    primaryAction: "justificacao", title: "Retenção por faltas",
    disciplinaIds: ["d1"],
    faltas: [
      { id:"f1", data_falta:"2026-09-12", status:"pending", motivo:"Pedido 1", trimestre: 1 },
      { id:"f2", data_falta:"2026-11-12", status:"pending", motivo:"Pedido 2", trimestre: 2 },
      { id:"f3", data_falta:"2027-03-12", status:"pending", motivo:"Pedido 3", trimestre: null },
    ],
  });
  assert.deepEqual(items.filter((i)=>i.kind==="justificacao").map((i)=>i.periodo), [1,2,"nao_identificado"]);
  assert.equal(items.find((i)=>i.kind==="nota")?.periodo,"nao_identificado");
});
test("recurso e disciplina permanecem no contexto anual quando o registo não aponta um trimestre", () => {
  const items = buildRaaBalcaoWorkspaceCases({
    primaryAction:"reapreciacao", title:"Revisão",
    sessoes:[{ id:"s1", tipo:"recurso",estado:"aberta",data_inicio:"2026-12-15" }],
    pedidos:[{ id:"p1", protocolo_publico:"RAA-1", estado:"pendente", motivo:"Recurso" }],
    eventos:[{ id:"e1",categoria:"Conduta",estado:"em_analise",descricao:"Pendência" }],
  });
  assert.deepEqual(items.map((i)=>i.periodo),["ano_letivo","ano_letivo","ano_letivo"]);
});
