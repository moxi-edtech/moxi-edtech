import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const year="20000000-0000-4000-8000-000000000001",matrix="70000000-0000-4000-8000-000000000001";
const user="10000000-0000-4000-8000-000000000001",id="30000000-0000-4000-8000-000000000001";
const base={id,autor_id:user,ano_letivo_id:year,curso_matriz_id:matrix,titulo:"Prova de Física",classe:"8.ª Classe",disciplina:"Física",ano_lectivo:"2026/2027",trimestre:1,duracao:90,serie:"A",estado:"aprovada",versao:3,atualizado_em:"2026-11-25T00:00:00Z",conteudo:[{tipo:"discursiva",texto:"Questão de teste",linhas:3}]};
const browser=await chromium.launch({headless:true});
await mkdir("apps/web/visual-evidence/provas",{recursive:true});
const noOverflow=async(page,label)=>{
 const metrics=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,dialog:document.querySelector('[role="dialog"]')?.getBoundingClientRect().width}));
 assert.ok(metrics.scroll<=metrics.width+2,label+": page overflow "+JSON.stringify(metrics));
 if(metrics.dialog!==undefined)assert.ok(metrics.dialog<=metrics.width+2,label+": dialog overflow");
};
try{
 for(const [width,height] of [[320,568],[390,844],[768,1024],[1280,800]]){
  const page=await browser.newPage({viewport:{width,height},hasTouch:width<640,isMobile:width<640});
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  let saved=null;
  await page.route("**/api/escola/**/provas**",async route=>{
   const req=route.request(),url=new URL(req.url());
   const reply=body=>route.fulfill({json:body});
   if(req.method()==="POST"){
    const data=req.postDataJSON();
    assert.equal(data.dados.ano_letivo_id,year);assert.equal(data.dados.curso_matriz_id,matrix);assert.equal(data.dados.conteudo[0].linhas,7);
    assert.ok(data.dados.conteudo[0].rich.segments.some(s=>s.kind==="math"&&s.latex==="2+3"));
    assert.deepEqual(data.dados.conteudo[1].alternativas,["Joule","Watt","Newton","Pascal"]);
    assert.equal(data.dados.conteudo[1].cotacao_cent,125);
    assert.equal(data.dados.apresentacao,"espacosa");
    saved={...base,...data.dados,id:"30000000-0000-4000-8000-000000000002",estado:"rascunho",versao:1};
    return reply({prova:saved});
   }
   if(url.searchParams.get("branding")==="1")return reply({logo:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAAAoCAIAAADmAupWAAAAT0lEQVR4nO3PQRHAIADAMMAIQpCE//9cbHddoqCd+57xJ+vrgLcZrjNcZ7jOcJ3hOsN1husM1xmuM1xnuM5wneE6w3WG6wzXGa4zXGe47gEClwEVK6MyPwAAAABJRU5ErkJggg=="});
   if(url.searchParams.get("contexto")==="1")return reply({items:url.searchParams.has("ano")?[{ano_letivo_id:year,curso_matriz_id:matrix,ano_lectivo:"2026/2027",classe:"8.ª Classe",disciplina:"Física",curso:"Ensino Geral",trimestre:1}]:[{id:year,ativo:true,label:"2026/2027"}]});
   if(url.searchParams.has("prova"))return reply({prova:base});
   return reply({provas:saved?[base,saved]:[base],escola:"Escola de teste",permissions:{author:true,admin:false,userId:user}});
  });
  await page.goto("http://127.0.0.1:6006/provas.html");
  const create=page.getByRole("button",{name:"Nova prova",exact:true});
  await create.waitFor();await noOverflow(page,"list "+width);
  if(width<640){assert.equal(await page.getByRole("list",{name:"Provas"}).isVisible(),true);assert.equal(await page.getByRole("table").isVisible(),false);}
  await page.screenshot({path:"apps/web/visual-evidence/provas/list-"+width+".png"});
  await create.click();
  const dialog=page.getByRole("dialog");await dialog.waitFor();
  await dialog.getByRole("combobox",{name:"Ano lectivo",exact:true}).waitFor();
  await dialog.getByLabel("Ano lectivo",{exact:true}).selectOption(year);
  await dialog.getByLabel("Classe e disciplina").selectOption(matrix);
  await dialog.getByLabel("Apresentação da folha").selectOption("espacosa");
  if(width<640){
   assert.equal(await dialog.getByLabel("Enunciado 1",{exact:true}).isVisible(),false);
   await dialog.getByRole("button",{name:"Perguntas",exact:true}).click();
   await dialog.getByLabel("Enunciado 1",{exact:true}).fill("Calcula a soma.");
   await dialog.getByRole("button",{name:"Cabeçalho",exact:true}).click();
   assert.equal(await dialog.getByLabel("Apresentação da folha").inputValue(),"espacosa");
   await dialog.getByRole("button",{name:"Perguntas",exact:true}).click();
   assert.equal(await dialog.getByLabel("Enunciado 1",{exact:true}).inputValue(),"Calcula a soma.");
  }else{
   await dialog.getByLabel("Enunciado 1",{exact:true}).fill("Calcula a soma.");
   await dialog.getByRole("button",{name:"Cabeçalho da prova"}).click();
   assert.equal(await dialog.getByRole("button",{name:/Cabeçalho da prova/}).getAttribute("aria-expanded"),"false");
  }
  if(width<640){
   assert.equal(await dialog.getByRole("button",{name:"Médio",exact:true}).isVisible(),false);
   assert.equal(await dialog.getByRole("button",{name:"Subir bloco 1"}).isVisible(),false);
   assert.equal(await dialog.getByRole("button",{name:"Adicionar √",exact:true}).isVisible(),false);
   await dialog.getByText("Símbolos matemáticos",{exact:true}).click();
   assert.equal(await dialog.getByRole("button",{name:"Adicionar √",exact:true}).isVisible(),true);
   await dialog.getByText("Símbolos matemáticos",{exact:true}).click();
   await dialog.getByRole("spinbutton",{name:"Linhas para resposta 1"}).fill("6");
  }else await dialog.getByRole("group",{name:"Espaço da resposta 1"}).getByRole("button",{name:"Médio",exact:true}).click();
  await dialog.getByRole("button",{name:"Aumentar espaço da resposta 1"}).click();
  assert.equal(await dialog.getByRole("spinbutton",{name:"Linhas para resposta 1"}).inputValue(),"7");
  await noOverflow(page,"editor "+width);
  if(width<640){
   const box=await dialog.getByRole("button",{name:"Guardar rascunho"}).boundingBox();
   assert.ok(box&&box.height>=43,"save touch target too small");
   await page.setViewportSize({width,height:360});
   await noOverflow(page,"short viewport "+width);
   await page.setViewportSize({width,height});
  }
  await dialog.getByRole("button",{name:"Formatar / inserir fórmulas"}).click();
  await dialog.getByRole("button",{name:"Fórmula",exact:true}).click();
  await dialog.getByRole("group",{name:"Teclado matemático"}).waitFor();
  if(width===320){
   const pad=dialog.getByRole("group",{name:"Teclado matemático"});
   await pad.getByRole("button",{name:"2",exact:true}).click();
   await pad.getByRole("button",{name:"+",exact:true}).click();
   await pad.getByRole("button",{name:"3",exact:true}).click();
  }else{
   await dialog.getByRole("button",{name:"Editar em LaTeX (alternativa por teclado)"}).click();
   await dialog.getByLabel("Expressão em LaTeX").fill("2+3");
  }
  await noOverflow(page,"formula "+width);
  await page.screenshot({path:"apps/web/visual-evidence/provas/formula-"+width+".png"});
  await dialog.getByRole("button",{name:"Inserir fórmula"}).click();
  await dialog.getByRole("button",{name:"Concluir edição"}).click();
  if(width<640){
   await dialog.getByRole("button",{name:"Adicionar pergunta",exact:true}).click();
   assert.equal(await dialog.getByRole("status").filter({hasText:"Pergunta 2 de 2"}).isVisible(),true);
   assert.equal(await dialog.getByLabel("Tipo do bloco 1",{exact:true}).count(),0,"only active question is mounted");
   await dialog.getByLabel("Tipo do bloco 2",{exact:true}).selectOption("escolha");
  }else{
   await dialog.getByRole("button",{name:"Escolha múltipla",exact:false}).click();
   assert.equal(await dialog.getByLabel("Tipo do bloco 1",{exact:true}).isVisible(),true,"desktop retains continuous editing");
  }
  await dialog.getByLabel("Enunciado 2",{exact:true}).fill("Qual é a unidade de energia?");
  for(const [i,value] of ["Joule","Watt","Newton","Pascal"].entries())await dialog.getByLabel("Alternativa "+String.fromCharCode(65+i)+" da pergunta 2",{exact:true}).fill(value);
  await dialog.getByLabel("Cotação da pergunta 2").fill("1.25");
  if(width<640){
   await dialog.getByRole("button",{name:"Anterior",exact:true}).click();
   assert.equal(await dialog.getByRole("spinbutton",{name:"Linhas para resposta 1"}).inputValue(),"7");
   assert.equal(await dialog.getByLabel("Enunciado 2",{exact:true}).count(),0);
   await dialog.getByRole("button",{name:"Próxima",exact:true}).click();
   assert.equal(await dialog.getByLabel("Alternativa A da pergunta 2").inputValue(),"Joule");
   await dialog.getByRole("button",{name:"Ir para bloco 1"}).click();
   await dialog.getByRole("button",{name:"Ir para bloco 2"}).click();
   assert.equal(await dialog.getByLabel("Cotação da pergunta 2").inputValue(),"1.25");
   assert.equal(await dialog.getByRole("button",{name:"Subir bloco 2"}).isVisible(),false);
   await dialog.getByText("Opções da pergunta",{exact:true}).click();
   await dialog.getByRole("button",{name:"Subir bloco 2"}).click();
   assert.equal(await dialog.getByLabel("Tipo do bloco 1",{exact:true}).inputValue(),"escolha");
   await dialog.getByText("Opções da pergunta",{exact:true}).click();
   await dialog.getByRole("button",{name:"Descer bloco 1"}).click();
   assert.equal(await dialog.getByLabel("Tipo do bloco 2",{exact:true}).inputValue(),"escolha");
   await dialog.getByRole("button",{name:"Adicionar pergunta",exact:true}).click();
   assert.equal(await dialog.getByLabel("Tipo do bloco 3",{exact:true}).inputValue(),"discursiva");
   await dialog.getByText("Opções da pergunta",{exact:true}).click();
   await dialog.getByRole("button",{name:"Remover bloco 3"}).click();
   assert.equal(await dialog.getByLabel("Alternativa D da pergunta 2").inputValue(),"Pascal");
   await noOverflow(page,"single question "+width);
   await page.screenshot({path:"apps/web/visual-evidence/provas/pergunta-individual-"+width+".png"});
  }
  await dialog.getByRole("button",{name:"Pré-visualizar"}).click();
  const preview=dialog.frameLocator('iframe[title="Pré-visualização A4 da prova"]');
  await preview.locator("math").waitFor();
  assert.equal(await preview.locator(".paper").getAttribute("data-layout"),"espacosa");
  assert.equal(await preview.locator(".linha").count(),7);
  assert.equal(await preview.locator(".alternativas li").count(),4);
  assert.match(await preview.locator(".cotacao").innerText(),/1,25/);
  await noOverflow(page,"preview "+width);
  await dialog.getByRole("button",{name:"Editar",exact:true}).click();
  if(width<640)assert.equal(await dialog.getByLabel("Alternativa B da pergunta 2").inputValue(),"Watt","preview returns to active block");
  await dialog.getByRole("button",{name:"Guardar rascunho"}).click();
  await dialog.getByRole("status").filter({hasText:"Prova guardada."}).waitFor();
  await dialog.getByRole("button",{name:"Fechar",exact:true}).click();
  await dialog.waitFor({state:"hidden"});
  await page.waitForFunction(()=>document.activeElement?.textContent?.includes("Nova prova"));
  assert.equal(errors.length,0,errors.join("\n"));
  await page.close();
  console.log("Mobile professor fixture passed:",width);
 }
}finally{await browser.close();}
