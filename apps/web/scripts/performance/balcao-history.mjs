#!/usr/bin/env node
// Synthetic-only browser history/back and discarded-form regression.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const modulePath=process.env.PLAYWRIGHT_MODULE||'playwright';
const {chromium}=await import(modulePath.startsWith('/')?pathToFileURL(modulePath).href:modulePath);
const browser=await chromium.launch({headless:true,...(process.env.PERF_CHROME_PATH?{executablePath:process.env.PERF_CHROME_PATH}:{})});
try{
 const page=await browser.newPage();
 const base=process.env.PERF_BASE_URL||'http://127.0.0.1:6016';
 await page.goto(base+'/?story=balcao-retention');
 await page.getByTestId('draft-payment').waitFor();
 await page.evaluate(()=>history.pushState({synthetic:true},'',location.pathname+'?story=balcao-retention&synthetic=previous'));
 let dialogs=0;
 page.on('dialog',dialog=>{dialogs++;void dialog.dismiss()});
 await page.getByTestId('draft-payment').fill('fixture pending');
 await page.getByTestId('has-unsaved').getByText('true').waitFor();
 await page.goBack({waitUntil:'domcontentloaded'}).catch(()=>null);
 await page.waitForTimeout(300);
 assert.ok(dialogs>=1,'browser back must ask before dropping pending work');
 assert.equal(await page.getByTestId('draft-payment').inputValue(),'fixture pending','cancelling browser Back keeps the draft');
 assert.match(page.url(),/story=balcao-retention/);
 await page.getByTestId('clear-payment').click();
 await page.getByTestId('has-unsaved').getByText('false').waitFor();
 // No confirmation for a reverted/clean draft.
 const prior=dialogs;
 await page.evaluate(()=>window.dispatchEvent(new Event('beforeunload',{cancelable:true})));
 assert.equal(dialogs,prior);
 console.log('PASS: browser history confirmation for dirty state, cancelled Back preserves draft, clean state no prompt');
}finally{await browser.close()}
