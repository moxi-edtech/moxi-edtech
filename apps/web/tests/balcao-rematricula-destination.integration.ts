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
  const { useRematriculaMensalidadesDestino } = await import("../src/hooks/useRematriculaMensalidadesDestino");
  const { RematriculaBalcaoModal } = await import("../src/components/secretaria/RematriculaBalcaoModal");
  let hook: ReturnType<typeof useRematriculaBalcao>, posted: any;
  let available = true, failBudget = false, firstMonthAlreadyPaid = false;
  let paymentItems: any[] = [];
  let budget: ReturnType<typeof useRematriculaMensalidadesDestino>;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    if(init?.method === "POST") { posted=JSON.parse(String(init.body));return Response.json({ok:true,rematricula:{matricula_id:"new",turma_id:"destination",ano_letivo_id:"target"}}); }
    if(url.includes("/orcamento/matricula?")) return failBudget
      ? Response.json({ok:false,error:"Falha sintética"},{status:503})
      : Response.json({ok:true,data:{mensalidades:[
        ...(!firstMonthAlreadyPaid?[{competencia:"2026-09",valor:3500}]:[]),
        {competencia:"2026-10",valor:3500}
      ]}});
    if(url.includes("turmas-simples")) return Response.json({ok:true,items:available?[{id:"destination",nome:"4.ª classe",capacidade_maxima:70,ocupacao_atual:38,session_id:"target"}]:[],progressao:{estado:"aprovado",modo:"promocao",classe_origem:3,classe_destino:4,mensagem:"Aprovado"}});
    assert.ok(url.includes("/rematriculas/status?"));
    const destination=new URL(url,"https://fixture.invalid").searchParams.get("destino_turma_id");
    return Response.json({ok:true,status:"READY",service:{id:"fee",nome:"Rematrícula",valor_base:1600},debt:{total:0,count:0},academic:{eligible:true},ano_letivo:{id:"target",ano:2026,label:"2026/2027"},destino_turma_id:destination});
  }) as typeof fetch;
  function Harness() {
    const [items,setItems]=React.useState<any[]>([]);
    const state=useRematriculaBalcao({escolaId:"school",alunoId:"pupil",matriculaId:"source",academicYearId:"target",itensPagamento:items});
    const quote=useRematriculaMensalidadesDestino({escolaId:"school",alunoId:"pupil",anoLetivoId:"target",turmaId:state.selectedTurmaId,setSelectedItems:setItems});
    React.useEffect(() => { hook=state; budget=quote; paymentItems=items; });
    if(!state.anoLetivo || !state.service)return null;
    return React.createElement(RematriculaBalcaoModal,{...state,open:state.modalOpen,onClose:state.closeModal,embedded:true,
      alunoNome:"Aluno sintético",alunoProcesso:"1",turmaAtual:"3.ª classe",matriculaId:"source",anoLetivo:state.anoLetivo,service:state.service,onPostAction:()=>{},
      itensPagamento:items,itensDisponiveis:[...quote.items,{id:"card",tipo:"servico",nome:"Cartão",preco:300}],
      mensalidadesLoading:quote.loading,mensalidadesError:quote.error,onRetryMensalidades:quote.retry,
      onAdicionarItem:(item:any)=>setItems(current=>current.some(x=>x.id===item.id&&x.tipo===item.tipo)?current:[...current,item]),
      onRemoverItem:(id:string,tipo:string)=>setItems(current=>current.filter(x=>x.id!==id||x.tipo!==tipo)),
    });
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
    await click("Rever cobrança");
    await click("Propina 2026-10");await click("Cartão");
    assert.equal(paymentItems.filter(x=>x.tipo==="mensalidade").length,2);
    await click("Continuar");
    assert.match(document.querySelector('[aria-label="Itens do pagamento"]')!.textContent!,/Propina 2026-09/);
    assert.match(document.querySelector('[aria-label="Itens do pagamento"]')!.textContent!,/Propina 2026-10/);
    assert.equal(hook!.step,3);
    assert.equal(button("Confirmar rematrícula").disabled,false,"confirmation remains enabled with an eligible selected class");
    await React.act(async()=>{await hook!.refreshStatus("destination");});await React.act(tick);
    assert.equal(hook!.selectedTurmaId,"destination");
    assert.equal(paymentItems.length,3,"status refresh preserves both months and the service");
    failBudget=true;
    await React.act(async()=>{budget!.retry();await tick();});await React.act(tick);
    assert.equal(paymentItems.length,3,"failed quote refresh never silently discards monthly selections");
    assert.equal(button("Confirmar rematrícula").disabled,true,"a stale monthly quote must be rechecked");
    failBudget=false;await React.act(async()=>{budget!.retry();await tick();});await React.act(tick);
    assert.equal(button("Confirmar rematrícula").disabled,false);
    // Fresh availability may invalidate a selection, but never an unrelated refresh.
    available=false;await React.act(async()=>{await hook!.retryTurmas();});await React.act(tick);
    assert.equal(hook!.selectedTurmaId,null);
    assert.equal(paymentItems.length,3,"a temporary missing class does not clear the payment draft");
    assert.equal(button("Confirmar rematrícula").disabled,true);
    available=true;await React.act(async()=>{await hook!.retryTurmas();hook!.setStep(1);});await React.act(tick);
    await React.act(async()=>{hook!.setSelectedTurmaId("destination");await tick();});await React.act(tick);
    await click("Rever cobrança");await click("Continuar");await click("Confirmar rematrícula");
    assert.equal(posted.destino_turma_id,"destination");assert.equal(posted.aluno_id,"pupil");
    assert.deepEqual(posted.mensalidades_competencias,["2026-09","2026-10"]);
    assert.deepEqual(posted.itens,[{id:"card",tipo:"servico"}]);assert.equal(hook!.result?.ok,true);
    // Once the source-of-truth ledger reports a month already settled, the
    // next successful quote drops only that stale month, never valid services.
    firstMonthAlreadyPaid=true;
    await React.act(async()=>{budget!.retry();await tick();});await React.act(tick);
    assert.deepEqual(paymentItems.filter(x=>x.tipo==="mensalidade").map(x=>x.competencia),["2026-10"]);
    assert.equal(paymentItems.some(x=>x.tipo==="servico"&&x.id==="card"),true);
  } finally {await React.act(async()=>root.unmount());globalThis.fetch=originalFetch;dom.window.close();}
});
