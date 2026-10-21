#!/usr/bin/env node
/**
 * M3 - Synthetic fixture navigation of the REAL URL reconciliation and
 * retention contracts. Does NOT represent authenticated Next + Supabase.
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const modulePath=process.env.PLAYWRIGHT_MODULE||"playwright";
const { chromium }=await import(modulePath.startsWith("/")?pathToFileURL(modulePath).href:modulePath);
const browser=await chromium.launch({headless:true,...(process.env.PERF_CHROME_PATH?{executablePath:process.env.PERF_CHROME_PATH}:{})});
const base=process.env.PERF_BASE_URL||"http://127.0.0.1:6016";
const page=await browser.newPage({viewport:{width:1366,height:768}});
const got=[];
page.on("pageerror",error=>got.push(error.message.slice(0,200)));
let accept=true, confirmations=0;
page.on("dialog",dialog=>{confirmations++;void (accept?dialog.accept():dialog.dismiss());});
try {
  await page.goto(base+"/?story=balcao-route");
  await page.getByTestId("route-student").getByText("student-a").waitFor();
  const go=action=>page.getByTestId("route-go-"+action).click();
  const action=async expected=>assert.equal(await page.getByTestId("route-action").innerText(),expected);
  await go("payment"); await action("payment");
  await go("profile"); await action("profile");
  await go("enrollment"); await action("enrollment");
  const enrollmentUrl=new URL(page.url());
  assert.equal(enrollmentUrl.searchParams.get("alunoId"),null);
  assert.equal(enrollmentUrl.searchParams.get("atendimentoAlunoId"),"student-a");
  assert.match(await page.getByTestId("target-enrollment").innerText(),/não selecionado/);
  await page.goBack({waitUntil:"domcontentloaded"});
  await page.getByTestId("route-action").getByText("profile").waitFor();
  assert.equal(await page.getByTestId("route-student").innerText(),"student-a");
  await page.goForward({waitUntil:"domcontentloaded"});
  await page.getByTestId("route-action").getByText("enrollment").waitFor();
  assert.equal(await page.getByTestId("route-student").innerText(),"student-a");
  // Old network response must never overwrite newer student selection.
  await go("payment");
  await page.getByTestId("route-select-slow-a").click();
  await page.getByTestId("route-select-fast-b").click();
  await page.waitForTimeout(650);
  assert.equal(await page.getByTestId("route-student").innerText(),"student-b");
  await go("payment");
  await page.getByTestId("draft-payment").fill("Synthetic pending draft");
  await page.waitForFunction(()=>document.querySelector('[data-testid="route-dirty"]')?.textContent==="true");
  const previous=confirmations;
  accept=false;
  await page.getByTestId("route-select-fast-b").click();
  assert.equal(await page.getByTestId("route-student").innerText(),"student-b");
  assert.ok(confirmations>previous,"switch requires confirmation with pending work");
  accept=true;
  await go("profile");
  await go("payment");
  assert.equal(await page.getByTestId("draft-payment").inputValue(),"Synthetic pending draft");
  await page.getByTestId("clear-payment").click();
  await page.waitForFunction(()=>document.querySelector('[data-testid="route-dirty"]')?.textContent==="false");
  const captures=[];
  if(process.env.PERF_CAPTURE==="1"){
    const resolutions=[[1366,768],[1536,864],[1920,1080],[768,1024],[390,844]];
    const tabs=["desk","payment","profile","enrollment","document","grade","reenrollment"];
    await mkdir("docs/performance/evidence-m3",{recursive:true});
    for(const [width,height] of resolutions)for(const zoom of [1,1.25,1.5]){
      await page.setViewportSize({width,height});
      await page.evaluate(value=>{document.documentElement.style.zoom=String(value)},zoom);
      for(const tab of tabs){
        await go(tab);
        await page.waitForTimeout(100);
        const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
        const name="docs/performance/evidence-m3/"+tab+"-"+width+"x"+height+"-"+Math.round(zoom*100)+".jpg";
        await page.screenshot({path:name,type:"jpeg",quality:62});
        captures.push({tab,width,height,zoom,overflow,file:name});
      }
    }
    await writeFile("docs/performance/balcao-m3-evidence.json",JSON.stringify({fixture:true,authBackend:false,captures},null,2));
    assert.equal(captures.length,105);
    assert.ok(captures.every(x=>x.overflow===0),"fixture page overflow");
  }
  assert.deepEqual(got,[],"no page errors");
  console.log(JSON.stringify({ok:true,fixture:true,authBackend:false,confirmedDraftPrompts:confirmations,captures:captures.length}));
} finally { await browser.close(); }
