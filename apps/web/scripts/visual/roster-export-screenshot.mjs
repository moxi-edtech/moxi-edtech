import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const moduleUrl = process.env.PLAYWRIGHT_MODULE || "playwright";
const { chromium } = await import(moduleUrl.startsWith("/") ? pathToFileURL(moduleUrl).href : moduleUrl);
const directory = "apps/web/visual-evidence/roster-export";
await mkdir(directory, { recursive: true });

const browser = await chromium.launch({ headless: true });
const manifest = [];
const scenarios = ["pronto", "a_gerar", "concluido", "erro"];
const sizes = [[360, 640], [390, 844], [768, 1024], [1366, 768], [1920, 1080]];
const zooms = [1, 1.25, 1.5];

try {
  for (const [width, height] of sizes) {
    for (const zoom of zooms) {
      for (const scenario of scenarios) {
        const page = await browser.newPage({
          viewport: { width, height },
          acceptDownloads: true,
          deviceScaleFactor: 1,
        });
        const errors = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.route("**/api/secretaria/turmas/**/alunos/pdf**", async route => {
          if (scenario === "a_gerar") {
            await new Promise(resolve => setTimeout(resolve, 3_000));
          }
          if (scenario === "erro") {
            await route.fulfill({
              status: 503, contentType: "application/json",
              body: JSON.stringify({ ok: false, error: "Falha sintética de emissão" }),
            });
            return;
          }
          await route.fulfill({
            status: 200,
            headers: {
              "content-type": "application/pdf",
              "content-disposition": 'attachment; filename="lista_teste.pdf"',
            },
            body: "%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF",
          });
        });
        await page.goto("http://127.0.0.1:6006/?story=roster-export", { waitUntil: "domcontentloaded" });
        await page.locator("#roster-export-fixture").waitFor({ state: "visible" });
        await page.evaluate(z => { document.documentElement.style.zoom = String(z); }, zoom);

        const button = page.getByRole("button", { name: "Imprimir lista" }).first();
        if (scenario !== "pronto") {
          await button.click();
          if (scenario === "a_gerar") {
            await page.getByRole("button", { name: "A gerar lista…" }).first().waitFor();
          } else if (scenario === "concluido") {
            await page.getByText("PDF pronto.").first().waitFor({ timeout: 10_000 });
          } else {
            await page.getByRole("alert").first().waitFor({ timeout: 10_000 });
            await page.getByRole("button", { name: "Tentar de novo" }).first().waitFor();
          }
        }

        const overflow = await page.evaluate(() => {
          const root = document.documentElement;
          return Math.max(0, root.scrollWidth - root.clientWidth);
        });
        if (overflow > 1) {
          throw new Error("Horizontal overflow " + width + "x" + height +
            " zoom " + zoom + " scenario " + scenario + ": +" + overflow + "px");
        }
        if (errors.length > 0) {
          throw new Error("React/browser error: " + errors.join("; "));
        }
        const filename = directory + "/lista-" + scenario + "-" + width + "x" + height +
          "-" + Math.round(100 * zoom) + ".png";
        await page.screenshot({ path: filename, fullPage: false });
        manifest.push({ width, height, zoom, scenario, filename, overflowPx: overflow });
        await page.close();
      }
    }
  }
  await writeFile(directory + "/manifest.json", JSON.stringify(manifest, null, 2));
  if (manifest.length !== sizes.length * zooms.length * scenarios.length) {
    throw new Error("Matriz visual incompleta");
  }
  console.log("Capturas sintéticas: " + manifest.length + "; sem overflow horizontal");
} finally {
  await browser.close();
}
