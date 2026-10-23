#!/usr/bin/env node
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const lib=process.env.PLAYWRIGHT_MODULE||"playwright";
const {chromium}=await import(lib.startsWith("/")?pathToFileURL(lib).href:lib);
const browser=await chromium.launch({headless:true,...(process.env.PERF_CHROME_PATH?{executablePath:process.env.PERF_CHROME_PATH}:{})});
const page=await browser.newPage({viewport:{width:1366,height:768}});
const dialogs=[];
page.on("dialog",dialog=>{dialogs.push(dialog.message());void dialog.dismiss()});
try {
  await page.goto((process.env.PERF_BASE_URL||"http://127.0.0.1:6019")+"/?story=balcao-route");
  await page.getByTestId("route-go-payment").click();
  await page.getByTestId("draft-payment").fill("SYNTHETIC_ONLY_PENDING");
  await page.getByTestId("route-dirty").getByText("true").waitFor();
  const indicator=page.getByRole("button",{name:/Pagar.*alterações por guardar/i});
  await indicator.waitFor();
  assert.match(await indicator.getAttribute("aria-label"),/alterações por guardar/);
  // N1: the indicator follows React's form state and disappears on revert.
  await page.getByTestId("clear-payment").click();
  await page.getByTestId("route-dirty").getByText("false").waitFor();
  assert.equal(await page.getByRole("button",{name:/Pagar/i}).getAttribute("aria-label"),"Pagar");
  // N2: shortcut must be dismissible and must ignore edited input focus.
  const help=page.getByTestId("route-toggle-shortcuts");
  if(await help.innerText()==="Ativar atalhos") await help.click();
  const initial=Number(await page.getByTestId("route-search-opened").innerText());
  await page.locator("body").click({position:{x:30,y:30}});
  await page.keyboard.press("Control+Alt+Shift+F");
  await page.waitForFunction(expected=>Number(document.querySelector('[data-testid="route-search-opened"]')?.textContent)===expected+1,initial);
  const first=Number(await page.getByTestId("route-search-opened").innerText());
  await page.getByTestId("draft-payment").focus();
  await page.keyboard.press("Control+Alt+Shift+F");
  assert.equal(Number(await page.getByTestId("route-search-opened").innerText()),first,"input editing must not trigger a shortcut");
  await help.click();
  await page.locator("body").click({position:{x:30,y:30}});
  await page.keyboard.press("Control+Alt+Shift+F");
  assert.equal(Number(await page.getByTestId("route-search-opened").innerText()),first,"disabled shortcut must not trigger");
  await help.click();
  await page.keyboard.press("Control+Alt+Shift+T");
  await page.getByTestId("route-student").getByText("student-b").waitFor();
  // A keyboard-driven switch is the SAME guarded handler as the button.
  await page.getByTestId("route-go-payment").click();
  await page.getByTestId("draft-payment").fill("Synthetic hold");
  await page.getByTestId("route-dirty").getByText("true").waitFor();
  await page.locator("body").click({position:{x:30,y:30}});
  await page.keyboard.press("Control+Alt+Shift+T");
  await page.waitForTimeout(80);
  assert.equal(await page.getByTestId("route-student").innerText(),"student-b");
  assert.ok(dialogs.length>0,"pending-work confirmation must protect keyboard student switch");
  console.log("PASS: N1 accessible per-tab dirty label, revert cleans, N2 shortcuts respect form focus, opt-out and guarded switch");
}finally{await browser.close()}
