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
  const input = () => page.getByRole("searchbox", { name: "Procurar aluno nesta lista" });

  await reset();
  await capture(page,size,zoom,"lista");
  assert.equal(await page.getByText("55").first().isVisible(),true);
  await capture(page,size,zoom,"lotacao-55-50");
  assert.equal(await page.getByText("Matrículas activas").first().isVisible(),true);
  await capture(page,size,zoom,"filtro-activo");

  const sort = page.getByRole("combobox", { name: "Ordenar alunos" });
  await input().focus();
  await page.keyboard.press("Tab");
  assert.equal(await sort.evaluate(element => element === document.activeElement), true,
    "Sort must be keyboard reachable after search");
  await sort.selectOption("nome_desc");
  await page.getByText("55 encontrados").waitFor();
  await page.getByText("Aluno Sintético 55").first().waitFor();
  await capture(page,size,zoom,"ordenacao-z-a");
  await sort.selectOption("nome_asc");


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
  await page.getByText("Aluno Sintético 01").click();
  await page.getByRole("dialog",{name:"Balcão sintético"}).waitFor();
  await capture(page,size,zoom,"balcao-sintetico");
  await page.getByRole("button",{name:"Voltar à turma"}).click();
  await page.getByText(/Voltou ao mesmo contexto da Turma/).waitFor();
  await capture(page,size,zoom,"retorno-balcao");

  assert.deepEqual(errors,[],`Browser errors at ${size.join("x")}/${zoom}: ${errors.join("; ")}`);
  await page.close();
}
try {
  for(const size of dimensions) for(const zoom of zooms) await run(size,zoom);
  await writeFile(`${output}/manifest.json`, JSON.stringify({ fixture:"entirely synthetic", scenarios: reports },null,2));
  console.log(`Command Center visual contract: ${reports.length} synthetic screenshots, ${dimensions.length} viewports x ${zooms.length} zooms OK`);
} finally { await browser.close(); }
