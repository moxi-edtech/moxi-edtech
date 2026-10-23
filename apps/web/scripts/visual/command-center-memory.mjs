import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const moduleUrl = process.env.PLAYWRIGHT_MODULE || "playwright";
const { chromium } = await import(moduleUrl.startsWith("/") ? pathToFileURL(moduleUrl).href : moduleUrl);
const output = "apps/web/visual-evidence/command-center-memory";
await mkdir(output,{recursive:true});
const browser = await chromium.launch({
  headless:true, args:["--enable-precise-memory-info"],
});
const page = await browser.newPage({
  viewport:{width:1366,height:768},
  reducedMotion:"reduce",
});
await page.addInitScript(() => {
  const timers = new Set();
  const intervals = new Set();
  const baseSetTimeout = window.setTimeout.bind(window);
  const baseClearTimeout = window.clearTimeout.bind(window);
  const baseSetInterval = window.setInterval.bind(window);
  const baseClearInterval = window.clearInterval.bind(window);
  const realAdd = EventTarget.prototype.addEventListener;
  const realRemove = EventTarget.prototype.removeEventListener;
  const tally = { eventsAdded:0,eventsRemoved:0 };
  window.setTimeout = (handler, delay, ...args) => {
    const id = baseSetTimeout((...params) => {
      timers.delete(id);
      if (typeof handler === "function") handler(...params);
    },delay,...args);
    timers.add(id);
    return id;
  };
  window.clearTimeout = (id) => {timers.delete(id); return baseClearTimeout(id);};
  window.setInterval = (handler, delay, ...args) => {
    const id = baseSetInterval(handler,delay,...args);
    intervals.add(id);
    return id;
  };
  window.clearInterval = (id) => {intervals.delete(id); return baseClearInterval(id);};
  EventTarget.prototype.addEventListener = function (...args) {
    if (this === window || this === document) tally.eventsAdded += 1;
    return realAdd.apply(this,args);
  };
  EventTarget.prototype.removeEventListener = function (...args) {
    if (this === window || this === document) tally.eventsRemoved += 1;
    return realRemove.apply(this,args);
  };
  window.__ccSyntheticTestMetrics = () => ({
    timers:timers.size,intervals:intervals.size,
    eventBalance:tally.eventsAdded-tally.eventsRemoved,
  });
});
async function snap(label) {
  await page.waitForTimeout(80);
  return page.evaluate((state) => {
    const query = window.__ccQueryMetrics?.() ?? {};
    const hooks = window.__ccSyntheticTestMetrics?.() ?? {};
    const heap = performance.memory?.usedJSHeapSize ?? null;
    const storage = Object.entries(localStorage).concat(Object.entries(sessionStorage));
    const persistedSyntheticStudent = storage.some(([key,value]) =>
      /Aluno Sintético|numero_processo|alunoId=/.test(key+" "+value));
    return {
      state, heapBytes:heap,
      domNodes:document.querySelectorAll("*").length,
      queryCacheEntries:query.queryCount ?? null,
      snapshotViews:query.viewCount ?? null,
      mockedApiRequests:window.__ccSyntheticRequestCount ?? 0,
      timers:hooks.timers ?? 0,
      intervals:hooks.intervals ?? 0,
      eventBalance:hooks.eventBalance ?? 0,
      persistedSyntheticStudent,
    };
  },label);
}
const samples=[];
try {
  await page.goto("http://127.0.0.1:6006/?story=command-center-explorer");
  await page.getByRole("heading",{name:"10.ª A"}).waitFor();
  await page.getByText("Excedente de lotação").waitFor();
  samples.push(await snap("before"));
  const filters=["documentos_sinalizados","propinas_vencidas","ambos","todos"];
  const sorting=["nome_desc","pendencias_primeiro","nome_asc"];
  // 110 synthetic student switches, 170 filter switches, 120 sort switches.
  // All run in the same React tree; no real patient/pupil/student data.
  for(let i=0;i<400;i++) {
    if(i<110) {
      await page.locator("[data-student-id]").first().click();
      await page.getByRole("dialog",{name:"Balcão sintético"}).waitFor();
      await page.getByRole("button",{name:"Voltar à turma"}).click();
      await page.getByRole("heading",{name:"10.ª A"}).waitFor();
    } else if (i<280) {
      await page.getByRole("combobox",{name:"Situação verificada"})
        .selectOption(filters[(i-110)%filters.length]);
    } else {
      await page.getByRole("combobox",{name:"Ordenar alunos"})
        .selectOption(sorting[(i-280)%sorting.length]);
    }
    if ((i+1)%100===0) samples.push(await snap("after-"+(i+1)));
  }
  await page.waitForTimeout(850);
  const last=samples[samples.length-1], first=samples[0];
  // Global listeners are enumerable; listeners on detached React DOM nodes
  // are not and are assessed indirectly through heap + live DOM stability.
  console.log(JSON.stringify({snapshotFirst:first,snapshotLast:last}));
  assert.equal(last.persistedSyntheticStudent,false,"Student content persisted in browser storage");
  assert.ok(last.domNodes <= first.domNodes + 140,"DOM nodes increased on 400 transitions");
  assert.ok(last.queryCacheEntries != null && last.queryCacheEntries <= 50,
    "React Query cache is not bounded across 400 synthetic operations");
  assert.ok(last.intervals <= first.intervals+4,"Background poller/interval leaked");
  assert.ok(last.timers <= first.timers+80,"Timer backlog grows without cleanup");
  assert.ok(last.eventBalance <= first.eventBalance+180,
    "Document/window listener balance shows accumulation");
  if(first.heapBytes != null && last.heapBytes != null) {
    assert.ok(last.heapBytes <= first.heapBytes*3+45*1024*1024,
      "Heap grew beyond tolerated browser/CI noise");
  }
  // Another tab hides the first. There must not be background polling.
  const beforeHidden=(await snap("before-hidden")).mockedApiRequests;
  const other=await browser.newPage();
  await other.goto("about:blank");
  await other.bringToFront();
  await page.waitForTimeout(2000);
  const afterHidden=(await snap("after-hidden")).mockedApiRequests;
  assert.equal(afterHidden,beforeHidden,"Background tab issued new API requests");
  await other.close();
  const report={
    fixture:"400 operator transitions, one real React Turma component, mocked APIs",
    operations:{student:110,filters:170,sort:120},
    samples,
    backgroundApiRequests:afterHidden-beforeHidden,
    note:"Not equivalent to real 8-hour GoTrue session or production memory usage.",
  };
  await writeFile(output+"/manifest.json",JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({operations:400,first:samples[0],last:samples[samples.length-1],
    backgroundApiRequests:0},null,2));
} finally {
  await browser.close();
}
