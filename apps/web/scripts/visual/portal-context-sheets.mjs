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
    if (path === "/api/escola/fixture/provas") {
      const offset = Number(new URL(req.url()).searchParams.get("offset"));
      const provas = Array.from({length:offset ? 1 : 30}, (_,i) => ({id:String(offset+i), titulo:"Prova " + (offset+i), classe:"7ª", trimestre:1, estado:"rascunho"}));
      await route.fulfill({json:{permissions:{author:true},provas}});
      return;
    }
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
    await open("exams");
    await page.getByRole("button",{name:"Seguinte"}).click();
    await page.getByRole("button",{name:"Anterior"}).click();
    await page.getByRole("button",{name:"Seguinte"}).click();
    assert.equal(counts.get("/api/escola/fixture/provas"),2);
    assert.equal(await page.getByRole("dialog").count(),1);
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
  await validateDashboardNavigation();
  await validateGradeAndPaymentRequests();
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

async function validateDashboardNavigation() {
  const page = await browser.newPage({ viewport:{width:390,height:844} });
  const dialog = page.getByRole("dialog");
  const failures = [];
  page.on("pageerror", err => failures.push(err.message));
  const visit = async story => {
    await page.goto(base + "/?story=" + story);
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => {
      window.drawerRequests = [];
      const fetch = window.fetch.bind(window);
      window.fetch = (input, init) => {
        const url = new URL(typeof input === "string" ? input : input.url ?? input, location.href);
        url.searchParams.sort();
        window.drawerRequests.push({ path: url.pathname, key: (init?.method ?? input?.method ?? "GET").toUpperCase() + " " + url.pathname + url.search });
        return fetch(input, init);
      };
    });
  };
  const count = path => page.evaluate(path => window.drawerRequests.filter(request => request.path === path).length, path);
  const reads = async paths => page.evaluate(paths => window.drawerRequests.filter(request => request.key.startsWith("GET ") && paths.some(path => request.path === path || (path.endsWith("*") && request.path.startsWith(path.slice(0,-1))))).map(request => request.key).sort(), paths);
  const assertNoRepeat = async (paths, action, label) => {
    await page.waitForLoadState("networkidle");
    const before = await reads(paths);
    await action();
    await page.waitForLoadState("networkidle");
    assert.deepEqual(await reads(paths), before, `${label}: repeated GET`);
    console.log("Drawer request budget:", label, "0 redundant GETs", paths.join(", "));
  };
  const click = (scope, name) => scope.getByRole("button", {name,exact:true}).first().click();
  const child = async (name, title) => {
    console.log("Drawer navigation:", name, "→", title);
    const parent = await dialog.getAttribute("aria-labelledby");
    const heading = await page.locator("[id]").evaluateAll((els, id) => els.find(el => el.id === id)?.textContent, parent);
    await click(dialog, name);
    await page.getByRole("dialog",{name:title,exact:true}).waitFor();
    assert.equal(await dialog.count(), 1);
    if (title === "Materiais pedagógicos") {
      const before = await count("/api/professor/materiais-pedagogicos");
      await click(dialog,"Novo Material");
      assert.equal(await page.getByRole("dialog").count(),1);
      await click(dialog,"Cancelar");
      assert.equal(await count("/api/professor/materiais-pedagogicos"),before);
    }
    await page.evaluate(() => history.back());
    await page.getByRole("dialog",{name:heading,exact:true}).waitFor();
  };
  const close = async () => { await page.keyboard.press("Escape"); await dialog.waitFor({state:"hidden"}); };
  try {
    await page.route("**/api/**", route => {
      const path = new URL(route.request().url()).pathname;
      const data = path.endsWith("/calendario") ? {ok:true,periodos:[],items:[{id:"evt",nome:"Reunião sintética",descricao:"Detalhe do evento",data_inicio:"2099-12-01",data_fim:"2099-12-01",tipo:"REUNIAO"}]} : path.endsWith("/avisos") ? {ok:true,avisos:[{id:"notice",titulo:"Circular sintética",resumo:"Mensagem"}]}
        : path.endsWith("/financeiro") ? {ok:true,mensalidades:[{id:"month",competencia:"2026-11",valor:500,status:"pendente"}],servicos:[{id:"service",nome:"Serviço sintético",valor:500,status:"pendente",acao:{label:"Consultar",href:"/aluno/documentos?servico=DOC"}}],movimentos:[]}
        : path.endsWith("/pauta") ? [] : {ok:true,items:[],periodos:[],eventos:[],slots:[],assignments:[]};
      return route.fulfill({json:data});
    });
    await visit("dashboard-clean");
    await page.locator("section").filter({has:page.getByRole("heading",{name:"Próxima aula",exact:true})}).last().getByRole("button").first().click();
    await click(dialog,"Consultar horário completo");
    for (const tab of ["Próximos eventos","Aulas","Próximos eventos"]) await click(dialog,tab);
    assert.equal(await count("/api/aluno/horario"),1);
    assert.equal(await count("/api/aluno/home/academic-events"),1);
    await close();
    await page.getByRole("button",{name:/Reunião de encarregados/}).first().click();
    await click(dialog,"Ver todos os avisos");
    await assertNoRepeat(["/api/aluno/avisos"], () => child(/Circular sintética/,"Circular sintética"), "Aviso: detalhe e retorno");
    await close();
    await page.getByTestId("aluno-summary-cards").getByRole("button",{name:/^Propinas vencidas/}).click();
    await assertNoRepeat(["/api/aluno/financeiro"], async () => {
      await click(dialog,/^Filtrar período/);
      await dialog.getByRole("region",{name:"Filtrar período"}).getByRole("button",{name:"Voltar"}).click();
      await click(dialog,/2026-11/);
      await click(dialog,"Enviar comprovativo");
      await dialog.getByRole("region",{name:"Pagamento consolidado"}).waitFor();
      assert.equal(await page.getByRole("dialog").count(),1);
      await dialog.getByRole("region",{name:"Pagamento consolidado"}).getByRole("button",{name:"Voltar",exact:true}).first().click();
    }, "Financeiro: filtro sem aplicar, propina e pagamento sem confirmar");
    await click(dialog,/Serviço sintético/);
    await child(/Secretaria Digital/,"Documentos e serviços");
    await assertNoRepeat(["/api/aluno/documentos/catalogo"], () => child(/Secretaria Digital/,"Documentos e serviços"), "Serviço: reentrada na Secretaria Digital");
    await close();
    await visit("professor-com-turmas");
    const turma = page.getByRole("button",{name:/Matemática.*Língua Portuguesa/}).first();
    await turma.click();
    for (const [label,title] of [["Chamada","Registar chamada"],["Notas","Lançamento de notas"],["Plano de aula","Planos de aula"],["Materiais","Materiais pedagógicos"],["Horário da turma","Horário da turma"],["Aluno sintético","Aluno sintético"]]) await child(label,title);
    for (const [label,title,paths] of [
      ["Chamada","Registar chamada",["/api/professor/atribuicoes","/api/professor/turmas/*"]],
      ["Notas","Lançamento de notas",["/api/professor/atribuicoes"]],
      ["Plano de aula","Planos de aula",["/api/professor/planos-aula","/api/professor/agenda"]],
      ["Materiais","Materiais pedagógicos",["/api/professor/materiais-pedagogicos","/api/professor/agenda"]],
      ["Horário da turma","Horário da turma",["/api/professor/turmas/*"]],
      ["Aluno sintético","Aluno sintético",["/api/professor/periodos"]],
    ]) await assertNoRepeat(paths, () => child(label,title), `Turma: reentrada em ${title}`);
    assert.equal(await count("/api/professor/agenda"),0);
    await close();
    await page.locator('button[aria-expanded][aria-haspopup="dialog"]').filter({hasText:"08:00"}).first().click();
    for (const [label,title] of [["Chamada","Registar chamada"],["Notas","Lançamento de notas"],["Plano de aula","Planos de aula"]]) await child(label,title);
    await close();
    for (const [label,title] of [["Ver calendário","Calendário académico"],["Calendário de Avaliações","Calendário de avaliações"]]) {
      await click(page,label);
      await page.getByRole("dialog",{name:title,exact:true}).waitFor();
      await assertNoRepeat(["/api/professor/calendario"], async () => {
        await click(dialog,"Eventos");
        await click(dialog,"Ver detalhes de Reunião sintética");
        await dialog.getByRole("region",{name:"Reunião sintética"}).getByRole("button",{name:"Voltar"}).click();
        await click(dialog,"Períodos lectivos");
        await click(dialog,"Avaliações");
        await click(dialog,"Histórico de avaliações");
        await dialog.getByRole("region",{name:"Histórico de avaliações"}).waitFor();
      }, `${title}: abas, evento e histórico`);
      assert.equal(await dialog.count(),1);
      await close();
    }
    assert.deepEqual(failures,[]);
  } finally { await page.close(); }
}

async function validateGradeAndPaymentRequests() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const requests = [];
  const api = "/api/aluno/financeiro/appypay";
  const reference = { id: "fixture-reference", entity: "12345", reference: "123456789", amount: 500, currency: "AOA", expires_at: "2099-12-01T00:00:00Z", status: "active" };
  let issued = false;
  try {
    await page.route("**/api/**", route => {
      const req = route.request();
      const url = new URL(req.url());
      url.searchParams.sort();
      const body = req.method() === "POST" ? req.postDataJSON() : null;
      requests.push({ path: url.pathname, key: req.method() + " " + url.pathname + url.search, action: body?.action ?? url.searchParams.get("action"), body });
      if (url.pathname === "/api/professor/periodos") return route.fulfill({ json: { ok: true, items: [1,2,3].map(numero => ({ id: "period-"+numero, numero, data_inicio: null, data_fim: null, trava_notas_em: null })) } });
      if (url.pathname === "/api/professor/pauta") {
        const mac = 10 + Number(url.searchParams.get("trimestre")) + (url.searchParams.get("disciplinaId") === "disc-2" ? 3 : 0);
        return route.fulfill({ json: [{ aluno_id:"fixture-student", matricula_id:"fixture-enrollment", mac, npt: 17, mt: 15 }], headers: { "x-klasse-grade-max":"20", "x-klasse-grade-components":"MAC,NPT" } });
      }
      if (url.pathname === api) {
        if (req.method() === "GET") return route.fulfill({ json: url.searchParams.get("action") === "status" ? { ok:true, enabled:true } : { ok:true, amount:500, environment:"sandbox", canIssue:!issued, reference:issued ? reference : null } });
        if (body.action === "issue") { issued = true; return route.fulfill({ json: { ok:true, reference } }); }
        if (body.action === "check") return route.fulfill({ json: { ok:true, status:"reconciled" } });
      }
      return route.fulfill({ json:{ok:true} });
    });
    const open = async flow => {
      await page.goto(base + "/?story=drawer-data&flow=" + flow);
      await page.getByRole("button",{name:"Abrir portal"}).click();
    };
    await open("individual-grades");
    const discipline = page.getByLabel("Disciplina",{exact:true});
    const period = page.getByLabel("Trimestre",{exact:true});
    const expectGrade = async value => page.getByText(value + " / 20",{exact:true}).waitFor();
    await expectGrade(11);
    await period.selectOption("2"); await expectGrade(12);
    await discipline.selectOption("disc-2"); await expectGrade(15);
    await period.selectOption("1"); await expectGrade(14);
    const gradeReads = () => requests.filter(r => r.path === "/api/professor/pauta");
    assert.equal(gradeReads().length,4,"first visit to each subject/term combination must query once");
    assert.equal(new Set(gradeReads().map(r=>r.key)).size,4);
    await discipline.selectOption("disc"); await expectGrade(11);
    await period.selectOption("2"); await expectGrade(12);
    await discipline.selectOption("disc-2"); await expectGrade(15);
    assert.equal(gradeReads().length,4,"revisiting subject/term repeated the grade query");
    assert.equal(requests.filter(r => r.path === "/api/professor/periodos").length,1);
    console.log("Drawer request budget: individual grades, four first reads, zero repeats on subject/term revisit");
    await open("appypay");
    await page.getByRole("button",{name:"Pagar com AppyPay"}).click();
    const panel = page.getByRole("region",{name:"Pagamento por referência"});
    const generate = panel.getByRole("button",{name:/Gerar referência de/});
    await generate.waitFor();
    const payments = action => requests.filter(r=>r.path===api&&r.action===action);
    assert.equal(payments("status").length,1);
    assert.equal(payments("preview").length,1);
    assert.equal(payments("issue").length,0);
    assert.equal(payments("check").length,0);
    await panel.getByRole("button",{name:"Fechar",exact:true}).click();
    await page.getByRole("button",{name:"Pagar com AppyPay"}).click();
    await generate.waitFor();
    // A new payment preview is deliberate: the payable balance may have changed.
    assert.equal(payments("preview").length,2);
    assert.equal(payments("status").length,1);
    assert.equal(payments("issue").length,0);
    await generate.click();
    await panel.getByText("Referência emitida — a aguardar pagamento",{exact:true}).waitFor();
    assert.equal(payments("issue").length,1);
    assert.equal(payments("issue")[0].body.expectedAmount,500);
    assert.equal(payments("preview").length,2);
    assert.equal(payments("check").length,0);
    await panel.getByRole("button",{name:"Verificar pagamento"}).click();
    await panel.getByText("Pagamento confirmado e registado.",{exact:true}).waitFor();
    assert.equal(payments("check").length,1);
    assert.equal(payments("issue").length,1);
    assert.equal(payments("preview").length,2);
    console.log("Drawer request budget: AppyPay monthly: one preview per opening, one explicit issue, one explicit check, no implicit writes");
  } finally { await page.close(); }
}
