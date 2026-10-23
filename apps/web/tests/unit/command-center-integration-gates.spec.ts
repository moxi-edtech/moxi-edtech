import assert from "node:assert/strict";
import test from "node:test";
import {
  clearExplorerReturnContext, consumeExplorerReturnContext, peekExplorerReturnContext,
  saveExplorerReturnContext, type ExplorerScope,
} from "../../src/lib/command-center/explorer-return-context";
import {
  buildBalcaoActionHref,
  getStudentBalcaoActions,
} from "../../src/lib/balcao/action-registry";
import { resolveExplorerStudentCapabilities } from "../../src/lib/command-center/student-capabilities";

const scope:ExplorerScope={
  userId:"fixture-operator-A",escolaId:"fixture-school-A",
  poloId:null,academicYearId:"fixture-year-2026",portal:"secretaria",
};
const users=["fixture-student-01","fixture-student-02","fixture-student-03"];

function selectStudent(id:string) {
  saveExplorerReturnContext({
    scope,escolaId:scope.escolaId,
    entityContext:{escolaId:scope.escolaId,id:"fixture-turma",
      academicYearId:scope.academicYearId,type:"turma",label:"Turma fictícia"},
    contextTrail:[],courseClassId:null,courseTurmaId:null,
    viewState:{"turma:fixture-turma:fixture-year-2026":{
      page:1,scrollTop:234,search:"",sort:"pendencias_primeiro",
      filter:"documentos_sinalizados",selectedStudentId:id,
    }},
  });
}

test("D: three consecutive student services never expose previous student context",()=>{
  clearExplorerReturnContext();
  for(const id of users) {
    selectStudent(id);
    const resumed=consumeExplorerReturnContext(scope);
    assert.ok(resumed);
    assert.equal(resumed.viewState["turma:fixture-turma:fixture-year-2026"]?.selectedStudentId,id);
    assert.equal(consumeExplorerReturnContext(scope),null);
    for(const other of users.filter(value=>value!==id)) {
      assert.notEqual(
        resumed.viewState["turma:fixture-turma:fixture-year-2026"]?.selectedStudentId,other);
    }
  }
});

test("D: a changed operator, school, polo, year or portal invalidates old service",()=>{
  const otherScopes:ExplorerScope[]=[
    {...scope,userId:"fixture-operator-B"},
    {...scope,escolaId:"fixture-school-B"},
    {...scope,poloId:"fixture-polo-Y"},
    {...scope,academicYearId:"fixture-year-2027"},
    {...scope,portal:"financeiro"},
  ];
  for(const changed of otherScopes) {
    selectStudent(users[0]);
    assert.equal(peekExplorerReturnContext(changed),null);
    assert.equal(peekExplorerReturnContext(scope),null);
  }
});

test("D: six existing actions and new enrollment have distinct safe context",()=>{
  const actions=getStudentBalcaoActions();
  for(const action of actions) {
    if(!["enrollment","reenrollment","payment","document","profile","grade"].includes(action.id)) continue;
    const url=buildBalcaoActionHref({
      escolaParam:"fixture-school-A",
      actionId:action.id,portal:"secretaria",
      alunoId:action.id==="enrollment"?null:users[2],
    });
    assert.equal(new URL(url,"https://fixture.invalid").searchParams.get("alunoId"),
      action.id==="enrollment"?null:users[2]);
  }
  const studentCapabilities=resolveExplorerStudentCapabilities("aluno");
  assert.equal(Object.values(studentCapabilities).some(Boolean),false);
  const unknown=resolveExplorerStudentCapabilities("cargo-invalido");
  assert.equal(Object.values(unknown).some(Boolean),false);
});
