"use client";
import { useEffect,useRef,useState } from "react";
import dynamic from "next/dynamic";
import { ArrowDown,ArrowUp,ClipboardList,Copy,Eye,Pencil,Plus,Printer,Trash2,Minus,ChevronDown,ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { estados,tipos,provaWriteSchema,type Bloco,type Prova,type ProvaInput,type ProvaResumo,type AnoProva,type ContextoProva } from "@/lib/provas/schema";
import { provaHtml } from "@/lib/provas/print";
import { PROVA_PAPER,respostaLayout } from "@/lib/provas/layout";
const RichQuestionEditor=dynamic(()=>import("./RichQuestionEditor"),{ssr:false,loading:()=> <p role="status" className="text-sm text-muted-foreground">A carregar editor...</p>});
const input="w-full min-w-0 max-w-full min-h-11 rounded-xl border border-border bg-background px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold";
const fresh=():ProvaInput=>({ano_letivo_id:"",curso_matriz_id:"",titulo:"Prova",classe:"",disciplina:"",ano_lectivo:"",trimestre:1,duracao:90,serie:"A",conteudo:[{tipo:"discursiva",texto:"",linhas:3}]});
function editable(p:Prova):ProvaInput {
 const {ano_letivo_id,curso_matriz_id,titulo,classe,disciplina,ano_lectivo,trimestre,duracao,serie,conteudo}=p;
 return {ano_letivo_id,curso_matriz_id,titulo,classe,disciplina,ano_lectivo,trimestre,duracao,serie,conteudo};
}
type Permissions={author:boolean;admin:boolean;userId:string};
type Action="submeter"|"aprovar"|"devolver"|"arquivar"|"duplicar";
async function response(r:Response){const b=await r.json();if(!r.ok)throw new Error(b.error||"Não foi possível concluir a operação.");return b;}
export default function ProvasWorkspace({escolaId}:{escolaId:string}){
 const endpoint="/api/escola/"+encodeURIComponent(escolaId)+"/provas";
 const [rows,setRows]=useState<ProvaResumo[]>([]),[school,setSchool]=useState(""),[permissions,setPermissions]=useState<Permissions|null>(null);
 const [offset,setOffset]=useState(0),[revision,setRevision]=useState(0),[loading,setLoading]=useState(true),[listError,setListError]=useState("");
 const [selected,setSelected]=useState<Prova|null>(null),[form,setForm]=useState<ProvaInput|null>(null),[preview,setPreview]=useState(false),[dirty,setDirty]=useState(false),[discard,setDiscard]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [confirm,setConfirm]=useState<Action|null>(null);
 const [richIndex,setRichIndex]=useState<number|null>(null);
 const [headerExpanded,setHeaderExpanded]=useState(true);
 const [anos,setAnos]=useState<AnoProva[]>([]),[contextos,setContextos]=useState<ContextoProva[]>([]);
 const [anosLoading,setAnosLoading]=useState(false),[contextLoading,setContextLoading]=useState(false);
 const [anosError,setAnosError]=useState(""),[contextError,setContextError]=useState(""),[contextRetry,setContextRetry]=useState(0);
 const selectedYear=form?.ano_letivo_id??"";
 const editing=Boolean(form&&permissions?.author&&(!selected||selected.estado==="rascunho"&&(permissions.admin||selected.autor_id===permissions.userId)));
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
 function finishRich(){setRichIndex(null);requestAnimationFrame(()=>{const target=richTrigger.current;if(target?.isConnected)target.focus();else document.getElementById("provas-rich-"+(richIndex??0))?.focus();});}
 useEffect(()=>{
  const c=new AbortController();setLoading(true);setListError("");
  fetch(endpoint+"?offset="+offset,{cache:"no-store",signal:c.signal}).then(response).then(b=>{if(!c.signal.aborted){setRows(b.provas);setSchool(b.escola);setPermissions(b.permissions);}}).catch(e=>{if(!c.signal.aborted)setListError(e.message);}).finally(()=>{if(!c.signal.aborted)setLoading(false);});
  return()=>c.abort();
 },[endpoint,offset,revision]);
 useEffect(()=>()=>request.current?.abort(),[endpoint]);
 function change<K extends keyof ProvaInput>(key:K,value:ProvaInput[K]){setForm(p=>p?{...p,[key]:value}:p);setDirty(true);setError("");}
 function patch(index:number,part:Partial<Bloco>){setForm(p=>p?{...p,conteudo:p.conteudo.map((b,i)=>i===index?{...b,...part}:b)}:p);setDirty(true);setError("");}
 function move(index:number,step:number){if(!form||richIndex!==null)return;const blocks=[...form.conteudo],to=index+step;if(to<0||to>=blocks.length)return;[blocks[index],blocks[to]]=[blocks[to],blocks[index]];change("conteudo",blocks);}
 function close(force=false){if(locked.current)return;if((dirty||richIndex!==null)&&!force){setDiscard(true);return;}setRichIndex(null);setForm(null);setSelected(null);setDirty(false);setDiscard(false);setConfirm(null);setError("");}
 function create(){if(locked.current)return;setRichIndex(null);setSelected(null);setForm(fresh());setHeaderExpanded(true);setDirty(false);setPreview(false);setError("");setNotice("");}
 async function open(id:string){
  if(locked.current)return;locked.current=true;setBusy(true);setListError("");setNotice("");
  const c=new AbortController();request.current=c;
  try{const b=await response(await fetch(endpoint+"?prova="+encodeURIComponent(id),{cache:"no-store",signal:c.signal}));if(c.signal.aborted)return;setRichIndex(null);setSelected(b.prova);setForm(editable(b.prova));setHeaderExpanded(true);setDirty(false);setPreview(b.prova.estado!=="rascunho"||!permissions?.author);setError("");}
  catch(e){if(!c.signal.aborted)setListError(e instanceof Error?e.message:"Erro ao abrir a prova.");}
  finally{if(request.current===c){request.current=null;locked.current=false;setBusy(false);}}
 }
 async function mutate(action:"criar"|"guardar"|Action){
  if(locked.current||!form||richIndex!==null)return;
  let dados:ProvaInput|undefined;
  if(action==="criar"||action==="guardar"){
   const validated=provaWriteSchema.safeParse(form);
   if(!validated.success){setError(validated.error.issues.map(i=>i.path[0]==="conteudo"?"Verifique o enunciado, a formatação e os limites das perguntas.":"Verifique "+String(i.path[0]).replace("_"," ")+".").filter((v,i,a)=>a.indexOf(v)===i).join(" "));return;}dados=validated.data;
  }else if(!selected||dirty)return;
  const payload={acao:action,...(action==="criar"?{}:{id:selected?.id,versao:selected?.versao}),...(dados?{dados}:{})};
  locked.current=true;setBusy(true);setError("");setConfirm(null);
  const c=new AbortController();request.current=c;
  try{
   const b=await response(await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),cache:"no-store",signal:c.signal}));
   if(c.signal.aborted)return;
   const saved=b.prova as Prova;setSelected(saved);setForm(editable(saved));setDirty(false);setPreview(saved.estado!=="rascunho");setNotice(action==="criar"||action==="guardar"?"Prova guardada.":action==="duplicar"?"Cópia criada como rascunho.":"Estado atualizado.");setOffset(0);setRevision(v=>v+1);
  }catch(e){if(!c.signal.aborted)setError(e instanceof Error?e.message:"Erro ao guardar.");}
  finally{if(request.current===c){request.current=null;locked.current=false;setBusy(false);}}
 }
 const canEdit=Boolean(permissions?.author&&(!selected||selected.estado==="rascunho"&&(permissions.admin||selected.autor_id===permissions.userId)));
 const canManage=Boolean(selected&&permissions?.author&&(permissions.admin||selected.autor_id===permissions.userId));
 const printHref=selected?.estado==="aprovada"?endpoint+"/print?prova="+encodeURIComponent(selected.id):null;
 const yearOptions=contextos.filter(o=>o.ano_letivo_id===selectedYear);
 const matrixOptions=Array.from(new Map(yearOptions.map(o=>[o.curso_matriz_id,o])).values());
 const periodOptions=yearOptions.filter(o=>o.curso_matriz_id===form?.curso_matriz_id).map(o=>o.trimestre);
 const contextReady=Boolean(form&&yearOptions.some(o=>o.curso_matriz_id===form.curso_matriz_id&&o.trimestre===form.trimestre));
 function selectYear(id:string){
  const year=anos.find(a=>a.id===id);setContextos([]);
  setForm(p=>p?{...p,ano_letivo_id:id,ano_lectivo:year?.label??"",curso_matriz_id:"",classe:"",disciplina:"",trimestre:1}:p);setDirty(true);setError("");
 }
 function selectMatrix(id:string){
  const option=matrixOptions.find(o=>o.curso_matriz_id===id);
  setForm(p=>p?{...p,curso_matriz_id:id,classe:option?.classe??"",disciplina:option?.disciplina??"",ano_lectivo:option?.ano_lectivo??p.ano_lectivo,trimestre:option?.trimestre??1}:p);setDirty(true);setError("");
 }
 const actionLabels:Record<Action,string>={submeter:"Enviar para revisão",aprovar:"Aprovar prova",devolver:"Devolver para edição",arquivar:"Arquivar",duplicar:"Duplicar"};
 return <section className="min-w-0 space-y-4 [&_button]:max-sm:min-h-11 [&_button]:max-sm:whitespace-normal">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="provas-heading" tabIndex={-1} className="break-words text-lg font-semibold text-foreground">Provas e impressos pedagógicos</h2><p className="text-sm text-muted-foreground">{permissions?.author?"Elabore, reveja e imprima avaliações.":"Consulte e imprima as provas aprovadas."}</p></div>{permissions?.author&&<Button tone="gold" className="w-full sm:w-auto" disabled={busy||loading} onClick={e=>{rememberOpener(e.currentTarget);create();}}><Plus/> Nova prova</Button>}</div>
  {notice&&!form&&<p role="status" className="text-sm text-klasse-green">{notice}</p>}
  {listError&&<div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">{listError}<Button variant="outline" onClick={()=>setRevision(v=>v+1)}>Tentar novamente</Button></div>}
  <div className="overflow-hidden rounded-xl border border-border bg-card">
   {loading?<p role="status" className="p-5 text-sm text-muted-foreground">A carregar provas...</p>:<div><ul aria-label="Provas" className="divide-y divide-border md:hidden">{rows.map(p=><li key={p.id} className="min-w-0 space-y-2 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0 flex-1"><p className="break-words font-medium">{p.titulo}</p><p className="break-words text-sm text-muted-foreground">{p.disciplina} · {p.classe}</p></div><span className="rounded-full bg-muted px-2 py-1 text-xs">{estados[p.estado]}</span></div><p className="text-xs text-muted-foreground">{p.ano_lectivo} · {p.trimestre}.º trimestre · Série {p.serie}</p><div className="flex flex-wrap gap-2"><Button variant="outline" className="flex-1" disabled={busy} onClick={e=>{rememberOpener(e.currentTarget);open(p.id);}}>{p.estado==="rascunho"?<Pencil/>:<Eye/>}{p.estado==="rascunho"?"Editar":"Consultar"}</Button>{p.estado==="aprovada"&&<Button asChild tone="gold" className="flex-1"><a href={endpoint+"/print?prova="+encodeURIComponent(p.id)} target="_blank" rel="noopener noreferrer"><Printer/> Imprimir</a></Button>}</div></li>)}</ul><div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground"><tr>{["Prova","Classe","Período","Estado","Ações"].map(h=><th key={h} scope="col" className="px-4 py-3 font-medium">{h}</th>)}</tr></thead><tbody className="divide-y divide-border">{rows.map(p=><tr key={p.id}><td className="px-4 py-3"><p className="font-medium">{p.titulo} · {p.disciplina}</p><p className="text-xs text-muted-foreground">Série {p.serie}</p></td><td className="px-4 py-3">{p.classe}</td><td className="px-4 py-3 whitespace-nowrap">{p.ano_lectivo} · {p.trimestre}.º trim.</td><td className="px-4 py-3"><span className="rounded-full bg-muted px-2 py-1 text-xs">{estados[p.estado]}</span></td><td className="px-4 py-3"><div className="flex flex-wrap gap-1"><Button size="sm" variant="ghost" disabled={busy} onClick={e=>{rememberOpener(e.currentTarget);open(p.id);}}>{p.estado==="rascunho"?<Pencil/>:<Eye/>}{p.estado==="rascunho"?"Editar":"Consultar"}</Button>{p.estado==="aprovada"&&<a href={endpoint+"/print?prova="+encodeURIComponent(p.id)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium hover:bg-muted"><Printer className="h-4 w-4"/> Imprimir</a>}</div></td></tr>)}</tbody></table></div>{!rows.length&&!listError&&<div className="p-8 text-center"><ClipboardList className="mx-auto mb-3 h-7 w-7 text-muted-foreground"/><p className="font-medium">{permissions?.author?"Ainda não existem provas.":"Nenhuma prova aprovada."}</p><p className="text-sm text-muted-foreground">{permissions?.author?"Crie a primeira prova para começar.":"As provas ficam disponíveis após a aprovação."}</p></div>}</div>}
   {(offset>0||rows.length===30)&&<div className="flex justify-end gap-2 border-t border-border p-3"><Button variant="outline" disabled={loading||busy||offset===0} onClick={()=>setOffset(o=>Math.max(0,o-30))}>Anterior</Button><Button variant="outline" disabled={loading||busy||rows.length<30||offset>=9990} onClick={()=>setOffset(o=>o+30)}>Seguinte</Button></div>}
  </div>
  <ModalShell open={Boolean(form)} title={selected?selected.titulo:"Nova prova"} description={selected?estados[selected.estado]:"Configure o cabeçalho e adicione perguntas."} size="wide" mobileFullscreen onRestoreFocus={restoreFocus} onClose={()=>close()}
    footer={form?<div className="min-w-0 space-y-2 [&_button]:max-sm:min-h-11 [&_button]:max-sm:whitespace-normal">
     {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}{notice&&<p role="status" className="text-sm text-klasse-green">{notice}</p>}
     {discard?<div className="flex flex-wrap items-center gap-2"><p className="mr-auto text-sm">Descartar as alterações não guardadas?</p><Button variant="outline" onClick={()=>setDiscard(false)}>Continuar edição</Button><Button variant="destructive" onClick={()=>close(true)}>Descartar</Button></div>:confirm?<div className="flex flex-wrap items-center gap-2"><p className="mr-auto text-sm">Confirmar: {actionLabels[confirm]}?</p><Button variant="outline" onClick={()=>setConfirm(null)}>Cancelar</Button><Button tone="gold" disabled={busy} onClick={()=>mutate(confirm)}>Confirmar</Button></div>:<div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
       {canEdit&&<Button variant="outline" disabled={busy||richIndex!==null} onClick={()=>setPreview(v=>!v)}>{preview?<Pencil/>:<Eye/>}{preview?"Editar":"Pré-visualizar"}</Button>}
       {canEdit&&(!selected||dirty)&&<Button tone="gold" disabled={busy||richIndex!==null||!contextReady||contextLoading} onClick={()=>mutate(selected?"guardar":"criar")}>Guardar rascunho</Button>}
       {canManage&&selected&&!dirty&&selected.estado==="rascunho"&&<Button tone="gold" disabled={busy||richIndex!==null||!contextReady||contextLoading} onClick={()=>setConfirm("submeter")}>Enviar para revisão</Button>}
       {permissions?.admin&&selected?.estado==="em_revisao"&&<><Button variant="outline" disabled={busy} onClick={()=>setConfirm("devolver")}>Devolver</Button><Button tone="gold" disabled={busy} onClick={()=>setConfirm("aprovar")}>Aprovar prova</Button></>}
       {canManage&&selected&&!dirty&&<Button variant="ghost" disabled={busy||richIndex!==null} onClick={()=>setConfirm("duplicar")}><Copy/> Duplicar</Button>}
       {canManage&&selected&&!dirty&&(selected.estado==="rascunho"||permissions?.admin&&selected.estado==="aprovada")&&<Button variant="ghost" disabled={busy||richIndex!==null} onClick={()=>setConfirm("arquivar")}>Arquivar</Button>}
       {printHref&&<Button asChild tone="gold"><a href={printHref} target="_blank" rel="noopener noreferrer"><Printer className="h-4 w-4"/> Imprimir prova</a></Button>}
     </div>}
    </div>:undefined}>
   {form&&(preview||!canEdit?<div className="min-w-0 space-y-2"><p className="text-xs text-muted-foreground">Em ecrãs pequenos, a leitura adapta-se à largura. A impressão mantém as margens A4 e os espaços em milímetros.</p><iframe title="Pré-visualização A4 da prova" sandbox="" srcDoc={provaHtml(form,school,{draft:selected?.estado!=="aprovada"})} className="h-[60dvh] min-h-40 w-full rounded-xl border border-border bg-background sm:h-[65vh]"/></div>:
   <div className="min-w-0 space-y-5 [&_button]:max-sm:min-h-11 [&_button]:max-sm:whitespace-normal">
    <div className="rounded-xl border border-border p-3 sm:p-4">
    <Button type="button" variant="ghost" className="h-auto w-full justify-between whitespace-normal px-0 text-left" aria-expanded={headerExpanded} aria-controls="provas-header-fields" onClick={()=>setHeaderExpanded(v=>!v)}>
      <span className="min-w-0"><span className="block font-semibold">Cabeçalho da prova</span>{!headerExpanded&&<span className="block break-words text-xs font-normal text-muted-foreground">{form.disciplina?form.classe+" · "+form.disciplina+" · "+form.trimestre+".º trimestre":"Complete o contexto académico"}</span>}</span>{headerExpanded?<ChevronUp/>:<ChevronDown/>}
    </Button>
    <fieldset id="provas-header-fields" hidden={!headerExpanded} disabled={busy||Boolean(confirm)||discard} className={headerExpanded?"mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4":"hidden"}>
     <label className="grid min-w-0 gap-1 text-sm">Ano lectivo<select aria-label="Ano lectivo" className={input} value={selectedYear} disabled={anosLoading||richIndex!==null} onChange={e=>selectYear(e.target.value)}><option value="">Seleccione o ano</option>{selectedYear&&!anos.some(a=>a.id===selectedYear)&&<option value={selectedYear}>{form.ano_lectivo} (indisponível)</option>}{anos.map(a=><option key={a.id} value={a.id}>{a.label}{a.ativo?" · Actual":""}</option>)}</select></label>
     <label className="grid gap-1 text-sm sm:col-span-2">Classe e disciplina<select aria-label="Classe e disciplina" className={input} value={form.curso_matriz_id} disabled={!selectedYear||contextLoading||richIndex!==null} onChange={e=>selectMatrix(e.target.value)}><option value="">{contextLoading?"A carregar disciplinas...":"Seleccione a disciplina"}</option>{form.curso_matriz_id&&!matrixOptions.some(o=>o.curso_matriz_id===form.curso_matriz_id)&&<option value={form.curso_matriz_id}>{form.classe} · {form.disciplina} (indisponível)</option>}{matrixOptions.map(o=><option key={o.curso_matriz_id} value={o.curso_matriz_id}>{o.curso} · {o.classe} · {o.disciplina}</option>)}</select></label>
     <label className="grid gap-1 text-sm">Trimestre<select aria-label="Trimestre" className={input} value={form.trimestre} disabled={!form.curso_matriz_id||!periodOptions.length||richIndex!==null} onChange={e=>change("trimestre",Number(e.target.value))}>{!periodOptions.includes(form.trimestre)&&<option value={form.trimestre}>{form.trimestre}.º trimestre (indisponível)</option>}{periodOptions.map(v=><option key={v} value={v}>{v}.º trimestre</option>)}</select></label>
     {([ "titulo","serie"] as const).map(key=><label key={key} className="grid gap-1 text-sm">{key==="titulo"?"Título":"Série"}<input className={input} value={form[key]} onChange={e=>change(key,e.target.value)} maxLength={key==="titulo"?160:20}/></label>)}
     {(anosError||contextError)&&<div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive sm:col-span-2 lg:col-span-4">{anosError||contextError}<Button type="button" size="sm" variant="outline" onClick={()=>setContextRetry(v=>v+1)}>Tentar novamente</Button></div>}
     {!contextLoading&&!contextError&&selectedYear&&yearOptions.length===0&&<p role="status" className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-4">Não existem disciplinas publicadas e autorizadas neste ano. Consulte a Direção.</p>}
     <label className="grid gap-1 text-sm">Duração (min.)<input type="number" min={1} max={480} className={input} value={form.duracao||""} onChange={e=>change("duracao",Number(e.target.value))}/></label>
    </fieldset>
    </div>
    <fieldset disabled={busy||Boolean(confirm)||discard} className="min-w-0 space-y-3">
     <legend className="mb-3 text-sm font-semibold">Enunciado e perguntas</legend>
     {form.conteudo.map((block,index)=><div key={index} className="min-w-0 space-y-3 rounded-xl border border-border p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><label className="flex w-full min-w-0 items-center gap-2 text-sm sm:w-auto"><span className="font-medium text-muted-foreground">{index+1}.</span><select aria-label={"Tipo do bloco "+(index+1)} className={input} value={block.tipo} onChange={e=>{const tipo=e.target.value as Bloco["tipo"];patch(index,{tipo,linhas:["grupo","texto","verdadeiro_falso","lacunas","escolha"].includes(tipo)?0:3});}}>{Object.entries(tipos).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
       <div className="flex w-full flex-wrap gap-1 sm:w-auto"><Button size="sm" variant="ghost" aria-label={"Subir bloco "+(index+1)} disabled={richIndex!==null||index===0} onClick={()=>move(index,-1)}><ArrowUp/> Subir</Button><Button size="sm" variant="ghost" aria-label={"Descer bloco "+(index+1)} disabled={richIndex!==null||index===form.conteudo.length-1} onClick={()=>move(index,1)}><ArrowDown/> Descer</Button><Button size="sm" variant="ghost" className="text-destructive" aria-label={"Remover bloco "+(index+1)} disabled={richIndex!==null||form.conteudo.length===1} onClick={()=>change("conteudo",form.conteudo.filter((_,i)=>i!==index))}><Trash2/> Remover</Button></div>
      </div>
      {richIndex===index?<RichQuestionEditor key={index} block={block} label={"Enunciado "+(index+1)} disabled={busy||Boolean(confirm)||discard} onChange={part=>patch(index,part)} onDone={finishRich}/>:
       <div className="space-y-2">
        {block.rich?<div className="min-h-20 min-w-0 break-words whitespace-pre-wrap rounded-xl border border-border bg-muted/20 p-3 text-sm"><span className="mb-1 block text-xs text-muted-foreground">Conteúdo formatado · ver pré-visualização para as fórmulas</span>{block.texto}</div>:<textarea className={input+" resize-y"} id={"provas-block-"+index} aria-label={"Enunciado "+(index+1)} rows={4} maxLength={3000} value={block.texto} placeholder={block.tipo==="grupo"?"Ex.: I GRUPO — Compreensão do texto":block.tipo==="escolha"?"Escreva a pergunta e as alternativas em linhas separadas.":block.tipo==="lacunas"?"Escreva a frase utilizando ____ para as lacunas.":"Escreva o enunciado."} disabled={richIndex!==null} onChange={e=>patch(index,{texto:e.target.value})}/>}
        <Button type="button" id={"provas-rich-"+index} size="sm" variant="outline" className="w-full sm:w-auto" disabled={richIndex!==null} onClick={e=>{richTrigger.current=e.currentTarget;setRichIndex(index);}}><Pencil/> {block.rich?"Editar conteúdo formatado":"Formatar / inserir fórmulas"}</Button>
       </div>}

      {!["grupo","texto"].includes(block.tipo)&&<div className="min-w-0 space-y-3 border-t border-border pt-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><span className="text-sm font-medium">Espaço para resposta</span><span className="text-xs tabular-nums text-muted-foreground">{respostaLayout(block.tipo,block.linhas).kind==="none"?"Sem espaço adicional":respostaLayout(block.tipo,block.linhas).kind==="box"?"Área livre · "+(respostaLayout(block.tipo,block.linhas).heightMm/10).toFixed(1).replace(".",",")+" cm":block.linhas+" linha(s) · "+(respostaLayout(block.tipo,block.linhas).heightMm/10).toFixed(1).replace(".",",")+" cm"}</span></div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={"Espaço da resposta "+(index+1)}>
         {([0,3,6,10] as const).map(n=><Button key={n} type="button" size="sm" variant={block.linhas===n?"secondary":"outline"} aria-pressed={block.linhas===n} className="flex-1 sm:flex-none" onClick={()=>patch(index,{linhas:n})}>{n===0?"Nenhum":n===3?"Curto":n===6?"Médio":"Longo"}</Button>)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
         <Button type="button" size="sm" variant="outline" aria-label={"Diminuir espaço da resposta "+(index+1)} className="min-w-11" disabled={block.linhas<=0} onClick={()=>patch(index,{linhas:Math.max(0,block.linhas-1)})}><Minus/></Button>
         <label className="flex min-w-0 items-center gap-2 text-sm"><input type="number" inputMode="numeric" min={0} max={PROVA_PAPER.maxLines} aria-label={"Linhas para resposta "+(index+1)} value={block.linhas} className={input+" w-20 text-center"} onChange={e=>patch(index,{linhas:Math.max(0,Math.min(PROVA_PAPER.maxLines,Math.trunc(Number(e.target.value)||0)))})}/><span>{["calculo","desenho"].includes(block.tipo)?"unidades de altura":"linhas"}</span></label>
         <Button type="button" size="sm" variant="outline" aria-label={"Aumentar espaço da resposta "+(index+1)} className="min-w-11" disabled={block.linhas>=PROVA_PAPER.maxLines} onClick={()=>patch(index,{linhas:Math.min(PROVA_PAPER.maxLines,block.linhas+1)})}><Plus/></Button>
        </div>
        {!block.rich&&richIndex===null&&["calculo","discursiva","alinea"].includes(block.tipo)&&<div className="flex flex-wrap gap-1">{["²","³","√","×","÷","π","½","¼","≤","≥","∪","∩"].map(symbol=><button key={symbol} type="button" aria-label={"Adicionar "+symbol} className="min-h-11 min-w-11 rounded-xl border border-border px-2 py-1 text-base hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20" disabled={block.texto.length>=3000} onClick={()=>patch(index,{texto:block.texto+symbol})}>{symbol}</button>)}</div>}
      </div>}
     </div>)}
     <Button variant="outline" className="w-full sm:w-auto" disabled={richIndex!==null||form.conteudo.length>=80} onClick={()=>{const index=form.conteudo.length;change("conteudo",[...form.conteudo,{tipo:"discursiva",texto:"",linhas:3}]);requestAnimationFrame(()=>document.getElementById("provas-block-"+index)?.focus());}}><Plus/> Adicionar bloco</Button>
    </fieldset>
   </div>)}
  </ModalShell>
 </section>;
}
