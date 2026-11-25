"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {Printer,RefreshCw,Wallet} from "lucide-react";
import {z} from "zod";
import {Button} from "@/components/ui/Button";
import {PROVA_BATCH,PROVA_BATCH_SIZES,MAX_PROVA_TURMAS,type PrintTurma,type PrintRecipient} from "@/lib/provas/distribution";
import {tiposProva,type Prova} from "@/lib/provas/schema";
import {formatClasseProva,turmaProvaLabels} from "@/lib/provas/academicLabels";
type Mode="generic"|"turma"|"aluno";
type Prepared={total:number;offset:number;snapshot:string};
const input="min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2 text-base focus:outline-none focus:ring-4 focus:ring-klasse-gold/20 sm:text-sm";
const billingPreviewSchema=z.object({
 ok:z.literal(true),snapshot:z.string().regex(/^[a-f0-9]{32}$/),
 quantidade:z.number().int().positive(),moeda:z.literal("AOA"),
 valor_centimos:z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
 total_estimado_centimos:z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
 estado:z.enum(["preco_disponivel","preco_nao_configurado"]),
 confirmacao_disponivel:z.literal(false),
}).superRefine((value,ctx)=>{
 const valid=value.estado==="preco_disponivel"
  ? value.valor_centimos!==null&&value.total_estimado_centimos===value.valor_centimos*value.quantidade
  : value.valor_centimos===null&&value.total_estimado_centimos===null;
 if(!valid)ctx.addIssue({code:z.ZodIssueCode.custom,message:"Prévia financeira inválida."});
});
type BillingPreview=z.infer<typeof billingPreviewSchema>;
const money=new Intl.NumberFormat("pt-AO",{style:"currency",currency:"AOA"});
function PrintBillingPreview({url,snapshot,total}:{url:string;snapshot:string;total:number}){
 const [attempt,setAttempt]=useState(0);
 const [state,setState]=useState<{attempt:number;quote?:BillingPreview;error?:string}|null>(null);
 const current=state?.attempt===attempt?state:null;
 const loading=attempt>0&&!current;
 useEffect(()=>{
  if(attempt===0)return;
  const controller=new AbortController();
  async function consult(){
   try{
    const res=await fetch(url,{signal:controller.signal,cache:"no-store"});
    const data:unknown=await res.json();
    if(!res.ok)throw Error(res.status===409?"A selecção mudou. Actualize os destinatários.":"Não foi possível consultar a cobrança.");
    const parsed=billingPreviewSchema.safeParse(data);
    if(!parsed.success||parsed.data.snapshot!==snapshot||parsed.data.quantidade!==total)throw Error("A selecção mudou. Actualize os destinatários.");
    if(!controller.signal.aborted)setState({attempt,quote:parsed.data});
   }catch(error){
    if(!controller.signal.aborted)setState({attempt,error:error instanceof Error?error.message:"Não foi possível consultar a cobrança."});
   }
  }
  void consult();
  return()=>controller.abort();
 },[attempt,url,snapshot,total]);
 const quote=current?.quote;
 return <div className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-3">
  <div className="flex items-center gap-2 text-sm font-semibold text-klasse-green dark:text-foreground"><Wallet className="h-4 w-4 shrink-0" aria-hidden="true"/> Cobrança de folhas de prova</div>
  {quote?.estado==="preco_disponivel"&&quote.valor_centimos!==null&&quote.total_estimado_centimos!==null
   ?<div className="grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-muted-foreground">Por aluno</p><p className="font-medium tabular-nums">{money.format(quote.valor_centimos/100)}</p></div><div><p className="text-xs text-muted-foreground">Total estimado · {quote.quantidade} aluno(s)</p><p className="font-semibold tabular-nums">{money.format(quote.total_estimado_centimos/100)}</p></div></div>
   :quote?.estado==="preco_nao_configurado"?<p role="status" className="text-sm text-muted-foreground">Preço de folhas de prova ainda não configurado.</p>:null}
  {loading&&<p role="status" className="text-sm text-muted-foreground">A consultar preço...</p>}
  {current?.error&&<p role="alert" className="text-sm text-destructive">{current.error}</p>}
  <p className="text-xs text-muted-foreground">Prévia de preço. Não cria dívidas nem confirma pagamentos.</p>
  <Button type="button" variant="outline" disabled={loading} onClick={()=>setAttempt(v=>v+1)}><Wallet/> {attempt===0?"Consultar cobrança":"Actualizar cobrança"}</Button>
 </div>;
}
export default function ProvasPrintPanel({endpoint,prova}:{endpoint:string;prova:Prova}){
 const [mode,setMode]=useState<Mode>("generic"),[turmas,setTurmas]=useState<PrintTurma[]>([]),[chosen,setChosen]=useState<string[]>([]),[alunos,setAlunos]=useState<PrintRecipient[]>([]),[matricula,setMatricula]=useState(""),[name,setName]=useState(true),[prepared,setPrepared]=useState<Prepared|null>(null),[offset,setOffset]=useState(0),[revision,setRevision]=useState(0);
 const [listBusy,setListBusy]=useState(false),[studentBusy,setStudentBusy]=useState(false),[prepareBusy,setPrepareBusy]=useState(false);
 const [listError,setListError]=useState(""),[studentError,setStudentError]=useState(""),[prepareError,setPrepareError]=useState("");
 const busy=listBusy||studentBusy||prepareBusy,error=listError||studentError||prepareError;
 const [batchSize,setBatchSize]=useState<number>(PROVA_BATCH);
 const base=useMemo(()=>new URLSearchParams({prova:prova.id,versao:String(prova.versao)}).toString(),[prova.id,prova.versao]);
 const chosenKey=chosen.join(",");
 const selectionCount=turmas.filter(t=>chosen.includes(t.id)).reduce((sum,t)=>sum+t.total,0);
 const scopeKey=[mode,chosenKey,matricula,revision].join(":");
 const [preparedKey,setPreparedKey]=useState("");
 const ready=preparedKey===scopeKey?prepared:null;
 function reset(){setPrepared(null);setPreparedKey("");setOffset(0);setListError("");setStudentError("");setPrepareError("");}
 const get=useCallback(async(q:string,signal:AbortSignal)=>{const res=await fetch(endpoint+"/distribuicao?"+base+"&"+q,{signal,cache:"no-store"});const data=await res.json();if(!res.ok)throw Error(data.error??"Não foi possível consultar destinatários.");return data;},[endpoint,base]);
 useEffect(()=>{
  setListBusy(false);setListError("");setTurmas([]);
  if(mode==="generic")return;
  const controller=new AbortController();setListBusy(true);
  get("modo=turmas",controller.signal).then(data=>{if(!controller.signal.aborted)setTurmas(data.items);}).catch(e=>{if(!controller.signal.aborted)setListError(e.message);}).finally(()=>{if(!controller.signal.aborted)setListBusy(false);});
  return()=>controller.abort();
 },[get,mode,revision]);
 useEffect(()=>{
  setAlunos([]);setStudentBusy(false);setStudentError("");
  if(mode!=="aluno"||!chosenKey)return;
  const controller=new AbortController();setStudentBusy(true);
  get("modo=alunos&turmas="+encodeURIComponent(chosenKey),controller.signal).then(data=>{if(!controller.signal.aborted)setAlunos(data.items);}).catch(e=>{if(!controller.signal.aborted)setStudentError(e.message);}).finally(()=>{if(!controller.signal.aborted)setStudentBusy(false);});
  return()=>controller.abort();
 },[get,mode,chosenKey,revision]);
 useEffect(()=>{
  setPrepareBusy(false);setPrepareError("");
  if(mode==="generic"||!chosenKey||(mode==="aluno"&&!matricula))return;
  const controller=new AbortController();setPrepareBusy(true);
  const q="modo=imprimir&limit=1&turmas="+encodeURIComponent(chosenKey)+(mode==="aluno"?"&matricula="+encodeURIComponent(matricula):"");
  get(q,controller.signal).then(data=>{if(!controller.signal.aborted){setPrepared(data);setPreparedKey(scopeKey);}}).catch(e=>{if(!controller.signal.aborted)setPrepareError(e.message);}).finally(()=>{if(!controller.signal.aborted)setPrepareBusy(false);});
  return()=>controller.abort();
 },[get,scopeKey,mode,chosenKey,matricula]);
 const url=mode==="generic"?endpoint+"/print?prova="+encodeURIComponent(prova.id):ready?endpoint+"/print?"+base+"&modo=imprimir&turmas="+encodeURIComponent(chosenKey)+(mode==="aluno"?"&matricula="+encodeURIComponent(matricula):"")+"&offset="+offset+"&limit="+batchSize+"&snapshot="+ready.snapshot+"&nome="+(name?"1":"0"):null;
 return <section className="min-w-0 space-y-4">
  <div className="rounded-xl border border-border bg-card p-3"><p className="font-semibold text-klasse-green dark:text-foreground">{tiposProva[prova.tipo_prova]??"Prova"} · {prova.disciplina}</p><p className="text-sm text-muted-foreground">{formatClasseProva(prova.classe)} · {prova.ano_lectivo} · Série {prova.serie}</p><p className="mt-1 text-xs text-muted-foreground">Conteúdo aprovado. A distribuição não modifica a prova.</p></div>
  <fieldset className="min-w-0 space-y-2"><legend className="mb-2 font-medium text-sm">Modalidade de impressão</legend>
   {([["generic","Folha genérica","Nome e turma não preenchidos."],["turma","Por turma","Uma prova por aluno, em uma ou várias turmas."],["aluno","Por aluno","Uma prova individual a partir da matrícula."]] as const).map(([value,label,description])=><label key={value} className={"flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3 "+(mode===value?"border-klasse-gold bg-klasse-gold/10 ring-1 ring-klasse-gold/25":"border-border hover:bg-muted/30")}><input className="mt-1 accent-klasse-gold" type="radio" name="prova-print-mode" checked={mode===value} onChange={()=>{setMode(value);setChosen([]);setMatricula("");reset();}}/><span className="min-w-0"><span className="block text-sm font-medium">{label}</span><span className="block text-xs text-muted-foreground">{description}</span></span></label>)}
  </fieldset>
  {mode==="turma"&&<fieldset className="min-w-0 space-y-2"><legend className="mb-2 text-sm font-medium">Turmas elegíveis · até {MAX_PROVA_TURMAS}</legend>{turmas.map(t=><label key={t.id} className="flex min-h-11 items-center gap-3 rounded-xl border border-border p-3"><input type="checkbox" className="accent-klasse-gold" checked={chosen.includes(t.id)} disabled={t.total===0||(!chosen.includes(t.id)&&chosen.length>=MAX_PROVA_TURMAS)} onChange={e=>{reset();setChosen(p=>e.target.checked?[...p,t.id]:p.filter(id=>id!==t.id));}}/><span className="min-w-0 flex-1 break-words text-sm">{turmaProvaLabels(prova.classe,t).label}</span><span className="shrink-0 text-xs tabular-nums text-muted-foreground">{t.total} aluno(s)</span></label>)}</fieldset>}
  {mode==="aluno"&&<div className="grid min-w-0 gap-3 sm:grid-cols-2"><label className="grid min-w-0 gap-1 text-sm">Turma<select aria-label="Turma" className={input} value={chosen[0]??""} onChange={e=>{reset();setChosen(e.target.value?[e.target.value]:[]);setMatricula("");}}><option value="">Seleccione a turma</option>{turmas.map(t=><option key={t.id} value={t.id} disabled={!t.total}>{turmaProvaLabels(prova.classe,t).label} · {t.total}</option>)}</select></label><label className="grid min-w-0 gap-1 text-sm">Aluno<select aria-label="Aluno" className={input} value={matricula} disabled={!chosen.length||!alunos.length} onChange={e=>{reset();setMatricula(e.target.value);}}><option value="">Seleccione o aluno</option>{alunos.map(a=><option key={a.matricula_id} value={a.matricula_id}>{a.nome}{a.numero_processo?" · "+a.numero_processo:""}</option>)}</select></label></div>}
  {mode!=="generic"&&<><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="accent-klasse-gold" checked={name} onChange={e=>setName(e.target.checked)}/> Incluir nome, número de processo e chamada</label><p className="text-xs text-muted-foreground">Turma, turno e sala da turma são preenchidos automaticamente. A data e hora de exame só poderão aparecer após integração com agendamento específico.</p>
   {!turmas.length&&!busy&&!error&&<p role="status" className="text-sm text-muted-foreground">Nenhuma turma elegível neste contexto académico.</p>}
   <div className="rounded-xl border border-border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Provas a distribuir</p><p className="text-xl font-semibold tabular-nums text-klasse-green dark:text-foreground">{ready?ready.total:mode==="turma"?selectionCount:matricula?1:0}</p>{ready&&<p className="text-sm">Lote {Math.floor(offset/batchSize)+1} de {Math.ceil(ready.total/batchSize)} · provas {offset+1}–{Math.min(offset+batchSize,ready.total)}</p>}</div>
   {ready&&!busy&&!error&&<PrintBillingPreview key={[endpoint,base,scopeKey,ready.snapshot,ready.total].join(":")} url={endpoint+"/cobranca?"+base+"&modo=imprimir&limit=1&turmas="+encodeURIComponent(chosenKey)+(mode==="aluno"?"&matricula="+encodeURIComponent(matricula):"")+"&snapshot="+encodeURIComponent(ready.snapshot)} snapshot={ready.snapshot} total={ready.total}/>}
   {ready&&mode==="turma"&&<label className="grid gap-1 text-sm">Provas por lote<select aria-label="Provas por lote" className={input} value={batchSize} onChange={e=>{setBatchSize(Number(e.target.value));setOffset(0);}}>{PROVA_BATCH_SIZES.map(n=><option key={n} value={n}>{n}</option>)}</select></label>}
   {ready&&ready.total>batchSize&&<div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={!offset} onClick={()=>setOffset(v=>Math.max(0,v-batchSize))}>Lote anterior</Button><Button type="button" variant="outline" disabled={offset+batchSize>=ready.total} onClick={()=>setOffset(v=>v+batchSize)}>Lote seguinte</Button></div>}
  </>}
  {busy&&<p role="status" className="text-sm text-muted-foreground">A consultar destinatários...</p>}
  {error&&<div role="alert" className="space-y-2 text-sm text-destructive"><p>{error}</p><Button variant="outline" onClick={()=>{reset();setRevision(v=>v+1);}}><RefreshCw/> Actualizar selecção</Button></div>}
  {url&&!busy&&!error?<Button asChild tone="gold" className="min-h-11 w-full whitespace-normal"><a href={url} target="_blank" rel="noopener noreferrer"><Printer/> {mode==="generic"?"Abrir folha para impressão":"Imprimir lote"}</a></Button>:<Button tone="gold" className="min-h-11 w-full" disabled><Printer/> Seleccione os destinatários</Button>}
 </section>;
}
