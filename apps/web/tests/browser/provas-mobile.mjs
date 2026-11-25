import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const {chromium,webkit}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const isWebKit=process.env.PROVAS_BROWSER==="webkit";
const year="20000000-0000-4000-8000-000000000001",matrix="70000000-0000-4000-8000-000000000001";
const user="10000000-0000-4000-8000-000000000001",id="30000000-0000-4000-8000-000000000001";
const base={id,autor_id:user,ano_letivo_id:year,curso_matriz_id:matrix,titulo:"Prova de Física",classe:"8.ª Classe",disciplina:"Física",ano_lectivo:"2026/2027",trimestre:1,duracao:90,serie:"A",estado:"aprovada",versao:3,atualizado_em:"2026-11-25T00:00:00Z",conteudo:[{tipo:"discursiva",texto:"Questão de teste",linhas:3}]};
const browser=await (isWebKit?webkit:chromium).launch({headless:true});
await mkdir("apps/web/visual-evidence/provas",{recursive:true});
const noOverflow=async(page,label)=>{
 const metrics=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,dialog:document.querySelector('[role="dialog"]')?.getBoundingClientRect().width}));
 assert.ok(metrics.scroll<=metrics.width+2,label+": page overflow "+JSON.stringify(metrics));
 if(metrics.dialog!==undefined)assert.ok(metrics.dialog<=metrics.width+2,label+": dialog overflow");
};
try{
 for(const [width,height] of (isWebKit?[[390,844]]:[[320,568],[390,844],[768,1024],[1280,800]])){
  const page=await browser.newPage({viewport:{width,height},hasTouch:width<640,isMobile:width<640});
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  let saved=null;
  await page.route("**/api/escola/**/provas**",async route=>{
   const req=route.request(),url=new URL(req.url());
   const reply=body=>route.fulfill({json:body});
   if(req.method()==="POST"){
    const data=req.postDataJSON();
    assert.equal(data.dados.ano_letivo_id,year);assert.equal(data.dados.curso_matriz_id,matrix);assert.equal(data.dados.conteudo[0].linhas,7);
    assert.ok(data.dados.conteudo[0].rich.segments.some(s=>s.kind==="math"&&s.latex===(width===320?"\\frac{7}{5}+2^{3}":width===390?"\\frac{7}{5}":"2+3")));
    assert.deepEqual(data.dados.conteudo[1].alternativas,["Joule","Watt","Newton","Pascal"]);
    assert.equal(data.dados.conteudo[1].cotacao_cent,125);
    assert.equal(data.dados.apresentacao,"espacosa");
    assert.equal(data.dados.titulo,"Prova Trimestral");
    assert.equal(data.dados.serie,"A");
    saved={...base,...data.dados,id:"30000000-0000-4000-8000-000000000002",estado:"rascunho",versao:1};
    return reply({prova:saved});
   }
   if(url.searchParams.get("branding")==="1")return reply({logo:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAAAoCAIAAADmAupWAAAAT0lEQVR4nO3PQRHAIADAMMAIQpCE//9cbHddoqCd+57xJ+vrgLcZrjNcZ7jOcJ3hOsN1husM1xmuM1xnuM5wneE6w3WG6wzXGa4zXGe47gEClwEVK6MyPwAAAABJRU5ErkJggg=="});
   if(url.searchParams.get("contexto")==="1")return reply({items:url.searchParams.has("ano")?[{ano_letivo_id:year,curso_matriz_id:matrix,ano_lectivo:"2026/2027",classe:"8.ª Classe",disciplina:"Física",curso:"Ensino Geral",trimestre:1,cotacao_max_cent:2000}]:[{id:year,ativo:true,label:"2026/2027"}]});
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
  assert.equal(await dialog.getByLabel("Título da prova",{exact:true}).count(),0);
  assert.equal(await dialog.getByLabel("Título automático",{exact:true}).innerText(),"Prova Trimestral de Física");
  await dialog.getByLabel("Tipo de prova",{exact:true}).selectOption("recurso");
  assert.equal(await dialog.getByLabel("Título automático",{exact:true}).innerText(),"Exame de Recurso de Física");
  await dialog.getByLabel("Tipo de prova",{exact:true}).selectOption("outro");
  assert.equal(await dialog.getByLabel("Título da prova",{exact:true}).inputValue(),"");
  if(width<640)assert.equal(await dialog.getByRole("button",{name:"Perguntas",exact:true}).isEnabled(),false);
  await dialog.getByLabel("Título da prova",{exact:true}).fill("Avaliação especial");
  await dialog.getByLabel("Tipo de prova",{exact:true}).selectOption("trimestral");
  assert.equal(await dialog.getByLabel("Título da prova",{exact:true}).count(),0);
  assert.equal(await dialog.getByLabel("Série",{exact:true}).isVisible(),false);
  await dialog.getByText(/Opções avançadas/).click();
  assert.equal(await dialog.getByLabel("Série",{exact:true}).inputValue(),"A");
  assert.equal(await dialog.getByLabel("Apresentação da folha").inputValue(),"automatica");
  await dialog.getByLabel("Apresentação da folha").selectOption("espacosa");
  if(width<640){
   assert.equal(await dialog.getByLabel("Enunciado 1",{exact:true}).isVisible(),false);
   await dialog.getByRole("button",{name:"Perguntas",exact:true}).click();
   await dialog.getByLabel("Enunciado 1",{exact:true}).fill("Calcula a soma.");
   await dialog.getByRole("button",{name:"Cabeçalho",exact:true}).click();
   if(!await dialog.getByLabel("Apresentação da folha").isVisible())await dialog.getByText(/Opções avançadas/).click();
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
   assert.equal(await dialog.getByRole("button",{name:"Subir bloco 1"}).count(),0);
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
  if(width<640){
   const enunciado=dialog.getByRole("textbox",{name:"Enunciado 1",exact:true});
   assert.equal(await dialog.getByRole("button",{name:"Negrito",exact:true}).isVisible(),false);
   await enunciado.focus();
   // Simulate the visual viewport shrinking while layout viewport remains unchanged,
   // as on iOS with the native keyboard. This is not a physical-device test.
   await page.evaluate(()=>{const vv=window.visualViewport;if(!vv)throw Error("Missing visual viewport");Object.defineProperty(vv,"height",{configurable:true,value:Math.max(220,vv.height-270)});vv.dispatchEvent(new Event("resize"));});
   await page.waitForFunction(()=>document.querySelector("[role=dialog]")?.getAttribute("data-keyboard-open")==="true");
   assert.equal(await dialog.locator("[data-modal-footer]").count(),0);
   assert.equal(await enunciado.isVisible(),true);
   const bounds=await dialog.locator("[data-modal-scroll]").boundingBox();
   assert.ok(bounds&&bounds.height>120,"typing surface must retain usable height");
   await noOverflow(page,"native keyboard "+width);
   await page.screenshot({path:"apps/web/visual-evidence/provas/teclado-"+(isWebKit?"webkit-":"")+width+".png"});
   await page.evaluate(()=>{const vv=window.visualViewport;Reflect.deleteProperty(vv,"height");vv.dispatchEvent(new Event("resize"));});
   await page.waitForFunction(()=>document.querySelector("[role=dialog]")?.getAttribute("data-keyboard-open")==="false");
  }
  await dialog.getByRole("button",{name:"Fórmula",exact:true}).click();
  const math=dialog.getByRole("region",{name:"Editor matemático"});
  await math.waitFor();
  assert.equal(await dialog.getByRole("button",{name:"Guardar rascunho"}).count(),0,"proof footer is absent during math editing");
  assert.equal(await dialog.getByRole("group",{name:"Formatação do enunciado"}).isVisible(),false);
  await math.getByRole("button",{name:"Fracção",exact:true}).click();
  await math.getByLabel("Numerador",{exact:true}).fill("7");
  await math.getByLabel("Denominador",{exact:true}).fill("5");
  if(width<640){
   await page.evaluate(()=>{const vv=window.visualViewport;Object.defineProperty(vv,"height",{configurable:true,value:Math.max(220,vv.height-270)});vv.dispatchEvent(new Event("resize"));});
   await page.waitForFunction(()=>document.querySelector("[role=dialog]")?.getAttribute("data-keyboard-open")==="true");
   assert.equal(await math.getByLabel("Denominador",{exact:true}).inputValue(),"5");
   assert.equal(await math.getByRole("button",{name:"Inserir fórmula",exact:true}).evaluate(el=>getComputedStyle(el.parentElement.parentElement).position),"static","formula actions must not cover focused inputs");
   await noOverflow(page,"formula native keyboard "+width);
   await page.evaluate(()=>{const vv=window.visualViewport;Reflect.deleteProperty(vv,"height");vv.dispatchEvent(new Event("resize"));});
   await page.waitForFunction(()=>document.querySelector("[role=dialog]")?.getAttribute("data-keyboard-open")==="false");
  }
  await math.getByRole("button",{name:"Alterar sinal de Numerador",exact:true}).click();
  assert.equal(await math.getByLabel("Numerador",{exact:true}).inputValue(),"-7");
  await math.getByRole("button",{name:"Alterar sinal de Numerador",exact:true}).click();
  assert.equal(await math.getByLabel("Pré-visualização do modelo").locator("mfrac").count(),1);
  if(width<640){
   assert.equal(await math.getByRole("button",{name:"Livre",exact:true}).count(),0);
   assert.equal(await math.getByRole("button",{name:"LaTeX",exact:true}).count(),0);
   assert.equal(await math.locator("math-field").count(),0);
   if(width===320){
    await math.getByRole("button",{name:"Adicionar à expressão",exact:true}).click();
    await math.getByRole("button",{name:"Adicionar componente",exact:true}).click();
    await math.getByRole("button",{name:"Potência",exact:true}).click();
    await math.getByRole("button",{name:"Adicionar à expressão",exact:true}).click();
    assert.equal(await math.getByLabel("Pré-visualização da expressão").locator("mfrac").count(),1);
    assert.equal(await math.getByLabel("Pré-visualização da expressão").locator("msup").count(),1);
   }
  }else{
   await math.getByRole("button",{name:"LaTeX",exact:true}).click();
   await math.getByLabel("Expressão em LaTeX").fill("2+3");
  }
  await noOverflow(page,"formula "+width);
  if(width<640){await page.setViewportSize({width,height:360});await noOverflow(page,"short formula viewport "+width);await math.getByRole("button",{name:"Inserir fórmula",exact:true}).scrollIntoViewIfNeeded();await page.setViewportSize({width,height});}
  await page.screenshot({path:"apps/web/visual-evidence/provas/formula-"+(isWebKit?"webkit-":"")+width+".png"});
  await dialog.getByRole("button",{name:"Inserir fórmula"}).click();
  await dialog.getByRole("group",{name:"Formatação do enunciado"}).waitFor();
  if(width<640){
   await dialog.getByRole("textbox",{name:"Enunciado 1"}).locator("math").click();
   await dialog.getByRole("button",{name:"Editar fórmula",exact:true}).click();
   await math.getByRole("button",{name:"Editar componente 1",exact:true}).click();
   assert.equal(await math.getByLabel("Numerador",{exact:true}).inputValue(),"7");
   assert.equal(await math.getByLabel("Denominador",{exact:true}).inputValue(),"5");
   await math.getByLabel("Numerador",{exact:true}).fill("8");
   await math.getByLabel("Numerador",{exact:true}).fill("7");
   await math.getByRole("button",{name:"Actualizar fórmula",exact:true}).click();
   await dialog.getByRole("group",{name:"Formatação do enunciado"}).waitFor();
   assert.equal(await dialog.getByRole("textbox",{name:"Enunciado 1"}).locator("math").count(),1,"update replaces, never duplicates");
  }
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
  await dialog.getByLabel("Cotação da pergunta 2").fill("21,5");
  assert.match(await dialog.innerText(),/Excesso de 1,5 valores/);
  await dialog.getByLabel("Cotação da pergunta 2").fill("1,25");
  assert.match(await dialog.getByRole("progressbar",{name:"Cotação atribuída"}).getAttribute("aria-valuetext"),/1,25 de 20/);
  if(width<640){
   await dialog.getByRole("button",{name:"Anterior",exact:true}).click();
   assert.equal(await dialog.getByRole("spinbutton",{name:"Linhas para resposta 1"}).inputValue(),"7");
   assert.equal(await dialog.getByLabel("Enunciado 2",{exact:true}).count(),0);
   await dialog.getByRole("button",{name:"Próxima",exact:true}).click();
   assert.equal(await dialog.getByLabel("Alternativa A da pergunta 2").inputValue(),"Joule");
   await dialog.getByRole("button",{name:"Ir para bloco 1"}).click();
   await dialog.getByRole("button",{name:"Ir para bloco 2"}).click();
   assert.equal(await dialog.getByLabel("Cotação da pergunta 2").inputValue(),"1,25");
   assert.equal(await dialog.getByRole("button",{name:"Subir bloco 2"}).count(),0);
   await dialog.getByRole("button",{name:"Adicionar pergunta",exact:true}).click();
   assert.equal(await dialog.getByLabel("Tipo do bloco 3",{exact:true}).inputValue(),"discursiva");
   await dialog.getByLabel("Tipo do bloco 3",{exact:true}).selectOption("calculo");
   await dialog.getByRole("button",{name:"Inserir fórmula",exact:true}).click();
   await dialog.getByRole("region",{name:"Editor matemático"}).waitFor();
   await dialog.getByRole("button",{name:"Cancelar",exact:true}).click();
   await dialog.getByRole("button",{name:"Concluir edição",exact:true}).click();
   await dialog.getByText("Opções da pergunta",{exact:true}).click();
   await dialog.getByRole("button",{name:"Remover bloco 3"}).click();
   assert.equal(await dialog.getByLabel("Alternativa D da pergunta 2").inputValue(),"Pascal");
   await noOverflow(page,"single question "+width);
   await page.screenshot({path:"apps/web/visual-evidence/provas/pergunta-individual-"+width+".png"});
  }
  await dialog.getByRole("button",{name:"Organizar perguntas",exact:true}).click();
  const order=dialog.getByRole("region",{name:"Organizar perguntas",exact:true});
  await order.getByRole("list",{name:"Ordem dos blocos"}).waitFor();
  assert.equal(await dialog.getByLabel("Enunciado 2",{exact:true}).count(),0,"organizer does not render question editor");
  const first=order.getByTestId("prova-order-row-0"),second=order.getByTestId("prova-order-row-1");
  assert.match(await first.innerText(),/Calcula a soma/);
  assert.match(await second.innerText(),/Qual é a unidade/);
  assert.equal((await order.getByRole("button",{name:"Posição do bloco 2",exact:true}).innerText()).trim(),"2");
   await order.getByRole("button",{name:"Posição do bloco 2",exact:true}).click();
   await second.getByRole("button",{name:"Mover para posição 1",exact:true}).click();
  await first.getByText(/Qual é a unidade/).waitFor();
  assert.match(await first.innerText(),/Qual é a unidade/);
   assert.equal((await order.getByRole("button",{name:"Posição do bloco 1",exact:true}).innerText()).trim(),"1");
   assert.equal((await order.getByRole("button",{name:"Posição do bloco 2",exact:true}).innerText()).trim(),"2");
  if(width>=640){
   const handle=order.getByRole("button",{name:"Arrastar bloco 1"});const from=await handle.boundingBox(),to=await second.boundingBox();
   assert.ok(from&&to);
   await page.mouse.move(from.x+from.width/2,from.y+from.height/2);
   await page.mouse.down();await page.mouse.move(from.x+from.width/2+8,from.y+from.height/2,{steps:2});
   await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:12});
   await page.mouse.up();
   await first.getByText(/Calcula a soma/).waitFor();
  }else if(!isWebKit){
   // Real touch pointer gesture in Chromium; scroll remains available outside handle.
   const handle=order.getByRole("button",{name:"Arrastar bloco 1"});const from=await handle.boundingBox(),to=await second.boundingBox();
   assert.ok(from&&to);
   const cdp=await page.context().newCDPSession(page);
   const x=from.x+from.width/2,y=from.y+from.height/2,target=to.y+to.height/2;
   await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x,y}]});
   for(let i=1;i<=10;i++)await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x,y:y+(target-y)*i/10}]});
   await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
   await cdp.detach();
   await first.getByText(/Calcula a soma/).waitFor();
  }else{
   await order.getByRole("button",{name:"Posição do bloco 1",exact:true}).click();
    await first.getByRole("button",{name:"Mover para posição 2",exact:true}).click();
    await first.getByText(/Calcula a soma/).waitFor();
    assert.equal((await order.getByRole("button",{name:"Posição do bloco 2",exact:true}).innerText()).trim(),"2");
    await order.getByRole("button",{name:"Posição do bloco 1",exact:true}).click();
    await first.getByRole("button",{name:"Mover para posição 2",exact:true}).click();
    await first.getByText(/Qual é a unidade/).waitFor();
    await order.getByRole("button",{name:"Posição do bloco 1",exact:true}).click();
    await first.getByRole("button",{name:"Mover para posição 2",exact:true}).click();
    await first.getByText(/Calcula a soma/).waitFor();
  }
  await second.getByText(/Qual é a unidade/).waitFor();
  assert.match(await second.innerText(),/Qual é a unidade/);
  await noOverflow(page,"organizer "+width);
  await page.screenshot({path:"apps/web/visual-evidence/provas/organizador-"+width+".png"});
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
  await create.click();
  await dialog.getByLabel("Ano lectivo",{exact:true}).selectOption(year);
  await dialog.getByLabel("Classe e disciplina").selectOption(matrix);
  if(width<640)await dialog.getByRole("button",{name:"Perguntas",exact:true}).click();
  await dialog.getByLabel("Tipo do bloco 1",{exact:true}).selectOption("grupo");
  await dialog.getByLabel("Título do grupo 1",{exact:true}).fill("I Grupo");
  assert.equal(await dialog.getByLabel("Cotação da pergunta 1",{exact:true}).count(),0);
  await dialog.getByText("Adicionar elemento de estrutura",{exact:true}).click();
  await dialog.getByRole("button",{name:/^Texto de apoio Conteúdo de referência/}).click();
  await dialog.getByLabel("Texto de apoio 2",{exact:true}).fill("Leia o texto antes de responder.");
  assert.equal(await dialog.getByLabel("Linhas para resposta 2",{exact:true}).count(),0);
  assert.equal(await dialog.getByLabel("Cotação da pergunta 2",{exact:true}).count(),0);
  if(width<640){
   assert.equal(await dialog.getByRole("button",{name:"Ir para bloco 2 — Texto de apoio",exact:true}).count(),1);
   await dialog.getByRole("button",{name:"Adicionar pergunta",exact:true}).click();
   assert.match(await dialog.getByRole("status").filter({hasText:"Pergunta 1 · posição 3 de 3"}).innerText(),/Pergunta 1/);
  }else await dialog.getByLabel("Adicionar pergunta ou bloco").selectOption("discursiva");
  await dialog.getByLabel("Enunciado 1",{exact:true}).fill("Identifica a ideia principal.");
  await dialog.getByRole("button",{name:"Pré-visualizar"}).click();
  await preview.locator(".apoio").waitFor();
  assert.equal(await preview.locator(".question-number").innerText(),"1.");
  assert.equal(await preview.locator(".apoio").innerText(),"Leia o texto antes de responder.");
  assert.equal(await preview.locator("h3 + .apoio + .questao").count(),1);
  await noOverflow(page,"estrutura "+width);
  assert.equal(errors.length,0,errors.join("\n"));
  await page.close();
  console.log("Mobile professor fixture passed:",width);
 }
}finally{await browser.close();}
