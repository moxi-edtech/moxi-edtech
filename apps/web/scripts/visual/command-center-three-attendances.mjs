import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const moduleUrl = process.env.PLAYWRIGHT_MODULE || "playwright";
const { chromium } = await import(moduleUrl.startsWith("/") ? pathToFileURL(moduleUrl).href : moduleUrl);
const sizes = [[360,640],[390,844],[768,1024],[1366,768],[1920,1080]];
const zooms = [1,1.25,1.5];
const folder = "apps/web/visual-evidence/command-center-three-attendances";
await mkdir(folder,{recursive:true});
const browser = await chromium.launch({headless:true});
const captured=[];
try {
  for(const [w,h] of sizes) for(const zoom of zooms) {
    const page = await browser.newPage({viewport:{
      width:Math.floor(w/zoom),height:Math.floor(h/zoom)},reducedMotion:"reduce"});
    await page.goto("http://127.0.0.1:6006/?story=command-center-explorer");
    await page.getByRole("heading",{name:"10.ª A"}).waitFor();
    for(let index=1;index<=3;index++) {
      const student = String(index).padStart(12,"0");
      const id = "00000000-0000-4000-8100-"+student;
      await page.locator('[data-student-id="'+id+'"]').click();
      await page.getByRole("dialog",{name:"Balcão sintético"}).waitFor();
      await page.getByText("Aluno seleccionado: Aluno Sintético "+String(index).padStart(2,"0")).waitFor();
      const file = folder+"/"+w+"x"+h+"-zoom"+Math.round(zoom*100)+"-atendimento-"+index+".jpg";
      await page.screenshot({path:file,type:"jpeg",quality:72,fullPage:false,animations:"disabled"});
      captured.push({viewport:[w,h],zoom,atendimento:index,file,fixture:"synthetic"});
      await page.getByRole("button",{name:"Voltar à turma"}).click();
      await page.getByRole("heading",{name:"10.ª A"}).waitFor();
      await page.waitForFunction(studentId =>
        document.activeElement?.getAttribute("data-student-id") === studentId,
        id,{timeout:8000});
      const overflow=await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow<=4,"Horizontal overflow after returning to the exact source");
    }
    const currentCount=await page.getByText("55").first().textContent();
    assert.equal(currentCount?.trim(),"55","55 pupils and capacity 50 must remain intact");
    await page.close();
  }
  await writeFile(folder+"/manifest.json",JSON.stringify({
    syntheticOnly:true,
    studentSwitches:45,
    sizes:sizes.length,zooms:zooms.length,attachments:captured,
    disclaimer:"A fixture mounts the real Turma React component but mocks API/GoTrue. Not an authenticated RLS proof.",
  },null,2)+"\n");
  console.log(JSON.stringify({threeSuccessiveAttendances:true,
    syntheticInteractions:captured.length,viewports:sizes.length,zoomLevels:zooms.length,
    noCrossStudentReuse:true,focusReturned:true,overflowFree:true}));
} finally { await browser.close(); }
