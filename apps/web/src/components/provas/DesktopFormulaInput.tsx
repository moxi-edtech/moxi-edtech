"use client";
import { useEffect,useRef,useState } from "react";
import { MathfieldElement } from "mathlive";
import "mathlive/fonts.css";
import { ArrowLeft,ArrowRight,Delete,Undo2,Redo2,Plus,Sigma } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { mathMarkup } from "@/lib/provas/math";
import { completeExpression,formulaModels,modelExpression,type FormulaModelId } from "@/lib/provas/formulaModels";

const structures=[
 ["Fracção","\\frac{#?}{#?}","fraction"],["Potência","^{#?}","power"],["Raiz","\\sqrt{#?}","root"],["Índice","_{#?}","index"],
] as const;
const symbols=["\\pi","\\times","\\div","\\pm","\\cup","\\cap","\\leq","\\geq","\\neq","\\approx","\\sin","\\cos","\\tan","\\log","\\theta","\\infty"] as const;
const symbolLabels=["π","×","÷","±","∪","∩","≤","≥","≠","≈","sin","cos","tan","log","θ","∞"] as const;
type Mode="models"|"keyboard"|"raw";

export default function FormulaInput({initial,onInsert,onCancel,disabled=false}:{initial:string;onInsert:(latex:string)=>void;onCancel:()=>void;disabled?:boolean}){
 const host=useRef<HTMLDivElement>(null),field=useRef<MathfieldElement|null>(null);
 const [latex,setLatex]=useState(initial),[error,setError]=useState("");
 const [ready,setReady]=useState(false),[mode,setMode]=useState<Mode>(initial?"keyboard":"models");
 const [selected,setSelected]=useState<FormulaModelId|null>(null),[values,setValues]=useState<string[]>([]);
 const model=formulaModels.find(m=>m.id===selected);
 const expression=selected?modelExpression(selected,values):null;
 const preview=expression?mathMarkup(expression):null;
 const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{
  const node=host.current;if(!node)return;
  MathfieldElement.soundsDirectory=null;
  const mf=new MathfieldElement();
  mf.setAttribute("aria-label","Expressão matemática");
  mf.mathVirtualKeyboardPolicy="manual";
  mf.value=initial;
  mf.style.width="100%";mf.style.maxWidth="100%";mf.style.minWidth="0";mf.style.minHeight="80px";mf.style.fontSize="1.5rem";
  const input=()=>{setLatex(mf.value);setError("");};
  mf.addEventListener("input",input);
  node.appendChild(mf);field.current=mf;setReady(true);
  heading.current?.focus({preventScroll:true});
  return()=>{mf.removeEventListener("input",input);mf.remove();field.current=null;};
 },[initial]);
 useEffect(()=>{if(field.current)field.current.readOnly=disabled;},[disabled,ready]);
 function syncField(mf:MathfieldElement){setLatex(mf.value);setError("");mf.focus();}
 function insert(value:string,structure=false){
  const mf=field.current;if(!mf||disabled)return;
  mf.insert(value,{format:"latex",selectionMode:structure?"placeholder":"after",focus:false,scrollIntoView:false});
  syncField(mf);
 }
 function command(action:"moveToPreviousChar"|"moveToNextChar"|"moveToNextPlaceholder"|"deleteBackward"|"undo"|"redo"){
  const mf=field.current;if(!mf||disabled)return;mf.executeCommand(action);syncField(mf);
 }
 function changeMode(next:Mode){
  if(disabled||next===mode)return;
  if(mode==="raw"&&next!=="raw"){
   if(latex.trim()&&!completeExpression(latex)){setError("Corrija a expressão LaTeX antes de mudar de editor.");return;}
   if(field.current)field.current.value=latex;
  }
  field.current?.blur();setMode(next);setError("");
 }
 function choose(id:FormulaModelId){
  const next=formulaModels.find(m=>m.id===id);if(!next)return;
  setSelected(id);setValues(next.fields.map(f=>f.example));setError("");
 }
 function applyModel(){
  if(!expression||!completeExpression(expression)||!field.current||disabled)return;
  if(latex.trim()&&latex!==expression&&!window.confirm("Substituir a expressão em edição por este modelo?"))return;
  field.current.value=expression;setLatex(expression);setMode("keyboard");setError("");
 }
 function submit(){
  if(disabled)return;
  const value=(mode==="models"?expression:mode==="keyboard"?field.current?.value??latex:latex)?.trim()??"";
  if(!completeExpression(value)){setError("Complete todos os campos da expressão ou remova os espaços vazios.");return;}
  if(mode==="models"&&latex.trim()&&latex!==value&&!window.confirm("Substituir a expressão em edição por este modelo?"))return;
  onInsert(value);
 }
 const keyClass="min-h-11 min-w-0 rounded-xl border border-border bg-card px-1 text-base font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 active:bg-muted disabled:opacity-50";
 return <section aria-label="Editor matemático" className="min-w-0 space-y-3">
  <style>{".klasse-mathfield math-field::part(virtual-keyboard-toggle),.klasse-mathfield math-field::part(menu-toggle){display:none}.klasse-mathfield math-field{border:0;outline:none;background:transparent;--caret-color:currentColor}"}</style>
  <div><h3 ref={heading} tabIndex={-1} className="text-base font-semibold text-klasse-green dark:text-foreground">Expressão matemática</h3><p className="text-xs text-muted-foreground">Escolha um modelo ou escreva a sua expressão.</p></div>
  <div role="group" aria-label="Modo de edição" className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
   {([["models","Modelos"],["keyboard","Livre"],["raw","LaTeX"]] as const).map(([id,label])=><button key={id} type="button" aria-pressed={mode===id} disabled={disabled} className={"min-h-11 rounded-xl px-1 text-sm font-medium focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 "+(mode===id?"bg-card text-klasse-green ring-1 ring-border dark:text-foreground":"text-muted-foreground")} onClick={()=>changeMode(id)}>{label}</button>)}
  </div>
  <div ref={host} className={"klasse-mathfield min-w-0 max-w-full overflow-x-auto rounded-xl border border-border bg-background px-2 py-3 focus-within:border-klasse-gold focus-within:ring-4 focus-within:ring-klasse-gold/20 "+(mode==="keyboard"?"":"hidden")}/>
  {mode==="models"&&(!model?<div className="grid grid-cols-2 gap-2" aria-label="Modelos matemáticos">{formulaModels.map(item=><button key={item.id} type="button" aria-label={item.label} disabled={disabled} className="flex min-h-20 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-border bg-card p-2 text-center hover:border-klasse-gold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20" onClick={()=>choose(item.id)}><span className="max-w-full overflow-x-auto text-lg" dangerouslySetInnerHTML={{__html:mathMarkup(item.sample)??""}}/><span className="text-xs font-medium">{item.label}</span></button>)}</div>:<div className="space-y-3">
   <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{model.label}</p><Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={()=>setSelected(null)}>Trocar modelo</Button></div>
   <div aria-label="Pré-visualização do modelo" className="min-h-20 overflow-x-auto rounded-xl border border-border bg-card p-4 text-center text-2xl">{preview?<span dangerouslySetInnerHTML={{__html:preview}}/>:<span className="text-sm text-muted-foreground">Preencha os valores.</span>}</div>
   <div className="grid grid-cols-2 gap-3">{model.fields.map((f,i)=><div key={f.label} className="grid min-w-0 gap-1 text-xs font-medium"><label htmlFor={"provas-formula-value-"+i}>{f.label}</label><div className="flex min-w-0 items-center gap-1"><input id={"provas-formula-value-"+i} aria-label={f.label} type="text" inputMode={f.kind==="variable"?"text":"decimal"} autoComplete="off" maxLength={16} disabled={disabled} className="min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-2 text-base tabular-nums focus:outline-none focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold" value={values[i]??""} onChange={e=>{setValues(v=>v.map((x,j)=>i===j?e.target.value:x));setError("");}}/><button type="button" aria-label={"Alterar sinal de "+f.label} disabled={disabled||f.kind==="variable"} className="min-h-11 min-w-11 shrink-0 rounded-xl border border-border text-base focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20" onClick={()=>{setValues(v=>v.map((x,j)=>i===j?(x.startsWith("-")?x.slice(1):"-"+x):x));setError("");}}>±</button></div></div>)}</div>
   <Button type="button" variant="outline" disabled={!ready||!preview||disabled} onClick={applyModel}><Sigma/> Personalizar no editor livre</Button>
  </div>)}
  {mode==="keyboard"&&<div role="group" aria-label="Teclado matemático" className="space-y-2">
   <div className="grid grid-cols-4 gap-1" onPointerDown={e=>{if(e.target instanceof Element&&e.target.closest("button"))e.preventDefault();}}>
    {structures.map(([label,value,id])=><button key={id} type="button" className={keyClass+" text-xs"} disabled={!ready||disabled} onClick={()=>insert(value,true)}>{label}</button>)}
   </div>
   <div className="grid grid-cols-5 gap-1" onPointerDown={e=>{if(e.target instanceof Element&&e.target.closest("button"))e.preventDefault();}}>
    {["7","8","9","+","−","4","5","6","×","÷","1","2","3","=","(","0",".","x","y",")"].map(key=><button key={key} type="button" className={keyClass} disabled={!ready||disabled} onClick={()=>insert(key==="−"?"-":key==="×"?"\\times":key==="÷"?"\\div":key)}>{key}</button>)}
    <button type="button" aria-label="Cursor à esquerda" className={keyClass+" flex items-center justify-center"} disabled={!ready||disabled} onClick={()=>command("moveToPreviousChar")}><ArrowLeft className="size-4"/></button>
    <button type="button" aria-label="Cursor à direita" className={keyClass+" flex items-center justify-center"} disabled={!ready||disabled} onClick={()=>command("moveToNextChar")}><ArrowRight className="size-4"/></button>
    <button type="button" aria-label="Apagar símbolo" className={keyClass+" flex items-center justify-center"} disabled={!ready||disabled} onClick={()=>command("deleteBackward")}><Delete className="size-4"/></button>
    <button type="button" aria-label="Desfazer símbolo" className={keyClass+" flex items-center justify-center"} disabled={!ready||disabled} onClick={()=>command("undo")}><Undo2 className="size-4"/></button>
    <button type="button" aria-label="Refazer símbolo" className={keyClass+" flex items-center justify-center"} disabled={!ready||disabled} onClick={()=>command("redo")}><Redo2 className="size-4"/></button>
   </div>
   <div className="grid grid-cols-2 gap-2" onPointerDown={e=>{if(e.target instanceof Element&&e.target.closest("button"))e.preventDefault();}}><Button type="button" variant="outline" size="sm" disabled={!ready||disabled} onClick={()=>command("moveToNextPlaceholder")}>Próximo campo <ArrowRight/></Button><Button type="button" variant="outline" size="sm" disabled={!ready||disabled} onClick={()=>insert("z")}><Plus/> z</Button></div>
   <details><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-muted-foreground">Mais símbolos</summary><div className="grid grid-cols-4 gap-1" onPointerDown={e=>{if(e.target instanceof Element&&e.target.closest("button"))e.preventDefault();}}>{symbols.map((symbol,i)=><button key={symbol} type="button" disabled={!ready||disabled} className={keyClass} onClick={()=>insert(symbol)}>{symbolLabels[i]}</button>)}</div></details>
  </div>}
  {mode==="raw"&&<label className="grid min-w-0 gap-1 text-sm">Expressão em LaTeX<textarea rows={4} maxLength={300} disabled={disabled} autoCapitalize="off" autoCorrect="off" spellCheck={false} className="w-full min-w-0 rounded-xl border border-border bg-background p-3 font-mono text-base focus:outline-none focus:ring-4 focus:ring-klasse-gold/20" value={latex} onChange={e=>{setLatex(e.target.value);setError("");}}/></label>}
  <div className="sticky bottom-0 z-10 space-y-2 border-t border-border bg-card pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
   {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
   <div className="grid grid-cols-2 gap-2"><Button type="button" variant="outline" disabled={disabled} onClick={onCancel}>Cancelar</Button><Button type="button" tone="gold" disabled={disabled||(mode==="models"?!preview:!latex.trim())} onClick={submit}>{initial?"Actualizar fórmula":"Inserir fórmula"}</Button></div>
  </div>
 </section>;
}
