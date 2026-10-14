import assert from "node:assert/strict";
import test from "node:test";
import {availablePeriods,chooseInitialPeriod,periodAssessments,formatPublishedGrade,accessPresentation} from "../../src/lib/aluno/gradesPresentation";
const course={id:"synthetic-math",nome:"Matemática",avaliacoes:[{nome:"Prova",tipo:"prova",trimestre:2,nota:16},{nome:"Trabalho",tipo:"trabalho",trimestre:1,nota:17}]};
test("períodos provêm da API, nunca hardcode, seleciona o mais recente publicado",()=>{
 assert.deepEqual(availablePeriods([course]),[1,2]);
 assert.equal(chooseInitialPeriod([course]),2);
 assert.equal(chooseInitialPeriod([course],1),1);
 assert.equal(chooseInitialPeriod([]),null);
});
test("filtra por período e preserva notas reais sem médias calculadas",()=>{
 assert.deepEqual(periodAssessments(course,2).map(v=>v.nota),[16]);
 assert.deepEqual(periodAssessments(course,3),[]);
});
test("formatação pt-AO respeita dados sem escala ou arredondamento arbitrários",()=>{
 assert.equal(formatPublishedGrade(17.25),new Intl.NumberFormat("pt-AO",{maximumFractionDigits:12,useGrouping:false}).format(17.25));
 assert.equal(formatPublishedGrade(0),new Intl.NumberFormat("pt-AO",{maximumFractionDigits:12,useGrouping:false}).format(0));
});
test("quatro estados e ação única de pagamento",()=>{
 assert.equal(accessPresentation("available").action,"Pagar boletim");
 assert.equal(accessPresentation("pending").action,"Acompanhar pagamento");
 assert.match(accessPresentation("pending").message,/não precisas de pagar outra vez/);
 assert.equal(accessPresentation("rejected","Ficheiro ilegível").action,"Reenviar no mesmo pedido");
 assert.match(accessPresentation("rejected","Ficheiro ilegível").message,/Ficheiro ilegível/);
 assert.equal(accessPresentation("granted").action,"Acompanhar pagamento");
});
test("notas protegidas nunca aparecem quando API nega is_liberado; modal preserva contratos",async()=>{
 const fs=await import("node:fs/promises");
 const ui=await fs.readFile(new URL("../../src/components/aluno/tabs/TabNotas.tsx",import.meta.url),"utf8");
 assert.match(ui,/json\.is_liberado \? json\.disciplinas \?\? \[\] : \[\]/);
 assert.match(ui,/!isLiberado \?/);
 assert.match(ui,/reapreciacao/);
 assert.match(ui,/melhoria/);
 assert.doesNotMatch(ui,/toFixed\(|Math\.round\(|reduce\([^\n]*(nota|media)/);
 const api=await fs.readFile(new URL("../../src/app/api/aluno/boletim/route.ts",import.meta.url),"utf8");
 const pdf=await fs.readFile(new URL("../../src/app/api/aluno/boletim/pdf/route.ts",import.meta.url),"utf8");
 for(const source of [api,pdf]){
  assert.match(source,/checkBoletimAccess\(/);
  assert.match(source,/resolveBoletimMatricula\(/);
  assert.match(source,/resolveAuthorizedStudentIds\(/);
 }
 assert.match(api,/is_liberado: false[^\n]*disciplinas: \[\]/);
 assert.match(pdf,/!access\.granted\)[^\n]*403/);
});
test("seleção de duas matrículas preserva ano e aluno nas APIs de notas e PDF", async()=>{
 const fs=await import("node:fs/promises");
 const ui=await fs.readFile(new URL("../../src/components/aluno/tabs/TabNotas.tsx",import.meta.url),"utf8");
 assert.match(ui,/bulletinParams\.set\("studentId", studentId\)/);
 assert.match(ui,/bulletinParams\.set\("ano_letivo_id", academicYearId\)/);
 assert.match(ui,/api\/aluno\/boletim\/pdf\$\{bulletinQuery\}/);
});
