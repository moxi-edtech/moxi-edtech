import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const moduleUrl = process.env.PLAYWRIGHT_MODULE || "playwright";
const { chromium } = await import(moduleUrl.startsWith("/") ? pathToFileURL(moduleUrl).href : moduleUrl);
const base = process.env.STORYBOOK_BASE_URL || "http://127.0.0.1:6006";
const output = "apps/web/visual-evidence";
await mkdir(output, { recursive: true });
const report = [], errors = [];
const percentile = (values, p) => {
  const sorted = [...values].sort((a,b)=>a-b);
  return sorted.length ? Math.round(sorted[Math.ceil(sorted.length*p)-1]*10)/10 : null;
};
const browser = await chromium.launch({headless:true});

async function run(rate, reduced, story) {
  const context = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, deviceScaleFactor:1, reducedMotion: reduced ? "reduce" : "no-preference" });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const row = { rate, reduced, story };
  try {
    await cdp.send("Emulation.setCPUThrottlingRate",{rate});
    await page.goto(base+"/?story="+story,{waitUntil:"domcontentloaded"});
    await page.evaluate(()=>document.fonts.ready);
    if(story==="academic-tabs") {
      const list = page.getByRole("tablist",{name:"Área académica"});
      await list.waitFor();
      const tabs = list.getByRole("tab");
      // Warm mounted panels before measuring interactive animation, not cold data fetching.
      for(let i=0;i<4;i++) {
        await tabs.nth(i).click();
        await page.waitForFunction(i=>document.querySelectorAll('[role="tab"]')[i]?.getAttribute("aria-selected")==="true",i);
      }
      const result = await list.evaluate(async node=>{
        const tabs = [...node.querySelectorAll('[role="tab"]')];
        const indicator = node.querySelector('[data-portal-motion-indicator]');
        if(!indicator) throw Error("indicator missing");
        const frames=[], latencies=[], longTasks=[];
        let last=performance.now(), running=true, frame=0;
        const tick=t=>{frames.push(t-last);last=t;if(running)frame=requestAnimationFrame(tick)};
        const observer=PerformanceObserver.supportedEntryTypes.includes("longtask") ? new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(e=>e.duration))) : null;
        observer?.observe({entryTypes:["longtask"]});
        frame=requestAnimationFrame(tick);
        const twoFrames=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        let sameNode=true;
        try {
          for(const i of [0,2,1,3,0,1,2,0,3,1,0,2]) {
            const started=performance.now();
            tabs[i].click();
            await twoFrames();
            latencies.push(performance.now()-started);
            sameNode &&= indicator===node.querySelector('[data-portal-motion-indicator]');
            await new Promise(resolve=>setTimeout(resolve,35));
          }
          await Promise.all(indicator.getAnimations().map(a=>a.finished.catch(()=>{})));
          await twoFrames();
          const selected=tabs.filter(tab=>tab.getAttribute("aria-selected")==="true");
          const box=indicator.getBoundingClientRect();
          const target=tabs[2].getBoundingClientRect();
          return {latencies,frames,longTasks,sameNode,selected:selected.length===1&&selected[0]===tabs[2],alignmentPx:Math.abs(box.left-target.left),activeIndex:getComputedStyle(node).getPropertyValue("--portal-tab-index").trim(),transitionMs:parseFloat(getComputedStyle(indicator).transitionDuration)*1000};
        } finally {running=false;cancelAnimationFrame(frame);observer?.disconnect()}
      });
      Object.assign(row,{samples:result.latencies.length,inputToSecondRafP95Ms:percentile(result.latencies,.95),frameGapP95Ms:percentile(result.frames,.95),frameGapMaxMs:percentile(result.frames,1),longTasks:result.longTasks.length,longTaskMaxMs:percentile(result.longTasks,1),alignmentPx:result.alignmentPx,indicatorStable:result.sameNode,transitionMs:result.transitionMs});
      assert.ok(result.sameNode&&result.selected&&result.activeIndex==="2","rapid tab changes lost selection or remounted indicator");
      assert.ok(result.alignmentPx<=2,"indicator not aligned with final tab");
      if(reduced)assert.equal(result.transitionMs,0);
      else assert.ok(result.transitionMs>0);
    } else {
      const more=page.getByRole("button",{name:"Mais áreas"});
      await more.waitFor();
      row.cycles=[];
      for(const method of ["Escape","button","backdrop"]) {
        const start=await page.evaluate(()=>performance.now());
        await more.click();
        const dialog=page.getByRole("dialog",{name:"Outras áreas"});
        await dialog.waitFor();
        await page.waitForFunction(()=>document.querySelector('[role="dialog"][data-motion-state="open"]')!==null);
        await dialog.evaluate(async el=>{await Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{})))});
        const opened=await page.evaluate(()=>performance.now());
        const geometry=await dialog.evaluate(el=>{const r=el.getBoundingClientRect();return {fits:r.top>=0&&r.bottom<=innerHeight+1&&r.left>=0&&r.right<=innerWidth+1,focused:el.contains(document.activeElement),locked:document.body.hasAttribute("data-scroll-locked"),duration:getComputedStyle(el).animationName==="none"?0:parseFloat(getComputedStyle(el).animationDuration)*1000}});
        assert.ok(geometry.fits&&geometry.focused&&geometry.locked,"open drawer geometry, focus or scroll lock");
        const close=dialog.getByRole("button",{name:"Fechar outras áreas"});
        await close.focus();
        await page.keyboard.press("Shift+Tab");
        assert.ok(await dialog.evaluate(el=>el.contains(document.activeElement)),"focus escaped backwards");
        await page.keyboard.press("Tab");
        assert.ok(await dialog.evaluate(el=>el.contains(document.activeElement)),"focus escaped forwards");
        if(reduced)assert.equal(geometry.duration,0);
        else assert.ok(geometry.duration>0);
        const closeStart=await page.evaluate(()=>{
          window.__sheetExitSamples=[];
          const sample=()=>{
            const el=document.querySelector('[role="dialog"]');
            if(!el)return;
            if(el.getAttribute("data-motion-state")==="closing")window.__sheetExitSamples.push({locked:document.body.hasAttribute("data-scroll-locked"),focused:el.contains(document.activeElement)});
            requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
          return performance.now();
        });
        // Dispatch the real close controls. Capture the intermediate state before the transition ends.
        if(method==="Escape") await page.keyboard.press("Escape");
        else if(method==="button") await close.click();
        else await page.mouse.click(10,10);
        const state=await page.evaluate(()=>{
          const el=document.querySelector('[role="dialog"]');
          return {mounted:!!el,phase:el?.getAttribute("data-motion-state"),locked:document.body.hasAttribute("data-scroll-locked"),focused:el?.contains(document.activeElement)};
        });
        // Pointer dismissal may be committed on the following frame. Do not
        // confuse the pre-commit open state with loss of modality.
        if(!reduced&&state.phase==="closing")assert.ok(state.locked&&state.focused,`exit released focus or scroll lock early: ${JSON.stringify(state)} (${method})`);
        await dialog.waitFor({state:"hidden"});
        await page.waitForFunction(()=>document.activeElement?.getAttribute("aria-label")==="Mais áreas");
        const samples=await page.evaluate(()=>window.__sheetExitSamples);
        if(!reduced){
          assert.ok(samples.length>0,`animated exit not observed (${method})`);
          assert.ok(samples.every(s=>s.locked&&s.focused),`exit lost modality (${method}): ${JSON.stringify(samples)}`);
        }
        await page.waitForFunction(()=>!document.body.hasAttribute("data-scroll-locked"));
        row.cycles.push({method,openWallMs:Math.round(opened-start),closeToFocusWallMs:Math.round(await page.evaluate(()=>performance.now())-closeStart),exitObserved:samples.length>0,exitSamples:samples.length});
      }
    }
  } catch(error) {row.error=String(error);errors.push(story+" rate="+rate+" reduced="+reduced+": "+String(error));}
  finally {report.push(row);await cdp.send("Emulation.setCPUThrottlingRate",{rate:1}).catch(()=>{});await context.close();}
}
try {
  for(const rate of [1,4])for(const story of ["academic-tabs","dashboard-clean","professor-com-turmas"])await run(rate,false,story);
  for(const story of ["academic-tabs","dashboard-clean","professor-com-turmas"])await run(4,true,story);
} finally {
  await browser.close();
  await writeFile(output+"/portal-motion-performance.json",JSON.stringify({synthetic:true,measurement:"Chromium CDP CPU throttle; input-to-second-rAF and frame gaps are proxies, not INP or device FPS. No production network.",report,errors},null,2));
}
console.log(JSON.stringify({report,errors},null,2));
if(errors.length)process.exitCode=1;
