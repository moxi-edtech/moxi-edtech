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
 assert.equal(accessPresentation("available").action,"Solicitar boletim");
 assert.equal(accessPresentation("pending_payment").action,"Continuar pagamento");
 assert.equal(accessPresentation("pending").action,"Acompanhar pedido");
 assert.match(accessPresentation("pending").message,/secretaria está a verificar/);
 assert.equal(accessPresentation("rejected","Ficheiro ilegível").action,"Corrigir comprovativo");
 assert.match(accessPresentation("rejected","Ficheiro ilegível").message,/Ficheiro ilegível/);
 assert.equal(accessPresentation("granted").action,"Ver pedido");
});
test("notas protegidas nunca aparecem quando API nega is_liberado; modal preserva contratos",async()=>{
 const fs=await import("node:fs/promises");
 const ui=await fs.readFile(new URL("../../src/components/aluno/tabs/TabNotas.tsx",import.meta.url),"utf8");
 assert.match(ui,/json\.is_liberado \? json\.disciplinas \?\? \[\] : \[\]/);
 assert.match(ui,/!safeIsLiberado \?/);
 assert.match(ui,/reapreciacao/);
 assert.match(ui,/melhoria/);
 assert.doesNotMatch(ui,/toFixed\(|Math\.round\(|reduce\([^\n]*(nota|media)/);
 const api=await fs.readFile(new URL("../../src/app/api/aluno/boletim/route.ts",import.meta.url),"utf8");
 const pdf=await fs.readFile(new URL("../../src/app/api/aluno/boletim/pdf/route.ts",import.meta.url),"utf8");
 for(const source of [api,pdf]){
  assert.match(source,/checkBoletimAccess\(/);
  assert.match(source,/resolveBoletimMatricula\(/);
  // getAlunoContext valida os vínculos uma vez por pedido; ambas as rotas
  // reutilizam apenas os IDs autorizados nesse contexto.
  assert.match(source,/getAlunoContext\(\)/);
  assert.match(source,/const authorizedIds = ctx\.alunoIds;/);
  assert.match(source,/resolveSelectedStudentId\(/);
  assert.doesNotMatch(source,/resolveAuthorizedStudentIds\(/);
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

test("contexto sintético A e B: IDs autorizados mantêm isolamento e aluno com matrículas diferentes mantém seleção",async()=>{
 const {resolveSelectedStudentId,resolveAuthorizedStudentIds}=await import("../../src/lib/portalAlunoAuth");
 const rows=[
  {id:"synthetic-student-A",profile_id:"synthetic-user-A",escola_id:"synthetic-school-A"},
  {id:"synthetic-student-B",profile_id:"synthetic-user-B",escola_id:"synthetic-school-B"},
 ];
 const client={
  from(table:string){
   const where:Record<string,string>={};
   const query={
    select(_columns:string){return query;},
    eq(field:string,value:string){where[field]=value;return query;},
    limit(_count:number){return query;},
    async maybeSingle(){return {data:null};},
    then(resolve:(v:{data:typeof rows})=>unknown){return Promise.resolve({data:table==="alunos"?rows.filter(x=>Object.entries(where).every(([k,v])=>x[k as keyof typeof x]===v)):[]}).then(resolve);}
   };
   return query;
  }
 } as unknown as Parameters<typeof resolveAuthorizedStudentIds>[0]["supabase"];
 const idsA=await resolveAuthorizedStudentIds({supabase:client,userId:"synthetic-user-A",escolaId:"synthetic-school-A"});
 const idsB=await resolveAuthorizedStudentIds({supabase:client,userId:"synthetic-user-B",escolaId:"synthetic-school-B"});
 assert.deepEqual(idsA,["synthetic-student-A"]);
 assert.deepEqual(idsB,["synthetic-student-B"]);
 assert.equal(resolveSelectedStudentId({selectedId:"synthetic-student-B",authorizedIds:idsA,fallbackId:"synthetic-student-A"}),"synthetic-student-A");
 assert.equal(resolveSelectedStudentId({selectedId:"synthetic-student-A",authorizedIds:idsB,fallbackId:"synthetic-student-B"}),"synthetic-student-B");
 // A mesma identidade autorizada pode ter várias matrículas; as APIs resolvem o ano escolhido.
 const api=await (await import("node:fs/promises")).readFile(new URL("../../src/app/api/aluno/boletim/route.ts",import.meta.url),"utf8");
 assert.match(api,/resolveBoletimMatricula\(/);
 assert.match(api,/anoLetivoId: new URL\(request.url\).searchParams.get\("ano_letivo_id"\)/);
});

test("a matrícula e o aluno anteriores nunca disponibilizam notas enquanto a nova resposta carrega", async () => {
 const fs=await import("node:fs/promises");
 const source=await fs.readFile(new URL("../../src/components/aluno/tabs/TabNotas.tsx",import.meta.url),"utf8");
 assert.match(source,/loadedScope === bulletinQuery && isLiberado/);
 assert.match(source,/safeIsLiberado \? disciplinas : \[\]/);
 assert.match(source,/safeDisciplinas\.map/);
 assert.match(source,/setLoadedScope\(bulletinQuery\)/);
 assert.match(source,/safeIsLiberado && !historicalRead && reapreciacaoDisc/);
 assert.match(source,/safeIsLiberado && !historicalRead && melhoriaDisc/);
});

test("histórico só permite leitura, sem enviar reapreciação ou melhoria da matrícula actual",async()=>{
 const fs=await import("node:fs/promises");
 const ui=await fs.readFile(new URL("../../src/components/aluno/tabs/TabNotas.tsx",import.meta.url),"utf8");
 assert.match(ui,/json\.context\?\.mode === "HISTORICAL_READ"/);
 assert.match(ui,/!historicalRead && disc\.avaliacoes\.length/);
 assert.match(ui,/safeIsLiberado && !historicalRead && reapreciacaoDisc/);
 assert.match(ui,/safeIsLiberado && !historicalRead && melhoriaDisc/);
});

test("cartão das notas bloqueadas é conciso e não repete explicações de pagamento", async () => {
 const fs=await import("node:fs/promises");
 const ui=await fs.readFile(new URL("../../src/components/aluno/tabs/TabNotas.tsx",import.meta.url),"utf8");
 assert.match(ui,/serviceUnconfigured/);
 assert.match(ui,/Boletim ainda indisponível/);
 assert.match(ui,/onOpenDocuments\(serviceUnconfigured \? null : BOLETIM_SERVICE_CODE\)/);
 assert.match(ui,/rounded-xl border border-border bg-card p-4/);
 assert.doesNotMatch(ui,/A aprovação do pedido, por si só, não libera as avaliações/);
});
