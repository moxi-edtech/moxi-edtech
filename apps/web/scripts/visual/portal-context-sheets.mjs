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
try {
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
