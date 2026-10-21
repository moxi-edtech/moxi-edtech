#!/usr/bin/env node
// Browser contract tests: only synthetic state, no real auth/API calls.
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const modulePath = process.env.PLAYWRIGHT_MODULE || "playwright";
const { chromium } = await import(modulePath.startsWith("/") ? pathToFileURL(modulePath).href : modulePath);
const browser = await chromium.launch({headless:true,...(process.env.PERF_CHROME_PATH?{executablePath:process.env.PERF_CHROME_PATH}:{})});
const page = await browser.newPage({viewport:{width:1366,height:768}});
const base = process.env.PERF_BASE_URL || "http://127.0.0.1:6016";
try {
  await page.goto(base+"/?story=balcao-retention");
  const go = async action => page.getByTestId("go-"+action).click();
  const draft = action => page.getByTestId("draft-"+action);
  await draft("payment").fill("Seleção de pagamento pendente, sintética");
  await page.getByTestId("file-payment").setInputFiles({name:"comprovativo-fixture.txt",mimeType:"text/plain",buffer:Buffer.from("FICTIONAL RECEIPT")});
  await go("document");
  await draft("document").fill("Declaração sintética");
  await go("enrollment");
  assert.match(await page.getByTestId("target-enrollment").innerText(),/aluno-alvo não selecionado/);
  assert.match(await page.getByTestId("actor-context").innerText(),/student-a/);
  await go("payment");
  assert.equal(await draft("payment").inputValue(),"Seleção de pagamento pendente, sintética");
  assert.equal(await page.getByTestId("file-payment").evaluate(el => el.files?.[0]?.name),"comprovativo-fixture.txt");
  await go("document");
  assert.equal(await draft("document").inputValue(),"Declaração sintética");
  assert.equal(await page.getByTestId("has-unsaved").innerText(),"true");
  await page.getByTestId("server-confirmed-save").click();
  await page.waitForFunction(() => document.querySelector('[data-testid="has-unsaved"]')?.textContent === 'true');
  assert.equal(await draft("document").inputValue(),"Declaração sintética", "successful save must not remount the form");
  await go("payment");
  await page.getByTestId("server-confirmed-save").click();
  await page.waitForFunction(() => document.querySelector('[data-testid="has-unsaved"]')?.textContent === 'false');
  await go("document");
  await draft("document").fill("Novo rascunho não guardado");
  await page.getByTestId("server-confirmed-mutation").click();
  assert.equal(await draft("document").inputValue(),"Novo rascunho não guardado", "background revision must not discard dirty form");
  await page.getByTestId("switch-student").click();
  assert.equal(await draft("payment").inputValue(),"", "old student's draft must not appear for a new student");
  for (const kind of ["switch-polo","switch-school","switch-user"]) {
    await draft("payment").fill("Rascunho anterior, não reutilizar");
    await page.getByTestId(kind).click();
    assert.equal(await draft("payment").inputValue(),"",kind+" must isolate memory cache");
  }
  await draft("payment").fill("Não perder no unload");
  assert.equal(await page.getByTestId("has-unsaved").innerText(),"true");
  const unloadRegistered=await page.evaluate(()=>{
    const event=new Event("beforeunload",{cancelable:true});
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  assert.equal(unloadRegistered,true,"dirty draft registers beforeunload confirmation");
  console.log("PASS: synthetic input, attachment, new enrollment independence, revision, user/school/polo/student isolation and unsaved unload");
} finally {
  await browser.close();
}
