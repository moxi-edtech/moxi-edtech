import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const moduleUrl = process.env.PLAYWRIGHT_MODULE || "playwright";
const { chromium } = await import(moduleUrl.startsWith("/") ? pathToFileURL(moduleUrl).href : moduleUrl);
const url = (process.env.STORYBOOK_BASE_URL || "http://127.0.0.1:6006") + "/?story=theme-switcher";
const out = "apps/web/visual-evidence";
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "light" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", err => errors.push(err.message));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const chooser = page.getByRole("radiogroup", { name: "Aparência" });
  await chooser.waitFor();
  await page.getByRole("button", { name: "Tema escuro" }).waitFor();

  const surface = page.getByTestId("theme-surface");
  const colors = () => surface.evaluate(el => {
    const css = getComputedStyle(el);
    return { background: css.backgroundColor, foreground: css.color };
  });
  const checkContrast = async () => {
    const { background, foreground } = await colors();
    const rgb = str => (str.match(/[0-9.]+/g) || []).slice(0, 3).map(Number);
    const lightness = str => rgb(str).map(n => {
      const v = n / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0);
    const a = lightness(background), b = lightness(foreground);
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    assert.ok(ratio >= 4.5, `Theme contrast ${ratio.toFixed(2)} (bg=${background}, fg=${foreground})`);
  };

  await chooser.getByRole("radio", { name: "Claro" }).click();
  await page.waitForFunction(() => !document.documentElement.classList.contains("dark"));
  const light = await colors();
  await checkContrast();
  await page.screenshot({ path: `${out}/theme-switcher-light.png` });

  await chooser.getByRole("radio", { name: "Escuro" }).click();
  await page.waitForFunction(() => document.documentElement.classList.contains("dark"));
  const dark = await colors();
  assert.notDeepEqual(dark, light, "Theme colors must visually differ");
  await checkContrast();
  assert.equal(await page.evaluate(() => localStorage.getItem("klasse-theme")), "dark");
  await page.screenshot({ path: `${out}/theme-switcher-dark.png` });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("radio", { name: "Escuro" }).waitFor();
  assert.equal(await page.getByRole("radio", { name: "Escuro" }).getAttribute("aria-checked"), "true");
  assert.equal(await page.locator("html").evaluate(el => el.classList.contains("dark")), true, "dark preference persists after reload");

  await page.getByRole("radio", { name: "Sistema" }).click();
  await page.waitForFunction(() => !document.documentElement.classList.contains("dark"));
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForFunction(() => document.documentElement.classList.contains("dark"));
  assert.equal(await page.evaluate(() => localStorage.getItem("klasse-theme")), "system");
  await page.getByRole("radio", { name: "Claro" }).click();
  await page.waitForFunction(() => !document.documentElement.classList.contains("dark"));
  assert.equal(await page.evaluate(() => localStorage.getItem("klasse-theme")), "light");
  assert.deepEqual(errors, [], "no client-side exceptions");
  await context.close();
  console.log("PASS: light, dark, system, persistence, contrast and control semantics");
} finally {
  await browser.close();
}
