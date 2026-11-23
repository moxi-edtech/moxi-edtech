#!/usr/bin/env node
/** Synthetic visual QA for operational KLASSE semantic tokens (no real school data). */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { contrastRatio } from "./color-contrast.mjs";

const moduleUrl = process.env.PLAYWRIGHT_MODULE || "playwright";
const { chromium } = await import(moduleUrl.startsWith("/") ? pathToFileURL(moduleUrl).href : moduleUrl);
const url = (process.env.STORYBOOK_BASE_URL || "http://127.0.0.1:6006") + "/?story=theme-switcher";
const evidence = "apps/web/visual-evidence/theme-operational";
const viewports = [[390,844], [768,1024], [1280,800], [1920,1080]];
const zooms = [1,1.25,1.5];
const palettes = ["light","dark","system"];
const testIds = ["operations-card","operations-muted","operations-stat","operations-overdue",
  "operations-success","operations-table-card","operations-table"];
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
const results = [];

async function checkContrast(page, id, context) {
  const pair = await page.getByTestId(id).evaluate(el => {
    const s = getComputedStyle(el);
    return { foreground:s.color, background:s.backgroundColor };
  });
  const ratio = contrastRatio(pair.foreground, pair.background);
  assert.ok(ratio >= 4.5, id + " contrast " + ratio.toFixed(2) + " in " + context);
}

try {
  const context = await browser.newContext({ viewport:{width:1280,height:800},
    colorScheme:"light", reducedMotion:"reduce" });
  const page = await context.newPage();
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(url, {waitUntil:"domcontentloaded",timeout:90000});
  const chooser = page.getByRole("radiogroup", {name:"Aparência"});
  await chooser.waitFor({timeout:20000});
  if (process.env.AXE_CORE_FILE) await page.addScriptTag({path:process.env.AXE_CORE_FILE});

  for (const preference of palettes) {
    await page.emulateMedia({colorScheme:"light"});
    const label = preference==="light" ? "Claro" : preference==="dark" ? "Escuro" : "Sistema";
    await chooser.getByRole("radio",{name:label}).click();
    await page.waitForFunction(dark => document.documentElement.classList.contains("dark") === dark,
      preference==="dark");
    assert.equal(await page.evaluate(() => localStorage.getItem("klasse-theme")), preference);
    const modes=preference==="system" ? ["light","dark"] : [preference];
    for (const scheme of modes) {
      if (preference==="system") {
        await page.emulateMedia({colorScheme:scheme});
        await page.waitForFunction(dark=>document.documentElement.classList.contains("dark")===dark,scheme==="dark");
      }
      for (const [width,height] of viewports) {
        await page.setViewportSize({width,height});
        for (const zoom of zooms) {
          await page.evaluate(z => {document.documentElement.style.zoom=String(z);},zoom);
          const scope=preference+"/"+scheme+"/"+width+"x"+height+"/"+zoom;
          const overflow=await page.evaluate(()=>Math.max(0,
            document.documentElement.scrollWidth-document.documentElement.clientWidth));
          assert.equal(overflow,0,"Document overflow: "+scope);
          assert.equal(await page.getByTestId("operations-table-scroll").isVisible(),true);
          for (const id of testIds) await checkContrast(page,id,scope);
          await checkContrast(page,"operations-open-modal",scope);
          if(width===390 && zoom===1) {
            await page.getByTestId("operations-open-modal").click();
            const modal=page.getByRole("dialog",{name:"Situação financeira"});
            assert.equal(await modal.isVisible(),true);
            for (const id of ["operations-modal","operations-modal-content"]) {
              await checkContrast(page,id,scope);
            }
            assert.equal(await page.evaluate(()=>Math.max(0,
              document.documentElement.scrollWidth-document.documentElement.clientWidth)),0,
              "Modal overflow: "+scope);
            await page.getByTestId("operations-close-modal").click();
            assert.equal(await modal.count(),0);
          }
          if (process.env.AXE_CORE_FILE && width===390 && zoom===1) {
            const violations=await page.evaluate(async ()=>{
              const a=await window.axe.run(document.querySelector("[data-testid=theme-surface]"),{
                runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa"]}
              });
              return a.violations.map(v=>({id:v.id,impact:v.impact,
                selectors:v.nodes.map(n=>n.target.join(" ")).slice(0,5)}));
            });
            assert.deepEqual(violations,[],"WCAG: "+scope+": "+JSON.stringify(violations));
          }
          results.push({preference,scheme,width,height,zoom});
        }
      }
      if(process.env.QA_CAPTURE==="1"){
        await page.setViewportSize({width:390,height:844});
        await page.evaluate(()=>{document.documentElement.style.zoom="1";});
        await page.screenshot({path:evidence+"/"+preference+"-"+scheme+"-mobile.png",fullPage:true});
      }
    }
  }
  await chooser.getByRole("radio",{name:"Escuro"}).click();
  await page.waitForFunction(()=>document.documentElement.classList.contains("dark"));
  await page.emulateMedia({media:"print"});
  assert.equal(await page.locator("html").evaluate(el=>getComputedStyle(el).colorScheme),"light");
  await page.emulateMedia({media:"screen"});
  assert.deepEqual(errors,[],"Client errors: "+errors.join("; "));
  console.log("PASS: "+results.length+" visual configurations; contrast, WCAG, mobile, modal, print");
} finally { await browser.close(); }
