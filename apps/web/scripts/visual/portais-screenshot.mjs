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
  ["grade-paid", "synthetic-grade-paid", /As tuas notas/i],
  ["grade-unpaid", "synthetic-grade-unpaid", /As tuas notas/i],
  ["grade-pending", "synthetic-grade-pending", /As tuas notas/i],
  ["grade-rejected", "synthetic-grade-rejected", /As tuas notas/i],
  ["grade-empty", "synthetic-grade-empty", /As tuas notas/i],
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
    for (const [width, height] of sizes) {
      for (const zoom of zooms) {
        await page.setViewportSize({ width, height });
        const url = `${baseUrl}/?story=${name}`;
        await page.goto(url, { waitUntil: "domcontentloaded" });
        if (name.startsWith("grade-")) await page.getByTestId("aluno-pauta-editorial").waitFor({timeout:10000});
        await page.waitForTimeout(350);
        await page.evaluate(z => { document.documentElement.style.zoom = String(z); }, zoom);
        await page.waitForTimeout(200);
        const metrics = await page.evaluate(() => {
          const root = document.documentElement;
          return { horizontalOverflow: Math.max(0, root.scrollWidth - root.clientWidth),
            bodyText: document.body.innerText.slice(0, 1600),
            rendered: document.querySelector("#root")?.childElementCount ?? 0 };
        });
        const output = `${directory}/${name}-${width}x${height}-${Math.round(zoom*100)}.jpg`;
        await page.screenshot({ path: output, type: "jpeg", quality: 72, fullPage: false });
        const visible = textMatcher.test(metrics.bodyText);
        report.push({ name, width, height, zoom, horizontalOverflow: metrics.horizontalOverflow, fixtureRendered: visible, output });
        if (name.startsWith("grade-")) {
          if (["grade-unpaid","grade-pending","grade-rejected"].includes(name) && /Prova trimestral|Trabalho prático|Exame do período/.test(metrics.bodyText)) errors.push(`${name} ${width}x${height} zoom ${zoom}: protected assessment leak`);
          if (name === "grade-paid" && (!metrics.bodyText.includes("Exame do período") || !metrics.bodyText.includes("15"))) errors.push(`${name} ${width}x${height} zoom ${zoom}: paid assessments not visible`);
          if (name === "grade-pending" && !metrics.bodyText.includes("Comprovativo em análise")) errors.push(`${name} ${width}x${height} zoom ${zoom}: pending state missing`);
          if (name === "grade-unpaid" && !metrics.bodyText.includes("Pagar boletim")) errors.push(`${name} ${width}x${height} zoom ${zoom}: payment CTA missing`);
          if (name === "grade-rejected" && !metrics.bodyText.includes("Reenviar no mesmo pedido")) errors.push(`${name} ${width}x${height} zoom ${zoom}: resubmit missing`);
          if (name === "grade-empty" && !metrics.bodyText.includes("Ainda não há avaliações publicadas")) errors.push(`${name} ${width}x${height} zoom ${zoom}: empty state missing`);
        }
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
