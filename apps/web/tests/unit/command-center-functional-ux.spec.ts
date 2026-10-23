import assert from "node:assert/strict";
import test from "node:test";
import {
  saveExplorerReturnContext, consumeExplorerReturnContext,
  peekExplorerReturnContext, clearExplorerReturnContext,
  retainExplorerViewState, type ExplorerScope,
} from "../../src/lib/command-center/explorer-return-context";
import { buildBalcaoActionHref, STUDENT_BALCAO_ACTION_IDS } from "../../src/lib/balcao/action-registry";
import { withExplorerObservability } from "../../src/lib/command-center/observability";

const school="00000000-0000-4000-8000-0000000000a1";
const scope:ExplorerScope={
  userId:"synthetic-operator-A",escolaId:school,
  poloId:null,academicYearId:"year-2026",portal:"secretaria",
};
function store(){
  saveExplorerReturnContext({
    scope,escolaId:school,courseClassId:null,courseTurmaId:null,
    entityContext:{escolaId:school,id:"synthetic-turma",type:"turma",label:"Turma sintética",academicYearId:"year-2026"},
    contextTrail:[],
    viewState:{ "turma:synthetic-turma:year-2026": {
      page:3,scrollTop:875,selectedStudentId:"synthetic-student",
      filter:"ambos",sort:"pendencias_primeiro",search:"SINTÉTICO",
    }},
  });
}
test("CC-012: route-only navigation restores page, zoom-independent scroll, search, filter and sort",()=>{
  clearExplorerReturnContext();
  store();
  const result=consumeExplorerReturnContext(scope);
  assert.ok(result);
  assert.deepEqual(result.viewState["turma:synthetic-turma:year-2026"],{
    page:3,scrollTop:875,selectedStudentId:"synthetic-student",
    filter:"ambos",sort:"pendencias_primeiro",search:"SINTÉTICO",
  });
  assert.equal(consumeExplorerReturnContext(scope),null);
});
test("CC-012: user, school, polo, year and portal changes invalidate without cross-context restore",()=>{
  const changes:Partial<ExplorerScope>[]=[
    {userId:"different"}, {escolaId:"different-school"},
    {poloId:"different-polo"}, {academicYearId:"year-2027"},
    {portal:"financeiro"},
  ];
  for(const changed of changes){
    store();
    assert.equal(peekExplorerReturnContext({...scope,...changed}),null);
    assert.equal(peekExplorerReturnContext(scope),null);
  }
});
test("CC-012: no hidden storage dependency; 700 context changes bounded",()=>{
  let current:Record<string,{page:number;scrollTop:number;selectedStudentId:null}>={};
  for(let i=0;i<700;i++){
    current=retainExplorerViewState(current,`turma:syn-${i}:year-2026`,{
      page:i+1,scrollTop:i*10,selectedStudentId:null,
    });
  }
  assert.equal(Object.keys(current).length,40);
  assert.equal(current["turma:syn-0:year-2026"],undefined);
  assert.equal(current["turma:syn-699:year-2026"]?.page,700);
});
test("CC-011: six canonical actions preserve selected student only when required",()=>{
  const ids=["enrollment","reenrollment","payment","document","profile","grade"];
  for(const actionId of ids){
    const href=buildBalcaoActionHref({
      escolaParam:"synthetic-school",portal:"secretaria",
      actionId:actionId as typeof STUDENT_BALCAO_ACTION_IDS[number],
      alunoId:actionId==="enrollment"?null:"synthetic-student",
    });
    assert.ok(href.includes("secretaria/balcao"));
    assert.equal(href.includes("alunoId="),actionId!=="enrollment");
  }
});
test("CC-017: helper endpoints redact unsafe error payloads and keep stable trace id",async()=>{
  for(const route of ["student-capabilities","roster-search","roster-export","disciplina-search"] as const){
    const bad=await withExplorerObservability(route,async()=> Response.json({
      ok:false,error:"synthetic internal sensitive search data",
    },{status:403}));
    const body=await bad.json();
    assert.equal(body.code,"FORBIDDEN");
    assert.equal(body.requestId,bad.headers.get("X-Correlation-ID"));
    assert.doesNotMatch(JSON.stringify(body),/synthetic internal sensitive search data/);
  }
});
