import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const {chromium,webkit}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const isWebKit=process.env.PROVAS_BROWSER==="webkit";
const browser=await (isWebKit?webkit:chromium).launch({headless:true});
try{
 for(const [width,height] of (isWebKit?[[390,844]]:[[320,568],[390,844],[768,1024],[1280,800]])){
  const page=await browser.newPage({viewport:{width,height},hasTouch:width<768,isMobile:width<768});
  const errors=[];page.on("pageerror",error=>errors.push(error.message));
  await page.goto("http://127.0.0.1:6006/provas.html?notificacoes=1");
  const trigger=page.getByRole("button",{name:/^Notificações/});
  await trigger.click();
  const panel=page.getByRole("dialog",{name:"Notificações",exact:true});
  await panel.waitFor();
  const box=await panel.boundingBox();
  assert.ok(box&&box.x>=-1&&box.x+box.width<=width+1,"panel fits viewport "+JSON.stringify(box));
  assert.ok(box.y>=0&&box.y+box.height<=height+1,"panel fits height "+JSON.stringify(box));
  if(width<768){
   assert.equal(await panel.getAttribute("aria-modal"),"true");
   assert.ok(Math.abs(box.y+box.height-height)<=2,"mobile sheet is bottom anchored");
   assert.ok(box.width>=width-2,"mobile sheet uses available width");
  }else{
   assert.ok(box.width<=322,"desktop anchored dropdown width");
  }
  assert.equal(await panel.getByRole("listitem").count(),20);
  const read=panel.getByRole("button",{name:/Avaliação disponível/});
  await read.click();
  await panel.getByText("19 por ler",{exact:true}).waitFor();
  await panel.getByRole("button",{name:"Marcar todas como lidas",exact:true}).click();
  await panel.getByText("19 por ler",{exact:true}).waitFor({state:"hidden"});
  assert.equal(await panel.getByRole("button",{name:"Marcar todas como lidas",exact:true}).count(),0);
  await page.keyboard.press("Escape");
  await panel.waitFor({state:"hidden"});
  await page.waitForFunction(()=>document.activeElement?.getAttribute("aria-label")==="Notificações");
  await trigger.click();
  await panel.waitFor();
  await panel.getByRole("button",{name:"Fechar notificações"}).click();
  await panel.waitFor({state:"hidden"});
  await trigger.click();
  await panel.getByRole("button",{name:/Revisão de prova/}).click();
  await panel.waitFor({state:"hidden"});
  assert.equal(await page.getByRole("status").innerText(),"/professor/provas");
  assert.equal(errors.length,0,errors.join("\n"));
  await page.close();
  console.log("Notification surface passed",width);
 }
}finally{await browser.close();}
