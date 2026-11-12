import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

test("three-year journey settles the selected year's debt, retries confirmation and stops at missing years", async () => {
 const {JSDOM}=await import(pathToFileURL(process.env.TEST_JSDOM_MODULE!).href);
 const dom=new JSDOM("<div id='root'></div>",{url:"https://fixture.invalid"});
 for(const k of ["window","document","HTMLElement","HTMLSelectElement","Event","MouseEvent"]) Object.defineProperty(globalThis,k,{value:dom.window[k],configurable:true,writable:true});
 Object.defineProperty(globalThis,"navigator",{value:dom.window.navigator,configurable:true});
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
 const React=await import("react");(globalThis as any).React=React;
 const {createRoot}=await import("react-dom/client");
 const {BalcaoPercursoAcademico}=await import("../src/components/secretaria/BalcaoPercursoAcademico");
 const root=createRoot(document.getElementById("root")!);
 const snapshot:any={ano:{ano:2026,label:"2026/2027"},can_recover_historical:true,records:[2023,2024,2025].map(ano_letivo=>({ano_letivo,ano_letivo_id:"y"+ano_letivo,matricula_id:"m"+ano_letivo,escola_id:"school",aluno_id:"pupil",turma_id:"t"+ano_letivo,turma_nome:"Turma "+ano_letivo,status_persistido:"pendente",situacao_resultado:ano_letivo===2023?"homologado":"sem_resultado_oficial"}))};
 let fees:any[]=[{id:"fee",origem_matricula_id:"m2023",preco:100,atrasada:true}];
 let paid="",writes=0,confirmed=0,fail=true;
 const originalFetch=globalThis.fetch;
 globalThis.fetch=(async(url:string,init?:RequestInit)=>{
  if(init?.method==="POST"){
   const b=JSON.parse(String(init.body));assert.equal(b.acao,"concluir_ano_percurso");assert.equal(b.modo,"resultado");assert.equal(b.matricula_id,"m2024");assert.equal(b.resultado_confirmado,"aprovado");assert.equal(b.notas,undefined);writes++;
   if(!fail){snapshot.records[1].situacao_resultado="homologado";confirmed++;}
   return Response.json({ok:!fail,error:fail?"Falha sintética":undefined},{status:fail?409:200});
  }
  assert.equal(init?.cache,"no-store");const id=new URL(url,"https://fixture.invalid").searchParams.get("matricula_id");
  return Response.json({ok:true,matricula_id:id,permite_confirmar_resultado:true,permite_notas_historicas:true,tem_notas_reais:false});
 }) as typeof fetch;
 dom.window.confirm=()=>true;
 const buttons=()=>[...document.querySelectorAll("button")];
 const tick=async()=>{await new Promise(r=>setTimeout(r,15));};
 const click=async(prefix:string)=>{await React.act(async()=>{buttons().find(b=>b.textContent?.startsWith(prefix))!.click();await tick();});await React.act(tick);};
 const render=async()=>{await React.act(async()=>{root.render(React.createElement(BalcaoPercursoAcademico,{snapshot,mensalidades:fees,financialVerified:true,onPay:(id:string)=>{paid=id;},onBusyChange:()=>{},onUpdated:async()=>{}}));await tick();});await React.act(tick);};
 try{
  await render();for(const y of [2023,2024,2025])assert.match(document.body.textContent!,new RegExp(String(y)));
  await click("2025");assert.match(document.body.textContent!,/Conclua primeiro/);assert.equal(document.querySelectorAll("select").length,0);assert.ok(buttons().find(b=>b.textContent==="Corrigir turma da pauta"),"a mistaken future class must be correctable without skipping the previous result");
  await click("2023");await click("Liquidar");assert.equal(paid,"m2023");fees=[];await render();assert.ok(document.querySelector('[aria-label="Resolver 2024"]'));
  await React.act(async()=>{const field=document.querySelector("select")!;field.value="aprovado";field.dispatchEvent(new dom.window.Event("change",{bubbles:true}));});
  await click("Confirmar e concluir");assert.equal(writes,1);assert.equal(confirmed,0);assert.match(document.body.textContent!,/Falha sintética/);assert.equal(document.querySelector("select")!.value,"aprovado");
  fail=false;await click("Confirmar e concluir");await render();assert.equal(confirmed,1);assert.ok(document.querySelector('[aria-label="Resolver 2025"]'));assert.equal(document.querySelectorAll("input").length,0);
  snapshot.records[0].ano_letivo=2022;await render();assert.match(document.body.textContent!,/Há anos sem matrícula registada/);assert.equal(buttons().find(b=>b.textContent==="Confirmar e concluir ano")!.disabled,true);
 }finally{await React.act(async()=>root.unmount());globalThis.fetch=originalFetch;dom.window.close();}
});
