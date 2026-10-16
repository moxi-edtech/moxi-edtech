import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const moduleUrl=process.env.PLAYWRIGHT_MODULE||'playwright';
const {chromium}=await import(moduleUrl.startsWith('/')?pathToFileURL(moduleUrl).href:moduleUrl);
const dir='apps/web/visual-evidence/class-transfer';
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
const report=[];
try {
 for(const [width,height] of [[360,640],[390,844],[768,1024],[1366,768],[1920,1080]]) {
  for(const zoom of [1,1.25,1.5]) {
   const page=await browser.newPage({viewport:{width,height}});
   await page.goto('http://127.0.0.1:6006/?story=class-transfer');
   await page.locator('option[value="00000000-0000-4000-8000-000000000012"]').waitFor({state:'attached'});
   await page.locator('#turma').selectOption('00000000-0000-4000-8000-000000000012');
   await page.getByLabel(/Motivo da correcção/).fill('Correção administrativa por divergência de turma');
   await page.getByRole('button',{name:'Rever transferência'}).click();
   await page.getByText('Reveja antes de aplicar').waitFor();
   await page.evaluate(z=>{document.documentElement.style.zoom=String(z)},zoom);
   const file=`${dir}/transfer-${width}x${height}-${Math.round(zoom*100)}.png`;
   await page.screenshot({path:file,fullPage:false});
   report.push({width,height,zoom,file});
   await page.close();
  }
 }
 await writeFile(`${dir}/manifest.json`,JSON.stringify(report,null,2));
} finally {await browser.close()}
