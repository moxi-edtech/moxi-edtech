import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { contrastRatio } from "./color-contrast.mjs";

const moduleUrl = process.env.PLAYWRIGHT_MODULE || "playwright";
const { chromium } = await import(moduleUrl.startsWith("/") ? pathToFileURL(moduleUrl).href : moduleUrl);
const baseUrl = process.env.STORYBOOK_BASE_URL || "http://127.0.0.1:6006";
const directory = "apps/web/visual-evidence";
await mkdir(directory, { recursive: true });

const stories = [
  ["academic-tabs", "synthetic-academic-tabs", /Académico/i],
  ["documentos-pendentes", "klasse-portal-visual-fixtures--documentos-pendentes", /Boletim/i],
  ["documentos-rejeitados", "klasse-portal-visual-fixtures--documentos-rejeitados", /Boletim/i],
  ["notas-pagas", "klasse-portal-visual-fixtures--notas-pagas", /Notas|Matemática/i],
  ["professor-com-turmas", "klasse-portal-visual-fixtures--professor-com-turmas", /Portal do Professor/i],
  ["dashboard-clean", "synthetic-dashboard-clean", /Em resumo/i],
  ["dashboard-pending", "synthetic-dashboard-pending", /Em resumo/i],
  ["dashboard-rejected", "synthetic-dashboard-rejected", /Em resumo/i],
  ["dashboard-rematricula", "synthetic-dashboard-rematricula", /Em resumo/i],
  ["dashboard-overdue", "synthetic-dashboard-overdue", /Em resumo/i],
  ["dashboard-empty", "synthetic-dashboard-empty", /Em resumo/i],
  ["dashboard-approved", "synthetic-dashboard-approved", /Em resumo/i],
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
        if (name.startsWith("dashboard-")) {
          const dashboard = page.getByTestId("aluno-dashboard-editorial");
          await dashboard.waitFor({timeout:10000});
          await dashboard.getByRole("heading", {name:"Em resumo", exact:true}).waitFor({timeout:10000});
          const summary = dashboard.getByTestId("aluno-summary-cards");
          for (const [label, destination] of [
            ["Avisos", "/aluno/avisos"],
            ["Notas", "/aluno/academico"],
            ["Propinas vencidas", "/aluno/financeiro"],
          ]) {
            const link = summary.getByRole("link", {name: new RegExp("^" + label)});
            await link.waitFor({timeout:10000});
            const href = await link.getAttribute("href");
            if (!href || !new URL(href, baseUrl).pathname.endsWith(destination)) {
              errors.push(`${name} ${width}x${height} zoom ${zoom}: invalid card destination ${label}`);
            }
          }
        }
        else if (name.startsWith("grade-")) {
          await page.getByTestId("aluno-boletim-grid").waitFor({timeout:10000});
          await page.getByTestId("aluno-boletim-grid").getByText("Matemática", {exact:true}).first().waitFor({timeout:10000});
        }
        else await page.locator("#root > *").first().waitFor({timeout:12000}).catch(() => { throw new Error(`${name}: fixture root did not render; browser errors: ${errors.slice(-5).join(" | ") || "none"}`); });
        // Espera pelo estado facultativo relevante, sem tratar a primeira
        // renderização da dashboard como se os endpoints já tivessem concluído.
        const expectedState = {
          "dashboard-pending": "Documento em análise",
          "dashboard-rejected": "Reenviar no mesmo pedido",
          "dashboard-rematricula": "A tua rematrícula",
          "dashboard-overdue": "1 mensalidade vencida",
          "grade-unpaid": "Solicitar boletim",
          "grade-pending": "Comprovativo recebido",
          "grade-rejected": "Reenviar comprovativo",
        }[name];
        if (expectedState) await page.getByText(expectedState, { exact: false }).first().waitFor({ timeout: 8000 }).catch(() => {});
        await page.evaluate(z => { document.documentElement.style.zoom = String(z); }, zoom);
        await page.waitForTimeout(200);
        await page.evaluate(() => document.fonts.ready);
        if (name.startsWith("dashboard-")) {
          const links = page.getByTestId("aluno-summary-cards").getByRole("link");
          if (await links.count() !== 3) errors.push(`${name}: expected exactly three summary cards`);
          const targets = await links.evaluateAll(nodes => nodes.map(el => ({
            width: el.offsetWidth, height: el.offsetHeight,
          })));
          if (targets.some(target => target.width < 44 || target.height < 44)) {
            errors.push(`${name} ${width}x${height} zoom ${zoom}: summary card below 44px touch target`);
          }
          if (name === "dashboard-clean") {
            await links.first().focus();
            await page.keyboard.press("Tab");
            await page.waitForFunction(() => document.activeElement === document.querySelectorAll('[data-testid="aluno-summary-cards"] a')[1], undefined, { timeout: 3000 }).catch(() => {});
            const focusVisible = await links.nth(1).evaluate(el => {
              const style = getComputedStyle(el);
              return document.activeElement === el && el.matches(":focus-visible") &&
                (style.outlineStyle !== "none" || style.boxShadow !== "none");
            });
            if (!focusVisible) errors.push(`${name} ${width}x${height} zoom ${zoom}: card keyboard focus not visible`);
            await links.nth(1).evaluate(el => el.blur());
          }
        }
        if ((name.startsWith("dashboard-") || name === "professor-com-turmas") && width === 390 && zoom === 1) {
          const welcome = page.getByTestId("portal-welcome-card");
          await welcome.waitFor({timeout:10000});
          const identity = await welcome.evaluate(async el => {
            const faces = await document.fonts.load("600 16px Sora");
            const signature = el.querySelector(".klasse-welcome-signature");
            const img = new Image();
            img.src = "/icons/klasse-welcome-signature.svg";
            try { await img.decode(); } catch { /* reported below */ }
            return {
              font: faces.some(face => face.status === "loaded") && getComputedStyle(el).fontFamily.includes("Sora"),
              signature: Boolean(signature && signature.getBoundingClientRect().height > 0 && getComputedStyle(signature).backgroundImage.includes("klasse-welcome-signature.svg") && img.naturalWidth > 0),
              dates: el.querySelectorAll("time").length,
            };
          });
          if (!identity.font || !identity.signature || identity.dates !== 1) errors.push(name + ": invalid welcome identity " + JSON.stringify(identity));
          if (name === "dashboard-clean" || name === "professor-com-turmas") {
            const more = page.getByRole("button", { name: "Mais áreas" });
            await more.click();
            const drawer = page.getByRole("dialog", { name: "Outras áreas" });
            await drawer.waitFor();
            await page.waitForFunction(() => document.querySelector('[role="dialog"][data-motion-state="open"]') !== null);
            await drawer.evaluate(async el => { await Promise.all(el.getAnimations().map(animation => animation.finished.catch(() => {}))); });
            const fits = await drawer.evaluate(el => {
              const box = el.getBoundingClientRect();
              return box.top >= 0 && box.bottom <= window.innerHeight + 1 && box.left >= 0 && box.right <= window.innerWidth + 1;
            });
            if (!fits) errors.push(name + ": drawer exceeds mobile viewport");
            await page.keyboard.press("Escape");
            await drawer.waitFor({state:"hidden"});
            await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Mais áreas");
          }
        }
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
          if (name === "dashboard-clean" && metrics.bodyText.includes("A acompanhar"))
            errors.push(`${name} ${width}x${height} zoom ${zoom}: false pending section`);
          if (name === "dashboard-pending" && !metrics.bodyText.includes("Documento em análise"))
            errors.push(`${name} ${width}x${height} zoom ${zoom}: pending state missing`);
          if (name === "dashboard-rejected" && !metrics.bodyText.includes("Reenviar no mesmo pedido"))
            errors.push(`${name} ${width}x${height} zoom ${zoom}: recovery action missing`);
          if (name === "dashboard-rematricula" && !metrics.bodyText.includes("A tua rematrícula"))
            errors.push(`${name} ${width}x${height} zoom ${zoom}: rematrícula missing`);
          if (name === "dashboard-overdue" && !metrics.bodyText.includes("1 mensalidade vencida"))
            errors.push(`${name} ${width}x${height} zoom ${zoom}: overdue missing`);
          if (name === "dashboard-empty" && (metrics.bodyText.includes("08:00") || metrics.bodyText.includes("Reunião de encarregados")))
            errors.push(`${name} ${width}x${height} zoom ${zoom}: invented schedule or notices`);
        }
        if (name.startsWith("grade-")) {
          if (["grade-paid","grade-unpaid","grade-pending","grade-rejected"].includes(name) && !metrics.bodyText.includes("Matemática")) errors.push(`${name}: published grades missing`);
          if (name === "grade-paid" && (!metrics.bodyText.includes("Matemática") || !metrics.bodyText.includes("16") || !metrics.bodyText.includes("17"))) errors.push(`${name}: paid grades missing from trimester grid`);
          if (name === "grade-pending" && !metrics.bodyText.includes("Comprovativo recebido")) errors.push(`${name}: pending state missing`);
          if (name === "grade-unpaid" && !metrics.bodyText.includes("Solicitar boletim")) errors.push(`${name}: payment CTA missing`);
          if (name === "grade-rejected" && !metrics.bodyText.includes("Reenviar comprovativo")) errors.push(`${name}: resubmit action missing`);
          if (name === "grade-empty" && !metrics.bodyText.includes("Ainda não há avaliações publicadas")) errors.push(`${name}: empty state missing`);
          if (!metrics.bodyText.includes("Minhas notas")) errors.push(`${name}: grade grid missing`);
          if (["grade-unpaid","grade-pending","grade-rejected"].includes(name) && !metrics.bodyText.includes("Prova trimestral") && !metrics.bodyText.includes("16")) errors.push(`${name}: published assessments missing`);
        }
        if ((name.startsWith("grade-") || name.startsWith("notice-")) && metrics.nestedScrolls) errors.push(`${name}: unnecessary nested scroll`);
        report.push({ name, width, height, zoom, horizontalOverflow: metrics.horizontalOverflow, nestedScrolls: metrics.nestedScrolls, fixtureRendered: visible, output });
        if (name.startsWith("dashboard-") && metrics.nestedScrolls > 0) errors.push(`${name} ${width}x${height} zoom ${zoom}: nested scroll ${metrics.nestedScrolls}`);
        if (!visible) errors.push(`${name} ${width}x${height} zoom ${zoom}: content not rendered; root children ${metrics.rendered}`);
        if (metrics.horizontalOverflow > 12) errors.push(`${name} ${width}x${height} zoom ${zoom}: horizontal overflow ${metrics.horizontalOverflow}px`);
      }
    }
    if (name === "academic-tabs") {
      await page.goto(`${baseUrl}/?story=academic-tabs`, { waitUntil: "domcontentloaded" });
      try {
        const tabs = page.getByRole("tablist", { name: "Área académica" });
        await tabs.waitFor({ timeout: 10000 });
        const initialDocument = await page.evaluate(() => { (window).__academicFixtureSentinel = "same-document"; return document; }).then(() => true);
        const notesTab = page.getByRole("tab", { name: "Notas" });
        const subjectTab = page.getByRole("tab", { name: "Disciplinas" });
        const documentsTab = page.getByRole("tab", { name: "Documentos" });
        await notesTab.focus();
        await page.keyboard.press("ArrowRight");
        await page.waitForFunction(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.includes("Disciplinas"));
        if (await subjectTab.getAttribute("tabindex") !== "0") errors.push("academic-tabs: roving keyboard focus broken");
        if (!(await page.getByRole("tabpanel", { name: "Disciplinas" }).isVisible())) errors.push("academic-tabs: discipline panel not visible");
        if (await tabs.locator("[data-portal-motion-indicator]").count() !== 1 || await tabs.evaluate(el => getComputedStyle(el).getPropertyValue("--portal-tab-index").trim() !== "1")) errors.push("academic-tabs: indicator not associated with selected tab");
        await page.keyboard.press("Home");
        await page.waitForFunction(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.includes("Notas"));
        await page.keyboard.press("End");
        await page.waitForFunction(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.includes("Documentos"));
        if (!(await documentsTab.getAttribute("aria-selected") === "true")) errors.push("academic-tabs: End key did not select documents");
        await page.goBack({ waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.includes("Notas"));
        if ((await page.evaluate(() => (window).__academicFixtureSentinel)) !== "same-document" || !initialDocument) {
          errors.push("academic-tabs: navigation caused full page reload");
        }
        await page.emulateMedia({reducedMotion:"reduce"});
        await page.goto(`${baseUrl}/?story=academic-tabs`, {waitUntil:"domcontentloaded"});
        await page.getByRole("tab", {name:"Notas"}).focus();
        await page.keyboard.press("ArrowRight");
        const reducedIndicator = page.getByRole("tablist", {name:"Área académica"}).locator("[data-portal-motion-indicator]");
        await page.waitForFunction(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.includes("Disciplinas"));
        await reducedIndicator.waitFor();
        if (await reducedIndicator.evaluate(el => el.getAnimations().length > 0 || parseFloat(getComputedStyle(el).transitionDuration) > 0)) errors.push("academic-tabs: indicator animates under reduced motion");
        await page.emulateMedia({reducedMotion:"no-preference"});
      } catch (error) {
        errors.push(`academic-tabs: keyboard/panel/back navigation failed: ${error.message}`);
      }
    }
    if (name === "dashboard-clean" || name === "professor-com-turmas") {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({width:390,height:844});
      await page.goto(`${baseUrl}/?story=${name}`, {waitUntil:"domcontentloaded"});
      const more = page.getByRole("button", {name:"Mais áreas"});
      await more.click();
      const sheet = page.getByRole("dialog", {name:"Outras áreas"});
      await sheet.waitFor();
      if (await sheet.evaluate(el => getComputedStyle(el).animationName !== "none" || el.getAnimations().length > 0)) errors.push(name + ": reduced-motion drawer still animates");
      await page.keyboard.press("Escape");
      await sheet.waitFor({state:"hidden"});
      await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Mais áreas");
      await page.emulateMedia({ reducedMotion: "no-preference" });
    }
    if (name === "grade-paid") {
      await page.goto(`${baseUrl}/?story=grade-paid`, { waitUntil: "domcontentloaded" });
      const grid = page.getByTestId("aluno-boletim-grid");
      await grid.waitFor({ timeout: 10000 });
      await grid.getByText("16", { exact: true }).first().waitFor({ timeout: 10000 });
      const printButton = grid.getByRole("button", { name: /Descarregar boletim em PDF para imprimir/ });
      if (await printButton.isDisabled()) errors.push("grade-paid: PDF unexpectedly disabled");
      await grid.getByRole("button", { name: "Ocultar notas" }).click();
      if (await grid.getByText("16", { exact: true }).count()) errors.push("grade-paid: score remained visible after hiding");
      await grid.getByRole("button", { name: "Exibir notas" }).click();
      await grid.getByText("16", { exact: true }).first().waitFor();
      await grid.getByRole("button", { name: "Ver detalhes de Matemática" }).click();
      await grid.getByText("Prova trimestral").waitFor();
      await grid.getByRole("button", { name: "Pedir reapreciação" }).click();
      await page.getByRole("dialog", { name: /Solicitar reapreciação/ }).waitFor();
      await page.keyboard.press("Tab");
      if (!(await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        return dialog?.contains(document.activeElement) ?? false;
      }))) errors.push("grade-paid: modal did not retain keyboard focus");
      await page.keyboard.press("Escape");
      await page.getByRole("dialog", { name: /Solicitar reapreciação/ }).waitFor({ state: "hidden" });
      if (!(await grid.getByRole("button", { name: "Pedir reapreciação" }).evaluate(el => el === document.activeElement))) {
        errors.push("grade-paid: focus not restored after Escape");
      }
      await grid.getByRole("button", { name: "Solicitar melhoria" }).click();
      await page.getByRole("dialog", { name: /Solicitar melhoria/ }).waitFor();
      await page.getByRole("button", { name: "Cancelar" }).click();
      await page.getByRole("dialog", { name: /Solicitar melhoria/ }).waitFor({ state: "hidden" });
      await grid.getByRole("button", { name: "2.º trimestre" }).click();
      await grid.getByRole("button", { name: "Ver detalhes de Matemática" }).click();
      await grid.getByText("Exame do período").waitFor();
      if (await grid.getByText("Biologia", { exact: true }).count()) errors.push("grade-paid: first-term-only subject appears in second trimester");
      await grid.getByRole("button", { name: "Por disciplina" }).click();
      const selector = grid.getByRole("combobox", { name: "Disciplina" });
      await selector.selectOption("disc-3");
      if (!(await grid.getByText("Disciplina não lecionada neste período").count())) errors.push("grade-paid: annual subject missing non-taught term");
      await grid.getByRole("button", { name: "Por trimestre" }).click();
    }
    if (name === "grade-unpaid") {
      await page.goto(`${baseUrl}/?story=grade-unpaid`, { waitUntil: "domcontentloaded" });
      const grid = page.getByTestId("aluno-boletim-grid");
      await grid.waitFor({ timeout: 10000 });
      await grid.getByText("Matemática", { exact: true }).first().waitFor({ timeout: 10000 });
      if (!(await grid.getByRole("button", { name: /Ocultar notas/ }).isEnabled())) {
        errors.push("grade-unpaid: published grades unexpectedly blocked");
      }
      if (!(await grid.getByRole("button", { name: /Boletim oficial requer autorização de pagamento/ }).isDisabled())) {
        errors.push("grade-unpaid: official PDF unexpectedly enabled");
      }
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
      const noticeMetrics = await page.evaluate(() => {
        const node = document.querySelector("section[role]");
        if (!node) return null;
        const title = node.querySelector("h3");
        return {
          foreground: title ? getComputedStyle(title).color : "",
          background: getComputedStyle(node).backgroundColor,
          animationDuration: getComputedStyle(node).animationDuration,
        };
      });
      const violations = [];
      if (!noticeMetrics) violations.push("notice semantic region missing");
      else {
        try {
          const ratio = contrastRatio(noticeMetrics.foreground, noticeMetrics.background);
          if (ratio < 4.5) violations.push("WCAG AA heading contrast " + ratio.toFixed(2));
        } catch (error) {
          violations.push("contrast could not be measured: " + error.message);
        }
        if (parseFloat(noticeMetrics.animationDuration) > 0)
          violations.push("notice animates under reduced-motion");
      }
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
