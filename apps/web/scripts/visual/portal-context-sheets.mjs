import assert from "node:assert/strict";
import { mkdir,writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const mod=process.env.PLAYWRIGHT_MODULE||"playwright";
const { chromium }=await import(mod.startsWith("/")?pathToFileURL(mod).href:mod);
const base=process.env.STORYBOOK_BASE_URL||"http://127.0.0.1:6006";
const dir="apps/web/visual-evidence";
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[];
async function validateDrawerData() {
  const page = await browser.newPage();
  const counts = new Map();
  const writes = [];
  let release;
  const slow = new Promise(resolve => { release = resolve; });
  const roster = "/api/professor/turmas/fixture-class/alunos";
  const responses = {
    "/api/professor/atribuicoes": { ok: true, items: [{ id: "assignment", turma: {id:"fixture-class", nome:"Turma A"}, disciplina: {id:"disc", nome:"Matemática"} }] },
    [roster]: { ok: true, items: [{id:"fixture-student", nome:"Aluno sintético", matricula_id:"fixture-enrollment"}] },
    "/api/aluno/rematricula/status": { ok: true, eligible: true, nextAno: 2027, rematricula: { service: { nome: "Rematrícula", valor: 2500 }, services: [] } },
    "/api/aluno/disciplinas": { ok: true, disciplinas: [{ id: "disc", nome: "Disciplina sintética", periodos_ativos: [1] }] },
    "/api/aluno/faltas": { ok: true, resumo: {faltas: 0, presencas: 1, atrasos: 0}, items: [] },
    "/api/aluno/minhas-notas": { ok: true, matricula_encontrada: true, is_liberado: true, disciplinas: [] },
    "/api/aluno/documentos/catalogo": { ok: true, documentos: [], boletim_pago: true },
  };
  await page.route("**/api/**", async route => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    counts.set(path, (counts.get(path) ?? 0) + 1);
    if (req.method() === "POST") writes.push({path, body: req.postDataJSON()});
    if (path === "/api/aluno/disciplinas") await slow;
    await route.fulfill({json: responses[path] ?? {ok: true}});
  });
  const open = async flow => {
    await page.goto(base + "/?story=drawer-data&flow=" + flow);
    await page.getByRole("button", {name: "Abrir portal"}).click();
  };
  try {
    await open("academic");
    const response = page.waitForResponse(r => new URL(r.url()).pathname === "/api/aluno/disciplinas");
    const area = page.getByRole("tabpanel", {name: "Disciplinas"});
    await page.getByRole("tab", {name: "Disciplinas"}).click();
    await area.getByText("A carregar disciplinas").waitFor({state:"attached"});
    release();
    await response;
    await area.getByText("Disciplina sintética").waitFor();
    await page.waitForLoadState("networkidle");
    const loaded = Object.fromEntries(counts);
    for (const name of ["Faltas", "Documentos", "Notas", "Disciplinas"]) {
      await page.getByRole("tab", {name, exact:true}).click();
      await page.getByRole("tabpanel", {name, exact:true}).waitFor();
    }
    await area.getByText("Disciplina sintética").waitFor();
    await page.waitForLoadState("networkidle");
    assert.deepEqual(Object.fromEntries(counts), loaded, "tab switches repeated API calls");
    await open("withdrawal");
    await page.getByRole("button", {name:"Outras ações para Aluno sintético"}).click();
    await page.getByRole("button", {name:"Sinalizar desistência"}).click();
    const signal = page.getByRole("region", {name:"Sinalizar possível desistência"});
    await signal.getByRole("textbox").fill("Sinalização sintética para teste.");
    assert.equal(await page.getByRole("dialog").count(), 1);
    await signal.getByRole("button", {name:"Enviar sinalização"}).click();
    await signal.getByText("Sinalização enviada à Secretaria.").waitFor();
    await signal.getByRole("button", {name:"Fechar", exact:true}).click();
    await page.getByText("Aluno sintético", {exact:true}).waitFor();
    assert.equal(counts.get(roster), 1, "opening the signal refetched the roster");
    await open("enrollment");
    const review = page.getByRole("button", {name:"Continuar para pagamento"});
    await review.click();
    assert.equal(await page.getByRole("dialog").count(), 1);
    await page.getByRole("button", {name:"Rever serviços"}).click();
    await review.click();
    const path = "/api/aluno/rematricula/iniciar";
    assert.equal(writes.filter(w => w.path === path).length, 0);
    const refreshed = page.waitForResponse(r => new URL(r.url()).pathname === "/api/aluno/rematricula/status");
    await page.getByRole("button", {name:"Confirmar e iniciar pagamento"}).click();
    await refreshed;
    assert.deepEqual(writes.filter(w => w.path === path), [{path, body:{servicos_ids:[]}}]);
    results.push({scenario:"drawer-data", initialAcademicRequests:loaded, requestsOnTabSwitch:0});
  } finally {
    release();
    await page.close();
  }
}
try {
  await validateDrawerData();
  for (const viewport of [{width:390,height:844},{width:768,height:1024},{width:1024,height:768},{width:1366,height:768}]) {
    for (const reducedMotion of ["reduce","no-preference"]) {
      const ctx=await browser.newContext({viewport,reducedMotion});
      try {
        const page=await ctx.newPage();
        await page.route("**/api/secretaria/atendimentos?*",route=>route.fulfill({json:{ok:true,items:[]}}));
        await page.goto(base+"/?story=dashboard-dialog-geometry");
        for (const mode of ["compact","medium","expanded","modal","queue"]) {
          const opener=page.getByRole("button",{name:"Abrir "+mode,exact:true});
          await opener.click();
          const dialog=page.getByRole("dialog",{name:mode==="modal"?"Operação sintética":mode==="queue"?"Fila de Atendimento":"Consulta sintética"});
          await dialog.waitFor();
          await dialog.evaluate(async el=>{await Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{})))});
          const geometry=await dialog.evaluate(el=>{
            // ModalShell owns the full viewport; its inner section is the visible panel.
            const panel=el.querySelector(":scope > section")??el;
            const r=panel.getBoundingClientRect();
            return {x:r.x,y:r.y,w:r.width,h:r.height,vw:innerWidth,vh:innerHeight,focus:el.contains(document.activeElement)};
          });
          assert.ok(Math.abs(geometry.x+geometry.w/2-geometry.vw/2)<=2,JSON.stringify({mode,geometry}));
          assert.ok(geometry.x>=-1&&geometry.y>=-1&&geometry.y+geometry.h<=geometry.vh+1,JSON.stringify({mode,geometry}));
          if(viewport.width>=768||mode==="modal"||mode==="queue"){
            assert.ok(Math.abs(geometry.y+geometry.h/2-geometry.vh/2)<=2,JSON.stringify({mode,geometry}));
          }else{
            assert.ok(Math.abs(geometry.y+geometry.h-geometry.vh)<=2,JSON.stringify({mode,geometry}));
          }
          assert.ok(geometry.focus,"initial dialog focus: "+mode);
          await page.keyboard.press("Escape");
          await dialog.waitFor({state:"hidden"});
          if(mode!=="queue"&&mode!=="modal") await page.waitForFunction(label=>document.activeElement?.textContent?.trim()===label,"Abrir "+mode);
        }
        if(viewport.width>=768){
          await page.goto(base+"/?story=operations-academic-card");
          await page.getByRole("button",{name:"Evento de hoje"}).click();
          const event=page.getByRole("dialog",{name:"Evento de hoje"});
          await event.waitFor();
          await event.evaluate(async el=>{await Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{})))});
          assert.ok(await event.evaluate(el=>{const r=el.getBoundingClientRect();return Math.abs(r.x+r.width/2-innerWidth/2)<=2&&Math.abs(r.y+r.height/2-innerHeight/2)<=2;}),"academic banner modal not centered");
          await page.keyboard.press("Escape");
          await event.waitFor({state:"hidden"});
        }
        results.push({viewport,reducedMotion,centeredDialogs:true});
      } finally { await ctx.close(); }
    }
  }
  for(const reduced of ["no-preference","reduce"]){
    const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:reduced});
    const page=await ctx.newPage();
    let requests=0, release;
    const pending=new Promise(resolve=>{release=resolve});
    await page.route("**/api/aluno/financeiro/comprovativo",async route=>{
      requests++;
      await pending;
      await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true})});
    });
    try{
      await page.goto(base+"/?story=portal-payment-sheet");
      const opener=page.getByRole("button",{name:"Pagar propinas"});
      await opener.click();
      const sheet=page.getByRole("dialog",{name:"Pagamento consolidado"});
      await sheet.waitFor();
      await sheet.evaluate(async el=>{await Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{})))});
      assert.ok(await sheet.evaluate(el=>{const r=el.getBoundingClientRect();return r.bottom<=innerHeight+1&&r.top>=0&&r.width<=innerWidth+1&&el.contains(document.activeElement)}),"sheet geometry or initial focus");
      await page.keyboard.press("Escape");
      await sheet.waitFor({state:"hidden"});
      await page.waitForFunction(()=>document.activeElement?.textContent?.includes("Pagar propinas"));
      await opener.click();
      await sheet.waitFor();
      await sheet.locator('input[type="file"]').setInputFiles({name:"fixture.pdf",mimeType:"application/pdf",buffer:Buffer.from("%PDF-1.4 fixture")});
      await sheet.getByText("Ficheiro seleccionado:",{exact:false}).waitFor();
      assert.equal(requests,0,"selection triggered upload");
      const submit=sheet.getByRole("button",{name:"Confirmar e enviar comprovativo"});
      await submit.click();
      await page.waitForFunction(()=>document.querySelector('[role="dialog"] button[disabled]')!==null);
      await page.keyboard.press("Escape");
      assert.ok(await sheet.isVisible(),"sheet dismissed during upload");
      await page.mouse.click(10,10);
      assert.ok(await sheet.isVisible(),"outside touch dismissed a pending upload");
      assert.ok(await sheet.evaluate(el=>el.contains(document.activeElement)),"outside touch lost payment focus");
      release();
      await sheet.waitFor({state:"hidden"});
      await page.getByTestId("receipt-status").getByText("Recebido").waitFor();
      assert.equal(requests,1,"duplicate or missing upload");
      await page.waitForFunction(()=>document.activeElement?.textContent?.includes("Pagar propinas"));
      results.push({reduced,requests,passed:true});
      await page.goto(base+"/?story=operations-academic-card");
      const eventButton=page.getByRole("button",{name:"Evento de hoje"});
      await eventButton.click();
      const event=page.getByRole("dialog",{name:"Evento de hoje"});
      await event.getByText("Reunião pedagógica sintética").waitFor();
      await page.keyboard.press("Escape");
      await event.waitFor({state:"hidden"});
      await page.waitForFunction(()=>document.activeElement?.textContent?.includes("Evento de hoje"));
      assert.ok((await page.getByRole("link",{name:"Calendário académico"}).getAttribute("href")).endsWith("/operacoes/calendario"));
      await page.goto(base+"/?story=professor-calendar-context");
      const details=page.getByRole("button",{name:"Ver detalhes de Reunião pedagógica"});
      await details.click();
      const detail=page.getByRole("dialog",{name:"Reunião pedagógica"});
      await detail.getByText("Informações completas da reunião pedagógica sintética.",{exact:false}).waitFor();
      await page.keyboard.press("Escape");
      await detail.waitFor({state:"hidden"});
      await page.waitForFunction(()=>document.activeElement?.getAttribute("aria-label")==="Ver detalhes de Reunião pedagógica");
      await page.getByRole("button",{name:"Ver períodos"}).click();
      const periods=page.getByRole("dialog",{name:"Períodos lectivos"});
      await periods.getByText("Os períodos lectivos ainda não foram configurados",{exact:false}).waitFor();
      await page.keyboard.press("Escape");
      await periods.waitFor({state:"hidden"});

      await page.getByRole("button",{name:"Histórico de avaliações"}).click();
      const history=page.getByRole("dialog",{name:"Histórico de avaliações"});
      await history.getByText("Avaliação anterior sintética",{exact:true}).waitFor();
      await page.keyboard.press("Escape");
      await history.waitFor({state:"hidden"});

      await page.goto(base+"/?story=professor-com-turmas");
      const turmaButton=page.getByRole("button",{name:/Matemática.*Língua Portuguesa/}).first();
      await turmaButton.click();
      const turmaSheet=page.getByRole("dialog");
      await turmaSheet.getByText("Aluno sintético",{exact:true}).waitFor();
      await page.keyboard.press("Escape");
      await turmaSheet.waitFor({state:"hidden"});
      const agendaButton=page.getByRole("button",{name:/08:00.*Matemática/});
      await agendaButton.click();
      const aulaSheet=page.getByRole("dialog",{name:"Matemática"});
      await aulaSheet.getByText("Sala sintética",{exact:true}).waitFor();
      await page.keyboard.press("Escape");
      await aulaSheet.waitFor({state:"hidden"});

      await page.goto(base+"/?story=dashboard-clean");
      const nextLesson=page.getByRole("region",{name:"Próxima aula"}).getByRole("button").first();
      await nextLesson.click();
      const daily=page.getByRole("dialog",{name:"Horário diário"});
      await daily.getByRole("button",{name:"Seg",exact:true}).click();
      await daily.getByText("Matemática sintética",{exact:true}).waitFor();
      await page.keyboard.press("Escape");
      await daily.waitFor({state:"hidden"});

      // Both consultation and the official PDF require payment.
      for(const mode of ["grade-paid","grade-unpaid","grade-pending","grade-rejected","grade-empty"]){
        await page.goto(base+"/?story="+mode);
        const grid=page.getByTestId("aluno-boletim-grid");
        const trigger=grid.getByRole("button",{name:"Ver detalhes de Matemática"});
        await trigger.waitFor();
        const locked=["grade-unpaid","grade-pending","grade-rejected"].includes(mode);
        if(locked){
          assert.ok(await grid.getByRole("button",{name:"Imprimir boletim indisponível até à liberação"}).isDisabled(),"unpaid official PDF became available");
          assert.ok(await grid.getByRole("button",{name:"Exibir notas indisponível até à liberação do boletim"}).isDisabled(),"unpaid grades became available");
        }
        await trigger.click();
        const grades=page.getByRole("dialog",{name:"Matemática",exact:true});
        if(locked || mode==="grade-empty"){
          await grades.getByText(locked?"Consulta o estado do boletim para aceder às notas.":"Sem avaliações publicadas.",{exact:true}).waitFor();
          assert.equal(await grades.locator('[aria-label^="Nota "]').count(),0,"protected scores disclosed");
          assert.equal(await grades.getByText("Prova trimestral",{exact:true}).count(),0);
          assert.equal(await grades.getByRole("button",{name:"Pedir reapreciação"}).count(),0);
          assert.equal(await grades.getByRole("button",{name:"Solicitar melhoria"}).count(),0);
        } else {
          await grades.getByText("Prova trimestral",{exact:true}).waitFor();
          await grades.getByLabel("Nota 16",{exact:true}).waitFor();
          assert.equal(await grid.getByTestId("boletim-assessment-details").count(),0,"assessment detail duplicated in grid");
        }
        await page.keyboard.press("Escape");
        await grades.waitFor({state:"hidden"});
        await page.waitForFunction(()=>document.activeElement?.getAttribute("aria-label")==="Ver detalhes de Matemática");
        if(mode==="grade-paid"){
          await page.getByRole("button",{name:"Situação académica"}).click();
          const academic=page.getByRole("dialog",{name:"Situação académica"});
          await academic.getByText("Nenhuma dependência académica encontrada.").waitFor();
          await page.keyboard.press("Escape");
          await academic.waitFor({state:"hidden"});
        }
      }

      let financeRequests=0;
      await page.route("**/api/aluno/financeiro?*",async route=>{
        financeRequests++;
        const u=new URL(route.request().url());
        const year=u.searchParams.get("toAno");
        await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true,mensalidades:[{id:"fixture-month",competencia:year+"-11",valor:5000,status:"pendente",vencimento:year+"-11-10"}],servicos:[{id:"fixture-service",nome:"Declaração sintética",valor:1000,status:"em_verificacao",estado_label:"Em validação",mensagem_estado:"Comprovativo recebido",proximo_passo:"Aguardar secretaria",protocolo:"FIX-01",data:"2026-11-01",acao:null}],movimentos:[],resumo:{saldo_consolidado:5000,total_pago:0,total_pendente:5000,em_dia:false}})});
      });
      await page.goto(base+"/?story=portal-finance-context");
      const filter=page.getByRole("button",{name:/Filtrar período/});
      await page.getByRole("heading",{name:"Mensalidades"}).waitFor();
      await filter.click();
      const filterSheet=page.getByRole("dialog",{name:"Filtrar período"});
      const oldFrom=Number(await filterSheet.getByRole("combobox",{name:"De",exact:true}).inputValue());
      const oldTo=Number(await filterSheet.getByRole("combobox",{name:"Até",exact:true}).inputValue());
      const count=financeRequests;
      await filterSheet.getByRole("combobox",{name:"De",exact:true}).selectOption(String(oldTo+1));
      assert.ok(await filterSheet.getByRole("button",{name:"Aplicar filtro"}).isDisabled());
      await filterSheet.getByRole("combobox",{name:"De",exact:true}).selectOption(String(oldFrom-1));
      await filterSheet.getByRole("combobox",{name:"Até",exact:true}).selectOption(String(oldTo-1));
      assert.equal(financeRequests,count,"draft filters requested data");
      await filterSheet.getByRole("button",{name:"Aplicar filtro"}).click();
      await filterSheet.waitFor({state:"hidden"});
      await page.getByRole("button",{name:new RegExp(String(oldTo-1)+"-11")}).click();
      const monthly=page.getByRole("dialog",{name:/Propina/});
      await monthly.getByText("Saldo por liquidar").waitFor();
      await monthly.getByRole("button",{name:"Enviar comprovativo"}).click();
      const single=page.getByRole("dialog",{name:"Pagamento consolidado"});
      await single.waitFor();
      await page.keyboard.press("Escape");
      await single.waitFor({state:"hidden"});
      await monthly.waitFor();
      await page.keyboard.press("Escape");
      await monthly.waitFor({state:"hidden"});
      await page.getByRole("button",{name:/Declaração sintética/}).click();
      const service=page.getByRole("dialog",{name:"Declaração sintética"});
      await service.getByText("FIX-01").waitFor();
      await service.getByText("Comprovativo recebido").waitFor();
      await page.keyboard.press("Escape");
      await service.waitFor({state:"hidden"});

      let absencePosted=0;
      await page.route(/\/api\/aluno\/faltas(?:\?.*)?$/,async route=>{
        if(route.request().method()==="POST"){
          absencePosted++;
          assert.equal(route.request().postDataJSON().frequencia_id,"fixture-absence");
          await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true})});
          return;
        }
        await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true,can_submit:true,resumo:{faltas:1,presencas:3,atrasos:0},items:[{id:"fixture-absence",data:"2026-11-20",disciplina_nome:"Matemática",periodo_letivo_id:null,justificacao:absencePosted?{id:"fixture-petition",motivo:"Justificação sintética de teste.",status:"pending",decision_reason:null,created_at:"2026-11-26"}:null}],has_more:false,taxa:null})});
      });
      await page.goto(base+"/?story=portal-absence-context");
      await page.getByRole("button",{name:"Solicitar justificação"}).click();
      const absence=page.getByRole("dialog",{name:"Matemática"});
      assert.ok(await absence.getByRole("button",{name:"Enviar justificação"}).isDisabled());
      await absence.getByRole("textbox",{name:"Motivo da ausência"}).fill("Justificação sintética de teste.");
      await absence.getByRole("button",{name:"Enviar justificação"}).click();
      await absence.waitFor({state:"hidden"});
      await page.getByText("Em análise",{exact:true}).waitFor();
      assert.equal(absencePosted,1);
    }finally{release();await ctx.close();}
  }
}finally{await browser.close();await writeFile(dir+"/portal-context-sheets.json",JSON.stringify(results,null,2));}
console.log("Contextual sheet tests passed",results);
