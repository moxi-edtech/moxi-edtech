"use client";
import { useEffect,useRef,useState } from "react";
import { ArrowDown,ArrowUp,ClipboardList,Copy,Eye,Pencil,Plus,Printer,Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { estados,tipos,provaSchema,type Bloco,type Prova,type ProvaInput,type ProvaResumo } from "@/lib/provas/schema";
import { provaHtml } from "@/lib/provas/print";
const input="w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold";
const fresh=():ProvaInput=>{
 const date=new Date(),year=Number(new Intl.DateTimeFormat("en",{timeZone:"Africa/Luanda",year:"numeric"}).format(date)),month=Number(new Intl.DateTimeFormat("en",{timeZone:"Africa/Luanda",month:"numeric"}).format(date)),start=month>=9?year:year-1;
 return {titulo:"Prova",classe:"",disciplina:"",ano_lectivo:start+"/"+(start+1),trimestre:1,duracao:90,serie:"A",conteudo:[{tipo:"discursiva",texto:"",linhas:3}]};
};
function editable(p:Prova):ProvaInput {
 const {titulo,classe,disciplina,ano_lectivo,trimestre,duracao,serie,conteudo}=p;
 return {titulo,classe,disciplina,ano_lectivo,trimestre,duracao,serie,conteudo};
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
 const locked=useRef(false),request=useRef<AbortController|null>(null);
 useEffect(()=>{
  const c=new AbortController();setLoading(true);setListError("");
  fetch(endpoint+"?offset="+offset,{cache:"no-store",signal:c.signal}).then(response).then(b=>{if(!c.signal.aborted){setRows(b.provas);setSchool(b.escola);setPermissions(b.permissions);}}).catch(e=>{if(!c.signal.aborted)setListError(e.message);}).finally(()=>{if(!c.signal.aborted)setLoading(false);});
  return()=>c.abort();
 },[endpoint,offset,revision]);
 useEffect(()=>()=>request.current?.abort(),[endpoint]);
 function change<K extends keyof ProvaInput>(key:K,value:ProvaInput[K]){setForm(p=>p?{...p,[key]:value}:p);setDirty(true);setError("");}
 function patch(index:number,part:Partial<Bloco>){if(form)change("conteudo",form.conteudo.map((b,i)=>i===index?{...b,...part}:b));}
 function move(index:number,step:number){if(!form)return;const blocks=[...form.conteudo],to=index+step;if(to<0||to>=blocks.length)return;[blocks[index],blocks[to]]=[blocks[to],blocks[index]];change("conteudo",blocks);}
 function close(force=false){if(locked.current)return;if(dirty&&!force){setDiscard(true);return;}setForm(null);setSelected(null);setDirty(false);setDiscard(false);setConfirm(null);setError("");}
 function create(){if(locked.current)return;setSelected(null);setForm(fresh());setDirty(false);setPreview(false);setError("");setNotice("");}
 async function open(id:string){
  if(locked.current)return;locked.current=true;setBusy(true);setListError("");setNotice("");
  const c=new AbortController();request.current=c;
  try{const b=await response(await fetch(endpoint+"?prova="+encodeURIComponent(id),{cache:"no-store",signal:c.signal}));if(c.signal.aborted)return;setSelected(b.prova);setForm(editable(b.prova));setDirty(false);setPreview(b.prova.estado!=="rascunho"||!permissions?.author);setError("");}
  catch(e){if(!c.signal.aborted)setListError(e instanceof Error?e.message:"Erro ao abrir a prova.");}
  finally{if(request.current===c){request.current=null;locked.current=false;setBusy(false);}}
 }
 async function mutate(action:"criar"|"guardar"|Action){
  if(locked.current||!form)return;
  let dados:ProvaInput|undefined;
  if(action==="criar"||action==="guardar"){
   const validated=provaSchema.safeParse(form);
   if(!validated.success){setError(validated.error.issues.map(i=>i.path[0]==="conteudo"?"Preencha o enunciado de todas as perguntas.":"Verifique "+String(i.path[0]).replace("_"," ")+".").filter((v,i,a)=>a.indexOf(v)===i).join(" "));return;}dados=validated.data;
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
 const actionLabels:Record<Action,string>={submeter:"Enviar para revisão",aprovar:"Aprovar prova",devolver:"Devolver para edição",arquivar:"Arquivar",duplicar:"Duplicar"};
 return <section className="space-y-5">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-foreground">Provas e impressos pedagógicos</h2><p className="text-sm text-muted-foreground">{permissions?.author?"Elabore, reveja e imprima avaliações.":"Consulte e imprima as provas aprovadas."}</p></div>{permissions?.author&&<Button tone="gold" disabled={busy||loading} onClick={create}><Plus/> Nova prova</Button>}</div>
  {notice&&!form&&<p role="status" className="text-sm text-klasse-green">{notice}</p>}
  {listError&&<div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">{listError}<Button variant="outline" onClick={()=>setRevision(v=>v+1)}>Tentar novamente</Button></div>}
  <div className="overflow-hidden rounded-xl border border-border bg-card">
   {loading?<p role="status" className="p-5 text-sm text-muted-foreground">A carregar provas...</p>:<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground"><tr>{["Prova","Classe","Período","Estado","Ações"].map(h=><th key={h} scope="col" className="px-4 py-3 font-medium">{h}</th>)}</tr></thead><tbody className="divide-y divide-border">{rows.map(p=><tr key={p.id}><td className="px-4 py-3"><p className="font-medium">{p.titulo} · {p.disciplina}</p><p className="text-xs text-muted-foreground">Série {p.serie}</p></td><td className="px-4 py-3">{p.classe}</td><td className="px-4 py-3 whitespace-nowrap">{p.ano_lectivo} · {p.trimestre}.º trim.</td><td className="px-4 py-3"><span className="rounded-full bg-muted px-2 py-1 text-xs">{estados[p.estado]}</span></td><td className="px-4 py-3"><div className="flex flex-wrap gap-1"><Button size="sm" variant="ghost" disabled={busy} onClick={()=>open(p.id)}>{p.estado==="rascunho"?<Pencil/>:<Eye/>}{p.estado==="rascunho"?"Editar":"Consultar"}</Button>{p.estado==="aprovada"&&<a href={endpoint+"/print?prova="+encodeURIComponent(p.id)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium hover:bg-muted"><Printer className="h-4 w-4"/> Imprimir</a>}</div></td></tr>)}</tbody></table>{!rows.length&&!listError&&<div className="p-8 text-center"><ClipboardList className="mx-auto mb-3 h-7 w-7 text-muted-foreground"/><p className="font-medium">{permissions?.author?"Ainda não existem provas.":"Nenhuma prova aprovada."}</p><p className="text-sm text-muted-foreground">{permissions?.author?"Crie a primeira prova para começar.":"As provas ficam disponíveis após a aprovação."}</p></div>}</div>}
   {(offset>0||rows.length===30)&&<div className="flex justify-end gap-2 border-t border-border p-3"><Button variant="outline" disabled={loading||busy||offset===0} onClick={()=>setOffset(o=>Math.max(0,o-30))}>Anterior</Button><Button variant="outline" disabled={loading||busy||rows.length<30||offset>=9990} onClick={()=>setOffset(o=>o+30)}>Seguinte</Button></div>}
  </div>
  <ModalShell open={Boolean(form)} title={selected?selected.titulo:"Nova prova"} description={selected?estados[selected.estado]:"Configure o cabeçalho e adicione perguntas."} size="wide" onClose={()=>close()}
    footer={form?<div className="space-y-2">
     {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}{notice&&<p role="status" className="text-sm text-klasse-green">{notice}</p>}
     {discard?<div className="flex flex-wrap items-center gap-2"><p className="mr-auto text-sm">Descartar as alterações não guardadas?</p><Button variant="outline" onClick={()=>setDiscard(false)}>Continuar edição</Button><Button variant="destructive" onClick={()=>close(true)}>Descartar</Button></div>:confirm?<div className="flex flex-wrap items-center gap-2"><p className="mr-auto text-sm">Confirmar: {actionLabels[confirm]}?</p><Button variant="outline" onClick={()=>setConfirm(null)}>Cancelar</Button><Button tone="gold" disabled={busy} onClick={()=>mutate(confirm)}>Confirmar</Button></div>:<div className="flex flex-wrap items-center justify-end gap-2">
       {canEdit&&<Button variant="outline" disabled={busy} onClick={()=>setPreview(v=>!v)}>{preview?<Pencil/>:<Eye/>}{preview?"Editar":"Pré-visualizar"}</Button>}
       {canEdit&&(!selected||dirty)&&<Button tone="gold" disabled={busy} onClick={()=>mutate(selected?"guardar":"criar")}>Guardar rascunho</Button>}
       {canManage&&selected&&!dirty&&selected.estado==="rascunho"&&<Button tone="gold" disabled={busy} onClick={()=>setConfirm("submeter")}>Enviar para revisão</Button>}
       {permissions?.admin&&selected?.estado==="em_revisao"&&<><Button variant="outline" disabled={busy} onClick={()=>setConfirm("devolver")}>Devolver</Button><Button tone="gold" disabled={busy} onClick={()=>setConfirm("aprovar")}>Aprovar prova</Button></>}
       {canManage&&selected&&!dirty&&<Button variant="ghost" disabled={busy} onClick={()=>setConfirm("duplicar")}><Copy/> Duplicar</Button>}
       {canManage&&selected&&!dirty&&(selected.estado==="rascunho"||permissions?.admin&&selected.estado==="aprovada")&&<Button variant="ghost" disabled={busy} onClick={()=>setConfirm("arquivar")}>Arquivar</Button>}
       {printHref&&<Button asChild tone="gold"><a href={printHref} target="_blank" rel="noopener noreferrer"><Printer className="h-4 w-4"/> Imprimir prova</a></Button>}
     </div>}
    </div>:undefined}>
   {form&&(preview||!canEdit?<iframe title="Pré-visualização A4 da prova" sandbox="" srcDoc={provaHtml(form,school,{draft:selected?.estado!=="aprovada"})} className="h-[65vh] w-full rounded-xl border border-border bg-background"/>:
   <div className="space-y-6">
    <fieldset disabled={busy||Boolean(confirm)||discard} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
     {(["titulo","classe","disciplina","ano_lectivo","serie"] as const).map(key=><label key={key} className="grid gap-1 text-sm">{({titulo:"Título",classe:"Classe",disciplina:"Disciplina",ano_lectivo:"Ano lectivo",serie:"Série"})[key]}<input className={input} value={form[key]} onChange={e=>change(key,e.target.value)} maxLength={({titulo:160,classe:80,disciplina:120,ano_lectivo:9,serie:20})[key]}/></label>)}
     <label className="grid gap-1 text-sm">Trimestre<select className={input} value={form.trimestre} onChange={e=>change("trimestre",Number(e.target.value))}>{[1,2,3].map(v=><option key={v} value={v}>{v}.º trimestre</option>)}</select></label>
     <label className="grid gap-1 text-sm">Duração (min.)<input type="number" min={1} max={480} className={input} value={form.duracao||""} onChange={e=>change("duracao",Number(e.target.value))}/></label>
    </fieldset>
    <fieldset disabled={busy||Boolean(confirm)||discard} className="space-y-3">
     <legend className="mb-3 text-sm font-semibold">Enunciado e perguntas</legend>
     {form.conteudo.map((block,index)=><div key={index} className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><label className="flex items-center gap-2 text-sm"><span className="font-medium text-muted-foreground">{index+1}.</span><select aria-label={"Tipo do bloco "+(index+1)} className={input} value={block.tipo} onChange={e=>{const tipo=e.target.value as Bloco["tipo"];patch(index,{tipo,linhas:["grupo","texto","verdadeiro_falso","lacunas","escolha"].includes(tipo)?0:3});}}>{Object.entries(tipos).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
       <div className="flex flex-wrap gap-1"><Button size="sm" variant="ghost" disabled={index===0} onClick={()=>move(index,-1)}><ArrowUp/> Subir</Button><Button size="sm" variant="ghost" disabled={index===form.conteudo.length-1} onClick={()=>move(index,1)}><ArrowDown/> Descer</Button><Button size="sm" variant="ghost" className="text-destructive" disabled={form.conteudo.length===1} onClick={()=>change("conteudo",form.conteudo.filter((_,i)=>i!==index))}><Trash2/> Remover</Button></div>
      </div>
      <textarea className={input+" resize-y"} aria-label={"Enunciado "+(index+1)} rows={3} maxLength={3000} value={block.texto} placeholder={block.tipo==="grupo"?"Ex.: I GRUPO — Compreensão do texto":block.tipo==="escolha"?"Escreva a pergunta e as alternativas em linhas separadas.":block.tipo==="lacunas"?"Escreva a frase utilizando ____ para as lacunas.":"Escreva o enunciado."} onChange={e=>patch(index,{texto:e.target.value})}/>
      {!["grupo","texto"].includes(block.tipo)&&<div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-sm">Linhas para resposta<input type="number" min={0} max={20} value={block.linhas} className={input+" max-w-24"} onChange={e=>patch(index,{linhas:Number(e.target.value)})}/></label>{["calculo","discursiva","alinea"].includes(block.tipo)&&<div className="flex flex-wrap gap-1">{["²","³","√","×","÷","π","½","¼","≤","≥","∪","∩"].map(symbol=><button key={symbol} type="button" aria-label={"Adicionar "+symbol} className="rounded-xl border border-border px-2 py-1 text-sm hover:bg-muted" disabled={block.texto.length>=3000} onClick={()=>patch(index,{texto:block.texto+symbol})}>{symbol}</button>)}</div>}</div>}
     </div>)}
     <Button variant="outline" disabled={form.conteudo.length>=80} onClick={()=>change("conteudo",[...form.conteudo,{tipo:"discursiva",texto:"",linhas:3}])}><Plus/> Adicionar bloco</Button>
    </fieldset>
   </div>)}
  </ModalShell>
 </section>;
}
