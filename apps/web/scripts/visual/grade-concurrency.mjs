import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const moduleName = process.env.PLAYWRIGHT_MODULE || "playwright";
const { chromium } = await import(moduleName.startsWith("/") ? pathToFileURL(moduleName).href : moduleName);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE || undefined });
try {
  for (const max of [10, 20]) {
    const page = await browser.newPage();
    const requests = [];
    await page.route("**/fixture/grade-save", route => { requests.push(route); });
    await page.goto((process.env.STORYBOOK_BASE_URL || "http://127.0.0.1:6006") + "/grade-concurrency.html");
    if (max === 10) await page.getByText("Usar dez valores").click();
    const input = page.locator('input[inputmode="decimal"]').first();
    const save = page.getByText("Guardar agora");
    const waitForCount = async count => {
      for (let i = 0; requests.length < count && i < 100; i++) await page.waitForTimeout(50);
      assert.equal(requests.length, count);
    };
    await input.fill("4");
    await save.click();
    await waitForCount(1);
    await input.fill(String(max));
    await save.click();
    await page.waitForTimeout(900);
    assert.equal(requests.length, 1, "Autosave e Guardar devem partilhar o pedido em curso");
    await requests[0].fulfill({status: 200, body: "{}"});
    await waitForCount(2);
    const batch = requests[1].request().postDataJSON();
    assert.deepEqual(batch.map(row => [row.id, row.mac1]), [["A", max]]);
    await requests[1].fulfill({status: 409, body: "{}"});
    await page.getByText("Falha ao guardar", {exact:true}).first().waitFor();
    await save.click();
    await waitForCount(3);
    assert.equal(requests[2].request().postDataJSON()[0].mac1, max);
    await requests[2].fulfill({status: 200, body: "{}"});
    await page.getByText("Guardado", {exact:true}).first().waitFor();
    assert.equal(await input.inputValue(), String(max));
    await page.close();
    console.log("Autosave, gravação manual e repetição confirmados na escala", max);
  }
} finally { await browser.close(); }
