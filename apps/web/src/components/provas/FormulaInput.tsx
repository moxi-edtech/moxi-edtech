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
 useEffect(()=>{
  const node=host.current;if(!node)return;
  MathfieldElement.soundsDirectory=null;
  const mf=new MathfieldElement();
  mf.setAttribute("aria-label","Expressão matemática");
  mf.mathVirtualKeyboardPolicy="manual";
  mf.value=initial;
  mf.style.width="100%";mf.style.minHeight="64px";mf.style.fontSize="1.4rem";
  const input=()=>{setLatex(mf.value);setError("");};
  mf.addEventListener("input",input);
  node.appendChild(mf);field.current=mf;
  return()=>{mf.removeEventListener("input",input);mf.remove();field.current=null;};
 },[initial]);
 function submit(){
  if(!mathMarkup(latex)){setError("A expressão está incompleta ou contém comandos não suportados.");return;}
  onInsert(latex);
 }
 return <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3">
  <p className="text-sm font-medium">Expressão matemática</p>
  <div ref={host} className="rounded-xl border border-border bg-background p-2"/>
  <div className="flex flex-wrap gap-1">{templates.map(([label,template])=><Button key={label} type="button" variant="outline" size="sm" onClick={()=>{field.current?.insert(template);field.current?.focus();}}>{label}</Button>)}</div>
  {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button><Button type="button" tone="gold" disabled={!latex.trim()} onClick={submit}>Inserir fórmula</Button></div>
 </div>;
}
