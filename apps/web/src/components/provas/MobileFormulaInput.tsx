"use client";
import { useRef,useState } from "react";
import { ArrowLeft,Plus,Pencil,Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { mathMarkup } from "@/lib/provas/math";
import { recoverFormulaParts,formulaValueSlots,updateFormulaValues } from "@/lib/provas/formulaRecovery";
import { composeExpression,formulaCategories,formulaModels,formulaOperators,partExpression,modelExpression,completeExpression,type FormulaCategory,type FormulaModelId,type FormulaOperator,type FormulaPart } from "@/lib/provas/formulaModels";

function Formula({value}:{value:string|null}){
 const html=value?mathMarkup(value):null;
 return html?<span className="inline-block max-w-full overflow-x-auto align-middle" dangerouslySetInnerHTML={{__html:html}}/>:<span className="text-sm text-muted-foreground">Preencha os campos.</span>;
}
export default function MobileFormulaInput({initial,onInsert,onCancel,disabled=false}:{initial:string;onInsert:(latex:string)=>void;onCancel:()=>void;disabled?:boolean}){
 const [parts,setParts]=useState<FormulaPart[]>(()=>recoverFormulaParts(initial));
 const nextId=useRef(12);
 const [category,setCategory]=useState<FormulaCategory>("Aritmética");
 const [picking,setPicking]=useState(!initial);
 const [editing,setEditing]=useState<number|null>(null);
 const [chosen,setChosen]=useState<FormulaModelId|null>(null);
 const [values,setValues]=useState<string[]>([]);
 const [parameterSource,setParameterSource]=useState<string|null>(null);
 const [parameterValues,setParameterValues]=useState<string[]>([]);
 const parameterSlots=parameterSource===null?[]:formulaValueSlots(parameterSource);
 const parameterDraft=parameterSource===null?null:updateFormulaValues(parameterSource,parameterValues);
 const model=formulaModels.find(m=>m.id===chosen);
 const draft=chosen?modelExpression(chosen,values):null;
 const current=composeExpression(parts);
 const [error,setError]=useState("");
 function choose(id:FormulaModelId){
  const m=formulaModels.find(v=>v.id===id);if(!m)return;
  setChosen(id);setValues(m.fields.map(f=>f.example));setError("");
 }
 function edit(part:FormulaPart){
  if("existing" in part){setEditing(part.id);setChosen(null);setPicking(true);setParameterSource(part.existing);setParameterValues(formulaValueSlots(part.existing).map(s=>s.value));return;}
  setParameterSource(null);
  setEditing(part.id);setChosen(part.model);setValues([...part.values]);setPicking(true);
 }
 function leavePicker(){setPicking(false);setChosen(null);setEditing(null);setParameterSource(null);setError("");}
 function saveValues(insertNow=false){
  if(disabled||parameterDraft===null||editing===null)return;
  const next=parts.map(p=>p.id===editing?{id:p.id,operator:p.operator,existing:parameterDraft}:p);
  if(insertNow){const result=composeExpression(next);if(!result){setError("A expressão está incompleta ou excede o limite.");return;}onInsert(result);return;}
  setParts(next);leavePicker();
 }
 function savePart(insertNow=false){
  if(disabled||!chosen||!draft||!completeExpression(draft))return;
  const previous=parts.find(p=>p.id===editing);
  const item:FormulaPart={id:previous?.id??nextId.current++,operator:previous?.operator??"+",model:chosen,values:[...values]};
  const next=editing===null?[...parts,item]:parts.map(p=>p.id===editing?item:p);
  if(insertNow){
   const result=composeExpression(next);
   if(!result){setError("A expressão está incompleta ou excede o limite de 300 caracteres.");return;}
   onInsert(result);return;
  }
  setParts(next);leavePicker();
 }
 function remove(id:number){setParts(p=>p.filter(v=>v.id!==id));setError("");}
 function submit(){if(disabled)return;if(!current){setError("A expressão está incompleta ou excede o limite de 300 caracteres.");return;}onInsert(current);}
 const insertLabel=initial?"Actualizar fórmula":"Inserir fórmula";
 return <section aria-label="Editor matemático" className="min-w-0 space-y-3">
  <div><h3 className="text-base font-semibold text-klasse-green dark:text-foreground">Expressão matemática</h3><p className="text-xs text-muted-foreground">Escolha estruturas, ajuste os valores e combine expressões.</p></div>
  {picking?(parameterSource!==null?<div className="space-y-3">
   <p className="text-sm font-medium">Editar valores da fórmula</p>
   <div aria-label="Pré-visualização dos valores" className="flex min-h-24 items-center justify-center overflow-x-auto rounded-xl border border-border bg-card p-3 text-2xl"><Formula value={parameterSlots.length?parameterDraft:parameterSource}/></div>
   {parameterSlots.length>0?<><p className="text-xs text-muted-foreground">Altere os números pela ordem em que aparecem. A estrutura, variáveis e operadores são preservados.</p><div className="grid grid-cols-2 gap-2">{parameterSlots.map((slot,i)=><label key={slot.start} className="grid min-w-0 gap-1 text-xs font-medium">Valor {i+1}<input type="text" inputMode="decimal" maxLength={16} autoComplete="off" disabled={disabled} className="min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-base focus:outline-none focus:ring-4 focus:ring-klasse-gold/20" value={parameterValues[i]??""} onChange={e=>setParameterValues(v=>v.map((x,j)=>i===j?e.target.value:x))}/></label>)}</div><Button type="button" variant="outline" className="w-full" disabled={disabled||!parameterDraft} onClick={()=>saveValues()}>Guardar valores</Button></>:<p className="text-xs text-muted-foreground">Esta estrutura não permite edição segura dos valores no celular. A expressão original permanece intacta.</p>}
   <Button type="button" variant="ghost" className="w-full" disabled={disabled} onClick={()=>{setParameterSource(null);setChosen(null);}}>Substituir por modelo</Button>
  </div>:model?<div className="space-y-3">
   <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{model.label}</p><Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={()=>setChosen(null)}>Trocar modelo</Button></div>
   <div aria-label="Pré-visualização do modelo" className="flex min-h-24 items-center justify-center overflow-x-auto rounded-xl border border-border bg-card p-3 text-2xl"><Formula value={draft}/></div>
   <div className="grid grid-cols-2 gap-2">{model.fields.map((f,i)=><div key={f.label} className="grid min-w-0 gap-1 text-xs font-medium"><label htmlFor={"provas-mobile-value-"+i}>{f.label}</label><div className="flex min-w-0 items-center gap-1">
    <input id={"provas-mobile-value-"+i} type="text" inputMode={f.kind==="variable"?"text":"decimal"} autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false} maxLength={16} disabled={disabled} className="min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-2 text-base tabular-nums focus:outline-none focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold" value={values[i]??""} onChange={e=>{setValues(v=>v.map((x,j)=>i===j?e.target.value:x));setError("");}}/>
    {f.kind==="number"&&<button type="button" aria-label={"Alterar sinal de "+f.label} disabled={disabled} className="min-h-11 min-w-11 shrink-0 rounded-xl border border-border text-base focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20" onClick={()=>setValues(v=>v.map((x,j)=>i===j?(x.startsWith("-")?x.slice(1):"-"+x):x))}>±</button>}
   </div></div>)}</div>
   <Button type="button" variant="outline" className="w-full" disabled={disabled||!draft||!completeExpression(draft)} onClick={()=>savePart()}><Plus/> {editing===null?"Adicionar à expressão":"Guardar componente"}</Button>
  </div>:<div className="space-y-3">
   <label className="grid gap-1 text-xs font-medium">Categoria<select aria-label="Categoria de modelos" value={category} disabled={disabled} onChange={e=>setCategory(e.target.value as FormulaCategory)} className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-base focus:outline-none focus:ring-4 focus:ring-klasse-gold/20">{formulaCategories.map(v=><option key={v}>{v}</option>)}</select></label>
   <div className="grid grid-cols-2 gap-2" aria-label="Modelos matemáticos">{formulaModels.filter(m=>m.category===category).map(m=><button key={m.id} type="button" aria-label={m.label} disabled={disabled} className="flex min-h-20 min-w-0 flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card p-2 text-center hover:border-klasse-gold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20" onClick={()=>choose(m.id)}><span className="text-xl"><Formula value={m.sample}/></span><span className="text-xs font-medium">{m.label}</span></button>)}</div>
  </div>):<div className="space-y-3">
   <div aria-label="Pré-visualização da expressão" className="flex min-h-24 items-center justify-center overflow-x-auto rounded-xl border border-border bg-card p-3 text-2xl"><Formula value={current}/></div>
   <ol aria-label="Componentes da expressão" className="space-y-2">
    {parts.map((part,index)=><li key={part.id} className="space-y-2">
     {index>0&&<label className="flex items-center justify-center gap-2 text-xs text-muted-foreground">Operador<select aria-label={"Operador do componente "+(index+1)} value={part.operator} disabled={disabled} onChange={e=>setParts(p=>p.map(v=>v.id===part.id?{...v,operator:e.target.value as FormulaOperator}:v))} className="min-h-11 rounded-xl border border-border bg-background px-3 text-base focus:outline-none focus:ring-4 focus:ring-klasse-gold/20">{formulaOperators.map(op=><option key={op.id} value={op.id}>{op.label}</option>)}</select></label>}
     <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-card p-2"><div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">{"existing" in part?"Expressão existente":formulaModels.find(m=>m.id===part.model)?.label}</p><div className="text-lg"><Formula value={partExpression(part)}/></div></div>
      <Button type="button" size="sm" variant="ghost" aria-label={"Editar componente "+(index+1)} disabled={disabled} onClick={()=>edit(part)}><Pencil/><span className="sr-only">Editar</span></Button>
      <Button type="button" size="sm" variant="ghost" className="text-destructive" aria-label={"Remover componente "+(index+1)} disabled={disabled} onClick={()=>remove(part.id)}><Trash2/><span className="sr-only">Remover</span></Button>
     </div>
    </li>)}
   </ol>
   <Button type="button" variant="outline" className="w-full" disabled={disabled||parts.length>=12} onClick={()=>{setPicking(true);setChosen(null);setEditing(null);}}><Plus/> Adicionar componente</Button>
   {parts.some(p=>"existing" in p)&&<p className="text-xs text-muted-foreground">A fórmula original é preservada. Pode editar os valores reconhecidos ou substituir a estrutura por um modelo.</p>}
  </div>}
  <div className="sticky bottom-0 z-10 space-y-2 border-t border-border bg-card pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 group-data-[keyboard-open=true]/modal:static">
   {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
   <div className="grid grid-cols-2 gap-2">
    <Button type="button" variant="outline" disabled={disabled} onClick={()=>{if(picking&&(parts.length||chosen)){if(parameterSource!==null)leavePicker();else if(chosen)setChosen(null);else leavePicker();}else onCancel();}}>{picking&&(parts.length||chosen)?<><ArrowLeft/> Voltar</>:"Cancelar"}</Button>
    <Button type="button" tone="gold" disabled={disabled||(picking?(parameterSource!==null?!parameterDraft:!draft||!completeExpression(draft)):!current)} onClick={()=>picking?(parameterSource!==null?saveValues(true):savePart(true)):submit()}>{insertLabel}</Button>
   </div>
   {picking&&(parts.length>0||chosen)&&<Button type="button" variant="ghost" className="w-full" disabled={disabled} onClick={onCancel}>Cancelar</Button>}
  </div>
 </section>;
}
