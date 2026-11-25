import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const year="20000000-0000-4000-8000-000000000001",matrix="70000000-0000-4000-8000-000000000001",id="30000000-0000-4000-8000-000000000001";
const a="80000000-0000-4000-8000-000000000001",b="80000000-0000-4000-8000-000000000002",m="b0000000-0000-4000-8000-000000000001";
const snapshot="a".repeat(32);
const prova={id,autor_id:"10000000-0000-4000-8000-000000000001",ano_letivo_id:year,curso_matriz_id:matrix,tipo_prova:"recurso",titulo:"Prova",classe:"8.ª Classe",disciplina:"Física",ano_lectivo:"2026/2027",trimestre:1,duracao:90,serie:"A",estado:"aprovada",versao:4,atualizado_em:"2026-11-25T00:00:00Z",conteudo:[{tipo:"discursiva",texto:"Questão de teste",linhas:3}]};
const turmas=[{id:a,nome:"ESG-8ª Classe-T-Z",letra:"A",curso:"Ensino Geral",turno:"M",sala:"12",total:42},{id:b,nome:"ESG-8ª Classe-T-B",letra:null,curso:"Ensino Geral",turno:"T",sala:"13",total:30}];
const aluno={matricula_id:m,turma_id:a,turma:"ESG-8ª Classe-T-Z",letra:"A",curso:"Ensino Geral",turno:"M",sala:"12",nome:"Aluno de teste",numero_processo:"P-1",numero_chamada:1};
const browser=await chromium.launch({headless:true});
try{
 for(const [width,modal] of [[390,true],[1280,false],[1280,true]]){
  const page=await browser.newPage({viewport:{width,height:844},hasTouch:width<640,isMobile:width<640});
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/api/escola/**/provas**",async route=>{
   const u=new URL(route.request().url()),q=u.searchParams;
   assert.equal(route.request().method(),"GET","distribution must not edit the approved proof");
   const reply=json=>route.fulfill({json});
   if(q.get("branding")==="1")return reply({logo:null});
   if(u.pathname.endsWith("/distribuicao")){
    assert.equal(q.get("versao"),"4");
    const mode=q.get("modo"),selected=(q.get("turmas")??"").split(",");
    const total=q.has("matricula")?1:turmas.filter(t=>selected.includes(t.id)).reduce((n,t)=>n+t.total,0);
    return reply({items:mode==="turmas"?turmas:mode==="alunos"?[aluno]:[],total:mode==="turmas"?72:total,offset:0,limit:Number(q.get("limit")??40),snapshot});
   }
   assert.equal(q.get("aprovadas"),modal?null:"1","modal uses role-scoped API; dedicated print-only page requests approved proofs");
   if(q.has("prova"))return reply({prova});
   return reply({provas:[prova],escola:"Escola de teste",permissions:{author:!modal,admin:!modal,distribute:true,userId:"10000000-0000-4000-8000-000000000004"}});
  });
  await page.goto("http://127.0.0.1:6006/provas.html?portal=secretaria"+(modal?"&modal=1":""));
  if(modal)await page.getByRole("button",{name:"Abrir central de provas"}).click();
  await page.getByRole("heading",{name:"Central de impressão de provas"}).waitFor();
  await page.getByRole("button",{name:"Imprimir",exact:true}).click();
  const dialog=page.getByRole("dialog");
  await dialog.getByRole("link",{name:"Abrir folha para impressão"}).waitFor();
  assert.equal(await page.getByRole("dialog").count(),1,"one dialog, no stacked overlays");
  assert.equal(await page.getByRole("button",{name:"Nova prova",exact:true}).count(),0,"print-only hides authoring even for admin");
  assert.equal(await dialog.getByRole("button",{name:"Aprovar prova",exact:true}).count(),0);
  await dialog.getByRole("radio",{name:/^Por turma/}).check();
  await dialog.getByRole("checkbox",{name:/8\.ª Classe — Turma A \(Manhã\)/}).check();
  await dialog.getByRole("checkbox",{name:/8\.ª Classe — Turma B \(Tarde\)/}).check();
  assert.doesNotMatch(await dialog.innerText(),/ESG-8ª Classe/);
  const link=dialog.getByRole("link",{name:"Imprimir lote"});
  await link.waitFor();
  let href=new URL(await link.getAttribute("href"),page.url());
  assert.equal(href.searchParams.get("turmas"),a+","+b);
  assert.equal(href.searchParams.get("snapshot"),snapshot);
  assert.equal(href.searchParams.get("nome"),"1");
  assert.equal(href.searchParams.get("offset"),"0");
  await dialog.getByRole("combobox",{name:"Provas por lote"}).selectOption("20");
  await dialog.getByRole("button",{name:"Lote seguinte"}).click();
  href=new URL(await link.getAttribute("href"),page.url());
  assert.equal(href.searchParams.get("offset"),"20");
  assert.equal(href.searchParams.get("limit"),"20");
  await dialog.getByRole("checkbox",{name:/Incluir nome/}).uncheck();
  assert.equal(new URL(await link.getAttribute("href"),page.url()).searchParams.get("nome"),"0");
  await dialog.getByRole("radio",{name:/^Por aluno/}).check();
  await dialog.getByRole("combobox",{name:"Turma",exact:true}).selectOption(a);
  await dialog.getByRole("combobox",{name:"Aluno",exact:true}).selectOption(m);
  await link.waitFor();
  href=new URL(await link.getAttribute("href"),page.url());
  assert.equal(href.searchParams.get("matricula"),m);
  assert.equal(href.searchParams.get("offset"),"0");
  assert.ok(!href.toString().includes("Aluno de teste"),"PII must not be in print URL");
  const metrics=await page.evaluate(()=>({w:document.documentElement.clientWidth,s:document.documentElement.scrollWidth}));
  assert.ok(metrics.s<=metrics.w+2,"mobile distribution overflow");
  assert.equal(errors.length,0,errors.join("\n"));
  await page.screenshot({path:"apps/web/visual-evidence/provas/distribuicao-"+width+".png"});
  if(modal){
   await dialog.getByRole("button",{name:"Voltar à lista"}).click();
   await dialog.getByRole("heading",{name:"Central de impressão de provas"}).waitFor();
   await dialog.getByRole("button",{name:"Fechar",exact:true}).click();
   await dialog.waitFor({state:"hidden"});
   await page.waitForFunction(()=>document.activeElement?.textContent?.includes("Abrir central de provas"));
  }
  await page.close();
  console.log("Secretary distribution smoke:",width,modal);
 }
 const adminPage=await browser.newPage({viewport:{width:1280,height:844}});
 const review={...prova,estado:"em_revisao",versao:3};
 await adminPage.route("**/api/escola/**/provas**",async route=>{
  const q=new URL(route.request().url()).searchParams;
  assert.equal(q.get("aprovadas"),null,"financial admin must not be reduced to print-only");
  if(q.get("branding")==="1")return route.fulfill({json:{logo:null}});
  if(q.has("prova"))return route.fulfill({json:{prova:review}});
  return route.fulfill({json:{provas:[review],escola:"Escola de teste",permissions:{author:true,admin:true,distribute:true,userId:"10000000-0000-4000-8000-000000000007"}}});
 });
 await adminPage.goto("http://127.0.0.1:6006/provas.html?modal=1");
 await adminPage.getByRole("button",{name:"Abrir central de provas"}).click();
 const adminDialog=adminPage.getByRole("dialog");
 await adminDialog.getByRole("button",{name:"Nova prova"}).waitFor();
 await adminDialog.getByRole("button",{name:"Consultar",exact:true}).click();
 await adminDialog.getByRole("button",{name:"Aprovar prova"}).waitFor();
 assert.equal(await adminDialog.getByRole("button",{name:"Devolver",exact:true}).isVisible(),true);
 await adminPage.close();
}finally{await browser.close();}
