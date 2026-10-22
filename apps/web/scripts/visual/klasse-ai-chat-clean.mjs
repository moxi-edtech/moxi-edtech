import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

// Offline browser against the real KLASSE IA component with synthetic API responses.
const moduleUrl = process.env.PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = await import(moduleUrl.startsWith('/') ? pathToFileURL(moduleUrl).href : moduleUrl);
const output = 'apps/web/visual-evidence/klasse-ai-chat-clean';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const [width,height] of [[360,640],[390,844],[1366,768]]) {
    for (const zoom of [1,1.25]) {
      // Emulate browser zoom by reducing CSS viewport dimensions; a CSS zoom
      // on the root would enlarge fixed elements without changing 100vw.
      const cssWidth = Math.floor(width / zoom);
      const cssHeight = Math.floor(height / zoom);
      const page = await browser.newPage({ viewport: { width: cssWidth, height: cssHeight } });
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err.message));
      await page.addInitScript(() => localStorage.clear());
      await page.goto('http://127.0.0.1:6006/?story=school-intelligence&role=admin&school=A', { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', {name:'Abrir KLASSE IA'}).click();
      const dialog = page.getByRole('dialog', { name: 'Conversa com o KLASSE IA' });
      await dialog.waitFor();
      assert.equal(await dialog.getByRole('heading', {name:'KLASSE IA'}).count(), 1);
      assert.equal(await dialog.getByText('Klasse Brain').count(), 0, 'legacy branding must be removed');
      assert.equal(await dialog.locator('[class*="bg-gradient"]').count(), 0, 'no decorative gradients in chat');
      const textarea = dialog.getByRole('textbox', {name:'Mensagem para o KLASSE IA'});
      assert.ok(await dialog.getByLabel('Sugestões de consulta').locator('button').count() > 0, 'initial suggestions remain available');
      const metrics = await dialog.evaluate(element => {
        const box = element.getBoundingClientRect();
        const input = element.querySelector('textarea');
        return { left:box.left,right:box.right,top:box.top,bottom:box.bottom,
          width:box.width, height:box.height,
          inputFont:parseFloat(getComputedStyle(input).fontSize),
          bodyOverflow:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth) };
      });
      assert.ok(metrics.left >= -2 && metrics.right <= cssWidth+2, `horizontal bounds ${JSON.stringify(metrics)}`);
      assert.ok(metrics.top >= -2 && metrics.bottom <= cssHeight+2, `vertical bounds ${JSON.stringify(metrics)}`);
      assert.ok(metrics.inputFont >= 14, `composer is too small: ${metrics.inputFont}`);
      assert.ok(metrics.bodyOverflow <= 8, `page overflow: ${metrics.bodyOverflow}`);
      const filename = `${output}/${width}x${height}-${Math.round(zoom*100)}.png`;
      await page.screenshot({ path:filename, fullPage:false });
      // Verify sending, data insight, evidence and navigation without touching a real school.
      await textarea.fill('Quais são os professores com notas pendentes?');
      if (cssWidth < 768) await dialog.getByRole('button',{name:'Enviar mensagem'}).click();
      else await textarea.press('Enter');
      await dialog.getByText(/2 de 8 docentes têm lançamentos/).waitFor({timeout:12000});
      await dialog.getByText('Ver detalhes', {exact:true}).last().click();
      await dialog.getByText('Fonte e filtros aplicados').waitFor();
      assert.equal(await dialog.getByLabel('Sugestões de consulta').count(), 0, 'suggestions should not crowd the ongoing conversation');
      await dialog.getByRole('button',{name:'Ajuda'}).click();
      await dialog.getByRole('button',{name:'Voltar ao assistente'}).waitFor();
      await dialog.getByRole('button',{name:'Voltar ao assistente'}).click();
      await dialog.getByText(/2 de 8 docentes têm lançamentos/).waitFor();
      assert.deepEqual(pageErrors,[],`browser errors: ${pageErrors.join('; ')}`);
      results.push({ width,height,zoom,cssWidth,cssHeight,filename,metrics,passed:true });
      await page.close();
    }
  }
  // The server must reject users who cannot use the operational assistant.
  const denied = await browser.newPage();
  await denied.goto('http://127.0.0.1:6006/?story=school-intelligence&role=professor');
  await denied.waitForTimeout(700);
  assert.equal(await denied.getByRole('button',{name:'Abrir KLASSE IA'}).count(),0,'unauthorized role must not see the chat');
  await denied.close();
  await writeFile(`${output}/report.json`, JSON.stringify({ synthetic:true, results },null,2));
  console.log(`KLASSE IA clean UI: ${results.length} responsive/zoom scenarios + unauthorized role PASS`);
} finally {
  await browser.close();
}
