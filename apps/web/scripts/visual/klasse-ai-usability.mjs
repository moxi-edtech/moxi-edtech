import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Playwright is already used by KLASSE's visual harness; no new production dependency.
// Offline fixture, fictional identifiers and records; zero external LLM/Supabase requests.
const moduleUrl=process.env.PLAYWRIGHT_MODULE || 'playwright';
const {chromium}=await import(moduleUrl.startsWith('/')?pathToFileURL(moduleUrl).href:moduleUrl);
const dir='apps/web/visual-evidence/klasse-ai-usability';
const base='http://127.0.0.1:6006/?story=school-intelligence&role=admin&school=A';
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
const reports=[];

async function snapshot(page, name, width, height, zoom) {
  const dialog=page.getByRole('dialog',{name:'Conversa com o KLASSE IA'});
  const visible=await dialog.isVisible().catch(()=>false);
  const panel=visible ? await dialog.evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,height:r.height};}) : null;
  const bounds=await page.evaluate(()=>({width:document.documentElement.clientWidth,height:window.innerHeight,
    overflow:Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth)}));
  assert.ok(bounds.overflow<=8,`horizontal page overflow ${name}: ${JSON.stringify(bounds)}`);
  if(panel){
    assert.ok(panel.left>=-2 && panel.right<=bounds.width+2,`panel horizontal bounds ${name}: ${JSON.stringify(panel)}`);
    assert.ok(panel.top>=-2 && panel.bottom<=bounds.height+2,`panel vertical bounds ${name}: ${JSON.stringify(panel)}`);
  }
  const file=`${dir}/${width}x${height}-zoom-${Math.round(zoom*100)}-${name}.png`;
  await page.screenshot({path:file,fullPage:false,animations:'disabled'});
  reports.push({width,height,zoom,name,file,panel,bounds});
}
async function send(page, text) {
  const panel=page.getByRole('dialog',{name:'Conversa com o KLASSE IA'});
  const field=panel.getByRole('textbox',{name:'Mensagem para o KLASSE IA'});
  await field.fill(text);
  await panel.getByRole('button',{name:'Enviar mensagem'}).click();
}
async function exerciseViewport(width,height,zoom){
  const cssWidth=Math.floor(width/zoom), cssHeight=Math.floor(height/zoom);
  const page=await browser.newPage({viewport:{width:cssWidth,height:cssHeight},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await page.getByRole('button',{name:'Abrir KLASSE IA'}).waitFor();
  await snapshot(page,'closed',width,height,zoom);
  await page.getByRole('button',{name:'Abrir KLASSE IA'}).click();
  const panel=page.getByRole('dialog',{name:'Conversa com o KLASSE IA'});
  const field=panel.getByRole('textbox',{name:'Mensagem para o KLASSE IA'});
  await panel.getByText('KLASSE IA',{exact:true}).waitFor();
  await snapshot(page,'open',width,height,zoom);
  await panel.getByRole('button',{name:'Expandir conversa'}).click();
  await panel.getByRole('button',{name:'Recolher conversa'}).waitFor();
  await snapshot(page,'expanded',width,height,zoom);
  await page.keyboard.press('Escape');
  await panel.getByRole('button',{name:'Expandir conversa'}).waitFor();
  assert.equal(await panel.getByRole('button',{name:'Expandir conversa'}).evaluate(el=>document.activeElement===el),true,'focus restored after Esc');

  // A complete scoped insight: source + filters are inside an accessible details disclosure.
  await send(page,'Traz as notas sintéticas por turma');
  await panel.getByText(/2 de 8 docentes têm lançamentos/).waitFor();
  const details=panel.locator('details').filter({hasText:'Fonte e filtros aplicados'}).last();
  await details.locator('summary').click();
  assert.equal(await details.getByText('Fonte e filtros aplicados').isVisible(),true);
  await details.getByText(/Fonte:/).waitFor();
  await details.getByText(/Filtros \/ âmbito:/).waitFor();
  await snapshot(page,'scoped-insight',width,height,zoom);
  await details.locator('summary').click();

  // Accessible semantic table, either inline or in disclosure; horizontal scroll stays inside.
  await send(page,'tabela de teste');
  await panel.getByText(/43 cobranças de 80/).waitFor();
  const tableDisclosure=panel.locator('details').filter({hasText:'Fonte e filtros aplicados'}).last();
  await tableDisclosure.locator('summary').click();
  const table=tableDisclosure.locator('table').first();
  assert.equal(await table.locator('thead th[scope="col"]').count(),2);
  assert.equal(await table.locator('tbody tr').count(),2);
  await snapshot(page,'table',width,height,zoom);

  // In-flight request cancellation, with no retries or page reloads.
  await send(page,'demora de teste');
  await panel.getByRole('button',{name:'Cancelar consulta'}).waitFor();
  await snapshot(page,'loading',width,height,zoom);
  await panel.getByRole('button',{name:'Cancelar consulta'}).click();
  await panel.getByText('Consulta interrompida. Nenhum resultado foi confirmado.').waitFor();
  await snapshot(page,'interrupted',width,height,zoom);

  await send(page,'erro de teste');
  await panel.getByText('Não foi possível consultar a escola agora. Tente novamente.').waitFor();
  await snapshot(page,'error',width,height,zoom);
  const before=await page.evaluate(()=>window.__klasseFixtureCounters.assistant);
  await panel.getByRole('button',{name:'Tentar de novo'}).last().click();
  await panel.getByText(/2 de 8 docentes têm lançamentos/).last().waitFor();
  const after=await page.evaluate(()=>window.__klasseFixtureCounters.assistant);
  assert.equal(after-before,1,'retry is exactly one request');
  assert.equal(await panel.getByText('Não foi possível consultar a escola agora. Tente novamente.').count(),0,'retry replaces failure instead of duplicating it');

  // The input grows up to its own scroll threshold; Shift+Enter adds a line everywhere.
  await field.fill('Linha longa\n'.repeat(20));
  const inputHeight=await field.evaluate(el=>el.getBoundingClientRect().height);
  assert.ok(inputHeight <= 130 && inputHeight >= 110,`auto-grow textarea ${inputHeight}`);
  await field.fill('Texto curto');
  await field.press('Shift+Enter');
  assert.ok((await field.inputValue()).includes('\n'));
  if(cssWidth<768){
    await field.fill('Enter móvel');
    await field.press('Enter');
    assert.ok((await field.inputValue()).includes('\n'),'mobile Enter must insert line break');
  } else {
    await field.fill('Enter desktop');
    const count=await page.evaluate(()=>window.__klasseFixtureCounters.assistant);
    await field.press('Enter');
    await panel.getByText('Enter desktop',{exact:true}).waitFor();
    const countAfter=await page.evaluate(()=>window.__klasseFixtureCounters.assistant);
    assert.equal(countAfter-count,1,'desktop Enter sends once');
  }
  await field.fill('Rascunho sintético que deve sobreviver');
  await panel.getByRole('button',{name:'Fechar conversa'}).click();
  await page.getByRole('button',{name:'Abrir KLASSE IA'}).click();
  assert.equal(await field.inputValue(),'Rascunho sintético que deve sobreviver');
  await field.fill('');
  await panel.getByText(/43 cobranças de 80/).waitFor();
  // Long conversation stays scrollable in the transcript only; never page horizontally.
  for(let i=0;i<9;i++){
    await send(page,`Consulta sintética ${i}`);
    await panel.getByText(/2 de 8 docentes têm lançamentos/).last().waitFor();
  }
  await snapshot(page,'long-conversation',width,height,zoom);

  // Simulate the mobile keyboard by reducing the visual viewport without using a real IME.
  if(cssWidth<768){
    await panel.getByRole('button',{name:'Expandir conversa'}).click();
    const restoredHeight=cssHeight;
    await page.setViewportSize({width:cssWidth,height:Math.max(280,Math.floor(cssHeight*0.58))});
    await page.waitForTimeout(80);
    const textRect=await field.boundingBox();
    const submitRect=await panel.getByRole('button',{name:'Enviar mensagem'}).boundingBox();
    const keyboardHeight=await page.evaluate(()=>window.innerHeight);
    assert.ok(textRect&&submitRect&&textRect.y>=0&&textRect.y+textRect.height<=keyboardHeight+2,'composer visible above simulated keyboard');
    assert.ok(submitRect.y+submitRect.height<=keyboardHeight+2,'send visible above simulated keyboard');
    await snapshot(page,'virtual-keyboard',width,height,zoom);
    await page.setViewportSize({width:cssWidth,height:restoredHeight});
  }
  assert.deepEqual(errors,[],`page errors at ${width}x${height}/${zoom}: ${errors.join('; ')}`);
  await page.close();
}

async function exerciseIsolation(){
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await page.goto(base);
  await page.getByRole('button',{name:'Abrir KLASSE IA'}).click();
  const panel=page.getByRole('dialog',{name:'Conversa com o KLASSE IA'});
  await send(page,'Mensagem exclusiva da Escola A, utilizador A');
  await panel.getByText('Mensagem exclusiva da Escola A, utilizador A',{exact:true}).waitFor();
  const count=await page.evaluate(()=>window.__klasseFixtureCounters.assistant);
  await panel.getByRole('button',{name:'Fechar conversa'}).click();
  await page.getByRole('button',{name:'Trocar ano sintético'}).click();
  await page.getByRole('button',{name:'Abrir KLASSE IA'}).click();
  await panel.getByText(/Nova consulta: Escola/).waitFor();
  assert.equal(await panel.getByText('Mensagem exclusiva da Escola A, utilizador A').count(),0,'year scope reset');
  await panel.getByRole('button',{name:'Fechar conversa'}).click();
  await page.getByRole('button',{name:'Trocar polo sintético'}).click();
  await page.getByRole('button',{name:'Abrir KLASSE IA'}).click();
  await panel.getByText(/polo selecionado/).waitFor();
  assert.equal(await panel.getByText('Mensagem exclusiva da Escola A, utilizador A').count(),0,'polo scope reset');
  await panel.getByRole('button',{name:'Fechar conversa'}).click();
  await page.getByRole('button',{name:'Trocar escola sintética'}).click();
  await page.getByRole('button',{name:'Abrir KLASSE IA'}).waitFor();
  await page.getByRole('button',{name:'Abrir KLASSE IA'}).click();
  assert.equal(await panel.getByText('Mensagem exclusiva da Escola A, utilizador A').count(),0,'school scope reset');
  assert.equal(await page.evaluate(()=>window.__klasseFixtureCounters.assistant),count,'context changes do not create assistant requests');
  await send(page,'Pergunta exclusiva do utilizador A');
  await panel.getByText('Pergunta exclusiva do utilizador A',{exact:true}).waitFor();
  await panel.getByRole('button',{name:'Fechar conversa'}).click();
  await page.getByRole('button',{name:'Trocar utilizador sintético'}).click();
  await page.getByRole('button',{name:'Abrir KLASSE IA'}).waitFor();
  await page.getByRole('button',{name:'Abrir KLASSE IA'}).click();
  assert.equal(await panel.getByText('Pergunta exclusiva do utilizador A').count(),0,'user B cannot read user A messages');
  await panel.getByRole('button',{name:'Fechar conversa'}).click();
  await page.getByRole('button',{name:'Logout sintético'}).click();
  await page.waitForTimeout(80);
  assert.equal(await page.getByRole('dialog',{name:'Conversa com o KLASSE IA'}).count(),0,'logout clears chat');
  await page.close();

  const denied=await browser.newPage({viewport:{width:390,height:844}});
  await denied.goto('http://127.0.0.1:6006/?story=school-intelligence&role=professor');
  await denied.waitForTimeout(350);
  assert.equal(await denied.getByRole('button',{name:'Abrir KLASSE IA'}).count(),0,'unauthorized cannot see chat');
  await denied.close();
}
try{
  for(const [w,h] of [[360,640],[390,844],[768,1024],[1366,768],[1920,1080]]){
    for(const zoom of [1,1.25,1.5]) await exerciseViewport(w,h,zoom);
  }
  await exerciseIsolation();
  await writeFile(`${dir}/manifest.json`,JSON.stringify({fixture:'synthetic only',playwright:true, scenarios:reports},null,2));
  console.log(`KLASSE IA usability: ${reports.length} screenshots, 15 viewport/zoom configurations; interaction and isolation PASS`);
}finally{await browser.close();}
