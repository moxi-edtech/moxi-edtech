#!/usr/bin/env node
// N4: repeatable, synthetic-only 200+ tab/student switches on actual React
// retained panels. Chrome CDP reports post-GC heap; no personal data is read.
import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const lib=process.env.PLAYWRIGHT_MODULE||"playwright";
const { chromium }=await import(lib.startsWith("/")?pathToFileURL(lib).href:lib);
const browser=await chromium.launch({headless:true,...(process.env.PERF_CHROME_PATH?{executablePath:process.env.PERF_CHROME_PATH}:{})});
const page=await browser.newPage({viewport:{width:1366,height:768}});
const cdp=await page.context().newCDPSession(page);
await cdp.send("HeapProfiler.enable");
const cycles=Math.max(100,Number(process.env.PERF_MEMORY_CYCLES||210));
const base=process.env.PERF_BASE_URL||"http://127.0.0.1:6016";
const output=process.env.PERF_MEMORY_OUTPUT||"docs/performance/balcao-memory-after.json";
const samples=[];
const errors=[];
page.on("pageerror",error=>errors.push(error.message.slice(0,110)));
try {
  await page.goto(base+"/?story=balcao-route",{waitUntil:"domcontentloaded"});
  await page.getByTestId("route-student").getByText("student-a").waitFor();
  await page.evaluate(()=>{
    const stats={adds:0,removes:0};
    Object.assign(window,{__balcaoListenerStats:stats});
    const add=EventTarget.prototype.addEventListener;
    const remove=EventTarget.prototype.removeEventListener;
    // Only long-lived event targets. Listeners on detached React DOM nodes
    // are garbage-collected without removeEventListener: counting them as
    // active would falsely report thousands of leaks, despite flat DOM/heap.
    EventTarget.prototype.addEventListener=function(...args){
      if(this===window || this===document) stats.adds++;
      return add.apply(this,args)
    };
    EventTarget.prototype.removeEventListener=function(...args){
      if(this===window || this===document) stats.removes++;
      return remove.apply(this,args)
    };
  });
  const inspect=async cycle=>{
    await cdp.send("HeapProfiler.collectGarbage");
    await page.waitForTimeout(125);
    const heap=await cdp.send("Runtime.getHeapUsage");
    const dom=await page.evaluate(()=>({
      domNodes:document.querySelectorAll("*").length,
      panels:document.querySelectorAll("[data-balcao-retained-action]").length,
      listeners:window.__balcaoListenerStats ? Math.max(0,window.__balcaoListenerStats.adds-window.__balcaoListenerStats.removes):null,
      historyLength:history.length
    }));
    samples.push({cycle,heapBytes:heap.usedSize,...dom});
  };
  await inspect(0);
  for(let cycle=1;cycle<=cycles;cycle++){
    for(const action of ["payment","profile","grade","enrollment","document","desk"]){
      await page.getByTestId("route-go-"+action).click();
    }
    if(cycle%2===0){
      await page.getByTestId("route-select-slow-a").click();
      await page.waitForTimeout(465);
    }else{
      await page.getByTestId("route-select-fast-b").click();
      await page.waitForTimeout(40);
    }
    if(cycle%20===0 || cycle===cycles) await inspect(cycle);
  }
  const warm=samples.find(s=>s.cycle>=40)??samples[1];
  const end=samples.at(-1);
  const allowedHeap=warm.heapBytes*1.50+6_000_000;
  const allowedDom=warm.domNodes*1.40+90;
  const allowedListeners=(warm.listeners??0)*1.50+50;
  const result={
    fixture:true,authenticatedBackend:false,cycles,samples,
    budget:{allowedHeapBytes:Math.round(allowedHeap),allowedDomNodes:Math.round(allowedDom),allowedListeners:Math.round(allowedListeners),maxRetainedPanels:7},
    errors
  };
  await mkdir("docs/performance",{recursive:true});
  await writeFile(output,JSON.stringify(result,null,2));
  console.log(JSON.stringify({output,cycles,first:samples[0],warm,last:end,budget:result.budget,errors},null,2));
  assert.equal(errors.length,0,"no browser errors");
  assert.ok(end.heapBytes<=allowedHeap,"post-GC JS heap grew beyond noise-adjusted limit");
  assert.ok(end.domNodes<=allowedDom,"DOM nodes grew without bound");
  assert.ok(end.listeners!==null && end.listeners<=allowedListeners,"active event listeners grew without bound");
  assert.ok(samples.every(s=>s.panels<=7),"retained panels exceeded seven actions for one student");
}finally{await browser.close()}
