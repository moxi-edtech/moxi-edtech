import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
// tsx registers the TS require hook; the web package uses CommonJS semantics.
const require = createRequire(import.meta.url);
const { provaHtml } = require("../../src/lib/provas/print.ts");
const base={titulo:"Prova",classe:"8.ª Classe",disciplina:"Física",ano_lectivo:"2026/2027",trimestre:1,duracao:90,serie:"A",conteudo:[
 {tipo:"grupo",texto:"I Grupo",linhas:0},{tipo:"discursiva",texto:"Define energia.",linhas:2},{tipo:"alinea",texto:"Justifica.",linhas:1},{tipo:"verdadeiro_falso",texto:"A Terra gira.",linhas:0},
 {tipo:"grupo",texto:"II Grupo",linhas:0},{tipo:"calculo",texto:"√9 = ",linhas:4}]};
test("A4 renderer numbers questions, resets groups, and supports handwriting space",()=>{
 const html=provaHtml(base,"Curtume");
 assert.match(html,/@page\{size:A4/);
 assert.match(html,/1\.<\/strong> Define energia\./);
 assert.match(html,/a\)<\/strong> Justifica\./);
 assert.match(html,/2\.<\/strong> A Terra gira\.<span class="vf"/);
 assert.match(html,/1\.<\/strong> √9/);
 assert.equal((html.match(/class="linha"/g)||[]).length,3);
 assert.match(html,/height:32mm/);
 assert.match(html,/Ano lectivo: 2026\/2027/);
});
test("all user values are escaped, draft preview contains no script or external resources",()=>{
 const evil='<img src=x onerror=alert(1)><script>alert(1)</script>';
 const html=provaHtml({...base,titulo:evil,disciplina:evil,conteudo:[{tipo:"texto",texto:evil,linhas:0}]},evil,{draft:true});
 assert.doesNotMatch(html,/<(?:script|img)\b/i);
 assert.match(html,/&lt;img/);
 assert.match(html,/RASCUNHO/);
 assert.doesNotMatch(html,/window\.print/);
});
test("approved print uses only a nonce-bound fixed script, preview line count is bounded",()=>{
 const html=provaHtml({...base,conteudo:[{tipo:"discursiva",texto:"Q",linhas:1e9}]}, "Curtume",{nonce:"nonce-1"});
 assert.equal((html.match(/class="linha"/g)||[]).length,20);
 assert.match(html,/<script nonce="nonce-1">/);
 assert.match(html,/window\.print/);
});

test("rich text and KaTeX MathML share the escaped A4 renderer",()=>{
 const formula="\\frac{2}{5}+\\sqrt{9}";
 const evil="<img src=x onerror=alert(1)>";
 const rich={version:1,segments:[{kind:"text",text:evil,marks:["bold","italic"]},{kind:"break"},{kind:"math",latex:formula}]};
 const html=provaHtml({...base,conteudo:[{tipo:"calculo",texto:evil+"\n"+formula,linhas:2,rich}]},"Curtume");
 assert.match(html,/<em><strong>&lt;img/);
 assert.match(html,/<math\b/);
 assert.match(html,/<mfrac>/);
 assert.match(html,/<msqrt>/);
 assert.doesNotMatch(html,/<img\b|<script\b|<a\b/);
});
test("untrusted commands never generate active markup",()=>{
 for(const latex of ["\\href{https://evil.test}{x}","\\includegraphics{evil}","\\htmlClass{x}{y}","\\def\\x{\\x}\\x","\\frac{1}"]){
  const rich={version:1,segments:[{kind:"math",latex}]};
  const html=provaHtml({...base,conteudo:[{tipo:"calculo",texto:latex,linhas:0,rich}]},"Curtume");
  assert.doesNotMatch(html,/<math\b|<img\b|<a\b|<script\b/);
 }
});

test("write contract retains required academic UUIDs while print uses snapshots",()=>{
 const {provaSchema,provaWriteSchema,mutationSchema}=require("../../src/lib/provas/schema.ts");
 const input={...base,ano_letivo_id:"20000000-0000-4000-8000-000000000001",curso_matriz_id:"70000000-0000-4000-8000-000000000001"};
 const parsed=provaWriteSchema.parse(input);
 assert.equal(parsed.ano_letivo_id,input.ano_letivo_id);
 assert.equal(parsed.curso_matriz_id,input.curso_matriz_id);
 assert.equal(mutationSchema.safeParse({acao:"criar",dados:parsed}).success,true);
 assert.equal(provaWriteSchema.safeParse(base).success,false);
 assert.equal(provaWriteSchema.safeParse({...input,curso_matriz_id:"invalid"}).success,false);
 assert.equal(provaSchema.safeParse(base).success,true);
});

test("shared physical layout reserves print margins and exact writing space",()=>{
 const {PROVA_PAPER,respostaLayout}=require("../../src/lib/provas/layout.ts");
 assert.equal(PROVA_PAPER.marginLeft,20);assert.equal(PROVA_PAPER.marginRight,20);
 assert.equal(PROVA_PAPER.marginTop,18);assert.equal(PROVA_PAPER.marginBottom,18);
 assert.equal(PROVA_PAPER.questionGap,6);assert.equal(PROVA_PAPER.answerGap,3);
 assert.equal(respostaLayout("discursiva",6).heightMm,48);
 assert.equal(respostaLayout("calculo",1).heightMm,24);
 assert.equal(respostaLayout("desenho",0).heightMm,0);
 assert.equal(respostaLayout("desenho",20).heightMm,160);
 assert.equal(respostaLayout("grupo",20).kind,"none");
 const html=provaHtml({...base,conteudo:[{tipo:"desenho",texto:"Desenhe.",linhas:0},{tipo:"calculo",texto:"Calcule.",linhas:6},{tipo:"discursiva",texto:"Explique.",linhas:3}]},"Curtume");
 assert.match(html,/@page\{size:A4;margin:18mm 20mm 18mm 20mm\}/);
 assert.match(html,/height:48mm/);
 assert.equal((html.match(/class="espaco"/g)||[]).length,1);
 assert.equal((html.match(/class="linha"/g)||[]).length,3);
 assert.match(html,/class="resposta resposta-inicio"/);
 assert.match(html,/class="student-line"/);
 assert.doesNotMatch(html,/_{20,}/);
});

test("nominal distribution uses one identical proof per recipient, escaping student fields",()=>{
 const student={matricula_id:"b0000000-0000-4000-8000-000000000001",turma_id:"80000000-0000-4000-8000-000000000001",turma:"ESG-8ª Classe-T-Z",letra:"A",curso:"Ensino Geral",turno:"M",sala:"12",nome:"Nome <img src=x>",numero_processo:"P-123",numero_chamada:1};
 const second={...student,nome:"Aluno B",numero_processo:"P-456",numero_chamada:2};
 const prova={...base,tipo_prova:"recurso"};
 const html=provaHtml(prova,"Curtume",{recipients:[student,second],nonce:"fixed"});
 assert.equal((html.match(/class="paper" data-layout="/g)||[]).length,2);
 assert.equal((html.match(/Define energia\./g)||[]).length,2);
 assert.equal((html.match(/Exame de Recurso de Física/g)||[]).length,2);
 assert.match(html,/Nome &lt;img src=x&gt;/);
 assert.doesNotMatch(html,/<img\b/);
 assert.match(html,/Sala da turma: 12/);
 assert.match(html,/Turno: Manhã/);
 assert.match(html,/N.º de processo: P-123/);
 assert.doesNotMatch(html,/I Trimestre/);
 assert.match(html,/\.paper\+\.paper\{break-before:page/);
 const anonymous=provaHtml(prova,"Curtume",{recipients:[student,second],includeName:false});
 assert.doesNotMatch(anonymous,/P-123|P-456|Aluno B|Nome &lt;img/);
 assert.equal((anonymous.match(/class="student-line"/g)||[]).length,2);
 assert.match(anonymous,/Turma A/);
 assert.match(html,/8\.ª Classe/);
 assert.match(html,/Curso: Ensino Geral/);
 assert.doesNotMatch(html,/ESG-8ª Classe-T-Z|Turma Z/);
});
test("distribution query rejects unbounded, duplicate or incompatible selections",()=>{
 const {parseDistribution}=require("../../src/lib/provas/distribution.ts");
 const id="30000000-0000-4000-8000-000000000001",turma="80000000-0000-4000-8000-000000000001";
 const q=new URLSearchParams({prova:id,versao:"4",modo:"imprimir",turmas:turma,offset:"0",limit:"20"});
 assert.equal(parseDistribution(q).success,true);
 q.set("limit","100");assert.equal(parseDistribution(q).success,false);
 q.set("limit","40");q.set("turmas",turma+","+turma);assert.equal(parseDistribution(q).success,false);
 q.set("turmas",turma);q.set("matricula",id);q.set("offset","40");assert.equal(parseDistribution(q).success,false);
 q.set("offset","0");q.set("versao","0");assert.equal(parseDistribution(q).success,false);
});

test("portal entry points share the server-authorized central and retain tenant routes", async()=>{
 const {readFile}=await import("node:fs/promises");
 const read=path=>readFile(new URL("../../src/"+path,import.meta.url),"utf8");
 const [secretaria,operacoes,professor,central,nav,quick,teacher,legacy]=await Promise.all([
  read("app/escola/[id]/(portal)/secretaria/(portal-secretaria)/provas/page.tsx"),
  read("app/escola/[id]/(portal)/operacoes/provas/page.tsx"),
  read("app/escola/[id]/professor/provas/page.tsx"),
  read("components/provas/ProvasPortalPage.tsx"),
  read("lib/sidebarNav.ts"),read("app/secretaria/(portal-secretaria)/Dashboard.tsx"),read("app/professor/page.tsx"),read("components/secretaria/SecretariaDocumentosWorkspace.tsx")
 ]);
 assert.match(secretaria,/ProvasPortalPage.*portal="secretaria"/s);
 assert.match(operacoes,/ProvasPortalPage.*portal="operacoes"/s);
 assert.match(professor,/provaAccess/);
 assert.match(professor,/teacherWizard/);
 assert.match(central,/!access\.ok\|\|!access\.distribute/);
 assert.match(central,/const printOnly=!access\.admin/);
 assert.match(nav,/operacoes\/provas/);
 assert.match(quick,/<ProvasModal/);
 assert.match(teacher,/professorHref\("\/professor\/provas"\)/);
 assert.match(legacy,/<ProvasModal/);
 assert.doesNotMatch(legacy,/<ProvasWorkspace/);
});

test("exam labels use class snapshot, structured letter, full course and normalized shift",()=>{
 const {formatClasseProva,turmaProvaLabels}=require("../../src/lib/provas/academicLabels.ts");
 assert.equal(formatClasseProva("8ª"),"8.ª Classe");
 assert.equal(formatClasseProva("9"),"9.ª Classe");
 assert.equal(formatClasseProva("Pré-Escolar"),"Pré-Escolar");
 assert.equal(formatClasseProva("Classe de Iniciação"),"Classe de Iniciação");
 assert.equal(turmaProvaLabels("8ª",{nome:"ESG-7ª Classe-T-Z",letra:"A",turno:"M"}).label,"8.ª Classe — Turma A (Manhã)");
 assert.equal(turmaProvaLabels("10ª",{nome:"TI-10ª Classe-M-B",turno:"T",curso:"Técnico de Informática"}).label,"Técnico de Informática — 10.ª Classe — Turma B (Tarde)");
 assert.equal(turmaProvaLabels("8ª",{nome:"8ª A",turno:"Manhã"}).turma,"Turma A");
 assert.equal(turmaProvaLabels("8ª",{nome:"Turma Horizonte",turno:"M"}).turma,"Turma Horizonte");
 assert.equal(turmaProvaLabels("Pré-Escolar",{nome:"PRE-Pré-Escolar-M-A",letra:"A",turno:"M"}).label,"Pré-Escolar — Turma A (Manhã)");
 assert.equal(turmaProvaLabels("8ª",{nome:"XYZ-123"}).turma,"Turma sem designação");
 assert.equal(turmaProvaLabels("8ª",{}).turma,"Turma sem designação");
});

test("institutional branding uses only the school storage path and a bounded image",async()=>{
 const {schoolLogoSource,safeLogoData,PROVA_FOOTER}=require("../../src/lib/provas/branding.ts");
 const {loadProvaLogo}=require("../../src/lib/provas/loadLogo.ts");
 const id="00000000-0000-4000-8000-000000000001",origin="https://project.supabase.co";
 const url=origin+"/storage/v1/object/public/school-branding/escolas/"+id+"/logo/123.png";
 const png="iVBORw0KGgoAAAANSUhEUgAAAFAAAAAoCAIAAADmAupWAAAAT0lEQVR4nO3PQRHAIADAMMAIQpCE//9cbHddoqCd+57xJ+vrgLcZrjNcZ7jOcJ3hOsN1husM1xmuM1xnuM5wneE6w3WG6wzXGa4zXGe47gEClwEVK6MyPwAAAABJRU5ErkJggg==";
 let calls=0;
 const fetcher=async(input,options)=>{calls++;assert.equal(String(input),url);assert.equal(options.redirect,"error");assert.equal(options.credentials,"omit");return new Response(Buffer.from(png,"base64"),{headers:{"content-type":"image/png"}});};
 const logo=await loadProvaLogo(url,id,fetcher,[origin]);
 assert.equal(logo,"data:image/png;base64,"+png);
 for(const invalid of [null,"https://evil.test/logo.png",url.replace(id,"00000000-0000-4000-8000-000000000002"),url+"?token=abc",url.replace(".png",".svg"),url.replace("https:","http:")]){
  assert.equal(schoolLogoSource(invalid,id,[origin]),null);
  assert.equal(await loadProvaLogo(invalid,id,fetcher,[origin]),null);
 }
 assert.equal(calls,1);
 assert.equal(await loadProvaLogo(url,id,async()=>new Response("fake",{headers:{"content-type":"image/png"}}),[origin]),null);
 assert.equal(await loadProvaLogo(url,id,async()=>new Response("large",{headers:{"content-type":"image/png","content-length":"3000000"}}),[origin]),null);
 assert.equal(await loadProvaLogo(url,id,async()=>{throw Error("network")},[origin]),null);
 assert.equal(safeLogoData("data:image/svg+xml;base64,PHN2Zz4="),null);
 assert.equal(safeLogoData("https://evil.test/track.png"),null);
 const student={matricula_id:"b0000000-0000-4000-8000-000000000001",turma_id:"80000000-0000-4000-8000-000000000001",turma:"Turma A",letra:"A",curso:"Ensino Geral",turno:"M",sala:"12",nome:"Aluno",numero_processo:"P-1",numero_chamada:1};
 const html=provaHtml(base,"Curtume",{logo,recipients:[student,{...student,nome:"Outro"}]});
 assert.equal(html.split(logo).length-1,1,"embed logo once regardless of batch size");
 assert.equal((html.match(/class="school-logo"/g)||[]).length,2);
 assert.ok(html.includes(PROVA_FOOTER));
 assert.match(html,/@bottom-left/);
 const fallback=provaHtml(base,"Curtume",{logo:"https://evil.test/track.png"});
 assert.doesNotMatch(fallback,/class="school-logo"|evil\.test/);
 assert.match(fallback,/<h1 class="school">Curtume/);
});

test("question templates are contextual without restricting formats or mutating defaults",()=>{
 const {questionTemplate,suggestedTypes,structures,formatCotacao}=require("../../src/lib/provas/questionTemplates.ts");
 assert.equal(questionTemplate("discursiva").linhas,2);
 assert.equal(questionTemplate("calculo").linhas,6);
 const a=questionTemplate("escolha"), b=questionTemplate("escolha");a.alternativas[0]="Changed";assert.equal(b.alternativas[0],"");
 assert.equal(suggestedTypes("Matemática")[0],"calculo");
 assert.equal(suggestedTypes("Língua Portuguesa")[0],"discursiva");
 assert.ok(!suggestedTypes("Língua Portuguesa").includes("texto"));
 assert.equal(structures.length,3);
 assert.equal(formatCotacao(0),"0");assert.equal(formatCotacao(2000),"20");assert.equal(formatCotacao(125),"1,25");
});
test("structured questions preserve legacy data, validate alternatives and print escaped labels and marks",()=>{
 const {blockSchema}=require("../../src/lib/provas/schema.ts");
 const q={tipo:"escolha",texto:"Qual?",linhas:0,alternativas:["Joule","<script>bad</script>"],cotacao_cent:125};
 assert.ok(blockSchema.safeParse(q).success);
 assert.ok(blockSchema.safeParse({tipo:"escolha",texto:"Qual?\\nA) Um",linhas:0}).success);
 for(const invalid of [{...q,alternativas:[""]},{...q,alternativas:[" ","OK"]},{...q,tipo:"calculo"},{...q,cotacao_cent:2001},{...q,cotacao_cent:1.5},{tipo:"grupo",texto:"G",linhas:0,cotacao_cent:1}])assert.equal(blockSchema.safeParse(invalid).success,false);
 const html=provaHtml({...base,conteudo:[q]},"Curtume");
 assert.match(html,/1,25 val\./);assert.match(html,/A\) <\/span>Joule/);assert.match(html,/&lt;script&gt;bad/);assert.doesNotMatch(html,/<script>/);
});

test("adaptive composition preserves physical answers and uses compact only when it saves estimated sheets",()=>{
 const {chooseComposicao,estimatedPages,COMPOSICAO,respostaLayout}=require("../../src/lib/provas/layout.ts");
 const short=[{tipo:"discursiva",texto:"Define energia.",linhas:2}];
 const dense=Array.from({length:7},()=>({...short[0]}));
 assert.equal(chooseComposicao(short,"automatica"),"normal");
 assert.equal(chooseComposicao(dense,"automatica"),"compacta");
 assert.ok(estimatedPages(dense,"compacta")<estimatedPages(dense,"normal"));
 assert.equal(chooseComposicao(short,"espacosa"),"espacosa");
 assert.equal(chooseComposicao(short,"compacta"),"compacta");
 assert.equal(chooseComposicao(short,undefined),"normal");
 assert.ok(COMPOSICAO.compacta.questionGap<COMPOSICAO.normal.questionGap);
 assert.equal(respostaLayout("discursiva",2).heightMm,16);
 const {provaSchema}=require("../../src/lib/provas/schema.ts");
 assert.equal(provaSchema.safeParse({...base,apresentacao:"invalid"}).success,false);
 for(const mode of ["automatica","compacta","espacosa"]){
  const html=provaHtml({...base,apresentacao:mode,conteudo:short},"Curtume");
  assert.equal((html.match(/class="linha"/g)||[]).length,2);
  assert.match(html,/\.linha\{height:8mm/);
  assert.match(html,/data-layout="(normal|compacta|espacosa)"/);
 }
});

test("institutional monochrome composition uses school identity, bold numbers, aligned marks and conditional option columns",()=>{
 const {alternativesInColumns}=require("../../src/lib/provas/layout.ts");
 const choices={tipo:"escolha",texto:"Qual?",linhas:0,cotacao_cent:200,alternativas:["Watt","Joule","Newton","Pascal"]};
 const html=provaHtml({...base,conteudo:[choices]},"Curtume");
 assert.match(html,/<div class="institution">/);
 assert.match(html,/Arial,"Liberation Sans",sans-serif/);
 assert.match(html,/<strong class="question-number">1\.<\/strong>/);
 assert.match(html,/\.cotacao\{float:right/);
 assert.match(html,/class="alternativas duas-colunas"/);
 assert.match(html,/@bottom-right\{content:"Página " counter\(page\) " de " counter\(pages\)/);
 assert.doesNotMatch(html,/#(?:1F6B3B|E3B23C)/i);
 assert.equal(alternativesInColumns(choices.alternativas),true);
 assert.equal(alternativesInColumns(["A","B"]),false);
 assert.equal(alternativesInColumns(["A","B","C","D".repeat(29)]),false);
 assert.equal(alternativesInColumns(["A","B","C","D\nE"]),false);
 const wide=provaHtml({...base,conteudo:[{...choices,alternativas:["A","B","C","D".repeat(29)]}]},"Curtume");
 assert.match(wide,/class="alternativas"/);
 assert.doesNotMatch(wide,/class="alternativas duas-colunas"/);
});

test("editable formula models produce only validated mathematical expressions",()=>{
 const {formulaModels,modelExpression,completeExpression}=require("../../src/lib/provas/formulaModels.ts");
 for(const model of formulaModels){
  const value=modelExpression(model.id,model.fields.map(f=>f.example));
  assert.equal(value,model.sample,model.id);
  assert.equal(completeExpression(value),true,model.id);
 }
 assert.equal(modelExpression("equacao",["2","-5","15"]),"2x-5=15");
 assert.equal(modelExpression("potencia",["-2","3"]),"(-2)^{3}");
 assert.equal(modelExpression("fracao",["3,5","2"]),"\\frac{3.5}{2}");
 assert.equal(modelExpression("fracao",["\\htmlClass{evil}","2"]),null);
 assert.equal(modelExpression("fracao",["","2"]),null);
 assert.equal(completeExpression("\\frac{}{5}"),false);
 assert.equal(completeExpression("\\placeholder{}+3"),false);
 assert.equal(completeExpression("2+3"),true);
});

test("mobile composition preserves math notation and rejects unsafe/incomplete components",()=>{
 const {composeExpression,modelExpression}=require("../../src/lib/provas/formulaModels.ts");
 const parts=[{id:1,operator:"+",model:"fracao",values:["7","5"]},{id:2,operator:"+",model:"potencia",values:["2","3"]}];
 assert.equal(composeExpression(parts),"\\frac{7}{5}+2^{3}");
 assert.equal(composeExpression([{id:1,operator:"+",existing:"\\sqrt{25}"},parts[1]]),"\\sqrt{25}+2^{3}");
 assert.equal(composeExpression([{...parts[0],values:["","5"]}]),null);
 assert.equal(composeExpression(Array.from({length:13},(_,i)=>({...parts[0],id:i}))),null);
 assert.equal(modelExpression("fracao_algebrica",["3","\\htmlClass","2","5"]),null);
 const html=provaHtml({...base,conteudo:[{tipo:"calculo",texto:composeExpression(parts),linhas:6,rich:{version:1,segments:[{kind:"math",latex:composeExpression(parts)}]}}]},"Curtume");
 assert.match(html,/<mfrac>/);
 assert.match(html,/<msup>/);
});

test("formula recovery is lossless for all model examples and canonical compositions",()=>{
 const {formulaModels,modelExpression,composeExpression}=require("../../src/lib/provas/formulaModels.ts");
 const {recoverFormulaParts,formulaValueSlots,updateFormulaValues}=require("../../src/lib/provas/formulaRecovery.ts");
 for(const model of formulaModels){
  const source=modelExpression(model.id,model.fields.map(f=>f.example));
  const parts=recoverFormulaParts(source);
  assert.ok(parts.every(p=>"model" in p),model.id);
  assert.equal(composeExpression(parts),source,model.id);
 }
 const source="\\frac{7}{5}+\\sqrt{25}-2^{3}";
 const recovered=recoverFormulaParts(source);
 assert.equal(recovered.length,3);
 assert.deepEqual(recovered.map(p=>p.model),["fracao","raiz","potencia"]);
 assert.equal(composeExpression(recovered),source);
 assert.equal(composeExpression(recovered.map((p,i)=>i===0?{...p,values:["8","5"]}:p)),"\\frac{8}{5}+\\sqrt{25}-2^{3}");
 const complex="\\frac{3x^{2}+7}{\\sqrt{16}}";
 assert.equal(composeExpression(recoverFormulaParts(complex)),complex);
 assert.deepEqual(formulaValueSlots(complex).map(s=>s.value),["3","2","7","16"]);
 assert.equal(updateFormulaValues(complex,["3","2","7","16"]),complex);
 assert.equal(updateFormulaValues(complex,["4","3","8","25"]),"\\frac{4x^{3}+8}{\\sqrt{25}}");
 assert.equal(updateFormulaValues("x^2+3",["12","4"]),"x^{12}+4");
 assert.equal(updateFormulaValues("x^ 2+3",["12","4"]),"x^ {12}+4");
 assert.equal(updateFormulaValues(complex,["3","2","7","\\htmlClass"]),null);
 assert.deepEqual(formulaValueSlots("\\frac12"),[]);
 assert.deepEqual(formulaValueSlots("\\text{2026}+2").map(s=>s.value),["2"]);
});

const {parseCotacao,cotacaoStatus}=require("../../src/lib/provas/cotacao.ts");
test("cotação decimal exacta e escalas académicas",()=>{
 assert.equal(parseCotacao("2,1"),210);assert.equal(parseCotacao("2.5"),250);assert.equal(parseCotacao("0,75"),75);assert.equal(parseCotacao("2,111"),undefined);
 const q=cent=>({tipo:"discursiva",texto:"Q",linhas:1,cotacao_cent:cent});
 assert.equal(cotacaoStatus([q(210),q(790),{tipo:"grupo",texto:"G",linhas:0}],1000).ready,true);
 assert.equal(cotacaoStatus([q(210),q(790)],2000).ready,false);
 assert.equal(cotacaoStatus([q(1100)],1000).ready,false);
 assert.equal(cotacaoStatus([q(1000),q(undefined)],1000).ready,false);
 assert.equal(cotacaoStatus([q(1000),q(0)],1000).ready,false);
 assert.equal(cotacaoStatus([q(1000)],null).ready,false);
 assert.equal(cotacaoStatus([q(undefined)],0).ready,true);
 assert.equal(cotacaoStatus([q(1)],0).ready,false);
});

test("standalone generic sheet has manual identification, blank writing lines and no synthetic assessment",()=>{
 const {folhaGenericaHtml}=require("../../src/lib/provas/print.ts");
 const html=folhaGenericaHtml("Escola <teste>",{nonce:"fixed-nonce"});
 assert.match(html,/Escola &lt;teste&gt;/);
 assert.match(html,/Folha de prova/);
 for(const label of ["Nome do aluno:","Disciplina:","Classe:","Turma:","Tipo de prova:","Data:","Classificação:"])assert.ok(html.includes(label));
 assert.equal((html.match(/class="linha"/g)||[]).length,18);
 assert.doesNotMatch(html,/class="questao|Duração: 1 min|Série A|RASCUNHO/);
 assert.match(html,/<script nonce="fixed-nonce">/);
});

test("standard proof titles are automatic; custom and legacy titles are preserved",()=>{
 const {provaDisplayTitle,provaSubtitle,tituloAoMudarTipo,tiposProva}=require("../../src/lib/provas/schema.ts");
 for(const [type,label] of Object.entries(tiposProva)){
  if(type==="outro")continue;
  const p={...base,tipo_prova:type,titulo:label};
  assert.equal(provaDisplayTitle(p),label+" de Física");
  assert.equal(provaSubtitle(p),null);
  assert.match(provaHtml(p,"Escola"),new RegExp('<h2 class="title">'+label+' de Física</h2>'));
  assert.doesNotMatch(provaHtml(p,"Escola"),/<p class="subtitle">/);
 }
 const legacy={...base,tipo_prova:"trimestral",titulo:"Avaliação de recuperação"};
 assert.equal(provaSubtitle(legacy),"Avaliação de recuperação");
 assert.equal(tituloAoMudarTipo(legacy,"recurso"),legacy.titulo);
 assert.match(provaHtml(legacy,"Escola"),/<p class="subtitle">Avaliação de recuperação<\/p>/);
 assert.equal(tituloAoMudarTipo({...legacy,titulo:"Prova Trimestral"},"recurso"),"Exame de Recurso");
 assert.equal(tituloAoMudarTipo(legacy,"outro"),"");
 const custom={...legacy,tipo_prova:"outro",titulo:"Avaliação especial"};
 assert.equal(provaDisplayTitle(custom),"Avaliação especial de Física");
 assert.equal(tituloAoMudarTipo(custom,"trimestral"),"Prova Trimestral");
 assert.equal(provaDisplayTitle({...base,tipo_prova:undefined}),"Prova — Física");
});

test("structure blocks do not consume question numbers or answer spaces",()=>{
 const {blockNumbering,questionTypes,structureTypes,questionTemplate,suggestedTypes}=require("../../src/lib/provas/questionTemplates.ts");
 const blocks=["grupo","texto","discursiva","alinea","texto","alinea","discursiva","grupo","texto","discursiva"].map((tipo,i)=>({...questionTemplate(tipo),texto:"Bloco "+i,linhas:0}));
 assert.deepEqual(blockNumbering(blocks).map(x=>x.prefix),[null,null,"1.","a)",null,"b)","2.",null,null,"1."]);
 assert.ok(structureTypes.every(x=>!questionTypes.includes(x)&&!suggestedTypes("Português").includes(x)));
 const html=provaHtml({...base,conteudo:blocks},"Escola");
 assert.deepEqual([...html.matchAll(/class="question-number">([^<]+)/g)].map(x=>x[1]),["1.","a)","b)","2.","1."]);
 assert.equal((html.match(/class="apoio"/g)||[]).length,3);
 assert.equal((html.match(/class="cotacao"/g)||[]).length,0);
});

test("modular arithmetic starters, editable operators, terminal equality and grouping round-trip",()=>{
 const {modelStarter,composeExpression}=require("../../src/lib/provas/formulaModels.ts");
 const {recoverEditableExpression}=require("../../src/lib/provas/formulaRecovery.ts");
 const seed=modelStarter("soma_fracoes",["2","3","1","4"]).map((p,id)=>({...p,id}));
 assert.equal(seed.length,2);
 assert.equal(composeExpression([seed[0],{...seed[1],operator:"-"}],true),"\\frac{2}{3}-\\frac{1}{4}=");
 for(const source of ["1+2-4-7=","\\frac{2}{3}+\\frac{1}{4}","\\frac{2}{3}\\times \\frac{5}{7}+\\frac{1}{2}=","(5+3)\\times 2-4="]){
  const recovered=recoverEditableExpression(source);
  assert.ok(recovered.parts.length>=2,source);
  assert.ok(recovered.parts.every(p=>!("existing" in p)),source);
  assert.equal(composeExpression(recovered.parts,recovered.ending),source);
 }
 assert.equal(composeExpression([{...seed[0],opens:1}]),null);
 assert.equal(composeExpression(seed.map((p,i)=>({...p,opens:i===0?1:0,closes:i===1?1:0})),true),"(\\frac{2}{3}+\\frac{1}{4})=");
});

test("groups derive roman headings, totals and membership without rewriting old titles",()=>{
 const {groupSummaries,groupHeading,questionTemplate,moveChangesGroup,groupTitleInput}=require("../../src/lib/provas/questionTemplates.ts");
 const g={tipo:"grupo",texto:"IV Grupo — Aritmética",linhas:0},h={tipo:"grupo",texto:"Grupo",linhas:0};
 const a={tipo:"discursiva",texto:"A",linhas:2,cotacao_cent:450},b={tipo:"alinea",texto:"B",linhas:1,cotacao_cent:350},c={tipo:"calculo",texto:"C",linhas:3,cotacao_cent:1200},support={tipo:"texto",texto:"Leia",linhas:0};
 const blocks=[g,support,a,b,h,c];
 const groups=groupSummaries(blocks);
 assert.deepEqual(groups.map(x=>[x.title,x.questions,x.total,x.assigned]),[["I Grupo — Aritmética",2,800,2],["II Grupo",1,1200,1]]);
 assert.equal(groupHeading(4,"II Grupo: Álgebra"),"IV Grupo — Álgebra");
 assert.equal(groupTitleInput("Aritmética "),"Aritmética ");
 assert.equal(questionTemplate("grupo").texto,"Grupo");
 assert.equal(moveChangesGroup(blocks,2,3),false);
 assert.equal(moveChangesGroup(blocks,2,5),true);
 assert.equal(moveChangesGroup(blocks,4,1),true);
 assert.equal(groupSummaries([g,h,c])[0].questions,0);
 const html=provaHtml({...base,conteudo:blocks},"Escola");
 assert.match(html,/I Grupo — Aritmética<span class="group-total"> · 8 val\./);
 assert.match(html,/II Grupo<span class="group-total"> · 12 val\./);
 assert.doesNotMatch(html,/IV Grupo — Aritmética/);
 assert.doesNotMatch(provaHtml({...base,conteudo:[g,{...a,cotacao_cent:undefined}]},"Escola"),/<span class="group-total">/);
});

test("recursive editor round-trips every model and supports nested arithmetic",()=>{
 const {formulaModels,modelExpression}=require("../../src/lib/provas/formulaModels.ts");
 const {parseMath,modelMathTree,serializeMath,validMathExpression,mathAt,replaceMathAt,tokenNode,mathTreeValid}=require("../../src/lib/provas/formulaAst.ts");
 for(const model of formulaModels){
  const source=modelExpression(model.id,model.fields.map(f=>f.example)),tree=modelMathTree(model.id);
  assert.ok(tree,model.id);
  assert.equal(serializeMath(tree),source,model.id);
  assert.equal(validMathExpression(tree),source,model.id);
 }
 const sources=["\\frac{2x+5}{3x-1}","(2x+3)^{x-1}","\\sqrt{3x^{2}+5x-7}","3x^{3}-2x^{2}+5x-7=0","\\sin(2x+30^{\\circ})-\\cos(x)=0","\\int_{0}^{5}(3x^{2}+2x-1)\\,dx","\\frac{2}{3}\\times \\frac{5}{7}-\\frac{1}{4}=","1+2-4-7="];
 for(const source of sources){const tree=parseMath(source);assert.ok(tree,source);assert.equal(serializeMath(tree),source);assert.equal(validMathExpression(tree),source);}
 const fraction=parseMath("\\frac{2}{3}");
 const numerator=[{index:0,slot:"numerator"}];
 const next=replaceMathAt(fraction,numerator,[...mathAt(fraction,numerator),tokenNode("x"),tokenNode("+"),tokenNode("5")]);
 assert.equal(validMathExpression(next),"\\frac{2x+5}{3}");
 assert.equal(serializeMath(fraction),"\\frac{2}{3}","original immutable");
 const replaced=replaceMathAt(next,[{index:0,slot:"denominator"}],parseMath("\\sqrt{x+1}"));
 assert.equal(validMathExpression(replaced),"\\frac{2x+5}{\\sqrt{x+1}}");
 assert.equal(validMathExpression(replaceMathAt(fraction,numerator,[])),null);
 assert.equal(parseMath("\\text{2026}+1"),null);
 assert.equal(parseMath("\\htmlClass{bad}{x}"),null);
 assert.equal(validMathExpression([tokenNode("x"),tokenNode("+")]),null);
 assert.equal(validMathExpression([tokenNode("x"),tokenNode("=")]),"x=");
 assert.equal(validMathExpression([tokenNode("\\sin"),tokenNode("x")]),"\\sin x");
 let deep=[tokenNode("x")];for(let i=0;i<9;i++)deep=[{kind:"root",body:deep}];
 assert.equal(mathTreeValid(deep),false);
 assert.equal(mathTreeValid(Array.from({length:161},()=>tokenNode("x"))),false);
 assert.equal(mathTreeValid([tokenNode("1".repeat(301))]),false);
});

test("bounded matrix, determinant and system validation and cell editing",()=>{
 const {safeLatex}=require("../../src/lib/provas/rich.ts");
 const {parseMath,serializeMath,validMathExpression,replaceMathAt,mathSlots}=require("../../src/lib/provas/formulaAst.ts");
 const good=["\\begin{cases}2x+y=10\\\\x-y=2\\end{cases}","\\begin{pmatrix}2&3\\\\4&5\\end{pmatrix}","\\begin{vmatrix}\\frac{1}{2}&x\\\\3&4\\end{vmatrix}","\\begin{pmatrix}1&2&3\\\\4&5&6\\end{pmatrix}"];
 for(const latex of good){assert.ok(safeLatex(latex),latex);const tree=parseMath(latex);assert.ok(tree,latex);assert.equal(serializeMath(tree),latex);assert.equal(validMathExpression(tree),latex);}
 const invalid=["\\begin{array}1&2\\end{array}","\\begin{pmatrix}1&2\\\\3\\end{pmatrix}","\\begin{vmatrix}1&2&3\\\\4&5&6\\end{vmatrix}","\\begin{cases}x=1\\end{cases}","\\begin{pmatrix}1&\\htmlClass{a}{x}\\\\3&4\\end{pmatrix}","\\begin{pmatrix}1&2\\\\3&4\\end{vmatrix}","x&y","\\begin{pmatrix}1&2\\\\3&\\begin{pmatrix}4\\end{pmatrix}\\end{pmatrix}","\\begin{pmatrix}1&&2\\\\3&4&5\\end{pmatrix}","\\begin{pmatrix}1&2&3&4&5\\end{pmatrix}"];
 for(const latex of invalid)assert.equal(safeLatex(latex),false,latex);
 const tree=parseMath(good[1]);assert.equal(mathSlots(tree[0]).length,4);
 const next=replaceMathAt(tree,[{index:0,slot:"cell:1:0"}],parseMath("\\frac{x+1}{2}"));
 assert.equal(validMathExpression(next),"\\begin{pmatrix}2&3\\\\\\frac{x+1}{2}&5\\end{pmatrix}");
 assert.equal(serializeMath(tree),good[1]);
 assert.equal(validMathExpression(replaceMathAt(tree,[{index:0,slot:"cell:0:0"}],[])),null);
 const proof=provaHtml({...base,conteudo:good.map(latex=>({tipo:"calculo",texto:latex,linhas:2,rich:{version:1,segments:[{kind:"math",latex}]}}))},"Escola");
 assert.equal((proof.match(/<mtable/g)||[]).length,4);
});
