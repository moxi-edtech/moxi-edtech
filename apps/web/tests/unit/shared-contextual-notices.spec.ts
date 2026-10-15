import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
const base = new URL("../../src/components/",import.meta.url);
const read=(name:string)=>readFileSync(new URL(name,base),"utf8");
test("Notice is added to the existing alert primitive without replacing backwards compatibility",()=>{
 const ui=read("ui/alert.tsx");
 assert.match(ui,/export \{ Alert, AlertTitle, AlertDescription \}/);
 assert.match(ui,/export function Notice\(/);
 assert.match(ui,/min-h-11/);
 assert.match(ui,/focus-visible:ring/);
});
test("rematricula preserves payment initiation, upload, refresh and RAA contracts",()=>{
 const ui=read("aluno/home/RematriculaBanner.tsx");
 for(const p of ["'/api/aluno/rematricula/status'","'/api/aluno/rematricula/iniciar'","'/api/aluno/documentos/comprovativo'","paymentIntent?.id","ACADEMIC_PROMOTION_PENDING","ACADEMIC_REVIEW_REQUIRED","ACADEMIC_CONDITIONAL_BLOCKED","REMATRICULA_DEBT_REQUIRED","selectedServices","uploadProgress"])assert.ok(ui.includes(p),p);
 assert.match(ui,/paymentIntent\?\.has_evidence/);
 assert.match(ui,/disabled=\{busy\}/);
 assert.match(ui,/rejectedEvidence/);
 assert.match(ui,/Reenviar comprovativo/);
 assert.match(ui,/Ver estado do pedido/);
 assert.match(ui,/<Notice/);
});
test("financial notices reuse same presentation and route to actual financial portal",()=>{
 const ui=read("aluno/home/FinanceAlertBanner.tsx");
 assert.match(ui,/<Notice/);
 assert.match(ui,/href="\/aluno\/financeiro"/);
 assert.doesNotMatch(ui,/<Button[^>]*>Pagar Agora/);
});

test("recent notices consume canonical component without a parallel API",()=>{ const ui=read("aluno/dashboard/AvisosRecentesCard.tsx"); assert.match(ui,/from ["\x27]@\/components\/ui\/alert["\x27]/); assert.match(ui,/<Notice title=/); assert.doesNotMatch(ui,/components\/ui\/notice/); });
