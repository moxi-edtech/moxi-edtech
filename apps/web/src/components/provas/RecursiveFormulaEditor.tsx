"use client";
import { useRef,useState,type ReactNode } from "react";
import { flushSync } from "react-dom";
import { ArrowLeft,Plus,Trash2,MoveLeft,MoveRight,Undo2,Redo2,SlidersHorizontal,ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { mathMarkup } from "@/lib/provas/math";
import { AST_LIMITS,editableMathToken,editableValueNode,groupMathRange,ungroupMathRange,mathAt,mathNodeLabel,mathSlots,mathSymbols,mathTreeValid,modelMathTree,replaceMathAt,serializeMath,tokenNode,validMathExpression,validMathToken,type MathNode,type MathPath } from "@/lib/provas/formulaAst";
import { formulaModels,formulaCategories,type FormulaCategory } from "@/lib/provas/formulaModels";

const fieldStyle="min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-2 text-base focus:outline-none focus:ring-4 focus:ring-klasse-gold/20";
function MathPreview({source}:{source:string}){
 const html=source?mathMarkup(source):null;
 return html?<span className="inline-block max-w-full overflow-x-auto align-middle" dangerouslySetInnerHTML={{__html:html}}/>:<span className="text-xs text-muted-foreground">Complete a expressão.</span>;
}
const structures:readonly {name:string;sample:string;nodes:()=>MathNode[]}[]=[
 {name:"Sistema de equações",sample:"\\begin{cases}x+y=3\\\\x-y=1\\end{cases}",nodes:()=>[{kind:"grid",env:"cases",rows:[[[tokenNode("x"),tokenNode("+"),tokenNode("y"),tokenNode("="),tokenNode("3")]],[[tokenNode("x"),tokenNode("-"),tokenNode("y"),tokenNode("="),tokenNode("1")]]]}]},
 {name:"Matriz",sample:"\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}",nodes:()=>[{kind:"grid",env:"pmatrix",rows:[[[tokenNode("1")],[tokenNode("2")]],[[tokenNode("3")],[tokenNode("4")]]]}]},
 {name:"Determinante",sample:"\\begin{vmatrix}1&2\\\\3&4\\end{vmatrix}",nodes:()=>[{kind:"grid",env:"vmatrix",rows:[[[tokenNode("1")],[tokenNode("2")]],[[tokenNode("3")],[tokenNode("4")]]]}]},
 {name:"Fracção",sample:"\\frac{1}{2}",nodes:()=>[{kind:"fraction",command:"\\frac",numerator:[tokenNode("1")],denominator:[tokenNode("2")]}]},
 {name:"Raiz",sample:"\\sqrt{x}",nodes:()=>[{kind:"root",body:[tokenNode("x")]}]},
 {name:"Raiz de índice n",sample:"\\sqrt[3]{x}",nodes:()=>[{kind:"root",index:[tokenNode("3")],body:[tokenNode("x")]}]},
 {name:"Potência",sample:"x^{2}",nodes:()=>[tokenNode("x"),{kind:"script",symbol:"^",braced:true,body:[tokenNode("2")]}]},
 {name:"Expoente",sample:"x^{2}",nodes:()=>[{kind:"script",symbol:"^",braced:true,body:[tokenNode("2")]}]},
 {name:"Índice",sample:"x_{1}",nodes:()=>[{kind:"script",symbol:"_",braced:true,body:[tokenNode("1")]}]},
 {name:"Parênteses",sample:"(x+1)",nodes:()=>[{kind:"group",open:"(",body:[tokenNode("x"),tokenNode("+"),tokenNode("1")]}]},
 {name:"Colchetes",sample:"[x+1]",nodes:()=>[{kind:"group",open:"[",body:[tokenNode("x"),tokenNode("+"),tokenNode("1")]}]},
];
const allSymbols=[...mathSymbols,["α","\\alpha"],["β","\\beta"],["θ","\\theta"],["λ","\\lambda"],["ω","\\omega"],["γ","\\gamma"],["δ","\\delta"],["φ","\\phi"]] as const;
type Picker="numbers"|"symbols"|"structures"|"models";
export default function RecursiveFormulaEditor({initial,onInsert,onBack,disabled,label}:{initial:MathNode[];onInsert:(value:string)=>void;onBack:()=>void;disabled:boolean;label:string}){
 const [tree,setTree]=useState(initial);
 const [path,setPath]=useState<MathPath>([]);
 const [selection,setSelection]=useState<number|null>(null);
 const [picker,setPicker]=useState<Picker|null>(null);
 const [position,setPosition]=useState<"before"|"after"|"end"|"replace">("end");
 const [atom,setAtom]=useState("1");
 const [category,setCategory]=useState<FormulaCategory>("Aritmética");
 const [error,setError]=useState("");
 const [advanced,setAdvanced]=useState(false);
 const [grouping,setGrouping]=useState<{path:MathPath;first:number}|null>(null);
 const [groupMode,setGroupMode]=useState(false);
 const [live,setLive]=useState(false);
 const valueInput=useRef<HTMLInputElement>(null);
 const [keyboard,setKeyboard]=useState<"decimal"|"text">("decimal");
 const [past,setPast]=useState<MathNode[][]>([]);
 const [future,setFuture]=useState<MathNode[][]>([]);
 const liveInvalid=live&&!validMathToken(atom.replace(",","."));
 function resetSelection(){setGroupMode(false);setGrouping(null);setPath([]);setSelection(null);setPicker(null);setLive(false);setError("");}
 function undo(){if(disabled||!past.length)return;setFuture(f=>[tree,...f].slice(0,50));setTree(past[past.length-1]);setPast(p=>p.slice(0,-1));resetSelection();}
 function redo(){if(disabled||!future.length)return;setPast(p=>[...p,tree].slice(-50));setTree(future[0]);setFuture(f=>f.slice(1));resetSelection();}
 const list=mathAt(tree,path)??[];
 const selected=selection===null?null:list[selection]??null;
 const source=serializeMath(tree);
 const valid=validMathExpression(tree);
 const crumbLabels=path.map((step,i)=>{const n=mathAt(tree,path.slice(0,i))?.[step.index];return n?mathSlots(n).find(s=>s.key===step.slot)?.label??"Expressão":"Expressão";});
 function change(next:MathNode[],focus:number|null,keepLive=false){
  if(disabled)return false;
  const updated=replaceMathAt(tree,path,next);
  if(!updated||!mathTreeValid(updated,true)){setError("Limite de profundidade, 160 elementos ou 300 caracteres atingido.");return false;}
  if(serializeMath(updated)!==serializeMath(tree)){setPast(p=>[...p,tree].slice(-50));setFuture([]);setTree(updated);}
  setGroupMode(false);setGrouping(null);setSelection(focus);if(!keepLive){setPicker(null);setLive(false);}setError("");return true;
 }
 function add(nodes:MathNode[]){
  if(disabled||!nodes.length)return;
  const index=position==="end"||selection===null?list.length:position==="before"||position==="replace"?selection:selection+1;
  const remove=position==="replace"&&selection!==null?1:0;
  const next=[...list];const insert=picker==="numbers"&&nodes.length===1&&nodes[0].kind==="token"?[editableValueNode(nodes[0].value,list.slice(0,index),list.slice(index+remove),remove?list[index]:undefined)]:nodes;next.splice(index,remove,...insert);change(next,index);
 }
 function openPicker(kind:Picker,at:typeof position){
  if(disabled||liveInvalid||error&&live)return;
  setLive(false);setPosition(at);setPicker(kind);setAtom(kind==="numbers"&&at==="replace"&&selected?.kind==="token"?selected.value:"1");setError("");
 }
 function openSlot(index:number,slot:MathPath[number]["slot"]){
  setPath(p=>[...p,{index,slot}]);setSelection(null);setPicker(null);setLive(false);setError("");
 }
 function navigate(depth:number){setPath(p=>p.slice(0,depth));setSelection(null);setPicker(null);setLive(false);setError("");}
 function selectElement(at:MathPath,index:number){
  if(disabled||liveInvalid||error&&live)return;
  const siblings=mathAt(tree,at);const node=siblings?.[index];if(!node||!siblings)return;
  if(groupMode){
   if(!grouping||JSON.stringify(grouping.path)!==JSON.stringify(at)){setGrouping({path:at,first:index});setError("");return;}
   const next=groupMathRange(siblings,grouping.first,index),updated=next&&replaceMathAt(tree,at,next);
   if(!updated||!mathTreeValid(updated,true)||!validMathExpression(updated)){setError("Seleccione um intervalo completo, incluindo a base e os expoentes.");return;}
   setPast(p=>[...p,tree].slice(-50));setFuture([]);setTree(updated);setPath(at);setSelection(Math.min(grouping.first,index));setGroupMode(false);setGrouping(null);setAdvanced(true);setError("");return;
  }
  const numeric=node.kind==="token"&&editableMathToken(node.value);
  const select=()=>{
   setPath(at);setSelection(index);setPosition("replace");setError("");
   setLive(numeric);setPicker(numeric?"numbers":node.kind==="token"?"symbols":null);
   setAdvanced(node.kind!=="token");
   if(numeric&&node.kind==="token"){setAtom(node.value);setKeyboard(/^[A-Za-z]$/.test(node.value)?"text":"decimal");}
  };
  if(numeric){flushSync(select);valueInput.current?.focus();valueInput.current?.select();}else select();
 }
 function selectEmpty(at:MathPath){
  if(disabled||liveInvalid)return;
  setPath(at);setSelection(null);setLive(false);setPicker("numbers");setPosition("end");setAtom("1");setError("");
 }
 function editLive(raw:string){
  setAtom(raw);
  const normalized=raw.replace(",",".");
  if(selection===null||!validMathToken(normalized)){setError("");return;}
  const replacement=editableValueNode(normalized,list.slice(0,selection),list.slice(selection+1),selected??undefined);
  if(replacement.kind==="group"){
   if(change(list.map((n,i)=>i===selection?replacement:n),selection,true)){
    setPath(p=>[...p,{index:selection,slot:"body"}]);setSelection(0);
   }
  }else change(list.map((n,i)=>i===selection?replacement:n),selection,true);
 }
 function renderSequence(nodes:MathNode[],at:MathPath,context="Expressão"):ReactNode{
  const slot=(i:number,key:MathPath[number]["slot"],children:MathNode[],label:string)=>renderSequence(children,[...at,{index:i,slot:key}],label);
  return <span className="inline-flex w-max max-w-none items-center gap-1 align-middle">
   {nodes.length===0&&<button type="button" className="min-h-11 min-w-11 rounded-xl border border-dashed border-border" aria-label={"Preencher "+context} disabled={disabled||liveInvalid||Boolean(error&&live)} onClick={()=>selectEmpty(at)}>□</button>}
   {nodes.map((node,i)=>{
    const active=groupMode?grouping?.first===i&&JSON.stringify(grouping.path)===JSON.stringify(at):selection===i&&JSON.stringify(path)===JSON.stringify(at);
    const mark=active?"border-klasse-gold bg-klasse-gold/10 ring-2 ring-klasse-gold/20":"border-border bg-background";
    const control=(name:string,children:ReactNode,extra="")=><button type="button" disabled={disabled||liveInvalid||Boolean(error&&live)} aria-label={context+" · "+name} aria-pressed={active} onClick={()=>selectElement(at,i)} className={"inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border px-2 text-base focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 "+mark+" "+extra}>{children}</button>;
    const display=node.kind==="token"?(allSymbols.find(sym=>sym[1]===node.value)?.[0]??node.value):"";
    if(node.kind==="token")return <span key={i}>{control(display.trim()?display:"Espaço",display.startsWith("\\")?<MathPreview source={display}/>:display.trim()?display:"␣")}</span>;
    if(node.kind==="fraction")return <span key={i} className={"inline-flex shrink-0 flex-col items-stretch gap-1 rounded-xl border p-1 "+(active?"border-klasse-gold":"border-transparent")}>
     <span className="flex justify-center">{slot(i,"numerator",node.numerator,"Numerador")}</span>
     <button type="button" aria-label={context+" · Seleccionar fracção"} aria-pressed={active} disabled={disabled||liveInvalid||Boolean(error&&live)} onClick={()=>selectElement(at,i)} className="flex min-h-11 items-center justify-center rounded-xl focus-visible:ring-4 focus-visible:ring-klasse-gold/20"><span className="h-px w-full bg-current"/></button>
     <span className="flex justify-center">{slot(i,"denominator",node.denominator,"Denominador")}</span>
    </span>;
    if(node.kind==="script")return <span key={i} className={"inline-flex shrink-0 "+(node.symbol==="^"?"-translate-y-3 self-start":"translate-y-3 self-end")}>{slot(i,"body",node.body,node.symbol==="^"?"Expoente":"Índice")}</span>;
    if(node.kind==="root")return <span key={i} className="inline-flex shrink-0 items-start gap-0.5">
     {node.index&&slot(i,"index",node.index,"Índice da raiz")}
     {control("Seleccionar raiz","√","self-stretch text-xl")}
     <span className="border-t border-current pt-1">{slot(i,"body",node.body,"Radicando")}</span>
    </span>;
    if(node.kind==="group")return <span key={i} className="inline-flex shrink-0 items-center gap-1">
     {control("Seleccionar grupo",node.open)}
     {slot(i,"body",node.body,"Expressão interna")}
     <span aria-hidden="true" className="text-xl">{node.open==="("?")":node.open==="["?"]":"}"}</span>
    </span>;
    return <span key={i} className="inline-flex shrink-0 items-stretch gap-1">
     {control("Seleccionar "+mathNodeLabel(node),node.env==="cases"?"{":node.env==="vmatrix"?"|":"(","self-stretch text-xl")}
     <span className="grid items-center gap-1" style={{gridTemplateColumns:"repeat("+node.rows[0].length+", max-content)"}}>
      {node.rows.flatMap((row,r)=>row.map((cell,c)=><span key={r+":"+c} className="flex justify-center">{slot(i,`cell:${r}:${c}`,cell,node.env==="cases"?"Equação "+(r+1):"Linha "+(r+1)+" · Coluna "+(c+1))}</span>))}
     </span>
     {node.env!=="cases"&&<span aria-hidden="true" className="self-center text-xl">{node.env==="vmatrix"?"|":")"}</span>}
    </span>;
   })}
  </span>;
 }
 function move(delta:number){
  if(selection===null||disabled)return;
  const to=selection+delta;if(to<0||to>=list.length)return;
  const next=[...list];[next[selection],next[to]]=[next[to],next[selection]];change(next,to);
 }
 function resizeGrid(axis:"row"|"column",delta:number){
  if(disabled||selection===null||selected?.kind!=="grid")return;
  const rows=selected.rows.length,cols=selected.rows[0].length,square=selected.env==="vmatrix";
  const nr=rows+(axis==="row"||square?delta:0),nc=cols+(axis==="column"||square?delta:0);
  if(nr<(selected.env==="cases"||square?2:1)||nc<(square?2:1)||nr>4||nc>4||(selected.env==="cases"&&nc!==1))return;
  if(delta<0&&!window.confirm("Remover a última linha ou coluna e o seu conteúdo?"))return;
  const next={...selected,rows:Array.from({length:nr},(_,r)=>Array.from({length:nc},(_,c)=>selected.rows[r]?.[c]??[tokenNode(selected.env==="cases"?"x":"0"),...(selected.env==="cases"?[tokenNode("="),tokenNode("0")]:[])]))};
  change(list.map((n,i)=>i===selection?next:n),selection);
 }
 const previewStyle="flex min-h-20 min-w-0 items-center justify-center overflow-x-auto rounded-xl border border-border bg-card p-3 text-2xl";
 return <section aria-label="Compositor de estruturas" className="min-w-0 space-y-3">
  <div className="flex items-center justify-between gap-2"><h3 className="text-base font-semibold text-klasse-green dark:text-foreground">Editar expressão</h3><Button type="button" variant="ghost" size="sm" onClick={()=>{if((!liveInvalid&&!error&&source===serializeMath(initial))||window.confirm("Descartar as alterações feitas nesta expressão?"))onBack();}} disabled={disabled}><ArrowLeft/> Voltar</Button></div>
  <div aria-label="Pré-visualização completa" className={previewStyle}><MathPreview source={source}/></div>
  <div className="flex flex-wrap items-center justify-between gap-1">
   <div className="flex gap-1"><Button type="button" size="sm" variant="ghost" disabled={disabled||!past.length} onClick={undo}><Undo2/> Desfazer</Button><Button type="button" size="sm" variant="ghost" disabled={disabled||!future.length} onClick={redo}><Redo2/> Refazer</Button></div>
   <Button type="button" size="sm" variant="ghost" aria-expanded={advanced} disabled={disabled||groupMode||liveInvalid} onClick={()=>setAdvanced(v=>!v)}><SlidersHorizontal/> Estrutura</Button>
  </div>
  <div className="flex flex-wrap items-center gap-2">
   <Button type="button" size="sm" variant="outline" disabled={disabled||liveInvalid||Boolean(error&&live)} aria-pressed={groupMode} onClick={()=>{setGroupMode(v=>!v);setGrouping(null);setSelection(null);setPicker(null);setLive(false);setAdvanced(false);setError("");}}>{groupMode?"Cancelar agrupamento":"Agrupar termos"}</Button>
   {groupMode&&<p role="status" className="text-xs text-muted-foreground">{grouping?"Toque no último elemento do grupo.":"Toque no primeiro elemento do grupo."}</p>}
  </div>
  {!groupMode&&<p className="text-xs text-muted-foreground">Toque no número, símbolo ou parte da fórmula para editar.</p>}
  <div role="group" aria-label="Elementos da expressão" className="min-w-0 overflow-x-auto rounded-xl border border-border bg-card p-3 py-6">{renderSequence(tree,[])}</div>
  {live&&selected?.kind==="token"&&<div className="space-y-2 rounded-xl border border-border p-3">
   <label className="grid gap-1 text-sm font-medium">Alterar valor ou variável
    <input aria-label="Valor ou variável" className={fieldStyle} ref={valueInput} inputMode={keyboard} autoCapitalize="off" autoComplete="off" spellCheck={false} maxLength={16} value={atom} onFocus={e=>e.currentTarget.select()} onChange={e=>editLive(e.target.value)} disabled={disabled} aria-invalid={liveInvalid||Boolean(error)}/>
   </label>
   <div className="flex flex-wrap gap-1">{/^-?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(atom)&&<Button type="button" variant="outline" size="sm" disabled={disabled} aria-label="Alterar sinal" onClick={()=>{editLive(atom.startsWith("-")?atom.slice(1):"-"+atom);valueInput.current?.focus();}}>± Alterar sinal</Button>}
   <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={()=>{flushSync(()=>setKeyboard(k=>k==="decimal"?"text":"decimal"));valueInput.current?.focus();}}> {keyboard==="decimal"?"Introduzir variável":"Teclado numérico"}</Button></div>
   {(liveInvalid||error)&&<div className="flex flex-wrap items-center gap-2"><p role="status" className="text-xs text-destructive">Introduza um número ou uma variável válida.</p><Button type="button" size="sm" variant="ghost" onClick={()=>{setAtom(selected.value);setError("");}}>Restaurar valor</Button></div>}
  </div>}
  {!live&&picker==="symbols"&&position==="replace"&&selected?.kind==="token"&&<div role="group" aria-label="Trocar símbolo" className="grid grid-cols-5 gap-1">
   {allSymbols.map(([display,value])=><button type="button" key={value} aria-label={"Símbolo "+display} aria-pressed={selected.value===value} disabled={disabled} onClick={()=>add([tokenNode(value)])} className="min-h-11 rounded-xl border border-border text-base focus-visible:ring-4 focus-visible:ring-klasse-gold/20">{display}</button>)}
  </div>}
  {!groupMode&&path.length>0&&!advanced&&<Button type="button" size="sm" variant="ghost" disabled={disabled||liveInvalid||Boolean(error&&live)} onClick={()=>navigate(0)}>Expressão inteira</Button>}
  {!groupMode&&advanced&&path.length>0&&<nav aria-label="Local da edição" className="flex flex-wrap gap-1"><button type="button" className="min-h-11 rounded-xl px-2" disabled={disabled||liveInvalid||Boolean(error&&live)} onClick={()=>navigate(0)}>Expressão</button>{crumbLabels.map((name,i)=><button key={i} type="button" disabled={disabled||liveInvalid||Boolean(error&&live)} className="min-h-11 rounded-xl px-2" onClick={()=>navigate(i+1)}>{name}</button>)}<Button type="button" size="sm" variant="outline" disabled={disabled||liveInvalid} onClick={()=>{const last=path[path.length-1];selectElement(path.slice(0,-1),last.index);}}>Seleccionar estrutura envolvente</Button></nav>}
  {!groupMode&&advanced&&!liveInvalid&&!(error&&live)&&(!picker||live)&&selected&&selection!==null&&<div className="space-y-2 rounded-xl border border-border p-3">
   <p className="text-sm font-medium">{mathNodeLabel(selected)}</p>
   {selected.kind==="group"&&selected.open!=="{"&&<Button type="button" variant="outline" disabled={disabled||!ungroupMathRange(list,selection)} onClick={()=>{const next=ungroupMathRange(list,selection);const updated=next&&replaceMathAt(tree,path,next);if(!next||!updated||!validMathExpression(updated)){setError("Não é possível remover este grupo sem deixar a expressão incompleta.");return;}if(window.confirm("Remover os parênteses pode alterar a ordem das operações. Continuar?"))change(next,selection);}}>Desagrupar termos</Button>}
   {selected.kind==="grid"&&<div className="space-y-2"><p className="text-xs text-muted-foreground">{selected.env==="cases"?selected.rows.length+" equações":selected.rows.length+" × "+selected.rows[0].length}</p><div className="flex flex-wrap gap-1">
    <Button type="button" size="sm" variant="outline" disabled={disabled||selected.rows.length>=4||selected.env==="vmatrix"&&selected.rows[0].length>=4} onClick={()=>resizeGrid("row",1)}><Plus/> {selected.env==="cases"?"Equação":selected.env==="vmatrix"?"Dimensão":"Linha"}</Button>
    {selected.env==="pmatrix"&&<Button type="button" size="sm" variant="outline" disabled={disabled||selected.rows[0].length>=4} onClick={()=>resizeGrid("column",1)}><Plus/> Coluna</Button>}
    <Button type="button" size="sm" variant="outline" disabled={disabled||selected.rows.length<=(selected.env==="pmatrix"?1:2)} onClick={()=>resizeGrid("row",-1)}>Remover {selected.env==="cases"?"equação":selected.env==="vmatrix"?"dimensão":"linha"}</Button>
    {selected.env==="pmatrix"&&<Button type="button" size="sm" variant="outline" disabled={disabled||selected.rows[0].length<=1} onClick={()=>resizeGrid("column",-1)}>Remover coluna</Button>}
   </div></div>}
   {mathSlots(selected).length>0&&<div className="grid gap-2">{mathSlots(selected).map(slot=><button key={slot.key} type="button" className="flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-xl border border-border px-3 text-left text-sm" onClick={()=>openSlot(selection,slot.key)} disabled={disabled||path.length>=AST_LIMITS.depth}><span>{slot.label}</span><span className="min-w-0 flex-1 text-right"><MathPreview source={serializeMath(slot.nodes)}/></span><ChevronRight className="size-4 shrink-0"/></button>)}</div>}
   <div className="flex flex-wrap gap-1">
    {selected.kind==="token"&&editableMathToken(selected.value)&&<Button type="button" size="sm" variant="outline" onClick={()=>openPicker("numbers","replace")} disabled={disabled}>Alterar valor</Button>}
    <Button type="button" size="sm" variant="outline" onClick={()=>openPicker("symbols","replace")} disabled={disabled}>Trocar símbolo</Button>
    <Button type="button" size="sm" variant="outline" onClick={()=>openPicker("structures","replace")} disabled={disabled}>Trocar estrutura</Button>
    <Button type="button" size="sm" variant="outline" onClick={()=>openPicker("numbers","before")} disabled={disabled}><Plus/> Antes</Button>
    <Button type="button" size="sm" variant="outline" onClick={()=>openPicker("numbers","after")} disabled={disabled}><Plus/> Depois</Button>
    <Button type="button" size="sm" variant="ghost" onClick={()=>move(-1)} disabled={disabled||selection===0} aria-label="Mover elemento para a esquerda"><MoveLeft/><span className="sr-only">Mover esquerda</span></Button>
    <Button type="button" size="sm" variant="ghost" onClick={()=>move(1)} disabled={disabled||selection===list.length-1} aria-label="Mover elemento para a direita"><MoveRight/><span className="sr-only">Mover direita</span></Button>
    <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={()=>change(list.filter((_,i)=>i!==selection),null)} disabled={disabled}><Trash2/> Remover</Button>
   </div>
  </div>}
  {!groupMode&&!liveInvalid&&!(error&&live)&&(!picker||live)&&<div className="grid grid-cols-2 gap-2">
   <Button type="button" variant="outline" disabled={disabled} onClick={()=>openPicker("numbers","end")}><Plus/> Número / variável</Button>
   <Button type="button" variant="outline" disabled={disabled} onClick={()=>openPicker("symbols","end")}><Plus/> Operador / símbolo</Button>
   <Button type="button" variant="outline" disabled={disabled} onClick={()=>openPicker("structures","end")}><Plus/> Estrutura</Button>
   <Button type="button" variant="outline" disabled={disabled} onClick={()=>openPicker("models","end")}><Plus/> Modelo</Button>
  </div>}
  {picker&&!live&&!(picker==="symbols"&&position==="replace"&&selected?.kind==="token")&&<div className="space-y-3 rounded-xl border border-border p-3">
   <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{position==="replace"?"Substituir elemento":position==="before"?"Inserir antes":position==="after"?"Inserir depois":"Adicionar elemento"}</p><Button type="button" variant="ghost" size="sm" onClick={()=>{setPicker(null);setLive(false);setError("");}}>Cancelar selecção</Button></div>
   <div className="flex flex-wrap gap-1">{([["numbers","Número / variável"],["symbols","Símbolo"],["structures","Estrutura"],["models","Modelo"]] as const).map(([key,name])=><Button key={key} type="button" size="sm" variant={picker===key?"secondary":"ghost"} onClick={()=>setPicker(key)} disabled={disabled}>{name}</Button>)}</div>
   {picker==="numbers"?<div className="flex items-end gap-2"><label className="min-w-0 flex-1 text-xs font-medium">Valor ou variável<input aria-label="Valor ou variável" className={fieldStyle} inputMode="text" autoCapitalize="off" autoComplete="off" spellCheck={false} maxLength={16} value={atom} onChange={e=>setAtom(e.target.value)} disabled={disabled}/></label><Button type="button" tone="gold" disabled={disabled||!validMathToken(atom.replace(",","."))} onClick={()=>add([tokenNode(atom.replace(",","."))])}>Aplicar</Button></div>:picker==="symbols"?<div className="grid grid-cols-5 gap-1">{allSymbols.map(([display,value])=><button key={value} type="button" aria-label={"Símbolo "+display} className="min-h-11 rounded-xl border border-border bg-background text-base focus-visible:ring-4 focus-visible:ring-klasse-gold/20" disabled={disabled} onClick={()=>add([tokenNode(value)])}>{display}</button>)}</div>:picker==="structures"?<div className="grid grid-cols-2 gap-2">{structures.map(s=><button key={s.name} type="button" disabled={disabled} onClick={()=>add(s.nodes())} className="flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-border p-2"><MathPreview source={s.sample}/><span className="text-xs">{s.name}</span></button>)}</div>:<><label className="grid gap-1 text-xs">Categoria<select className={fieldStyle} value={category} onChange={e=>setCategory(e.target.value as FormulaCategory)}>{formulaCategories.map(c=><option key={c}>{c}</option>)}</select></label><div className="grid grid-cols-2 gap-2">{formulaModels.filter(m=>m.category===category).map(m=><button key={m.id} type="button" disabled={disabled} onClick={()=>{const nodes=modelMathTree(m.id);if(nodes)add(nodes);else setError("Modelo não suportado nesta estrutura.");}} className="flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-border p-2"><MathPreview source={m.sample}/><span className="text-xs">{m.label}</span></button>)}</div></>}
  </div>}
  <div className="sticky bottom-0 z-10 space-y-2 border-t border-border bg-card pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 group-data-[keyboard-open=true]/modal:static">
   {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
   {!valid&&<p className="text-xs text-muted-foreground">Complete as partes em falta para inserir a expressão.</p>}

   <Button type="button" tone="gold" className="w-full" disabled={disabled||groupMode||!valid||liveInvalid||Boolean(error)||(picker!==null&&!live&&!(picker==="symbols"&&position==="replace"&&selected?.kind==="token"))} onClick={()=>{if(valid&&!groupMode&&!liveInvalid&&!error)onInsert(valid);}}>{label}</Button>
  </div>
 </section>;
}
