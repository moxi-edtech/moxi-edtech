import test from "node:test";
import assert from "node:assert/strict";
import { resolveRaaTrimestre, matchesRaaPeriodFilter, raaCasePeriodLabel } from "../../src/lib/rematricula/raa-balcao-temporal-context";

const ano="academic-year-source";
const map=new Map([
  ["p1", { numero:1, tipo:"TRIMESTRE", ano_letivo_id:ano }],
  ["p2", { numero:2, tipo:"TRIMESTRE", ano_letivo_id:ano }],
  ["p3", { numero:3, tipo:"TRIMESTRE", ano_letivo_id:ano }],
  ["other", { numero:2, tipo:"TRIMESTRE", ano_letivo_id:"different-year" }],
  ["exam", { numero:2, tipo:"EXAME", ano_letivo_id:ano }],
]);
test("each trimester is derived from the explicit official period, not the absence date",()=>{
  assert.equal(resolveRaaTrimestre({periodo_letivo_id:"p1"},map,ano),1);
  assert.equal(resolveRaaTrimestre({periodo_letivo_id:"p2"},map,ano),2);
  assert.equal(resolveRaaTrimestre({periodo_letivo_id:"p3"},map,ano),3);
});
test("other-year, non-trimester, missing and unknown periods never receive a guessed trimester",()=>{
  for(const id of ["other","exam","missing",null]){
    assert.equal(resolveRaaTrimestre({periodo_letivo_id:id},map,ano),null);
  }
  assert.equal(resolveRaaTrimestre({periodo_letivo_id:"p2"},map,null),null);
});
test("annual and unattributed evidence stays visible in all and in Outros, not in a trimester",()=>{
  assert.equal(matchesRaaPeriodFilter("ano_letivo","todos"),true);
  assert.equal(matchesRaaPeriodFilter("ano_letivo","2"),false);
  assert.equal(matchesRaaPeriodFilter("ano_letivo","outros"),true);
  assert.equal(matchesRaaPeriodFilter("nao_identificado","3"),false);
  assert.equal(matchesRaaPeriodFilter(2,"2"),true);
  assert.equal(matchesRaaPeriodFilter(1,"2"),false);
  assert.equal(raaCasePeriodLabel("nao_identificado"),"Trimestre por confirmar");
});
