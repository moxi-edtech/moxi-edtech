import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildRaaBalcaoWorkspaceCases,
  raaBalcaoProgress,
} from "../../src/lib/rematricula/raa-balcao-cases";
import { matchesRaaPeriodFilter } from "../../src/lib/rematricula/raa-balcao-temporal-context";

const read = (file: string) => readFileSync(resolve(process.cwd(), "src", file), "utf8");

test("a filter never moves unrelated yearly evidence into a selected trimester", () => {
  const cases=buildRaaBalcaoWorkspaceCases({
    primaryAction:"justificacao",title:"Aguardar decisão",
    disciplinaIds:["d1"],
    faltas:[
      {id:"f1",data_falta:"2026-09-12",status:"pending",motivo:"A",trimestre:1},
      {id:"f2",data_falta:"2026-12-12",status:"approved",motivo:"B",trimestre:2},
      {id:"f3",data_falta:"2027-03-12",status:"pending",motivo:"C",trimestre:3},
      {id:"f4",data_falta:"2027-04-02",status:"pending",motivo:"D",trimestre:null},
    ],
    pedidos:[{id:"p1",protocolo_publico:"RAA-12",estado:"pendente",motivo:"Pedido"}],
    sessoes:[{id:"s1",tipo:"recurso",estado:"aberta",data_inicio:"2027-07-11"}],
    eventos:[{id:"e1",categoria:"Ocorrência",estado:"em_analise",descricao:"Em análise"}],
  });
  assert.deepEqual(cases.filter((c)=>matchesRaaPeriodFilter(c.periodo,"1")).map((c)=>c.id),["falta:f1"]);
  assert.deepEqual(cases.filter((c)=>matchesRaaPeriodFilter(c.periodo,"2")).map((c)=>c.id),["falta:f2"]);
  assert.deepEqual(cases.filter((c)=>matchesRaaPeriodFilter(c.periodo,"3")).map((c)=>c.id),["falta:f3"]);
  assert.equal(cases.filter((c)=>matchesRaaPeriodFilter(c.periodo,"outros")).length,5);
  assert.equal(raaBalcaoProgress(cases).total,8);
});

test("the attendance API resolves period via attendance ID, tenant and origin school year", () => {
  const api=read("app/api/secretaria/faltas/justificacoes/route.ts");
  assert.match(api, /\.eq\("matricula_id", matriculaId\)\.in\("id", idsFrequencia\)/);
  assert.match(api, /\.eq\("ano_letivo_id", source\.session_id\)/);
  assert.match(api, /resolveRaaTrimestre\(/);
  assert.match(api, /trimestre: trimesterByPetition\.get\(item\.id\) \?\? null/);
  assert.doesNotMatch(api, /new Date\(item\.data_falta\)/);
});

test("UI filters are declarative; no mutation changes the canonical trimester or progression", () => {
  const ui=read("components/secretaria/RaaBalcaoResolutionPanel.tsx");
  assert.match(ui,/Filtrar pendências por trimestre/);
  assert.match(ui,/matchesRaaPeriodFilter\(item\.periodo, periodFilter\)/);
  assert.match(ui,/setPeriodFilter\(next\)/);
  assert.match(ui,/goToSummary/);
  assert.match(ui,/iraaCasePeriodLabel|raaCasePeriodLabel\(item\.periodo\)/);
  assert.doesNotMatch(ui,/update\s+public\.periodos_letivos/i);
});

test("grade form reconfirms an optional trimester with canonical MED periods and legal lock",()=>{
  const modal=read("components/secretaria/EnrollmentPostActionModal.tsx");
  const balc=read("components/secretaria/BalcaoAtendimento.tsx");
  assert.match(balc,/initialTrimestre: trimestre \?\? null/);
  assert.match(modal,/item\.numero === initialTrimestre && item\.disciplina_ativa/);
  assert.match(modal,/item\.estado !== "future"/);
  assert.match(modal,/periodReadOnly/);
  assert.match(modal,/\/api\/secretaria\/notas\/periodos/);
});
