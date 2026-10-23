#!/usr/bin/env node
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const lib=process.env.PLAYWRIGHT_MODULE||"playwright";
const {chromium}=await import(lib.startsWith("/")?pathToFileURL(lib).href:lib);
const browser=await chromium.launch({headless:true,...(process.env.PERF_CHROME_PATH?{executablePath:process.env.PERF_CHROME_PATH}:{})});
const page=await browser.newPage();
const errors=[];
page.on("pageerror",e=>errors.push(e.message.slice(0,200)));
try{
  await page.goto((process.env.PERF_BASE_URL||"http://127.0.0.1:6019")+"/?story=balcao-financial-refresh");
  await page.getByRole("status").filter({hasText:"Dados atualizados"}).waitFor();
  await page.getByText("Aluno fictício",{exact:true}).waitFor();
  await page.getByText(/Última atualização:/).waitFor();
  const cards=page.locator('[aria-disabled="false"]');
  assert.ok(await cards.count()>0);
  await page.getByTestId("refresh-dossier").click();
  await page.getByRole("status").filter({hasText:"Atualizando dados..."}).waitFor();
  assert.ok(await page.getByText("Aluno fictício",{exact:true}).count()>0,
    "last confirmed student data must remain visible during revalidation");
  assert.ok(await page.locator('[aria-disabled="true"][inert]').count()>0,
    "outdated financial operations must remain inert during background readback");
  await page.getByRole("status").filter({hasText:"Dados atualizados"}).waitFor();
  assert.equal(await page.locator('[aria-disabled="true"][inert]').count(),0,
    "verified server refresh must unblock actions");
  await page.getByTestId("refresh-dossier").click();
  await page.getByText(/Não foi possível confirmar dados recentes/).waitFor();
  assert.ok(await page.getByText("Aluno fictício",{exact:true}).count()>0,
    "a failed refresh must preserve snapshot but label it stale");
  assert.ok(await page.locator('[aria-disabled="true"][inert]').count()>0,
    "failed refresh must not expose stale finance as actionable");
  assert.deepEqual(errors,[],"no client exceptions");
  console.log("PASS: N3 keeps data during refresh, shows last confirmed time, disables stale finance after readback error");
}finally{await browser.close()}
