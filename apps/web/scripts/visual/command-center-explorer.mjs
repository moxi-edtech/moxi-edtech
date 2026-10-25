import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const moduleUrl = process.env.PLAYWRIGHT_MODULE || "playwright";
const { chromium } = await import(moduleUrl.startsWith("/") ? pathToFileURL(moduleUrl).href : moduleUrl);
const output = "apps/web/visual-evidence/command-center-explorer";
const base = "http://127.0.0.1:6006/?story=command-center-explorer";
const dimensions = [[360,640],[390,844],[768,1024],[1366,768],[1920,1080]];
const zooms = [1,1.25,1.5];
const browser = await chromium.launch({ headless: true });
const reports = [];
await mkdir(output, { recursive: true });

async function capture(page, size, zoom, state) {
  const layout = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    fullWidth: document.documentElement.scrollWidth,
    height: window.innerHeight,
  }));
  assert.ok(layout.fullWidth <= layout.width + 4,
    `Horizontal overflow at ${size.join("x")}/${zoom}/${state}: ${JSON.stringify(layout)}`);
  const name = `${size.join("x")}-${Math.round(zoom*100)}-${state}`;
  const file = `${output}/${name}.jpg`;
  await page.screenshot({ path: file, type: "jpeg", quality: 75, fullPage: false, animations: "disabled" });
  reports.push({ width: size[0], height: size[1], zoom, state, file, overflow: layout.fullWidth-layout.width });
}

/** Automated WCAG 2.0/2.1 A/AA subset on the real contextual component,
 * with wholly fictional records. No certification or screen-reader claim. */
async function checkAutomatedAccessibility(page, state) {
  const axePath = process.env.AXE_CORE_FILE;
  if (!axePath) return;
  await page.addScriptTag({ path: axePath });
  const violations = await page.evaluate(async () => {
    const results = await window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a","wcag2aa","wcag21a","wcag21aa"] },
    });
    return results.violations.map((rule) => ({
      id: rule.id, impact: rule.impact, nodes: rule.nodes.length,
      selectors: rule.nodes.map((node) => node.target.join(" ")).slice(0, 4),
    }));
  });
  assert.deepEqual(violations, [], `Automated accessibility failures in ${state}: ${JSON.stringify(violations)}`);
}

async function run(size, zoom) {
  const width = Math.floor(size[0] / zoom);
  const height = Math.floor(size[1] / zoom);
  const page = await browser.newPage({ viewport: { width,height }, reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  const reset = async () => {
    await page.goto(base);
    await page.getByRole("heading", { name: "10.ª A" }).waitFor();
    await page.getByText("Excedente de lotação").waitFor();
  };
  const input = () => page.getByRole("searchbox", { name: "Nome ou processo" });

  await reset();
  await capture(page,size,zoom,"lista");
  await checkAutomatedAccessibility(page, "turma-lista");
  assert.equal(await page.getByText("55").first().isVisible(),true);
  await capture(page,size,zoom,"lotacao-55-50");
  const filter = page.getByRole("combobox", { name: "Situação verificada" });
  assert.equal(await filter.isVisible(),true);
  await capture(page,size,zoom,"filtro-activo");

  const sort = page.getByRole("combobox", { name: "Ordenar alunos" });
  await input().focus();
  await page.keyboard.press("Tab");
  assert.equal(await filter.evaluate(element => element === document.activeElement), true,
    "Canonical filter must be keyboard reachable after search");
  await page.keyboard.press("Tab");
  assert.equal(await sort.evaluate(element => element === document.activeElement), true,
    "Sort must be keyboard reachable after filter");
  await sort.selectOption("nome_desc");
  await page.getByText("55 encontrados").waitFor();
  await page.getByText("Aluno Sintético 55").first().waitFor();
  await capture(page,size,zoom,"ordenacao-z-a");
  await sort.selectOption("pendencias_primeiro");
  await page.getByText("55 encontrados").waitFor();
  await page.waitForFunction(
    () => document.querySelector("[data-student-id]")?.getAttribute("data-student-id") ===
      "00000000-0000-4000-8100-000000000004",
    null, { timeout: 10_000 },
  );
  const firstPriorityId = await page.locator("[data-student-id]").first().getAttribute("data-student-id");
  assert.equal(firstPriorityId, "00000000-0000-4000-8100-000000000004");
  await capture(page,size,zoom,"pendencias-primeiro");
  await sort.selectOption("nome_asc");
  await filter.selectOption("documentos_sinalizados");
  await page.getByText("2 encontrados").waitFor();
  await capture(page,size,zoom,"documentos-sinalizados");
  await filter.selectOption("propinas_vencidas");
  await page.getByText("2 encontrados").waitFor();
  await capture(page,size,zoom,"propinas-vencidas");
  await filter.selectOption("ambos");
  await page.getByText("1 encontrados").waitFor();
  await capture(page,size,zoom,"documentos-e-propinas");
  await filter.selectOption("todos");


  await input().fill("Aluno Sintético 55");
  await page.getByText("1 encontrados").waitFor();
  await capture(page,size,zoom,"pesquisa-resultado");

  await input().fill("Nenhum nome encontrado");
  await page.getByText("0 encontrados").waitFor();
  await capture(page,size,zoom,"vazio");

  await input().fill("erro");
  await page.getByRole("alert").waitFor();
  await capture(page,size,zoom,"erro");

  await input().fill("demora");
  await page.getByText("A pesquisar alunos…").waitFor();
  await capture(page,size,zoom,"carregando");

  await reset();
  await page.getByRole("button", { name: "Ações de Aluno Sintético 01" }).click();
  await page.getByRole("button", { name: "Abrir Emitir documento" }).waitFor();
  await checkAutomatedAccessibility(page, "student-actions");
  await capture(page,size,zoom,"acoes-por-permissao");
  await page.getByRole("button", { name: "Fechar ações de Aluno Sintético 01" }).click();
  await page.locator('[data-student-id="00000000-0000-4000-8100-000000000001"]').click();
  await page.getByRole("dialog",{name:"Balcão sintético"}).waitFor();
  await capture(page,size,zoom,"balcao-sintetico");
  await page.getByRole("button",{name:"Voltar à turma"}).click();
  await page.getByText(/Voltou ao mesmo contexto da Turma/).waitFor();
  await capture(page,size,zoom,"retorno-balcao");

  // EX-004: exercise the actual React return path for three consecutive
  // fictional students. The viewport, page, and focus must survive the dialog.
  const viewport = () => page.getByRole("region", { name: "Área de rolagem da turma" });
  await viewport().evaluate((node) => { node.scrollTop = 260; });
  await page.waitForFunction(() => {
    const node = document.querySelector('[aria-label="Área de rolagem da turma"]');
    return Boolean(node && node.scrollTop > 0);
  });
  await page.locator('[data-student-id="00000000-0000-4000-8100-000000000002"]').click();
  await page.getByRole("dialog",{name:"Balcão sintético"}).waitFor();
  await page.getByRole("button",{name:"Voltar à turma"}).click();
  await viewport().waitFor();
  await page.waitForFunction(() => {
    const owner = document.querySelector('[aria-label="Área de rolagem da turma"]');
    const selected = document.querySelector('[data-student-id="00000000-0000-4000-8100-000000000002"]');
    return Boolean(owner && owner.scrollTop > 0 && selected?.getAttribute("aria-current") === "true" &&
      document.activeElement === selected);
  }, null, { timeout: 10000 });
  assert.ok(await viewport().evaluate((node) => node.scrollTop > 0),
    "Second student must return to the real scrollable parent, not to an inner div");

  await page.getByRole("button", { name: /Seguinte/ }).click();
  await page.getByText("Página 2 de 3").waitFor();
  await page.locator('[data-student-id="00000000-0000-4000-8100-000000000022"]').click();
  await page.getByRole("dialog",{name:"Balcão sintético"}).waitFor();
  await page.getByRole("button",{name:"Voltar à turma"}).click();
  await page.getByText("Página 2 de 3").waitFor();
  await page.waitForFunction(() => {
    const row = document.querySelector('[data-student-id="00000000-0000-4000-8100-000000000022"]');
    return row?.getAttribute("aria-current") === "true" && document.activeElement === row;
  }, null, { timeout: 10000 });
  await capture(page,size,zoom,"tres-alunos-retorno-paginado");

  assert.deepEqual(errors,[],`Browser errors at ${size.join("x")}/${zoom}: ${errors.join("; ")}`);
  await page.close();
}
try {
  for(const size of dimensions) for(const zoom of zooms) await run(size,zoom);
  await writeFile(`${output}/manifest.json`, JSON.stringify({ fixture:"entirely synthetic", scenarios: reports },null,2));
  console.log(`Command Center visual contract: ${reports.length} synthetic screenshots, ${dimensions.length} viewports x ${zooms.length} zooms OK`);
} finally { await browser.close(); }
