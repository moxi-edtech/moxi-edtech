#!/usr/bin/env node
/**
 * Reproducible, synthetic-only Balcão browser benchmark.
 * Run the Vite visual harness at http://127.0.0.1:6016 first.
 * PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node apps/web/scripts/performance/balcao-benchmark.mjs
 * No production APIs are contacted. The only external backend is fixture.invalid, intercepted.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const modulePath = process.env.PLAYWRIGHT_MODULE || "playwright";
const { chromium } = await import(modulePath.startsWith("/") ? pathToFileURL(modulePath).href : modulePath);
const baseUrl = process.env.PERF_BASE_URL || "http://127.0.0.1:6016";
const output = process.env.PERF_OUTPUT || "docs/performance/balcao-baseline.json";
const iterations = Math.max(3, Number(process.env.PERF_ITERATIONS || 7));
const idleMs = Math.max(1000, Number(process.env.PERF_IDLE_MS || 60000));
const capture = process.env.PERF_CAPTURE === "1";
const studentId = "00000000-0000-4000-8000-000000000401";
const yearId = "00000000-0000-4000-8000-000000000404";
const tabs = ["Visão geral", "Matrícula", "Rematrícula", "Pagar", "Documento", "Perfil", "Nota"];
const viewports = [[1366,768],[1536,864],[1920,1080],[768,1024],[390,844]];
const zooms = [1,1.25,1.5];

const source = {
  aluno: { id: studentId, nome: "Aluno sintético", numero_processo: "FIXTURE-0001", divida_total: 1200 },
  perfil: { id: studentId, nome_completo: "Aluno sintético", numero_processo: "FIXTURE-0001" },
  matricula_ativa: { id: "00000000-0000-4000-8000-000000000402", turma_id: "00000000-0000-4000-8000-000000000403", classe: "10.ª", turma_codigo: "B" },
  historico: [],
  financeiro: { total_em_atraso: 1200, mensalidades: [{ id:"00000000-0000-4000-8000-000000000405", mes:9, ano:2026, valor:1200, pago:0, status:"pendente", vencimento:"2026-09-10" }] },
};
function percentile(values, p) {
  if (!values.length) return null;
  const arr = [...values].sort((a,b)=>a-b);
  return Number(arr[Math.min(arr.length-1,Math.ceil(p*arr.length)-1)].toFixed(2));
}
function summarize(values) {
  return { n: values.length, median: percentile(values, .5), p95: percentile(values, .95), max: percentile(values, 1) };
}
const raw = [];
const errors = [];
const fixtureLatency = [];
const browser = await chromium.launch({ headless: true, ...(process.env.PERF_CHROME_PATH ? {executablePath:process.env.PERF_CHROME_PATH}: {}) });
const context = await browser.newContext({ viewport: {width: 1366, height: 768}, reducedMotion:"reduce" });
const page = await context.newPage();
page.on("dialog", dialog => dialog.accept());
page.on("pageerror", e => errors.push(e.message.slice(0,180)));
page.on("console", m => { if (m.type() === "error" && !/fixture.invalid|404/.test(m.text())) errors.push(m.text().slice(0,150)); });
let requests = 0;
let queryRequests = 0;
// Diagnostic paths, not query strings or payloads. Only the isolated fixture
// is benchmarked, so a regression pinpoints the actual duplicate reader.
const requestedPaths = [];
page.on("request", req => {
  if (req.resourceType() === "fetch" || req.resourceType() === "xhr") {
    requests++;
    const url = new URL(req.url());
    requestedPaths.push(url.pathname);
    if (req.url().includes("fixture.invalid")) queryRequests++;
  }
});
await page.route("**/api/**", async route => {
  const started=Date.now(); await new Promise(r=>setTimeout(r,24));
  const url=route.request().url();
  let payload = {ok:true,items:[],data:[],context:{anoLetivoId:yearId}};
  if (/\/api\/secretaria\/alunos\//.test(url) && !url.includes("/dossier")) payload = {ok:true,item:{ id:studentId, nome:"Aluno sintético", classe_nome:"10.ª", turma_nome:"B", turma_id:source.matricula_ativa.turma_id }};
  if (url.includes("/dossier")) payload = {ok:false,error:"Dossier sintético não incluído na fixture"};
  if (url.includes("rematriculas/status")) payload = {ok:false,error:"Sem rematrícula sintética"};
  await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(payload)});
  fixtureLatency.push(Date.now()-started);
});
await page.route("https://fixture.invalid/**", async route => {
  const started = Date.now(); await new Promise(r=>setTimeout(r,35));
  const url = route.request().url();
  let body = [];
  if (url.includes("/rpc/get_aluno_dossier")) body = source;
  else if (url.includes("/anos_letivos")) body = [{ano:2026}];
  else if (url.includes("/mensalidades")) body = [{ id:"00000000-0000-4000-8000-000000000405", matricula_id:source.matricula_ativa.id, turma_id:source.matricula_ativa.turma_id, ano_letivo:2026 }];
  else if (url.includes("/turmas")) body = [{id:source.matricula_ativa.turma_id,nome:"B",turma_codigo:"B"}];
  await route.fulfill({status:200,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"*"},body:JSON.stringify(body)});
  fixtureLatency.push(Date.now()-started);
});
try {
  await page.addInitScript(() => {
    window.__balcaoVitals = {lcp:0,inp:0,events:0};
    try {
      new PerformanceObserver(list => { for(const entry of list.getEntries()) window.__balcaoVitals.lcp = Math.max(window.__balcaoVitals.lcp, entry.startTime); }).observe({type:"largest-contentful-paint",buffered:true});
      new PerformanceObserver(list => { for(const entry of list.getEntries()) { if(entry.interactionId) {window.__balcaoVitals.inp=Math.max(window.__balcaoVitals.inp,entry.duration); window.__balcaoVitals.events++; } } }).observe({type:"event",buffered:true,durationThreshold:16});
    } catch { /* unsupported Chrome metric */ }
  });
  await page.goto(baseUrl + "/?story=balcao-perf", {waitUntil:"domcontentloaded", timeout:90000});
  await page.getByRole("button",{name:"Visão geral"}).waitFor({timeout:90000});
  await page.waitForTimeout(350);
  for(let round=0;round<iterations;round++){
    for(const tab of tabs) {
      const before = await page.evaluate(() => ({commits:window.__balcaoPerf?.commits||0,duration:window.__balcaoPerf?.duration||0}));
      const requestsBefore=requests, queryBefore=queryRequests, pathsBefore=requestedPaths.length, start=Date.now();
      const button=page.getByRole("button",{name:tab,exact:true});
      await button.click({timeout:20000});
      await button.waitFor({state:"visible",timeout:10000});
      await page.waitForFunction(label => [...document.querySelectorAll('button[aria-pressed="true"]')].some(button => button.textContent?.trim() === label),tab,{timeout:10000});
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const paintedMs = Date.now() - start;
      await page.waitForTimeout(250);
      const after = await page.evaluate(() => ({commits:window.__balcaoPerf?.commits||0,duration:window.__balcaoPerf?.duration||0}));
      raw.push({tab,round,timeMs:paintedMs,requests:requests-requestsBefore,queries:queryRequests-queryBefore,requestPaths:requestedPaths.slice(pathsBefore),commits:after.commits-before.commits,reactDurationMs:Number((after.duration-before.duration).toFixed(2))});
    }
  }
  const beforeIdle=requests, queriesBeforeIdle=queryRequests;
  await page.waitForTimeout(idleMs);
  const idle={ms:idleMs,requests:requests-beforeIdle,queries:queryRequests-queriesBeforeIdle};
  const vitals=await page.evaluate(()=>window.__balcaoVitals);
  const routeJs=await page.evaluate(()=>performance.getEntriesByType("resource").filter(x=>/\.(?:js|tsx|ts)(?:\?|$)/.test(x.name)).reduce((sum,x)=>sum+(x.transferSize||0),0));
  const captures=[];
  if(capture){
    for(const [width,height] of viewports)for(const zoom of zooms){
      await page.setViewportSize({width,height});
      await page.evaluate(z=>{document.documentElement.style.zoom=String(z)},zoom);
      for(const tab of tabs){
        await page.getByRole("button",{name:tab,exact:true}).click({timeout:20000});
        await page.waitForTimeout(125);
        const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
        const file="docs/performance/evidence/balcao-"+tab.toLowerCase().replace(/[^a-z]+/g,"-")+"-"+width+"x"+height+"-"+Math.round(zoom*100)+".jpg";
        await mkdir("docs/performance/evidence",{recursive:true});
        await page.screenshot({path:file,type:"jpeg",quality:65});
        captures.push({tab,width,height,zoom,overflow,file});
      }
    }
  }
  const perTab=Object.fromEntries(tabs.map(tab=>{
    const values=raw.filter(x=>x.tab===tab);
    return [tab,{timeMs:summarize(values.map(x=>x.timeMs)),requests:summarize(values.map(x=>x.requests)),queries:summarize(values.map(x=>x.queries)),commits:summarize(values.map(x=>x.commits)),reactDurationMs:summarize(values.map(x=>x.reactDurationMs))}];
  }));
  const result={fixture:true,source:"React components / Vite visual harness + mocked fixture API; not authenticated Next production",iterations,browser:browser.version(),perTab,idle,estimatedRequestsPerHour:Math.round(idle.requests*3600000/idleMs),queryResponseMs:summarize(fixtureLatency),routeJsTransferBytes:routeJs,lcpMs:vitals?.lcp??null,inpMs:vitals?.inp??null,inpEvents:vitals?.events??0,captures,raw,errors};
  await mkdir("docs/performance",{recursive:true});
  await writeFile(output,JSON.stringify(result,null,2));
  console.log(JSON.stringify({output,perTab,idle,routeJsTransferBytes:routeJs,vitals,errors,captures:captures.length},null,2));
  if(errors.length)process.exitCode=1;
} finally {
  await browser.close();
}
