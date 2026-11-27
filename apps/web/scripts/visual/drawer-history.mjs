import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const mod=process.env.PLAYWRIGHT_MODULE||"playwright";
const {chromium}=await import(mod.startsWith("/")?pathToFileURL(mod).href:mod);
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined});
try {
  for(const width of [390,1366]){
    const page=await browser.newPage({viewport:{width,height:844}});
    await page.goto((process.env.STORYBOOK_BASE_URL||"http://127.0.0.1:6006")+"/drawer-history.html");
    const dialog=name=>page.getByRole("dialog",{name,exact:true});
    const back=()=>page.evaluate(()=>history.back());
    const forward=()=>page.evaluate(()=>history.forward());
    const assertSingle=async name=>{await dialog(name).waitFor();assert.equal(await page.getByRole("dialog").count(),1)};
    await page.getByRole("button",{name:"Abrir A",exact:true}).click();
    await assertSingle("Drawer A");
    assert.equal(await page.evaluate(()=>history.state.fixtureRouter),"retained");
    await page.getByRole("button",{name:"Abrir filho"}).click();
    await assertSingle("Filho A");
    await page.getByLabel("Rascunho").fill("não descartar");
    page.once("dialog",d=>d.dismiss());
    await back();
    await page.waitForFunction(()=>history.state?.klassePortalDrawer?.depth===1);
    await assertSingle("Filho A");
    assert.equal(await page.getByLabel("Rascunho").inputValue(),"não descartar");
    page.once("dialog",d=>d.dismiss());
    await page.getByRole("link",{name:"Sair da rota"}).click();
    assert.equal(new URL(page.url()).search,"");
    await page.getByLabel("Rascunho").fill("");
    await page.getByRole("button",{name:"Iniciar operação"}).click();
    await back();
    await page.waitForFunction(()=>history.state?.klassePortalDrawer?.depth===1);
    await assertSingle("Filho A");
    await page.getByRole("button",{name:"Terminar operação"}).click();
    await back(); await assertSingle("Drawer A");
    await forward(); await assertSingle("Filho A");
    await page.keyboard.press("Escape"); await dialog("Filho A").waitFor({state:"hidden"}); await dialog("Drawer A").waitFor({state:"hidden"});
    await page.getByRole("button",{name:"Abrir B",exact:true}).click(); await assertSingle("Drawer B");
    await back(); await dialog("Drawer B").waitFor({state:"hidden"});
    await forward(); await assertSingle("Drawer B");
    // Explicit scope change must invalidate the prior school and its trail.
    await page.evaluate(()=>{history.pushState({},"","?school=b");window.dispatchEvent(new Event("fixture-scope"))});
    await page.getByTestId("scope").getByText("b",{exact:true}).waitFor();
    await page.getByRole("dialog").waitFor({state:"hidden"});
    await back();
    await page.getByTestId("scope").getByText("a",{exact:true}).waitFor();
    assert.equal(await page.getByRole("dialog").count(),0,"Previous school drawer must not reopen");
    await page.close();
    console.log("Drawer history, guards, multiple roots and scope invalidation verified at",width);
  }
} finally {await browser.close()}
