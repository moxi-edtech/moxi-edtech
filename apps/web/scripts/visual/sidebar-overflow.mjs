import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { mkdir } from "node:fs/promises";

const moduleUrl = process.env.PLAYWRIGHT_MODULE || "playwright";
const { chromium } = await import(moduleUrl.startsWith("/") ? pathToFileURL(moduleUrl).href : moduleUrl);
const base = process.env.STORYBOOK_BASE_URL || "http://127.0.0.1:6006";
const out = "apps/web/visual-evidence";
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  for (const role of ["operacoes", "admin", "secretaria", "financeiro", "superadmin", "professor", "gestor"]) {
    for (const width of [320, 768, 1024, 1280, 1920]) {
      const page = await browser.newPage({ viewport: { width, height: 640 }, reducedMotion: "reduce" });
      try {
        const errors = [];
        page.on("pageerror", (err) => errors.push(err.message));
        await page.goto(base + "/sidebar.html?portal=" + role, { waitUntil: "domcontentloaded" });
        const sidebar = page.locator('[data-sidebar="klasse"]');
        await sidebar.waitFor();
        await page.evaluate(() => document.fonts.ready);
        const nav = sidebar.getByRole("navigation", { name: "Menus do portal" });
        const groups = nav.locator("button[aria-expanded=false]");
        while (await groups.count()) await groups.first().click();
        await page.waitForFunction(() => {
          const el = document.querySelector('[data-sidebar="klasse"]');
          return el && el.getAttribute("data-collapsed") === "false";
        });
        const check = async (expectedWidth) => {
          const geometry = await sidebar.evaluate(el => {
            const nav = el.querySelector("nav");
            const rows = [...nav.querySelectorAll("button, a")];
            return {
              width: el.getBoundingClientRect().width,
              outerOverflow: el.scrollWidth - el.clientWidth,
              navOverflow: nav.scrollWidth - nav.clientWidth,
              rowOverflow: Math.max(0, ...rows.map(row => row.scrollWidth - row.clientWidth)),
              pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
              scrollable: getComputedStyle(nav).overflowY,
            };
          });
          assert.ok(Math.abs(geometry.width - expectedWidth) <= 1, JSON.stringify({ role, width, geometry }));
          for (const key of ["outerOverflow", "navOverflow", "rowOverflow", "pageOverflow"]) {
            assert.ok(geometry[key] <= 1, JSON.stringify({ role, width, key, geometry }));
          }
          assert.equal(geometry.scrollable, "auto");
        };
        await check(width < 768 ? Math.min(256, width * 0.65) : 256);
        const stress = nav.getByRole("link", { name: "Submenu excepcionalmente longo para validar a integridade visual" });
        assert.equal(await stress.getAttribute("title"), "Submenu excepcionalmente longo para validar a integridade visual");
        await sidebar.getByRole("button", { name: "Recolher sidebar" }).click();
        await page.waitForFunction(() => Math.abs(document.querySelector('[data-sidebar="klasse"]').getBoundingClientRect().width - 80) <= 1);
        await check(80);
        await sidebar.getByRole("button", { name: "Expandir sidebar" }).click();
        await page.waitForFunction(expected => Math.abs(document.querySelector('[data-sidebar="klasse"]').getBoundingClientRect().width - expected) <= 1, width < 768 ? Math.min(256, width * 0.65) : 256);
        await check(width < 768 ? Math.min(256, width * 0.65) : 256);
        assert.deepEqual(errors, []);
        if (role === "operacoes" && width === 1280) await page.screenshot({ path: out + "/sidebar-operacoes.png" });
      } finally {
        await page.close();
      }
    }
  }
  console.log("Sidebar: 7 portals × 5 widths × expanded/collapsed/reopened verified.");
} finally {
  await browser.close();
}
