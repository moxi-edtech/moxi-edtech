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
  ["grade-paid", "synthetic-grade-paid", /As tuas notas/i],
  ["grade-unpaid", "synthetic-grade-unpaid", /As tuas notas/i],
  ["grade-pending", "synthetic-grade-pending", /As tuas notas/i],
  ["grade-rejected", "synthetic-grade-rejected", /As tuas notas/i],
  ["grade-empty", "synthetic-grade-empty", /As tuas notas/i],
  ["notice-info", "synthetic-notice-info", /Informação escolar/i],
  ["notice-attention", "synthetic-notice-attention", /Atenção ao prazo/i],
  ["notice-critical", "synthetic-notice-critical", /Pedido rejeitado/i],
  ["notice-success", "synthetic-notice-success", /Pedido concluído/i],
  ["notice-rematricula", "synthetic-notice-rematricula", /rematrícula/i],
  ["notice-finance", "synthetic-notice-finance", /Mensalidade em atraso/i],
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
        else if (name.startsWith("grade-")) await page.getByTestId("aluno-pauta-editorial").waitFor({timeout:10000});
        else await page.locator("#root > *").first().waitFor({timeout:12000}).catch(() => { throw new Error(`${name}: fixture root did not render; browser errors: ${errors.slice(-5).join(" | ") || "none"}`); });
        await page.evaluate(z => { document.documentElement.style.zoom = String(z); }, zoom);
        await page.waitForTimeout(200);
        const metrics = await page.evaluate(() => {
          const root = document.documentElement;
          return { horizontalOverflow: Math.max(0, root.scrollWidth - root.clientWidth),
            bodyText: document.body.innerText.slice(0, 1600),
            nestedScrolls: Array.from(document.querySelectorAll("*")).filter(el=> el !== document.body && el !== document.documentElement && el.clientHeight > 0 && ["auto","scroll"].includes(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight+15).length,
            rendered: document.querySelector("#root")?.childElementCount ?? 0 };
        });
        const output = `${directory}/${name}-${width}x${height}-${Math.round(zoom*100)}.jpg`;
        await page.screenshot({ path: output, type: "jpeg", quality: 72, fullPage: false });
        const visible = textMatcher.test(metrics.bodyText);
        if (name.startsWith("dashboard-")) {
          if (["Prova trimestral", "Trabalho prático", "16/20", "17/20"].some(marker => metrics.bodyText.includes(marker)))
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
        if (name.startsWith("grade-")) {
          if (["grade-unpaid","grade-pending","grade-rejected"].includes(name) && /Prova trimestral|Trabalho prático|Exame do período/.test(metrics.bodyText)) errors.push(`${name}: protected assessments leaked`);
          if (name === "grade-paid" && !metrics.bodyText.includes("Exame do período")) errors.push(`${name}: paid assessments missing`);
          if (name === "grade-pending" && !metrics.bodyText.includes("Comprovativo em análise")) errors.push(`${name}: pending state missing`);
          if (name === "grade-unpaid" && !metrics.bodyText.includes("Pagar boletim")) errors.push(`${name}: payment CTA missing`);
          if (name === "grade-rejected" && !metrics.bodyText.includes("Reenviar no mesmo pedido")) errors.push(`${name}: resubmit action missing`);
          if (name === "grade-empty" && !metrics.bodyText.includes("Ainda não há avaliações publicadas")) errors.push(`${name}: empty state missing`);
        }
        if ((name.startsWith("grade-") || name.startsWith("notice-")) && metrics.nestedScrolls) errors.push(`${name}: unnecessary nested scroll`);
        report.push({ name, width, height, zoom, horizontalOverflow: metrics.horizontalOverflow, nestedScrolls: metrics.nestedScrolls, fixtureRendered: visible, output });
        if (name.startsWith("dashboard-") && metrics.nestedScrolls > 0) errors.push(`${name} ${width}x${height} zoom ${zoom}: nested scroll ${metrics.nestedScrolls}`);
        if (!visible) errors.push(`${name} ${width}x${height} zoom ${zoom}: content not rendered; root children ${metrics.rendered}`);
        if (metrics.horizontalOverflow > 12) errors.push(`${name} ${width}x${height} zoom ${zoom}: horizontal overflow ${metrics.horizontalOverflow}px`);
      }
    }
    if (name === "grade-paid") {
      await page.goto(`${baseUrl}/?story=grade-paid`, {waitUntil:"domcontentloaded"});
      await page.getByTestId("aluno-pauta-editorial").waitFor({timeout:10000});
      await page.getByRole("button",{name:"1.º trimestre"}).click();
      await page.getByText("Prova trimestral").waitFor();
      await page.getByRole("button",{name:"2.º trimestre"}).click();
      await page.getByText("Exame do período").waitFor();
      await page.locator("details summary").first().click();
      await page.getByRole("button",{name:"Pedir reapreciação"}).click();
      await page.getByRole("dialog",{name:/Solicitar reapreciação/}).waitFor();
      await page.getByRole("button",{name:"Fechar"}).click();
      await page.getByRole("button",{name:"Solicitar melhoria"}).click();
      await page.getByRole("dialog",{name:/Solicitar melhoria/}).waitFor();
      await page.getByRole("button",{name:"Fechar"}).click();
    }
    if (["notice-info","notice-attention","notice-finance"].includes(name)) {
      await page.keyboard.press("Tab");
      const focusEvidence = await page.evaluate(() => {
        const active = document.activeElement;
        if (!(active instanceof HTMLElement) || !["A","BUTTON"].includes(active.tagName)) return false;
        const style = getComputedStyle(active);
        return active.matches(":focus-visible") && (style.outlineStyle !== "none" || style.boxShadow !== "none");
      });
      if (!focusEvidence) errors.push(`${name}: keyboard focus indicator not visible`);
    }
    if (name.startsWith("notice-") && name !== "notice-rematricula") {
      await page.emulateMedia({ reducedMotion: "reduce" });
      const violations = await page.evaluate(() => {
        const node = document.querySelector("section[role]");
        if (!node) return ["notice semantic region missing"];
        const title = node.querySelector("h3");
        const textColor = title ? getComputedStyle(title).color : "";
        const bg = getComputedStyle(node).backgroundColor;
        const nums = (v) => (v.match(/[0-9.]+/g) || []).slice(0,3).map(Number);
        const lum = rgb => rgb.map(v => { const n=v/255; return n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4; }).reduce((sum,v,i)=>sum+v*[0.2126,0.7152,0.0722][i],0);
        const l1=lum(nums(textColor)),l2=lum(nums(bg));
        const contrast=(Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);
        const issues=[];
        if(contrast<4.5)issues.push(`WCAG AA heading contrast ${contrast.toFixed(2)}`);
        if(parseFloat(getComputedStyle(node).animationDuration)>0)issues.push("notice animates under reduced-motion");
        return issues;
      });
      errors.push(...violations.map(v=>`${name}: ${v}`));
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
