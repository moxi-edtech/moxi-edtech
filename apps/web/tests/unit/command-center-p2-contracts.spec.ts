import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_EXPLORER_VIEWS, retainExplorerViewState,
  saveExplorerReturnContext, peekExplorerReturnContext, clearExplorerReturnContext,
  type ExplorerViewState, type ExplorerScope,
} from "../../src/lib/command-center/explorer-return-context";
import { withExplorerObservability } from "../../src/lib/command-center/observability";

const blank: ExplorerViewState = { page: 1, scrollTop: 0, selectedStudentId: null };
const scope: ExplorerScope = {
  userId: "operator-synthetic", escolaId: "school-synthetic",
  poloId: null, academicYearId: "year-synthetic", portal: "secretaria",
};

test("P2: 200 views remain bounded at 40 with newest keys retained", () => {
  let views: Record<string, ExplorerViewState> = {};
  for (let i = 0; i < 200; i++) {
    views = retainExplorerViewState(views, `turma:${i}`, { ...blank, page: i + 1 });
  }
  assert.equal(Object.keys(views).length, MAX_EXPLORER_VIEWS);
  assert.equal(views["turma:0"], undefined);
  assert.equal(views["turma:199"]?.page, 200);
  assert.strictEqual(retainExplorerViewState(views, "turma:199", views["turma:199"]), views);
});

test("P2: saved return snapshot caps breadcrumbs and preserves current context", () => {
  const trail = Array.from({length: 100},(_,i)=>({
    escolaId:scope.escolaId, id:`entity-${i}`,type:"turma" as const,label:`Turma ${i}`,academicYearId:scope.academicYearId,
  }));
  saveExplorerReturnContext({
    scope, escolaId:scope.escolaId,
    entityContext:trail[99], contextTrail:trail,
    courseClassId:null,courseTurmaId:null,
    viewState:Object.fromEntries(trail.map((v,i)=>[`turma:${i}`,blank])),
  });
  const current=peekExplorerReturnContext(scope);
  assert.ok(current);
  assert.equal(current.contextTrail.length,24);
  assert.equal(Object.keys(current.viewState).length,40);
  assert.equal(peekExplorerReturnContext({ ...scope, userId:"other-user" }),null);
  clearExplorerReturnContext();
});

test("P2: auxiliary API errors have stable non-PII correlation codes", async () => {
  for(const route of ["roster-search","roster-export","disciplina-search"] as const) {
    const result=await withExplorerObservability(route,async()=>
      Response.json({ok:false,error:"private synthetic query value"}, {status:429,headers:{"Retry-After":"15"}}));
    const body=await result.json();
    assert.equal(body.code,"RATE_LIMITED");
    assert.equal(result.headers.get("Retry-After"),"15");
    assert.equal(result.headers.get("X-Correlation-ID"),body.requestId);
    assert.doesNotMatch(JSON.stringify(body),/private synthetic query value/);
  }
});
