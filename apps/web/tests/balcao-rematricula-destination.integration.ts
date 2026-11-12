import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

test("selected destination survives status refresh, all wizard steps and payment selection", async () => {
  const { JSDOM } = await import(pathToFileURL(process.env.TEST_JSDOM_MODULE!).href);
  const dom = new JSDOM("<div id='root'></div>", { url: "https://fixture.invalid" });
  for (const key of ["window","document","HTMLElement","HTMLInputElement","HTMLSelectElement","Event","MouseEvent","MutationObserver"])
    Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true,writable:true});
  Object.defineProperty(globalThis,"navigator",{value:dom.window.navigator,configurable:true});
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const React = await import("react"); (globalThis as any).React = React;
  const { createRoot } = await import("react-dom/client");
  const { useRematriculaBalcao } = await import("../src/hooks/useRematriculaBalcao");
  const { RematriculaBalcaoModal } = await import("../src/components/secretaria/RematriculaBalcaoModal");
  let hook: ReturnType<typeof useRematriculaBalcao>, posted: any;
  let available = true;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    if(init?.method === "POST") { posted=JSON.parse(String(init.body));return Response.json({ok:true,rematricula:{matricula_id:"new",turma_id:"destination",ano_letivo_id:"target"}}); }
    if(url.includes("turmas-simples")) return Response.json({ok:true,items:available?[{id:"destination",nome:"4.ª classe",capacidade_maxima:70,ocupacao_atual:38,session_id:"target"}]:[],progressao:{estado:"aprovado",modo:"promocao",classe_origem:3,classe_destino:4,mensagem:"Aprovado"}});
    assert.ok(url.includes("/rematriculas/status?"));
    const destination=new URL(url,"https://fixture.invalid").searchParams.get("destino_turma_id");
    return Response.json({ok:true,status:"READY",service:{id:"fee",nome:"Rematrícula",valor_base:1600},debt:{total:0,count:0},academic:{eligible:true},ano_letivo:{id:"target",ano:2026,label:"2026/2027"},destino_turma_id:destination});
  }) as typeof fetch;
  function Harness() {
    hook=useRematriculaBalcao({escolaId:"school",alunoId:"pupil",matriculaId:"source",academicYearId:"target"});
    if(!hook.anoLetivo || !hook.service)return null;
    return React.createElement(RematriculaBalcaoModal,{...hook,open:hook.modalOpen,onClose:hook.closeModal,embedded:true,
      alunoNome:"Aluno sintético",alunoProcesso:"1",turmaAtual:"3.ª classe",matriculaId:"source",anoLetivo:hook.anoLetivo,service:hook.service,onPostAction:()=>{}});
  }
  const root=createRoot(document.getElementById("root")!);
  const tick=async()=>{await new Promise(r=>setTimeout(r,10));};
  const button=(prefix:string)=>[...document.querySelectorAll<HTMLButtonElement>("button")].find(b=>b.textContent?.startsWith(prefix))!;
  const click=async(prefix:string)=>{await React.act(async()=>{button(prefix).click();await tick();});await React.act(tick);};
  try {
    await React.act(async()=>{root.render(React.createElement(Harness));await tick();});await React.act(tick);
    await React.act(async()=>{hook!.openModal();await tick();});await React.act(tick);
    await React.act(async()=>{const select=document.querySelector("#rematricula-turma-select") as HTMLSelectElement;select.value="destination";select.dispatchEvent(new dom.window.Event("change",{bubbles:true}));await tick();});await React.act(tick);
    assert.equal(hook!.selectedTurmaId,"destination","destination status echo must not clear the selection");
    await click("Rever cobrança");await click("Continuar");
    assert.equal(hook!.step,3);
    assert.equal(button("Confirmar rematrícula").disabled,false,"confirmation remains enabled with an eligible selected class");
    await React.act(async()=>{await hook!.refreshStatus("destination");});await React.act(tick);
    assert.equal(hook!.selectedTurmaId,"destination");
    // Fresh availability may invalidate a selection, but never an unrelated refresh.
    available=false;await React.act(async()=>{await hook!.retryTurmas();});await React.act(tick);
    assert.equal(hook!.selectedTurmaId,null);
    assert.equal(button("Confirmar rematrícula").disabled,true);
    available=true;await React.act(async()=>{await hook!.retryTurmas();hook!.setStep(1);});await React.act(tick);
    await React.act(async()=>{hook!.setSelectedTurmaId("destination");await tick();});await React.act(tick);
    await click("Rever cobrança");await click("Continuar");await click("Confirmar rematrícula");
    assert.equal(posted.destino_turma_id,"destination");assert.equal(posted.aluno_id,"pupil");assert.equal(hook!.result?.ok,true);
  } finally {await React.act(async()=>root.unmount());globalThis.fetch=originalFetch;dom.window.close();}
});
