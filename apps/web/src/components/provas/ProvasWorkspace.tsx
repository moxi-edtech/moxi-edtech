"use client";
import { useEffect,useRef,useState,type ReactNode } from "react";
import dynamic from "next/dynamic";
import { PortalTabs } from "@/components/portal/ui/PortalTabs";
import { ClipboardList,Copy,Eye,Pencil,Plus,Printer,Trash2,Minus,ChevronDown,ChevronUp,ArrowLeft,ArrowRight,Ellipsis,ListOrdered,FileText,Heading,ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { estados,tipos,tiposProva,provaDisplayTitle,provaSubtitle,tituloAoMudarTipo,provaWriteSchema,type Bloco,type Prova,type ProvaInput,type ProvaResumo,type AnoProva,type ContextoProva,type TipoProva } from "@/lib/provas/schema";
import { provaHtml } from "@/lib/provas/print";
import { contentFits,FIGURE_MAX_PER_BLOCK,FIGURE_MAX_PER_EXAM,figureCount } from "@/lib/provas/figures";
import { prepareProvaFigure } from "@/lib/provas/figureUpload";
import { mathMarkup } from "@/lib/provas/math";
import { formatClasseProva } from "@/lib/provas/academicLabels";
import { safeLogoData } from "@/lib/provas/branding";
import { PROVA_PAPER,respostaLayout,apresentacoes,type Apresentacao,type RespostaFormato } from "@/lib/provas/layout";
import { questionTemplate,placeholders,suggestedTypes,structures,isQuestion,formatCotacao,blockNumbering,blockFieldLabel,questionTypes,structureTypes,structureLabels,structureHelp,groupSummaries,groupTitleInput,UNTITLED_GROUP } from "@/lib/provas/questionTemplates";
import { cotacaoStatus } from "@/lib/provas/cotacao";
import CotacaoInput from "./CotacaoInput";
import ProvasFilters,{type ProvasColumn} from "./ProvasFilters";
import ProvaEstadoBadge,{type EstadoAction} from "./ProvaEstadoBadge";
const CalendarioAvaliacoesClient=dynamic(()=>import("@/components/academico/CalendarioAvaliacoesClient"),{ssr:false,loading:()=> <p role="status" className="text-sm text-muted-foreground">A carregar calendário de avaliações...</p>});
const ProvasSchedulePanel=dynamic(()=>import("./ProvasSchedulePanel"),{ssr:false});
const ProvasOrderPanel=dynamic(()=>import("./ProvasOrderPanel"),{ssr:false,loading:()=> <p role="status" className="text-sm text-muted-foreground">A carregar ordem das perguntas...</p>});
const ProvasPrintPanel=dynamic(()=>import("./ProvasPrintPanel"),{ssr:false,loading:()=> <p role="status" className="text-sm text-muted-foreground">A carregar distribuição...</p>});
const RichQuestionEditor=dynamic(()=>import("./RichQuestionEditor"),{ssr:false,loading:()=> <p role="status" className="text-sm text-muted-foreground">A carregar editor...</p>});
const input="w-full min-w-0 max-w-full min-h-11 rounded-xl border border-border bg-background px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold";
const fresh=():ProvaInput=>({ano_letivo_id:"",curso_matriz_id:"",tipo_prova:"trimestral",apresentacao:"automatica",titulo:tiposProva.trimestral,classe:"",disciplina:"",ano_lectivo:"",trimestre:1,duracao:90,serie:"A",conteudo:[questionTemplate("discursiva")]});
function editable(p:Prova):ProvaInput {
 const {ano_letivo_id,curso_matriz_id,tipo_prova,apresentacao,titulo,classe,disciplina,ano_lectivo,trimestre,duracao,serie,conteudo,data_realizacao,hora_inicio}=p;
 return {ano_letivo_id,curso_matriz_id,tipo_prova:tipo_prova??"trimestral",apresentacao:apresentacao??"automatica",titulo,classe,disciplina,ano_lectivo,trimestre,duracao,serie,conteudo,data_realizacao,hora_inicio};
}
type Permissions={author:boolean;admin:boolean;distribute?:boolean;userId:string};
type Action="submeter"|"aprovar"|"devolver"|"arquivar"|"duplicar";
async function response(r:Response){const b=await r.json();if(!r.ok)throw new Error(b.error||"Não foi possível concluir a operação.");return b;}
export default function ProvasWorkspace({escolaId,printOnly=false,teacherWizard=false,onDismiss}:{escolaId:string;printOnly?:boolean;teacherWizard?:boolean;onDismiss?:()=>void}){
 const endpoint="/api/escola/"+encodeURIComponent(escolaId)+"/provas";
 const [tab,setTab]=useState<"provas"|"calendario"|"historico">("provas");
 const [calendarVisited,setCalendarVisited]=useState(false);
 const [rows,setRows]=useState<ProvaResumo[]>([]),[school,setSchool]=useState(""),[permissions,setPermissions]=useState<Permissions|null>(null);
 const [offset,setOffset]=useState(0),[revision,setRevision]=useState(0),[loading,setLoading]=useState(true),[listError,setListError]=useState("");
 const [activeFilters,setActiveFilters]=useState<Record<string,string>>({}),[historyFilters,setHistoryFilters]=useState<Record<string,string>>({});
 const filters=tab==="historico"?historyFilters:activeFilters;
 function setFilters(next:Record<string,string>){setOffset(0);if(tab==="historico")setHistoryFilters(next);else setActiveFilters(next);}
 const canCalendar=!teacherWizard&&Boolean(permissions?.admin||permissions?.distribute);
 const canHistory=!teacherWizard&&Boolean(permissions?.admin);
 function selectTab(next:typeof tab){if(next===tab||next==="calendario"&&!canCalendar||next==="historico"&&!canHistory)return;setOffset(0);setTab(next);if(next==="calendario")setCalendarVisited(true);}

 const [selected,setSelected]=useState<Prova|null>(null),[form,setForm]=useState<ProvaInput|null>(null),[preview,setPreview]=useState(false),[dirty,setDirty]=useState(false),[discard,setDiscard]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [confirm,setConfirm]=useState<Action|null>(null);
 const [richIndex,setRichIndex]=useState<number|null>(null);
 const [startFormula,setStartFormula]=useState(false);
 const [headerExpanded,setHeaderExpanded]=useState(true);
 const [step,setStep]=useState<"header"|"questions">("header");
 const [activeBlock,setActiveBlock]=useState(0);
 const [collapsedGroups,setCollapsedGroups]=useState<number[]>([]);
 const [organizing,setOrganizing]=useState(false);
 const [smallScreen,setSmallScreen]=useState(false);
 const singleQuestion=teacherWizard&&smallScreen;
 const currentBlock=Math.max(0,Math.min(activeBlock,(form?.conteudo.length??1)-1));
 const numbering=blockNumbering(form?.conteudo??[]);
 const groups=groupSummaries(form?.conteudo??[]);
 const emptyGroups=groups.filter(g=>g.questions===0);
 const groupAt=(index:number)=>groups[(numbering[index]?.group??0)-1];
 const mixed=Boolean(form?.conteudo.some(b=>!isQuestion(b.tipo)||b.tipo==="alinea"));
 const fieldLabel=(index:number)=>{const block=form?.conteudo[index];if(!block)return "Conteúdo";return blockFieldLabel(block.tipo)+" "+(isQuestion(block.tipo)?numbering[index].short.replace(")",""):index+1);};
 useEffect(()=>{
  if(!teacherWizard)return;
  const mq=window.matchMedia("(max-width: 639px)");
  const sync=()=>setSmallScreen(mq.matches);
  sync();mq.addEventListener("change",sync);
  return()=>mq.removeEventListener("change",sync);
 },[teacherWizard]);
 useEffect(()=>{
  if(!singleQuestion||step!=="questions"||preview||organizing)return;
  const active=document.getElementById("provas-nav-"+currentBlock);
  const strip=active?.parentElement;
  if(active&&strip){
   const a=active.getBoundingClientRect(),b=strip.getBoundingClientRect();
   if(a.left<b.left)strip.scrollLeft+=a.left-b.left;
   else if(a.right>b.right)strip.scrollLeft+=a.right-b.right;
  }
 },[singleQuestion,step,preview,organizing,currentBlock,form?.conteudo.length]);
 const [distribution,setDistribution]=useState(false);
 const [branding,setBranding]=useState<{endpoint:string;logo:string|null}|null>(null),[brandingRetry,setBrandingRetry]=useState(0);
 const logo=branding?.endpoint===endpoint?branding.logo:null;
 const modalOpen=Boolean(form)||Boolean(onDismiss);
 useEffect(()=>{
  if(!modalOpen)return;
  setBranding(null);
  const controller=new AbortController();
  fetch(endpoint+"?branding=1",{cache:"no-store",signal:controller.signal}).then(response).then(b=>{if(!controller.signal.aborted)setBranding({endpoint,logo:safeLogoData(b.logo)});}).catch(()=>{if(!controller.signal.aborted)setBranding({endpoint,logo:null});});
  return()=>controller.abort();
 },[endpoint,modalOpen,brandingRetry]);
 const [anos,setAnos]=useState<AnoProva[]>([]),[contextos,setContextos]=useState<ContextoProva[]>([]);
 const [anosLoading,setAnosLoading]=useState(false),[contextLoading,setContextLoading]=useState(false);
 const [anosError,setAnosError]=useState(""),[contextError,setContextError]=useState(""),[contextRetry,setContextRetry]=useState(0);
 const selectedYear=form?.ano_letivo_id??"";
 const editing=Boolean(form&&permissions?.author&&(!selected||selected.estado==="rascunho"&&(permissions.admin||selected.autor_id===null||selected.autor_id===permissions.userId)||selected.estado==="em_revisao"&&permissions.admin));
 useEffect(()=>{
  if(!editing)return;
  const c=new AbortController();setAnosLoading(true);setAnosError("");setAnos([]);
  fetch(endpoint+"?contexto=1",{cache:"no-store",signal:c.signal}).then(response).then(b=>{if(!c.signal.aborted)setAnos(b.items);}).catch(e=>{if(!c.signal.aborted)setAnosError(e.message);}).finally(()=>{if(!c.signal.aborted)setAnosLoading(false);});
  return()=>c.abort();
 },[endpoint,editing,contextRetry]);
 useEffect(()=>{
  setContextos([]);setContextError("");setContextLoading(false);
  if(!editing||!selectedYear)return;
  const c=new AbortController();setContextLoading(true);
  fetch(endpoint+"?contexto=1&ano="+encodeURIComponent(selectedYear),{cache:"no-store",signal:c.signal}).then(response).then(b=>{if(!c.signal.aborted)setContextos(b.items);}).catch(e=>{if(!c.signal.aborted)setContextError(e.message);}).finally(()=>{if(!c.signal.aborted)setContextLoading(false);});
  return()=>c.abort();
 },[endpoint,editing,selectedYear,contextRetry]);
 const locked=useRef(false),request=useRef<AbortController|null>(null);
 const opener=useRef<HTMLElement|null>(null);
 const richTrigger=useRef<HTMLElement|null>(null);
 const rememberOpener=(target:HTMLElement)=>{opener.current=target;};
 function restoreFocus(){const target=opener.current;requestAnimationFrame(()=>{if(target?.isConnected)target.focus();else document.getElementById("provas-heading")?.focus();});}
 function finishRich(){setStartFormula(false);setRichIndex(null);requestAnimationFrame(()=>{const target=richTrigger.current;if(target?.isConnected)target.focus();else document.getElementById("provas-rich-"+(richIndex??0))?.focus();});}
 useEffect(()=>{
  if(tab==="calendario")return;
  const c=new AbortController();setLoading(true);setListError("");
  fetch(endpoint+"?offset="+offset+(printOnly?"&aprovadas=1":"")+(tab==="historico"?"&estado=arquivada":tab==="provas"&&canHistory?"&ativas=1":"")+(Object.keys(filters).length?"&"+new URLSearchParams(filters).toString():""),{cache:"no-store",signal:c.signal}).then(response).then(b=>{if(!c.signal.aborted){setRows(b.provas);setSchool(b.escola);setPermissions(printOnly?{...b.permissions,author:false,admin:false}:b.permissions);}}).catch(e=>{if(!c.signal.aborted)setListError(e.message);}).finally(()=>{if(!c.signal.aborted)setLoading(false);});
  return()=>c.abort();
 },[endpoint,offset,revision,printOnly,filters,tab,canHistory]);
 useEffect(()=>()=>request.current?.abort(),[endpoint]);
 function change<K extends keyof ProvaInput>(key:K,value:ProvaInput[K]){if(key==="conteudo")setCollapsedGroups([]);setForm(p=>p?{...p,[key]:value}:p);setDirty(true);setError("");}
 function patch(index:number,part:Partial<Bloco>){setForm(p=>p?{...p,conteudo:p.conteudo.map((b,i)=>{if(i!==index)return b;const next={...b,...part};return next.tipo==="grupo"&&!next.texto.trim()&&!next.rich?{...next,texto:UNTITLED_GROUP}:next;})}:p);setDirty(true);setError("");}
 async function attachFigure(index:number,file:File){
  if(!form||locked.current||richIndex!==null||!form.conteudo[index]||form.conteudo[index].tipo==="grupo")return;
  const block=form.conteudo[index];
  if((block.figuras?.length??0)>=FIGURE_MAX_PER_BLOCK||figureCount(form.conteudo)>=FIGURE_MAX_PER_EXAM){setError("Limite de figuras atingido.");return;}
  locked.current=true;setBusy(true);setError("");
  try{
   const figure=await prepareProvaFigure(file,"Figura "+((block.figuras?.length??0)+1));
   const next=[...form.conteudo];next[index]={...block,figuras:[...(block.figuras??[]),figure]};
   if(!contentFits(next))throw new Error("A prova excede o limite total de imagens. Remova ou recorte uma figura.");
   // While decoding, the existing modal mutation lock prevents switching or saving the draft.
   setForm(p=>p&&p.conteudo[index]===block?{...p,conteudo:next}:p);setDirty(true);
  }catch(e){setError(e instanceof Error?e.message:"Não foi possível inserir a figura.");}
  finally{locked.current=false;setBusy(false);}
 }
 function focusBlock(index:number,field:"heading"|"type"|"text"="heading"){
  requestAnimationFrame(()=>document.getElementById(field==="heading"?"provas-block-heading-"+index:field==="type"?"provas-block-type-"+index:"provas-block-"+index)?.focus());
 }
 function navigateBlock(index:number){
  if(!form||richIndex!==null||busy||confirm||discard||index<0||index>=form.conteudo.length)return;
  setActiveBlock(index);focusBlock(index);
 }
 function appendBlock(tipo:Bloco["tipo"]){
  if(!form||richIndex!==null||busy||confirm||discard||form.conteudo.length>=80)return;
  const index=form.conteudo.length;
  change("conteudo",[...form.conteudo,questionTemplate(tipo)]);
  setActiveBlock(index);
  focusBlock(index,singleQuestion?"type":"text");
 }
 function removeBlock(index:number){
  if(!form||richIndex!==null||busy||confirm||discard||form.conteudo.length<=1)return;
  const block=form.conteudo[index];if(!block)return;
  if((block.texto.trim()||block.alternativas?.some(a=>a.trim())||block.cotacao_cent!==undefined||block.figuras?.length)&&!window.confirm("Remover este bloco da prova?"))return;
  change("conteudo",form.conteudo.filter((_,i)=>i!==index));
  const next=currentBlock>index?currentBlock-1:Math.min(currentBlock,form.conteudo.length-2);
  setActiveBlock(next);
  if(singleQuestion)focusBlock(next);
 }

 function setQuestionType(index:number,tipo:Bloco["tipo"]){
  if(!form||richIndex!==null)return;
  const b=form.conteudo[index];if(!b||b.tipo===tipo)return;
  if((b.alternativas?.some(a=>a.trim())&&tipo!=="escolha"||b.cotacao_cent!==undefined&&!isQuestion(tipo)||b.figuras?.length&&tipo==="grupo")&&!window.confirm("Alterar o tipo remove dados incompatíveis. Continuar?"))return;
  const next:Bloco={...questionTemplate(tipo),texto:tipo==="grupo"&&!b.texto.trim()?UNTITLED_GROUP:b.tipo==="grupo"&&b.texto===UNTITLED_GROUP?"":b.texto,...(b.rich?{rich:b.rich}:{}),...(b.figuras&&tipo!=="grupo"?{figuras:b.figuras}:{}),...(isQuestion(tipo)&&b.cotacao_cent!==undefined?{cotacao_cent:b.cotacao_cent}:{}),...(isQuestion(tipo)&&isQuestion(b.tipo)&&b.resposta_formato!==undefined?{resposta_formato:b.resposta_formato,linhas:b.linhas}:{})};
  change("conteudo",form.conteudo.map((item,i)=>i===index?next:item));
 }
 function reorder(from:number,to:number){
  if(!form||richIndex!==null||busy||confirm||discard||!Number.isInteger(from)||!Number.isInteger(to)||from===to||from<0||to<0||from>=form.conteudo.length||to>=form.conteudo.length)return;
  const blocks=[...form.conteudo],active=blocks[currentBlock];
  const [moved]=blocks.splice(from,1);
  blocks.splice(to,0,moved);
  change("conteudo",blocks);
  setActiveBlock(Math.max(0,blocks.indexOf(active)));
 }
 function showOrder(){
  if(!form||richIndex!==null||busy||confirm||discard)return;
  setPreview(false);setOrganizing(true);setStep("questions");
 }
 function backToQuestions(){
  setOrganizing(false);setStep("questions");
  if(singleQuestion)focusBlock(currentBlock);
 }
 function close(force=false){if(locked.current)return;if((dirty||richIndex!==null)&&!force){setDiscard(true);return;}setRichIndex(null);setOrganizing(false);setDistribution(false);setForm(null);setSelected(null);setDirty(false);setDiscard(false);setConfirm(null);setError("");if(onDismiss)restoreFocus();}
 function create(){if(printOnly||locked.current)return;setCollapsedGroups([]);setRichIndex(null);setSelected(null);setDistribution(false);setForm(fresh());setHeaderExpanded(true);setStep("header");setOrganizing(false);setActiveBlock(0);setDirty(false);setPreview(false);setError("");setNotice("");}
 async function open(id:string,print=false){
  if(locked.current)return;locked.current=true;setBusy(true);setListError("");setNotice("");
  const c=new AbortController();request.current=c;
  try{const b=await response(await fetch(endpoint+"?prova="+encodeURIComponent(id)+(printOnly?"&aprovadas=1":""),{cache:"no-store",signal:c.signal}));if(c.signal.aborted)return;setCollapsedGroups([]);setRichIndex(null);setSelected(b.prova);setDistribution(print&&b.prova.estado==="aprovada"&&Boolean(permissions?.distribute));setForm(editable(b.prova));setHeaderExpanded(true);setStep("header");setOrganizing(false);setActiveBlock(0);setDirty(false);setPreview(b.prova.estado!=="rascunho"||!permissions?.author);setError("");}
  catch(e){if(!c.signal.aborted)setListError(e instanceof Error?e.message:"Erro ao abrir a prova.");}
  finally{if(request.current===c){request.current=null;locked.current=false;setBusy(false);}}
 }
 async function mutateRowStatus(prova:ProvaResumo,action:EstadoAction){
  if(printOnly||!permissions?.admin||locked.current||loading||form)throw new Error("Aguarde ou reabra a listagem.");
  locked.current=true;setBusy(true);setNotice("");
  const c=new AbortController();request.current=c;
  try{
   const b=await response(await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({acao:action,id:prova.id,versao:prova.versao}),cache:"no-store",signal:c.signal}));
   if(c.signal.aborted)return;
   const saved=b.prova as Prova;
   setNotice("Estado atualizado: "+estados[saved.estado]+".");
   setOffset(0);setRevision(v=>v+1);
  }finally{if(request.current===c){request.current=null;locked.current=false;setBusy(false);}}
 }
 async function mutate(action:"criar"|"guardar"|Action){
  if(printOnly||locked.current||!form||richIndex!==null)return;
  let dados:ProvaInput|undefined;
  if(action==="criar"||action==="guardar"){
   const validated=provaWriteSchema.safeParse(form);
   if(!validated.success){
    setOrganizing(false);
    const issues=validated.error.issues;
    const invalid=issues.find(i=>i.path[0]==="conteudo"&&typeof i.path[1]==="number");
    if(teacherWizard){
     setPreview(false);
     if(issues.some(i=>i.path[0]!=="conteudo")){setStep("header");setHeaderExpanded(true);}
     else{setStep("questions");if(invalid){const index=Number(invalid.path[1]);setActiveBlock(index);focusBlock(index);}}
    }
    setError(issues.map(i=>i.path[0]==="conteudo"?(typeof i.path[1]==="number"?"Verifique o bloco "+(i.path[1]+1)+": enunciado, alternativas, cotação e formatação.":"Verifique o conteúdo da prova."):"Verifique "+String(i.path[0]).replace("_"," ")+".").filter((v,i,a)=>a.indexOf(v)===i).join(" "));return;
   }dados=validated.data;
  }else if(!selected||dirty)return;
  if((action==="submeter"||action==="aprovar")&&emptyGroups.length){setError("Adicione perguntas a "+emptyGroups.map(g=>g.label).join(", ")+" antes de continuar.");setConfirm(null);return;}
  if((action==="submeter"||action==="aprovar")&&(!cotacao.ready||contextLoading)){setError(cotacao.message);setConfirm(null);return;}
  const payload={acao:action,...(action==="criar"?{}:{id:selected?.id,versao:selected?.versao}),...(dados?{dados}:{})};
  locked.current=true;setBusy(true);setError("");setConfirm(null);
  const c=new AbortController();request.current=c;
  try{
   const b=await response(await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),cache:"no-store",signal:c.signal}));
   if(c.signal.aborted)return;
   const saved=b.prova as Prova;setOrganizing(false);if(action==="duplicar")setActiveBlock(0);setDistribution(false);setSelected(saved);setForm(editable(saved));setDirty(false);setPreview(saved.estado!=="rascunho");setNotice(action==="criar"||action==="guardar"?"Prova guardada.":action==="duplicar"?"Cópia criada como rascunho.":"Estado atualizado.");setOffset(0);setRevision(v=>v+1);
  }catch(e){if(!c.signal.aborted)setError(e instanceof Error?e.message:"Erro ao guardar.");}
  finally{if(request.current===c){request.current=null;locked.current=false;setBusy(false);}}
 }
 const canEdit=Boolean(permissions?.author&&(!selected||selected.estado==="rascunho"&&(permissions.admin||selected.autor_id===null||selected.autor_id===permissions.userId)));
 const canManage=Boolean(selected&&permissions?.author&&(permissions.admin||selected.autor_id===null||selected.autor_id===permissions.userId));
 const sharedSystem=Boolean(selected&&selected.autor_id===null&&!permissions?.admin);
 const canOwn=canManage&&!sharedSystem;
 const printHref=selected?.estado==="aprovada"?endpoint+"/print?prova="+encodeURIComponent(selected.id):null;
 const yearOptions=contextos.filter(o=>o.ano_letivo_id===selectedYear);
 const matrixOptions=Array.from(new Map(yearOptions.map(o=>[o.curso_matriz_id,o])).values());
 const periodOptions=yearOptions.filter(o=>o.curso_matriz_id===form?.curso_matriz_id).map(o=>o.trimestre);
 const selectedContext=yearOptions.find(o=>o.curso_matriz_id===form?.curso_matriz_id&&o.trimestre===form?.trimestre);
 const contextReady=Boolean(form&&selectedContext);
 const cotacaoMax=selectedContext?.cotacao_max_cent??null;
 const cotacao=cotacaoStatus(form?.conteudo??[],cotacaoMax);
 function selectType(tipo:TipoProva){
  setForm(p=>p?{...p,tipo_prova:tipo,titulo:tituloAoMudarTipo(p,tipo)}:p);setDirty(true);setError("");
 }
 function selectYear(id:string){
  const year=anos.find(a=>a.id===id);setContextos([]);
  setForm(p=>p?{...p,ano_letivo_id:id,ano_lectivo:year?.label??"",curso_matriz_id:"",classe:"",disciplina:"",trimestre:1}:p);setDirty(true);setError("");
 }
 function selectMatrix(id:string){
  const option=matrixOptions.find(o=>o.curso_matriz_id===id);
  setForm(p=>p?{...p,curso_matriz_id:id,classe:option?.classe??"",disciplina:option?.disciplina??"",ano_lectivo:option?.ano_lectivo??p.ano_lectivo,trimestre:option?.trimestre??1}:p);setDirty(true);setError("");
 }
 const headerReady=Boolean(form&&contextReady&&!contextLoading&&form.titulo.trim()&&form.serie.trim()&&Number.isInteger(form.duracao)&&form.duracao>=1&&form.duracao<=480);
 function goStep(next:"header"|"questions"){
  if(richIndex!==null||busy||confirm||discard||next==="questions"&&!headerReady)return;
  setOrganizing(false);setStep(next);setHeaderExpanded(true);setError("");
  requestAnimationFrame(()=>document.getElementById("provas-step-"+next)?.focus());
 }
 const actionLabels:Record<Action,string>={submeter:"Enviar para revisão",aprovar:"Publicar prova",devolver:"Devolver para edição",arquivar:"Arquivar",duplicar:"Duplicar"};
 const listBody=(header?: (column:ProvasColumn,compact?:boolean)=>ReactNode)=>(  <div className="overflow-hidden rounded-xl border border-border bg-card">
   <div>{header&&<div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.8fr)] gap-2 border-b border-border bg-muted/40 px-3 py-1 md:hidden">{(["Prova","Classe","Estado"] as const).map(h=><div key={h}>{header(h,true)}</div>)}</div>}<ul aria-label="Provas" className="divide-y divide-border md:hidden">{(loading?[]:rows).map(p=><li key={p.id} className="min-w-0 space-y-2 p-3"><div className={header?"grid grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.8fr)] items-start gap-2":"flex flex-wrap items-start justify-between gap-2"}><div className="min-w-0 flex-1"><p className="break-words font-medium">{p.tipo_prova==="outro"?p.titulo:tiposProva[p.tipo_prova]??p.titulo}</p><p className="break-words text-sm text-muted-foreground">{p.disciplina}{!header&&" · "+formatClasseProva(p.classe)}</p></div>{header&&<p className="min-w-0 break-words text-sm">{formatClasseProva(p.classe)}</p>}<ProvaEstadoBadge key={p.id+":"+p.versao} prova={p} admin={Boolean(permissions?.admin&&!printOnly)} busy={busy||loading} onChange={mutateRowStatus}/></div><p className="text-xs text-muted-foreground">{p.ano_lectivo} · {p.trimestre}.º trimestre · Série {p.serie}{p.autor_id===null?" · Sistema KLASSE":""}{p.data_realizacao?" · "+p.data_realizacao.split("-").reverse().join("/")+(p.hora_inicio?" "+p.hora_inicio.slice(0,5):""):" · Por agendar"}</p><div className="flex flex-wrap gap-2"><Button variant="outline" className="flex-1" disabled={busy} onClick={e=>{rememberOpener(e.currentTarget);open(p.id);}}>{p.estado==="rascunho"?<Pencil/>:<Eye/>}{p.estado==="rascunho"?"Editar":"Consultar"}</Button>{p.estado==="aprovada"&&(permissions?.distribute?<Button tone="gold" className="flex-1" disabled={busy} onClick={e=>{rememberOpener(e.currentTarget);open(p.id,true);}}><Printer/> Imprimir</Button>:<Button asChild tone="gold" className="flex-1"><a href={endpoint+"/print?prova="+encodeURIComponent(p.id)} target="_blank" rel="noopener noreferrer"><Printer/> Imprimir</a></Button>)}</div></li>)}</ul><div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground"><tr>{(["Prova","Classe","Período","Estado","Ações"] as const).map(h=><th key={h} scope="col" className="px-4 py-1 font-medium">{header&&h!=="Ações"?header(h):h}</th>)}</tr></thead><tbody className="divide-y divide-border">{(loading?[]:rows).map(p=><tr key={p.id}><td className="px-4 py-3"><p className="font-medium">{p.tipo_prova==="outro"?p.titulo:tiposProva[p.tipo_prova]??p.titulo} · {p.disciplina}</p><p className="text-xs text-muted-foreground">Série {p.serie}{p.autor_id===null?" · Sistema KLASSE":""}{p.data_realizacao?" · "+p.data_realizacao.split("-").reverse().join("/")+(p.hora_inicio?" "+p.hora_inicio.slice(0,5):""):" · Por agendar"}</p></td><td className="px-4 py-3">{formatClasseProva(p.classe)}</td><td className="px-4 py-3 whitespace-nowrap">{p.ano_lectivo} · {p.trimestre}.º trim.</td><td className="px-4 py-3"><ProvaEstadoBadge key={p.id+":"+p.versao} prova={p} admin={Boolean(permissions?.admin&&!printOnly)} busy={busy||loading} onChange={mutateRowStatus}/></td><td className="px-4 py-3"><div className="flex flex-wrap gap-1"><Button size="sm" variant="ghost" disabled={busy} onClick={e=>{rememberOpener(e.currentTarget);open(p.id);}}>{p.estado==="rascunho"?<Pencil/>:<Eye/>}{p.estado==="rascunho"?"Editar":"Consultar"}</Button>{p.estado==="aprovada"&&(permissions?.distribute?<Button size="sm" variant="ghost" disabled={busy} onClick={e=>{rememberOpener(e.currentTarget);open(p.id,true);}}><Printer/> Imprimir</Button>:<a href={endpoint+"/print?prova="+encodeURIComponent(p.id)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium hover:bg-muted"><Printer className="h-4 w-4"/> Imprimir</a>)}</div></td></tr>)}</tbody></table></div>{loading&&<p role="status" className="p-5 text-sm text-muted-foreground">A carregar provas...</p>}{!loading&&!rows.length&&!listError&&<div className="p-8 text-center"><ClipboardList className="mx-auto mb-3 h-7 w-7 text-muted-foreground"/><p className="font-medium">{Object.keys(filters).length?"Nenhuma prova corresponde aos filtros.":tab==="historico"?"Nenhuma prova arquivada.":permissions?.author?"Ainda não existem provas.":"Nenhuma prova aprovada."}</p></div>}</div>
   {(offset>0||rows.length===30)&&<div className="flex justify-end gap-2 border-t border-border p-3"><Button variant="outline" disabled={loading||busy||offset===0} onClick={()=>setOffset(o=>Math.max(0,o-30))}>Anterior</Button><Button variant="outline" disabled={loading||busy||rows.length<30||offset>=9990} onClick={()=>setOffset(o=>o+30)}>Seguinte</Button></div>}
  </div>);
 const listing=<div className="min-w-0 space-y-4">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="provas-heading" tabIndex={-1} className="break-words text-lg font-semibold text-klasse-green dark:text-foreground">{tab==="historico"?"Histórico":canCalendar?"Provas":printOnly||permissions&&!permissions.author?"Provas para impressão":"Provas"}</h2></div><div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{tab==="provas"&&(permissions?.author||permissions?.distribute)&&<Button asChild variant="outline" className="w-full sm:w-auto"><a href={endpoint+"/print?modo=folha_generica"} target="_blank" rel="noopener noreferrer"><Printer/> Imprimir folha genérica</a></Button>}{permissions?.author&&tab!=="historico"&&<Button tone="gold" className="w-full sm:w-auto" disabled={busy||loading} onClick={e=>{rememberOpener(e.currentTarget);create();}}><Plus/> Nova prova</Button>}</div></div>

 {notice&&!form&&<p role="status" className="text-sm text-klasse-green">{notice}</p>}
  {listError&&<div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">{listError}<Button variant="outline" onClick={()=>setRevision(v=>v+1)}>Tentar novamente</Button></div>}
  {permissions?.admin?<ProvasFilters key={tab} endpoint={endpoint} historical={tab==="historico"} filters={filters} onChange={setFilters}>{listBody}</ProvasFilters>:listBody()}

 </div>;
 const tabs=canCalendar?<PortalTabs<"provas"|"calendario"|"historico"> items={[{id:"provas",label:"Provas"},{id:"calendario",label:"Calendário de Avaliações"},...(canHistory?[{id:"historico" as const,label:"Histórico"}]:[])]} value={tab} onChange={selectTab} label="Central de Provas" idPrefix="central-provas" />:null;
 const workspace=<div className="min-w-0 space-y-4">
  {canCalendar&&!onDismiss&&<h1 className="text-xl font-semibold text-klasse-green dark:text-foreground">Central de Provas</h1>}
  {tabs}
  <div id="central-provas-panel-provas" role={canCalendar?"tabpanel":undefined} aria-labelledby={canCalendar?"central-provas-tab-provas":undefined} hidden={tab!=="provas"}>{tab==="provas"&&listing}</div>
  {canHistory&&<div id="central-provas-panel-historico" role="tabpanel" aria-labelledby="central-provas-tab-historico" hidden={tab!=="historico"}>{tab==="historico"&&listing}</div>}
  {canCalendar&&<div id="central-provas-panel-calendario" role="tabpanel" aria-labelledby="central-provas-tab-calendario" hidden={tab!=="calendario"}>{calendarVisited&&<CalendarioAvaliacoesClient escolaId={escolaId} embedded active={tab==="calendario"}/>}</div>}
 </div>;
 return <section className="min-w-0 space-y-4 [&_button]:max-sm:min-h-11 [&_button]:max-sm:whitespace-normal">
  {!onDismiss&&workspace}
  <ModalShell open={Boolean(form)||Boolean(onDismiss)} title={richIndex!==null?"Editar "+(numbering[richIndex]?.label.toLocaleLowerCase("pt")??"conteúdo"):form?(selected?provaDisplayTitle(form):"Nova prova"):"Central de provas"} description={richIndex!==null?(form?.conteudo[richIndex]?.tipo==="texto"?"Conteúdo de referência":form?.conteudo[richIndex]?.tipo==="grupo"?"Título da secção":"Enunciado e expressões matemáticas"):form?selected?estados[selected.estado]:undefined:undefined} size="wide" mobileFullscreen keyboardAware onRestoreFocus={onDismiss?undefined:restoreFocus} onClose={()=>{if(form)close();else onDismiss?.();}}
    footer={distribution||richIndex!==null&&!discard&&!confirm?undefined:form?<div className="min-w-0 space-y-2 [&_button]:max-sm:min-h-11 [&_button]:max-sm:whitespace-normal">
     {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}{notice&&<p role="status" className="text-sm text-klasse-green">{notice}</p>}
     {discard?<div className="flex flex-wrap items-center gap-2"><p className="mr-auto text-sm">Descartar as alterações não guardadas?</p><Button variant="outline" onClick={()=>setDiscard(false)}>Continuar edição</Button><Button variant="destructive" onClick={()=>close(true)}>Descartar</Button></div>:confirm?<div className="flex flex-wrap items-center gap-2"><p className="mr-auto text-sm">Confirmar: {actionLabels[confirm]}?</p><Button variant="outline" onClick={()=>setConfirm(null)}>Cancelar</Button><Button tone="gold" disabled={busy} onClick={()=>mutate(confirm)}>Confirmar</Button></div>:<div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
       {canEdit&&teacherWizard&&!preview&&!organizing&&step==="header"&&<Button type="button" tone="gold" className="sm:hidden" disabled={!headerReady||busy||richIndex!==null} onClick={()=>goStep("questions")}>Perguntas <ArrowRight/></Button>}
       {canEdit&&organizing&&<Button variant="outline" disabled={busy} onClick={backToQuestions}><ArrowLeft/> Voltar às perguntas</Button>}
       {canEdit&&!organizing&&form.conteudo.length>1&&<Button type="button" variant="outline" className={teacherWizard&&!preview&&step==="header"?"hidden sm:inline-flex":undefined} disabled={busy||richIndex!==null} onClick={showOrder}><ListOrdered/> Organizar perguntas</Button>}
       {canEdit&&<Button variant={organizing?"default":"outline"} tone={organizing?"gold":undefined} disabled={busy||richIndex!==null} onClick={()=>{setOrganizing(false);setPreview(v=>!v);}}>{preview?<Pencil/>:<Eye/>}{preview?"Editar":"Pré-visualizar"}</Button>}
       {canEdit&&!organizing&&(!selected||dirty)&&<Button tone={singleQuestion&&!preview?undefined:"gold"} variant={singleQuestion&&!preview?"outline":"default"} className={teacherWizard&&step==="header"&&!preview?"hidden sm:inline-flex":undefined} disabled={busy||richIndex!==null||!contextReady||contextLoading} onClick={()=>mutate(selected?"guardar":"criar")}>Guardar rascunho</Button>}
       {canManage&&!organizing&&selected&&!dirty&&selected.estado==="rascunho"&&(!singleQuestion||preview)&&<Button tone="gold" disabled={busy||richIndex!==null||!contextReady||contextLoading||!cotacao.ready||emptyGroups.length>0} onClick={()=>setConfirm(permissions?.admin?"aprovar":"submeter")}>{permissions?.admin?"Publicar prova":"Enviar para revisão"}</Button>}
       {permissions?.admin&&selected?.estado==="em_revisao"&&<><Button variant="outline" disabled={busy} onClick={()=>setConfirm("devolver")}>Devolver</Button><Button tone="gold" disabled={busy||contextLoading||!cotacao.ready||emptyGroups.length>0} onClick={()=>setConfirm("aprovar")}>Publicar prova</Button></>}
       {canOwn&&!organizing&&selected&&!dirty&&(!singleQuestion||!canEdit||preview)&&<Button variant="ghost" disabled={busy||richIndex!==null} onClick={()=>setConfirm("duplicar")}><Copy/> Duplicar</Button>}
       {canOwn&&!organizing&&selected&&!dirty&&(!singleQuestion||!canEdit||preview)&&(selected.estado==="rascunho"||permissions?.admin&&selected.estado==="aprovada")&&<Button variant="ghost" disabled={busy||richIndex!==null} onClick={()=>setConfirm("arquivar")}>Arquivar</Button>}
       {permissions?.admin&&selected&&!dirty&&["rascunho","em_revisao"].includes(selected.estado)&&<Button asChild variant="outline"><a href={endpoint+"/print?modo=conferencia&prova="+encodeURIComponent(selected.id)} target="_blank" rel="noopener noreferrer"><Printer/> Imprimir conferência</a></Button>}
        {permissions?.admin&&selected?.estado==="arquivada"&&selected.aprovado_em&&<Button asChild variant="outline"><a href={endpoint+"/print?modo=historico&prova="+encodeURIComponent(selected.id)} target="_blank" rel="noopener noreferrer"><Printer/> Reimprimir prova</a></Button>}
        {printHref&&(permissions?.distribute?<Button tone="gold" onClick={()=>setDistribution(true)}><Printer/> Imprimir prova</Button>:<Button asChild tone="gold"><a href={printHref} target="_blank" rel="noopener noreferrer"><Printer className="h-4 w-4"/> Imprimir prova</a></Button>)}
     </div>}
    </div>:undefined}>
   {onDismiss&&<div hidden={Boolean(form)}>{workspace}</div>}
   {onDismiss&&form&&richIndex===null&&<Button type="button" variant="ghost" className="mb-3" disabled={busy} onClick={()=>close()}><ArrowLeft/> Voltar à lista</Button>}
   {form&&canEdit&&teacherWizard&&richIndex===null&&<div className="mb-3 space-y-2 sm:hidden group-data-[keyboard-open=true]/modal:hidden" aria-label="Etapas de elaboração">
    <div className="flex min-w-0 items-center justify-between gap-2">
     <p className="text-xs font-medium text-muted-foreground">Etapa {preview?3:step==="header"?1:2} de 3 · {preview?"Pré-visualização":organizing?"Organização":step==="header"?"Cabeçalho":"Perguntas"}</p>
     {!preview&&!organizing&&step==="questions"&&<Button type="button" size="sm" variant="ghost" disabled={busy||richIndex!==null||Boolean(confirm)||discard} onClick={()=>goStep("header")}><ArrowLeft/> Cabeçalho</Button>}
    </div>
    <div className="flex gap-1" aria-hidden="true">{[1,2,3].map(n=><span key={n} className={"h-1 flex-1 rounded-full "+(n<=(preview?3:step==="header"?1:2)?"bg-klasse-green":"bg-muted")}/>)}</div>
   </div>}
   {form&&editing&&richIndex===null&&!distribution&&!organizing&&(preview||!teacherWizard||step==="questions"||!singleQuestion)&&<div className="mb-3 space-y-1.5 rounded-xl border border-border bg-card p-3 group-data-[keyboard-open=true]/modal:hidden" aria-live="polite">
 <div className="flex items-baseline justify-between gap-2 text-sm"><span className="font-medium">Cotação total</span>{cotacaoMax!==null&&cotacaoMax>0&&<span className={"font-semibold tabular-nums "+(cotacao.total>cotacaoMax?"text-destructive":cotacao.ready?"text-klasse-green":"text-foreground")}>{formatCotacao(cotacao.total)} / {formatCotacao(cotacaoMax)}</span>}</div>
 {cotacaoMax!==null&&cotacaoMax>0&&<div role="progressbar" aria-label="Cotação atribuída" aria-valuemin={0} aria-valuemax={cotacaoMax} aria-valuenow={Math.min(cotacao.total,cotacaoMax)} aria-valuetext={formatCotacao(cotacao.total)+" de "+formatCotacao(cotacaoMax)+" valores"} className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={"h-full rounded-full "+(cotacao.total>cotacaoMax?"bg-red-600":cotacao.ready?"bg-klasse-green":"bg-klasse-gold")} style={{width:Math.min(100,cotacao.total/cotacaoMax*100)+"%"}}/></div>}
 <p className={"text-xs "+(cotacao.ready?"text-klasse-green":cotacaoMax!==null&&(cotacao.total>cotacaoMax||cotacao.qualitative&&cotacao.hasNumeric)?"text-destructive":"text-muted-foreground")}>{contextLoading?"A carregar escala…":cotacao.message}</p>
 {emptyGroups.length>0&&<p className="text-xs text-destructive">Sem perguntas: {emptyGroups.map(g=>g.label).join(", ")}. Complete os grupos antes de enviar para revisão.</p>}
 </div>}
    {form&&(distribution&&selected?.estado==="aprovada"&&permissions?.distribute?<div className="space-y-3"><Button variant="outline" onClick={()=>setDistribution(false)}><Eye/> Consultar prova</Button><ProvasPrintPanel key={selected.id+":"+selected.versao} endpoint={endpoint} prova={selected}/></div>:preview||!canEdit?<div className="min-w-0 space-y-2">{branding?.endpoint!==endpoint?<p role="status" className="text-xs text-muted-foreground">A carregar logótipo institucional...</p>:!logo?<div role="status" className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">Logótipo indisponível. <Button type="button" size="sm" variant="outline" onClick={()=>setBrandingRetry(v=>v+1)}>Recarregar logótipo</Button></div>:null}{permissions?.admin&&selected?.estado==="aprovada"&&<ProvasSchedulePanel key={selected.id+":"+selected.versao} endpoint={endpoint} prova={selected}/>}<iframe title="Pré-visualização A4 da prova" sandbox="" srcDoc={provaHtml(form,school,{draft:selected?.estado!=="aprovada"&&!(selected?.estado==="arquivada"&&selected.aprovado_em),logo})} className="h-[60dvh] min-h-40 w-full rounded-xl border border-border bg-background sm:h-[65vh]"/></div>:organizing?<ProvasOrderPanel blocks={form.conteudo} disabled={busy||Boolean(confirm)||discard} onMove={reorder}/>:richIndex!==null&&form.conteudo[richIndex]?<RichQuestionEditor key={richIndex} block={form.conteudo[richIndex]} label={fieldLabel(richIndex)} startWithFormula={startFormula} disabled={busy||Boolean(confirm)||discard} onChange={part=>patch(richIndex,part)} onDone={finishRich}/>:
   <div className="min-w-0 space-y-5 [&_button]:max-sm:min-h-11 [&_button]:max-sm:whitespace-normal">
    <div className={"rounded-xl border border-border bg-card p-3 sm:p-4 "+(teacherWizard&&step==="questions"?"hidden sm:block":"")}>
    <h3 id="provas-step-header" tabIndex={-1} className="sr-only">Cabeçalho da prova</h3>
    <Button type="button" variant="ghost" className="h-auto w-full justify-between whitespace-normal px-0 text-left" aria-expanded={headerExpanded} aria-controls="provas-header-fields" onClick={()=>setHeaderExpanded(v=>!v)}>
      <span className="min-w-0"><span className="block font-semibold text-klasse-green dark:text-foreground">Cabeçalho da prova</span>{!headerExpanded&&<span className="block break-words text-xs font-normal text-muted-foreground">{form.disciplina?formatClasseProva(form.classe)+" · "+form.disciplina+" · "+form.trimestre+".º trimestre":"Complete o contexto académico"}</span>}</span>{headerExpanded?<ChevronUp/>:<ChevronDown/>}
    </Button>
    <fieldset id="provas-header-fields" hidden={!headerExpanded} disabled={busy||Boolean(confirm)||discard} className={headerExpanded?"mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4":"hidden"}>
     <label className="grid min-w-0 gap-1 text-sm">Tipo de prova<select aria-label="Tipo de prova" className={input} value={form.tipo_prova} disabled={richIndex!==null} onChange={e=>selectType(e.target.value as TipoProva)}>{Object.entries(tiposProva).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
     <label className="grid min-w-0 gap-1 text-sm">Ano lectivo<select aria-label="Ano lectivo" className={input} value={selectedYear} disabled={sharedSystem||anosLoading||richIndex!==null} onChange={e=>selectYear(e.target.value)}><option value="">Seleccione o ano</option>{selectedYear&&!anos.some(a=>a.id===selectedYear)&&<option value={selectedYear}>{form.ano_lectivo} (indisponível)</option>}{anos.map(a=><option key={a.id} value={a.id}>{a.label}{a.ativo?" · Actual":""}</option>)}</select></label>
     <label className="grid gap-1 text-sm sm:col-span-2">Classe e disciplina<select aria-label="Classe e disciplina" className={input} value={form.curso_matriz_id} disabled={sharedSystem||!selectedYear||contextLoading||richIndex!==null} onChange={e=>selectMatrix(e.target.value)}><option value="">{contextLoading?"A carregar disciplinas...":"Seleccione a disciplina"}</option>{form.curso_matriz_id&&!matrixOptions.some(o=>o.curso_matriz_id===form.curso_matriz_id)&&<option value={form.curso_matriz_id}>{formatClasseProva(form.classe)} · {form.disciplina} (indisponível)</option>}{matrixOptions.map(o=><option key={o.curso_matriz_id} value={o.curso_matriz_id}>{o.curso} · {formatClasseProva(o.classe)} · {o.disciplina}</option>)}</select></label>
     <label className="grid gap-1 text-sm">Data de realização<input type="date" aria-label="Data de realização" className={input} min="1900-01-01" max="2200-12-31" value={form.data_realizacao??""} onChange={e=>{const date=e.target.value||null;setForm(p=>p?{...p,data_realizacao:date,hora_inicio:date?p.hora_inicio:null}:p);setDirty(true);}}/></label>
      <label className="grid gap-1 text-sm">Hora de início<input type="time" aria-label="Hora de início" className={input} disabled={!form.data_realizacao} value={form.hora_inicio?.slice(0,5)??""} onChange={e=>change("hora_inicio",e.target.value||null)}/></label>
      <label className="grid gap-1 text-sm">Trimestre<select aria-label="Trimestre" className={input} value={form.trimestre} disabled={sharedSystem||!form.curso_matriz_id||!periodOptions.length||richIndex!==null} onChange={e=>change("trimestre",Number(e.target.value))}>{!periodOptions.includes(form.trimestre)&&<option value={form.trimestre}>{form.trimestre}.º trimestre (indisponível)</option>}{periodOptions.map(v=><option key={v} value={v}>{v}.º trimestre</option>)}</select></label>
     {form.tipo_prova==="outro"&&<label className="grid gap-1 text-sm sm:col-span-2">Título da prova<input className={input} value={form.titulo} onChange={e=>change("titulo",e.target.value)} maxLength={160} required placeholder="Indique o título da prova"/></label>}
     {(anosError||contextError)&&<div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive sm:col-span-2 lg:col-span-4">{anosError||contextError}<Button type="button" size="sm" variant="outline" onClick={()=>setContextRetry(v=>v+1)}>Tentar novamente</Button></div>}
     {!contextLoading&&!contextError&&selectedYear&&yearOptions.length===0&&<p role="status" className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-4">Não existem disciplinas publicadas e autorizadas neste ano. Consulte a Direção.</p>}
     <label className="grid gap-1 text-sm">Duração (min.)<input type="number" min={1} max={480} className={input} value={form.duracao||""} onChange={e=>change("duracao",Number(e.target.value))}/></label>
     {form.tipo_prova!=="outro"&&<div className="min-w-0 rounded-xl border border-border bg-muted/20 p-3 sm:col-span-2 lg:col-span-4"><p className="text-xs text-muted-foreground">Título automático</p><p aria-label="Título automático" className="break-words text-sm font-semibold text-klasse-green dark:text-foreground">{provaDisplayTitle(form)}</p>{provaSubtitle(form)&&<p className="break-words text-xs text-muted-foreground">{provaSubtitle(form)}</p>}</div>}
     <details className="min-w-0 rounded-xl border border-border p-3 sm:col-span-2 lg:col-span-4">
      <summary className="cursor-pointer text-sm font-medium text-muted-foreground">Opções avançadas <span className="font-normal">· Série {form.serie||"—"} · {apresentacoes[form.apresentacao??"automatica"]}</span></summary>
      <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
       <label className="grid gap-1 text-sm">Série<input className={input} value={form.serie} onChange={e=>change("serie",e.target.value)} maxLength={20}/></label>
     <label className="grid min-w-0 gap-1 text-sm ">Apresentação da folha<select aria-label="Apresentação da folha" className={input} value={form.apresentacao??"automatica"} disabled={richIndex!==null} onChange={e=>change("apresentacao",e.target.value as Apresentacao)}>{Object.entries(apresentacoes).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      </div>
     </details>
    </fieldset>
    </div>
    <fieldset disabled={busy||Boolean(confirm)||discard} className={"min-w-0 space-y-3 "+(teacherWizard&&step==="header"?"hidden sm:block":"")}>
     <legend id="provas-step-questions" tabIndex={-1} className={singleQuestion?"sr-only":"mb-3 text-sm font-semibold text-klasse-green dark:text-foreground"}>Conteúdo da prova</legend>
     {singleQuestion&&<p className="break-words text-xs font-medium text-muted-foreground">{form.disciplina} · {formatClasseProva(form.classe)}{groupAt(currentBlock)?" · "+groupAt(currentBlock).title:""}</p>}
     {emptyGroups.length>0&&<p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">Sem perguntas: {emptyGroups.map(g=>g.label).join(", ")}. Adicione perguntas antes de enviar para revisão.</p>}
      {!singleQuestion&&<p className="text-sm text-muted-foreground">{form.conteudo.filter(b=>isQuestion(b.tipo)).length} pergunta(s)</p>}
     {!selected&&form.conteudo.length===1&&!form.conteudo[0].texto&&!form.conteudo[0].rich&&!form.conteudo[0].alternativas&&form.conteudo[0].cotacao_cent===undefined&&<details key={singleQuestion?"mobile-model":"desktop-model"} open={!singleQuestion} className="rounded-xl border border-border p-3"><summary className={"min-h-11 cursor-pointer py-2 text-sm font-medium text-muted-foreground "+(singleQuestion?"":"hidden")}>Começar com um modelo</summary><div className="space-y-2"><p className={singleQuestion?"sr-only":"text-sm font-medium"}>Começar com um modelo</p><div className="flex flex-wrap gap-2">{structures.map(s=><Button key={s.label} type="button" size="sm" variant="outline" disabled={richIndex!==null} onClick={()=>{setActiveBlock(0);change("conteudo",s.types.map(questionTemplate));}}>{s.label}</Button>)}</div></div></details>}
     {singleQuestion&&<div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
       <p role="status" className="text-sm font-semibold text-klasse-green dark:text-foreground">{mixed?numbering[currentBlock]?.label+" · posição "+(currentBlock+1)+" de "+form.conteudo.length:"Pergunta "+(currentBlock+1)+" de "+form.conteudo.length}</p>
       {currentBlock<form.conteudo.length-1&&<Button type="button" size="sm" variant="ghost" disabled={richIndex!==null||form.conteudo.length>=80} onClick={()=>appendBlock("discursiva")}><Plus/> Nova pergunta</Button>}
      </div>
      <div role="group" aria-label="Navegar pelo conteúdo" className={form.conteudo.length===1?"hidden":"flex max-w-full gap-1.5 overflow-x-auto pb-1"}>
       {form.conteudo.map((block,index)=><Button key={index} id={"provas-nav-"+index} type="button" size="sm" variant="outline" aria-label={"Ir para bloco "+(index+1)+(mixed?" — "+numbering[index].label:"")} title={numbering[index].label} aria-current={currentBlock===index?"step":undefined} disabled={richIndex!==null} className={"min-h-11 min-w-11 shrink-0 tabular-nums "+(currentBlock===index?"border-klasse-gold bg-klasse-gold/10 ring-1 ring-klasse-gold/25":"")} onClick={()=>navigateBlock(index)}>{block.tipo==="texto"?<FileText aria-hidden="true"/>:numbering[index].short}</Button>)}
      </div>
     </div>}
     {form.conteudo.map((block,index)=>(singleQuestion&&index!==currentBlock)||(!singleQuestion&&block.tipo!=="grupo"&&collapsedGroups.includes(numbering[index].group))?null:<div key={index} className={"min-w-0 space-y-3 rounded-xl border border-border bg-card p-3 sm:p-4 "+(block.tipo==="grupo"?"border-l-4 border-l-klasse-green":"")}>
      <h4 id={"provas-block-heading-"+index} tabIndex={-1} className={singleQuestion?"sr-only":"text-sm font-semibold text-klasse-green dark:text-foreground"}>{block.tipo==="grupo"?groupAt(index).title:numbering[index].label}{mixed&&<span className="ml-2 text-xs font-normal text-muted-foreground">Posição {index+1}</span>}</h4>
      {block.tipo==="grupo"&&<div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/30 p-3" aria-label={"Resumo "+groupAt(index).label}>
       <div><p className="text-xs text-muted-foreground">{groupAt(index).label}</p><p className="text-sm font-semibold">{groupAt(index).questions} pergunta(s){!cotacao.qualitative?" · "+formatCotacao(groupAt(index).total)+" val.":""}</p>{!cotacao.qualitative&&groupAt(index).questions>0&&groupAt(index).assigned<groupAt(index).questions&&<p className="text-xs text-muted-foreground">{groupAt(index).questions-groupAt(index).assigned} sem cotação positiva</p>}</div>
       {!singleQuestion&&<Button type="button" size="sm" variant="outline" aria-expanded={!collapsedGroups.includes(numbering[index].group)} onClick={()=>setCollapsedGroups(old=>old.includes(numbering[index].group)?old.filter(v=>v!==numbering[index].group):[...old,numbering[index].group])}>{collapsedGroups.includes(numbering[index].group)?<><ChevronDown/> Expandir perguntas</>:<><ChevronUp/> Recolher perguntas</>}</Button>}
      </div>}
      <div className="flex flex-wrap items-center justify-between gap-2"><label className={singleQuestion?"grid w-full min-w-0 gap-1 text-sm":"flex w-full min-w-0 items-center gap-2 text-sm sm:w-auto"}><span className="shrink-0 font-medium text-muted-foreground">{isQuestion(block.tipo)?"Tipo de pergunta":"Tipo de elemento"}</span><select id={"provas-block-type-"+index} aria-label={"Tipo do bloco "+(index+1)} className={input} value={block.tipo} disabled={richIndex!==null} onChange={e=>setQuestionType(index,e.target.value as Bloco["tipo"])}><optgroup label="Perguntas avaliativas">{questionTypes.map(key=><option key={key} value={key}>{tipos[key]}</option>)}</optgroup><optgroup label="Elementos de estrutura">{structureTypes.map(key=><option key={key} value={key}>{structureLabels[key]}</option>)}</optgroup></select></label>
       <details key={singleQuestion?"mobile-options":"desktop-options"} open={!singleQuestion} className="w-full sm:w-auto"><summary className={"flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm text-muted-foreground "+(singleQuestion?"":"hidden")}><Ellipsis className="size-4"/> {isQuestion(block.tipo)?"Opções da pergunta":"Opções do elemento"}</summary><div className="flex w-full flex-wrap gap-1 sm:w-auto"><Button size="sm" variant="ghost" className="text-destructive" aria-label={"Remover bloco "+(index+1)} disabled={richIndex!==null||form.conteudo.length===1} onClick={()=>removeBlock(index)}><Trash2/> Remover</Button></div></details>
      </div>
      {<div className="space-y-2">
        {(singleQuestion||!isQuestion(block.tipo))&&<label htmlFor={block.rich?"provas-rich-"+index:"provas-block-"+index} className="block text-sm font-medium">{blockFieldLabel(block.tipo)}{block.tipo==="grupo"?" (opcional)":""}</label>}
         {(block.tipo==="texto"||block.tipo==="grupo")&&<div className="flex items-start gap-2 rounded-xl bg-muted/30 p-3 text-xs text-muted-foreground">{block.tipo==="texto"?<FileText className="size-4 shrink-0"/>:<Heading className="size-4 shrink-0"/>}<p>{structureHelp[block.tipo]}</p></div>}
        {block.rich?<div className="min-h-20 min-w-0 break-words whitespace-pre-wrap rounded-xl border border-border bg-muted/20 p-3 text-sm">{block.rich.segments.map((segment,i)=>segment.kind==="break"?<br key={i}/>:segment.kind==="math"?<span key={i} className="inline-block max-w-full overflow-x-auto px-1 align-middle" aria-label={segment.latex} dangerouslySetInnerHTML={{__html:mathMarkup(segment.latex)??""}}/>:<span key={i} className={(segment.marks.includes("bold")?"font-bold ":"")+(segment.marks.includes("italic")?"italic ":"")+(segment.marks.includes("underline")?"underline":"")}>{segment.text}</span>)}</div>:<textarea className={input+" resize-y group-data-[keyboard-open=true]/modal:max-h-[var(--modal-writing-height)] group-data-[keyboard-open=true]/modal:overflow-y-auto group-data-[keyboard-open=true]/modal:resize-none"} id={"provas-block-"+index} aria-label={fieldLabel(index)} rows={singleQuestion?5:4} maxLength={3000} value={block.tipo==="grupo"?groupTitleInput(block.texto):block.texto} placeholder={placeholders[block.tipo]} disabled={richIndex!==null} onChange={e=>patch(index,{texto:block.tipo==="grupo"&&!e.target.value.trim()?UNTITLED_GROUP:e.target.value})}/>}
        <Button type="button" id={"provas-rich-"+index} size="sm" variant="outline" className="w-full sm:w-auto" disabled={richIndex!==null} onClick={e=>{richTrigger.current=e.currentTarget;setStartFormula(block.tipo==="calculo"&&!block.rich);setActiveBlock(index);setRichIndex(index);}}><Pencil/> {block.rich?"Editar conteúdo formatado":block.tipo==="calculo"?"Inserir fórmula":"Formatar / inserir fórmulas"}</Button>
       </div>}
 
      {isQuestion(block.tipo)&&(()=>{
        const answer=respostaLayout(block.tipo,block.linhas,block.resposta_formato);
        const format:RespostaFormato=answer.kind==="box"?"retangulo":answer.kind==="lines"?"linhas":"nenhum";
        const cm=(mm:number)=>(mm/10).toFixed(1).replace(".",",")+" cm";
        const setSize=(n:number)=>patch(index,{linhas:n===0?0:format==="retangulo"?Math.max(3,n):n,resposta_formato:n===0?"nenhum":format});
        return <div className="min-w-0 space-y-2 rounded-xl border border-border p-3" aria-label={"Espaço para resposta "+(index+1)}>
          <div className="flex flex-wrap items-baseline justify-between gap-2"><span className="text-sm font-medium">Espaço para resposta</span><span className="text-xs font-medium tabular-nums text-muted-foreground">{answer.kind==="none"?"Sem espaço adicional":cm(answer.heightMm)+(answer.kind==="lines"?" · "+answer.count+" linha(s)":"")}</span></div>
          <div role="group" aria-label={"Formato da resposta "+(index+1)} className="grid grid-cols-3 gap-1.5">
            {([["linhas","Linhas"],["retangulo","Rectângulo"],["nenhum","Nenhum"]] as const).map(([value,label])=><Button key={value} type="button" size="sm" variant="outline" aria-pressed={format===value} className={"min-h-11 min-w-0 whitespace-normal px-1 "+(format===value?"border-klasse-gold bg-klasse-gold/10 ring-1 ring-klasse-gold/25":"")} onClick={()=>patch(index,{resposta_formato:value,linhas:value==="nenhum"?0:value==="retangulo"?Math.max(3,block.linhas||6):block.linhas||3})}>{label}</Button>)}
          </div>
          {answer.kind!=="none"&&<>
            <div role="img" aria-label={"Pré-visualização da resposta "+(index+1)+" · "+cm(answer.heightMm)} data-testid={"provas-resposta-"+index} data-format={format} data-height-mm={answer.heightMm} className={"w-full bg-background "+(answer.kind==="box"?"border border-foreground/40":"flex flex-col")} style={{aspectRatio:(PROVA_PAPER.width-PROVA_PAPER.marginLeft-PROVA_PAPER.marginRight)+"/"+answer.heightMm}}>
              {answer.kind==="lines"&&Array.from({length:answer.count},(_,i)=><div key={i} className="min-h-0 flex-1 border-b border-foreground/25"/>)}
            </div>
            <div className="grid grid-cols-3 gap-1.5" role="group" aria-label={"Espaço da resposta "+(index+1)}>
              {([3,6,10] as const).map(n=><Button key={n} type="button" size="sm" variant="outline" aria-pressed={block.linhas===n} className={"min-h-11 min-w-0 px-1 whitespace-normal "+(block.linhas===n?"border-klasse-gold bg-klasse-gold/10":"")} onClick={()=>setSize(n)}><span className="flex flex-col items-center text-xs"><span>{n===3?"Curto":n===6?"Médio":"Longo"}</span><span className="font-normal">{cm(n*8)}</span></span></Button>)}
            </div>
            <div className="flex items-center justify-between gap-2">
              <Button type="button" size="sm" variant="outline" aria-label={"Diminuir espaço da resposta "+(index+1)} className="min-h-11 min-w-11" disabled={block.linhas<=(format==="retangulo"?3:1)} onClick={()=>setSize(block.linhas-1)}><Minus/></Button>
              {format==="retangulo"?<label className="flex min-w-0 flex-1 items-center gap-2 text-sm"><span>Altura</span><select aria-label={"Altura do rectângulo "+(index+1)} className={input} value={Math.max(3,block.linhas)} onChange={e=>setSize(Number(e.target.value))}>{Array.from({length:18},(_,i)=>i+3).map(n=><option key={n} value={n}>{cm(n*8)}</option>)}</select></label>:<label className="flex min-w-0 items-center gap-2 text-sm"><input type="number" inputMode="numeric" min={1} max={PROVA_PAPER.maxLines} aria-label={"Linhas para resposta "+(index+1)} value={block.linhas} className={input.replace("w-full","w-20")+" text-center"} onChange={e=>setSize(Math.max(1,Math.min(PROVA_PAPER.maxLines,Math.trunc(Number(e.target.value)||1))))}/><span>linhas</span></label>}
              <Button type="button" size="sm" variant="outline" aria-label={"Aumentar espaço da resposta "+(index+1)} className="min-h-11 min-w-11" disabled={block.linhas>=PROVA_PAPER.maxLines} onClick={()=>setSize(Math.min(PROVA_PAPER.maxLines,Math.max(format==="retangulo"?3:1,block.linhas)+1))}><Plus/></Button>
            </div>
            
          </>}
        </div>;
      })()}

      {block.tipo!=="grupo"&&<div className="space-y-2 border-t border-border pt-3">
       <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium">Figuras</span><label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-border px-3 text-sm font-medium focus-within:ring-4 focus-within:ring-klasse-gold/20"><ImagePlus className="size-4 text-muted-foreground"/><span>Inserir imagem</span><input type="file" accept="image/png,image/jpeg,image/webp" aria-label={"Inserir imagem na pergunta "+(index+1)} className="sr-only" disabled={busy||richIndex!==null||(block.figuras?.length??0)>=FIGURE_MAX_PER_BLOCK||figureCount(form.conteudo)>=FIGURE_MAX_PER_EXAM} onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value="";if(file)void attachFigure(index,file);}}/></label></div>
       {!!block.figuras?.length&&<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{block.figuras.map((f,j)=><div key={j} className="min-w-0 space-y-2 rounded-xl border border-border p-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- validated local PNG; no remote source or optimizer */}
        <img src={f.src} alt={f.alt} className="h-32 w-full rounded-xl bg-card object-contain"/>
        <label className="grid gap-1 text-xs">Descrição acessível (não revelar a resposta)<input className={input} value={f.alt} maxLength={160} onChange={e=>patch(index,{figuras:block.figuras!.map((item,k)=>k===j?{...item,alt:e.target.value}:item)})}/></label>
        <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={()=>{const figuras=block.figuras!.filter((_,k)=>j!==k);patch(index,{figuras:figuras.length?figuras:undefined});}}><Trash2/> Remover figura</Button>
       </div>)}</div>}
       <p className="text-xs text-muted-foreground">PNG, JPEG ou WebP · até 6 imagens</p>
      </div>}
      {block.tipo==="escolha"&&<div className="space-y-2">
       {block.alternativas===undefined?<><p className="text-xs text-muted-foreground">Alternativas no enunciado.</p><Button type="button" size="sm" variant="outline" disabled={richIndex!==null} onClick={()=>patch(index,{alternativas:["",""]})}><Plus/> Separar alternativas</Button></>:<>
       <p className="text-sm font-medium">Alternativas</p>
       {block.alternativas.map((alternative,j)=><div key={j} className="flex min-w-0 items-center gap-2"><label className="flex min-w-0 flex-1 items-center gap-2 text-sm"><span>{String.fromCharCode(65+j)})</span><input className={input} aria-label={"Alternativa "+String.fromCharCode(65+j)+" da "+numbering[index].label.toLowerCase()} maxLength={500} value={alternative} disabled={richIndex!==null} onChange={e=>patch(index,{alternativas:block.alternativas!.map((a,k)=>j===k?e.target.value:a)})}/></label><Button type="button" size="sm" variant="ghost" disabled={richIndex!==null||block.alternativas!.length<=2} aria-label={"Remover alternativa "+String.fromCharCode(65+j)} onClick={()=>patch(index,{alternativas:block.alternativas!.filter((_,k)=>j!==k)})}><Trash2/><span className="sr-only">Remover</span></Button></div>)}
       <Button type="button" size="sm" variant="outline" disabled={richIndex!==null||block.alternativas.length>=8} onClick={()=>patch(index,{alternativas:[...block.alternativas!,""]})}><Plus/> Adicionar alternativa</Button></>}
      </div>}
      {block.tipo==="verdadeiro_falso"&&<p className="text-sm text-muted-foreground">Na folha: ( ) V  ·  ( ) F</p>}
      {block.tipo==="lacunas"&&<p className="text-xs text-muted-foreground">Utilize ____ no enunciado para indicar cada lacuna.</p>}
       {isQuestion(block.tipo)&&(!cotacao.qualitative||block.cotacao_cent!==undefined)&&<label className="grid max-w-56 gap-1 text-sm">Cotação (valores)<CotacaoInput label={"Cotação da "+numbering[index].label.toLowerCase()} className={input} value={block.cotacao_cent} disabled={richIndex!==null} onChange={v=>patch(index,{cotacao_cent:v})}/>{block.cotacao_cent!==undefined&&cotacaoMax!==null&&block.cotacao_cent>cotacaoMax&&<span className="text-xs text-destructive">Excede a escala da classe.</span>}</label>}
      {isQuestion(block.tipo)&&<div className="min-w-0">{!block.rich&&richIndex===null&&["calculo","discursiva","alinea"].includes(block.tipo)&&<details key={singleQuestion?"mobile-symbols":"desktop-symbols"} open={!singleQuestion}><summary className={"min-h-11 cursor-pointer py-2 text-sm text-muted-foreground "+(singleQuestion?"":"hidden")}>Símbolos matemáticos</summary><div className="flex flex-wrap gap-1">{["²","³","√","×","÷","π","½","¼","≤","≥","∪","∩"].map(symbol=><button key={symbol} type="button" aria-label={"Adicionar "+symbol} className="min-h-11 min-w-11 rounded-xl border border-border px-2 py-1 text-base hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20" disabled={block.texto.length>=3000} onClick={()=>patch(index,{texto:block.texto+symbol})}>{symbol}</button>)}</div></details>}</div>}
     </div>)}
     {singleQuestion&&<div className="grid grid-cols-2 gap-2">
      <Button type="button" variant="outline" disabled={richIndex!==null||currentBlock===0} onClick={()=>navigateBlock(currentBlock-1)}><ArrowLeft/> Anterior</Button>
      {currentBlock<form.conteudo.length-1?<Button type="button" tone="gold" disabled={richIndex!==null} onClick={()=>navigateBlock(currentBlock+1)}>{mixed?"Seguinte":"Próxima"} <ArrowRight/></Button>:<Button type="button" tone="gold" disabled={richIndex!==null||form.conteudo.length>=80} onClick={()=>appendBlock("discursiva")}><Plus/> Adicionar pergunta</Button>}
     </div>}
     {!singleQuestion&&<div className="space-y-2 rounded-xl border border-dashed border-klasse-gold/50 bg-card p-3">
      <p className="text-sm font-semibold text-klasse-green dark:text-foreground">Perguntas avaliativas</p>
      
      <div className="flex flex-wrap gap-2">{suggestedTypes(form.disciplina).map(tipo=><Button key={tipo} type="button" size="sm" variant="outline" disabled={richIndex!==null||form.conteudo.length>=80} onClick={()=>appendBlock(tipo)}><Plus/> {tipos[tipo]}</Button>)}</div>
      <label className="grid gap-1 text-sm">Todos os tipos de pergunta<select className={input} aria-label="Adicionar pergunta ou bloco" value="" disabled={richIndex!==null||form.conteudo.length>=80} onChange={e=>{if(e.target.value)appendBlock(e.target.value as Bloco["tipo"]);}}><option value="">Seleccione o formato</option>{questionTypes.map(key=><option key={key} value={key}>{tipos[key]}</option>)}</select></label>
     </div>}
    <details className="min-w-0 rounded-xl border border-border bg-card p-3"><summary className="cursor-pointer text-sm font-medium text-klasse-green dark:text-foreground">Adicionar elemento de estrutura</summary><div className="mt-3 grid gap-2 sm:grid-cols-2">{structureTypes.map(tipo=><button key={tipo} type="button" disabled={richIndex!==null||form.conteudo.length>=80} onClick={()=>appendBlock(tipo)} className="flex min-w-0 items-start gap-3 rounded-xl border border-border p-3 text-left hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 disabled:opacity-50">{tipo==="grupo"?<Heading className="size-5 shrink-0 text-muted-foreground"/>:<FileText className="size-5 shrink-0 text-muted-foreground"/>}<span className="min-w-0"><span className="block text-sm font-medium">{structureLabels[tipo]}</span><span className="mt-1 block text-xs text-muted-foreground">{structureHelp[tipo]}</span></span></button>)}</div></details>
    </fieldset>
   </div>)}
  </ModalShell>
 </section>;
}
