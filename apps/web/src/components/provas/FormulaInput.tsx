"use client";
import { useEffect,useRef,useState } from "react";
import { MathfieldElement } from "mathlive";
import "mathlive/fonts.css";
import { Button } from "@/components/ui/Button";
import { mathMarkup } from "@/lib/provas/math";

const templates=[
 ["Fracção","\\frac{#?}{#?}"],["Potência","^{#?}"],["Raiz","\\sqrt{#?}"],["Índice","_{#?}"],["π","\\pi"],["×","\\times"],["÷","\\div"],["±","\\pm"],["∪","\\cup"],["∩","\\cap"],["≤","\\leq"],["≥","\\geq"]
] as const;
export default function FormulaInput({initial,onInsert,onCancel}:{initial:string;onInsert:(latex:string)=>void;onCancel:()=>void}){
 const host=useRef<HTMLDivElement>(null),field=useRef<MathfieldElement|null>(null);
 const [latex,setLatex]=useState(initial),[error,setError]=useState("");
 const [ready,setReady]=useState(false),[rawMode,setRawMode]=useState(false);
 useEffect(()=>{
  const node=host.current;if(!node)return;
  MathfieldElement.soundsDirectory=null;
  const mf=new MathfieldElement();
  mf.setAttribute("aria-label","Expressão matemática");
  mf.mathVirtualKeyboardPolicy="manual";
  mf.value=initial;
  mf.style.width="100%";mf.style.maxWidth="100%";mf.style.minWidth="0";mf.style.minHeight="64px";mf.style.fontSize="1.25rem";
  const input=()=>{setLatex(mf.value);setError("");};
  mf.addEventListener("input",input);
  node.appendChild(mf);field.current=mf;setReady(true);
  return()=>{mf.removeEventListener("input",input);mf.remove();field.current=null;};
 },[initial]);
 function submit(){
  if(!mathMarkup(latex)){setError("A expressão está incompleta ou contém comandos não suportados.");return;}
  onInsert(latex);
 }
 return <div className="min-w-0 space-y-3 rounded-xl border border-border bg-muted/30 p-3 [&_button]:max-sm:min-h-11 [&_button]:max-sm:whitespace-normal">
  <p className="text-sm font-medium">Expressão matemática</p>
  <div ref={host} className="min-w-0 max-w-full overflow-x-auto rounded-xl border border-border bg-background p-2" hidden={rawMode}/>
  {!rawMode&&<div role="group" aria-label="Teclado matemático" className="space-y-2"><div className="grid grid-cols-5 gap-1 sm:flex sm:flex-wrap">{["7","8","9","+","−","4","5","6","=","(", "1","2","3","0",")",".","x","y","z","←","→","⌫"].map(key=><Button key={key} type="button" variant="outline" size="sm" className="min-w-0 px-1 text-base" aria-label={key==="←"?"Cursor à esquerda":key==="→"?"Cursor à direita":key==="⌫"?"Apagar símbolo":key} disabled={!ready} onClick={()=>{const mf=field.current;if(!mf)return;if(key==="←")mf.executeCommand("moveToPreviousChar");else if(key==="→")mf.executeCommand("moveToNextChar");else if(key==="⌫")mf.executeCommand("deleteBackward");else mf.insert(key==="−"?"-":key);setLatex(mf.value);setError("");mf.focus();}}>{key}</Button>)}</div><div className="grid grid-cols-3 gap-1 sm:flex sm:flex-wrap">{templates.map(([label,template])=><Button key={label} type="button" variant="outline" size="sm" className="min-w-0 px-1" disabled={!ready} onClick={()=>{const mf=field.current;if(!mf)return;mf.insert(template);setLatex(mf.value);setError("");mf.focus();}}>{label}</Button>)}</div></div>}
  <Button type="button" variant="ghost" className="w-full justify-start sm:w-auto" aria-expanded={rawMode} onClick={()=>{if(rawMode&&field.current)field.current.value=latex;setRawMode(v=>!v);setError("");}}>{rawMode?"Voltar ao editor visual":"Editar em LaTeX (alternativa por teclado)"}</Button>
  {rawMode&&<label className="grid min-w-0 gap-1 text-sm">Expressão em LaTeX<textarea rows={3} maxLength={300} autoCapitalize="off" autoCorrect="off" spellCheck={false} className="w-full min-w-0 rounded-xl border border-border bg-background p-3 font-mono text-base focus:outline-none focus:ring-4 focus:ring-klasse-gold/20" value={latex} onChange={e=>{setLatex(e.target.value);setError("");}}/></label>}
  <p className="text-xs text-muted-foreground">Use os botões para escrever a fórmula sem teclado físico.</p>
  {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end"><Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button><Button type="button" tone="gold" disabled={!latex.trim()} onClick={submit}>Inserir fórmula</Button></div>
 </div>;
}
