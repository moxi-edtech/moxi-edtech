import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const moduleUrl = process.env.PLAYWRIGHT_MODULE || "playwright";
const { chromium } = await import(moduleUrl.startsWith("/") ? pathToFileURL(moduleUrl).href : moduleUrl);
const baseUrl = process.env.STORYBOOK_BASE_URL || "http://127.0.0.1:6006";
const directory = "apps/web/visual-evidence";
await mkdir(directory, { recursive: true });

const stories = [
  ["documentos-pendentes", "klasse-portal-visual-fixtures--documentos-pendentes", /Boletim/i],
  ["documentos-rejeitados", "klasse-portal-visual-fixtures--documentos-rejeitados", /Boletim/i],
  ["notas-pagas", "klasse-portal-visual-fixtures--notas-pagas", /Notas|Matemática/i],
  ["professor-com-turmas", "klasse-portal-visual-fixtures--professor-com-turmas", /Portal do Professor/i],
  ["dashboard-clean", "synthetic-dashboard-clean", /A tua vida escolar/i],
  ["dashboard-pending", "synthetic-dashboard-pending", /A tua vida escolar/i],
  ["dashboard-rejected", "synthetic-dashboard-rejected", /A tua vida escolar/i],
  ["dashboard-rematricula", "synthetic-dashboard-rematricula", /A tua vida escolar/i],
  ["dashboard-overdue", "synthetic-dashboard-overdue", /A tua vida escolar/i],
  ["dashboard-empty", "synthetic-dashboard-empty", /A tua vida escolar/i],
  ["dashboard-approved", "synthetic-dashboard-approved", /A tua vida escolar/i],
];
const sizes = [[360,640],[390,844],[768,1024],[1366,768],[1920,1080]];
const zooms = [1, 1.25, 1.5];
const report = [];
const errors = [];

const browser = await chromium.launch({ headless: true });
try {
  for (const [name, storyId, textMatcher] of stories) {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(`${name}: ${error.message.split("\n")[0]}`));
    page.on("response", response => { if (response.status() >= 500) errors.push(`${name}: HTTP ${response.status()} ${response.url().split("?")[0]}`); });
    for (const [width, height] of sizes) {
      for (const zoom of zooms) {
        await page.setViewportSize({ width, height });
        const url = `${baseUrl}/?story=${name}`;
        await page.goto(url, { waitUntil: "domcontentloaded" });
        if (name.startsWith("dashboard-")) await page.getByTestId("aluno-dashboard-editorial").waitFor({timeout:10000});
        else await page.waitForTimeout(1200);
        await page.evaluate(z => { document.documentElement.style.zoom = String(z); }, zoom);
        await page.waitForTimeout(200);
        const metrics = await page.evaluate(() => {
          const root = document.documentElement;
          return { horizontalOverflow: Math.max(0, root.scrollWidth - root.clientWidth),
            bodyText: document.body.innerText.slice(0, 1600),
            nestedScrolls: Array.from(document.querySelectorAll("*")).filter(el=> el !== document.body && el !== document.documentElement && el.clientHeight > 0 && getComputedStyle(el).overflowY === "scroll" && el.scrollHeight > el.clientHeight+15).length,
            rendered: document.querySelector("#root")?.childElementCount ?? 0 };
        });
        const output = `${directory}/${name}-${width}x${height}-${Math.round(zoom*100)}.jpg`;
        await page.screenshot({ path: output, type: "jpeg", quality: 72, fullPage: false });
        const visible = textMatcher.test(metrics.bodyText);
        if (name.startsWith("dashboard-")) {
          if (/Prova trimestral|Trabalho prático|16\\/20|17\\/20/.test(metrics.bodyText))
            errors.push(`${name} ${width}x${height} zoom ${zoom}: protected grades leaked`);
          if (name === "dashboard-clean" && metrics.bodyText.includes("Precisa da tua atenção"))
            errors.push(`${name} ${width}x${height} zoom ${zoom}: false pending section`);
          if (name === "dashboard-pending" && !metrics.bodyText.includes("Comprovativo recebido"))
            errors.push(`${name} ${width}x${height} zoom ${zoom}: pending state missing`);
          if (name === "dashboard-rejected" && !metrics.bodyText.includes("Reenviar no mesmo pedido"))
            errors.push(`${name} ${width}x${height} zoom ${zoom}: recovery action missing`);
          if (name === "dashboard-rematricula" && !metrics.bodyText.includes("A tua rematrícula"))
            errors.push(`${name} ${width}x${height} zoom ${zoom}: rematrícula missing`);
          if (name === "dashboard-overdue" && !metrics.bodyText.includes("uma mensalidade por regularizar"))
            errors.push(`${name} ${width}x${height} zoom ${zoom}: overdue missing`);
          if (name === "dashboard-empty" && (metrics.bodyText.includes("08:00") || metrics.bodyText.includes("Reunião de encarregados")))
            errors.push(`${name} ${width}x${height} zoom ${zoom}: invented schedule or notices`);
        }
        report.push({ name, width, height, zoom, horizontalOverflow: metrics.horizontalOverflow, nestedScrolls: metrics.nestedScrolls, fixtureRendered: visible, output });
        if (name.startsWith("dashboard-") && metrics.nestedScrolls > 0) errors.push(`${name} ${width}x${height} zoom ${zoom}: nested scroll ${metrics.nestedScrolls}`);
        if (!visible) errors.push(`${name} ${width}x${height} zoom ${zoom}: content not rendered; root children ${metrics.rendered}`);
        if (metrics.horizontalOverflow > 12) errors.push(`${name} ${width}x${height} zoom ${zoom}: horizontal overflow ${metrics.horizontalOverflow}px`);
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}
await writeFile(`${directory}/report.json`, JSON.stringify({ synthetic: true, count: report.length, report, errors }, null, 2));
if (errors.length) {
  console.error("Synthetic visual fixture regressions:", errors.slice(0, 40).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`PASS: ${report.length} synthetic UI captures; no unexpected overflow`);
}
