import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

/**
 * Browser evidence for REAL operations widgets in a fully synthetic shell.
 * No production network, cookies, school identifiers or personal data.
 * Usage: PLAYWRIGHT_MODULE=/tmp/klasse-visual/node_modules/playwright/index.mjs node apps/web/scripts/visual/operations-density.mjs
 */
const moduleUrl = process.env.PLAYWRIGHT_MODULE || "playwright";
const { chromium } = await import(moduleUrl.startsWith("/") ? pathToFileURL(moduleUrl).href : moduleUrl);
const base = process.env.STORYBOOK_BASE_URL || "http://127.0.0.1:6006";
const folder = "apps/web/visual-evidence/operations-density";
const viewports = [[1280,720],[1366,768],[1440,900],[1536,864],[1920,1080],[2560,1440],[768,1024],[390,844]];
const zoomLevels = [1,1.25,1.5];
const states = ["pending","clean","empty","loading","error"];
const failures = [], measurements = [];
await mkdir(folder, { recursive: true });
const browser = await chromium.launch({ headless:true });
const fixedTime = new Date("2026-10-22T09:00:00Z").valueOf();
const repeats = Math.max(1, Number(process.env.LAYOUT_REPEATS || "1"));

async function measure(page, viewport, zoom, state, baseline) {
  return await page.evaluate(({viewport,zoom,state,baseline}) => {
    const find = selector => document.querySelector(selector);
    const scope = find('[data-operations-dashboard]') || find('.fixture-before-dashboard');
    const grid = find('[data-testid="operations-kpi-grid"]') || find('[data-testid="operations-kpi-loading"]');
    const items = grid ? [...grid.children] : [];
    const rectangles = items.map(el => el.getBoundingClientRect());
    const kpiBottom = rectangles.length ? Math.max(...rectangles.map(r=>r.bottom)) : null;
    const finance = find('[data-testid="operations-finance"]');
    const financeTop = finance?.getBoundingClientRect().top ?? null;
    const availableWidth = scope ? parseFloat(getComputedStyle(scope).width) : 0;
    const columns = rectangles.length ? rectangles.filter(r => Math.abs(r.top - rectangles[0].top) < 2).length : 0;
    const overflow = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const clipped = [];
    const smallText = [];
    const targets = [];
    const overlapping = [];
    if (scope && !baseline) {
      const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
      while(walker.nextNode()) {
        const node = walker.currentNode, value = node.textContent?.trim() || "";
        if (!value) continue;
        const el = node.parentElement; if(!el)continue;
        const style=getComputedStyle(el);
        if(style.display==="none"||style.visibility==="hidden"||style.opacity==="0")continue;
        let ancestor=el.parentElement, hidden=false;
        while(ancestor && ancestor!==scope) {
          const s=getComputedStyle(ancestor);
          if(s.display==="none"||s.visibility==="hidden"||s.opacity==="0"){hidden=true;break;}
          ancestor=ancestor.parentElement;
        }
        if(hidden)continue;
        const px=parseFloat(style.fontSize);
        if(px<11)smallText.push({text:value.slice(0,32),px});
        if(el.scrollWidth > el.clientWidth+3 && ["hidden","clip"].includes(style.overflowX))
          clipped.push({text:value.slice(0,32),delta:el.scrollWidth-el.clientWidth});
      }
      for (const control of scope.querySelectorAll('a,button,summary')) {
        const style=getComputedStyle(control);
        if(style.display==="none"||style.visibility==="hidden")continue;
        const r=control.getBoundingClientRect();
        if(r.width>0&&r.height>0&&r.height<30) targets.push({text:(control.textContent||"").slice(0,24),height:Math.round(r.height)});
      }
      for(let i=0;i<rectangles.length;i++)for(let j=i+1;j<rectangles.length;j++){
        const a=rectangles[i],b=rectangles[j];
        if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>2 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2)overlapping.push([i,j]);
      }
    }
    return { viewport:viewport.join("x"),zoom,state,baseline,availableWidth,columns,
      kpiBottom:kpiBottom===null?null:Math.round(kpiBottom),
      financeTop:financeTop===null?null:Math.round(financeTop),
      viewportHeight:viewport[1],overflow,clipped:clipped.slice(0,6),
      smallText:smallText.slice(0,6),targets:targets.slice(0,6),overlapping,
      visibleBlocks:[...scope?.children||[]].filter(el=>el.getBoundingClientRect().top < viewport[1]).length };
  },{viewport,zoom,state,baseline});
}

try {
  for(let run=0;run<repeats;run++){
    for(const [width,height] of viewports){
      for(const zoom of zoomLevels){
        for(const state of states){
          for(const baseline of state==="pending" ? [true,false] : [false]){
            const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,reducedMotion:"reduce"});
            const page=await context.newPage();
            const errors=[];
            page.on("pageerror",e=>errors.push(e.message));
            page.on("request", req=>{
              if (!req.url().startsWith(base) && !req.url().startsWith("data:")) errors.push("external request blocked: "+new URL(req.url()).hostname);
            });
            await page.clock.install({time:fixedTime});
            await page.goto(`${base}/operations-density.html?state=${state}&baseline=${baseline?"1":"0"}`,{waitUntil:"domcontentloaded"});
            await page.locator(baseline?".fixture-before-dashboard":'[data-operations-dashboard]').waitFor({timeout:20000});
            await page.evaluate(async z=>{ document.documentElement.style.zoom=String(z); await document.fonts.ready; },zoom);
            await page.locator('[data-testid="operations-kpi-grid"],[data-testid="operations-kpi-loading"],[data-testid="operations-kpi-error"]').first().waitFor({timeout:10000});
            const m=await measure(page,[width,height],zoom,state,baseline);
            if(run===0){
              measurements.push(m);
              const file=`${folder}/${baseline?"before":"after"}-${state}-${width}x${height}-${Math.round(zoom*100)}.png`;
              await page.screenshot({path:file,fullPage:false,animations:"disabled"});
            }
            const tag=`run ${run+1} ${baseline?"before":"after"} ${state} ${width}x${height} ${Math.round(zoom*100)}%`;
            if(errors.length)failures.push(`${tag}: ${errors.join("; ").slice(0,250)}`);
            if(m.overflow>2)failures.push(`${tag}: document horizontal overflow ${m.overflow}px`);
            if(!baseline && (m.clipped.length||m.smallText.length||m.targets.length||m.overlapping.length))
              failures.push(`${tag}: layout regression ${JSON.stringify({clipped:m.clipped,smallText:m.smallText,targets:m.targets,overlapping:m.overlapping})}`);
            if(!baseline && state!=="error") {
              const expected=m.availableWidth>=870?4:m.availableWidth>=500?2:1;
              if(m.columns!==expected) failures.push(`${tag}: KPI grid columns ${m.columns} expected ${expected} for container ${m.availableWidth}px`);
            }
            if(!baseline && zoom===1 && state==="pending" && [[1366,768],[1440,900]].some(([w,h])=>w===width&&h===height)){
              if((m.kpiBottom??Infinity)>height-12 || (m.financeTop??Infinity)>height-36)
                failures.push(`${tag}: fold exceeded; KPIs bottom ${m.kpiBottom}, finance top ${m.financeTop}, viewport ${height}`);
            }
            await context.close();
          }
        }
      }
    }
  }
}finally{await browser.close();}
const report={synthetic:true,zoomMethod:"CSS zoom (page document root); browser context stays deviceScaleFactor=1",repeats,viewports,zoomLevels,states,baseline:"isolated reproduction of previous layout geometry; not historical live capture",measurements,failures};
await writeFile(`${folder}/measurements.json`,JSON.stringify(report,null,2));
if(failures.length){console.error("Operations density layout checks FAILED:",failures.slice(0,35).join("\n"));process.exitCode=1;}
else console.log(`PASS operations density: ${measurements.length} synthetic screenshots, ${repeats} runs, 0 layout failures. Fold and columns verified.`);
