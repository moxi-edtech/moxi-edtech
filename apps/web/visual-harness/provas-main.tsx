import React,{useRef,useState} from "react";
import { NotificacoesSurface } from "../src/components/ui/NotificacoesSurface";
import type { Notificacao } from "../src/hooks/useNotificacoes";
import { createRoot } from "react-dom/client";
import ProvasWorkspace from "../src/components/provas/ProvasWorkspace";
import ProvasModal from "../src/components/provas/ProvasModal";
import "./fixture.css";
import "../src/app/globals.css";
const escolaId="00000000-0000-4000-8000-000000000001";
const query=new URLSearchParams(location.search);
function NotificationsFixture(){
 const triggerRef=useRef<HTMLButtonElement>(null);
 const [action,setAction]=useState("");
 const [items,setItems]=useState<Notificacao[]>(()=>Array.from({length:20},(_,i)=>({
  id:String(i),evento_id:"fixture",titulo:i===0?"Avaliação disponível":i===1?"Revisão de prova":"Notificação "+(i+1),
  corpo:i===0?"A sua turma tem uma avaliação pendente. Consulte as informações e os detalhes antes de continuar. ".repeat(2):"Informação académica de teste.",
  prioridade:i===0?"aviso":"info",action_label:i===1?"Consultar prova":null,action_url:i===1?"/professor/provas":null,
  gatilho:null,tipo:null,modal_id:null,agrupamento_chave:null,arquivada:false,arquivada_em:null,lida:false,lida_em:null,created_at:new Date().toISOString()
 })));
 const read=(id:string)=>setItems(old=>old.map(n=>n.id===id?{...n,lida:true}:n));
 return <div className="klasse-portal-theme min-h-[120vh]">
  <header className="sticky top-0 z-30 flex justify-end gap-2 border-b border-border bg-card/95 p-2 backdrop-blur">
   <NotificacoesSurface triggerRef={triggerRef} notificacoes={items} naoLidas={items.filter(n=>!n.lida).length} loading={false}
    onLida={read} onTodasLidas={()=>setItems(old=>old.map(n=>({...n,lida:true})))}
    onAction={n=>{read(n.id);setAction(n.action_url??"");}}/>
   <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border">P</span>
  </header>
  <p role="status">{action||"Dashboard"}</p>
 </div>;
}
function Fixture(){
 const [open,setOpen]=useState(false);
 return query.get("notificacoes")==="1"?<NotificationsFixture/>:query.get("modal")==="1"?<><button type="button" onClick={()=>setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>Abrir central de provas</button>{open&&<ProvasModal escolaId={escolaId} onClose={()=>setOpen(false)}/>}</>:<ProvasWorkspace teacherWizard={!["secretaria","admin"].includes(query.get("portal")??"")} escolaId={escolaId} printOnly={query.get("portal")==="secretaria"}/>;
}
createRoot(document.getElementById("root")!).render(<main className="mx-auto w-full min-w-0 max-w-6xl px-6 py-8 max-sm:px-2 max-sm:py-4"><Fixture/></main>);
