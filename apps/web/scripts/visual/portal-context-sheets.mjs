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
      release();
      await sheet.waitFor({state:"hidden"});
      await page.getByTestId("receipt-status").getByText("Recebido").waitFor();
      assert.equal(requests,1,"duplicate or missing upload");
      await page.waitForFunction(()=>document.activeElement?.textContent?.includes("Pagar propinas"));
      results.push({reduced,requests,passed:true});
    }finally{release();await ctx.close();}
  }
}finally{await browser.close();await writeFile(dir+"/portal-context-sheets.json",JSON.stringify(results,null,2));}
console.log("Contextual sheet tests passed",results);
