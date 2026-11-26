import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=(p)=>readFileSync(new URL("../../src/"+p,import.meta.url),"utf8");
test("Central de Provas embeds the existing evaluation calendar and preserves portal access",()=>{
 const w=read("components/provas/ProvasWorkspace.tsx");
 const c=read("components/academico/CalendarioAvaliacoesClient.tsx");
 const q=read("components/layout/escola-admin/QuickActionsSection.tsx");
 assert.match(w,/PortalTabs</);
 assert.match(w,/CalendarioAvaliacoesClient escolaId=\{escolaId\} embedded active=/);
 assert.match(w,/calendarVisited&&<CalendarioAvaliacoesClient/);
 assert.match(w,/tab==="historico"\?"&estado=arquivada"/);
 assert.match(c,/escolaId \?\? params\?\.id/);
 assert.match(c,/embedded\?"div":"main"/);
 assert.doesNotMatch(q,/href: buildPortalHref\(escolaParam, "\/operacoes\/academico\/calendario-avaliacoes"\)/);
 assert.match(q,/href: buildPortalHref\(escolaParam, "\/operacoes\/provas"\)/);
 assert.match(read("app/api/escola/[id]/provas/route.ts"),/list\.neq\("estado","arquivada"\)/);
});

test("Central de Provas uses progressive disclosure instead of permanent explanatory copy",()=>{
 const w=read("components/provas/ProvasWorkspace.tsx");const c=read("components/academico/CalendarioAvaliacoesClient.tsx");
 assert.match(w,/<details key=\{tab\}/);assert.match(w,/Filtros \{Object.keys\(filters\).length/);
 assert.doesNotMatch(w,/Elabore, reveja e imprima avaliações|A leitura no ecrã é contínua/);
 assert.match(c,/useState\(!embedded\)/);assert.match(c,/hidden=\{!planningOpen\}/);
 assert.match(w,/cotacao\.ready/);assert.match(c,/assessmentPlanOverlaps/);
 assert.doesNotMatch(c,/A alteração fica auditada|Apenas turmas ativas do ano letivo/);
});
