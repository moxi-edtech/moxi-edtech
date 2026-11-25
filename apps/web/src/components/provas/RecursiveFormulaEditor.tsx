"use client";
import { useState } from "react";
import { ArrowLeft,ChevronRight,Plus,Trash2,MoveLeft,MoveRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { mathMarkup } from "@/lib/provas/math";
import { AST_LIMITS,editableMathToken,mathAt,mathNodeLabel,mathSlots,mathSymbols,mathTreeValid,modelMathTree,replaceMathAt,serializeMath,tokenNode,validMathExpression,validMathToken,type MathNode,type MathPath } from "@/lib/provas/formulaAst";
import { formulaModels,formulaCategories,type FormulaCategory } from "@/lib/provas/formulaModels";

const fieldStyle="min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-2 text-base focus:outline-none focus:ring-4 focus:ring-klasse-gold/20";
function MathPreview({source}:{source:string}){
 const html=source?mathMarkup(source):null;
 return html?<span className="inline-block max-w-full overflow-x-auto align-middle" dangerouslySetInnerHTML={{__html:html}}/>:<span className="text-xs text-muted-foreground">Complete a expressão.</span>;
}
const structures:readonly {name:string;sample:string;nodes:()=>MathNode[]}[]=[
 {name:"Fracção",sample:"\\frac{1}{2}",nodes:()=>[{kind:"fraction",command:"\\frac",numerator:[tokenNode("1")],denominator:[tokenNode("2")]}]},
 {name:"Raiz",sample:"\\sqrt{x}",nodes:()=>[{kind:"root",body:[tokenNode("x")]}]},
 {name:"Raiz de índice n",sample:"\\sqrt[3]{x}",nodes:()=>[{kind:"root",index:[tokenNode("3")],body:[tokenNode("x")]}]},
 {name:"Potência",sample:"x^{2}",nodes:()=>[tokenNode("x"),{kind:"script",symbol:"^",braced:true,body:[tokenNode("2")]}]},
 {name:"Expoente",sample:"x^{2}",nodes:()=>[{kind:"script",symbol:"^",braced:true,body:[tokenNode("2")]}]},
 {name:"Índice",sample:"x_{1}",nodes:()=>[{kind:"script",symbol:"_",braced:true,body:[tokenNode("1")]}]},
 {name:"Parênteses",sample:"(x+1)",nodes:()=>[{kind:"group",open:"(",body:[tokenNode("x"),tokenNode("+"),tokenNode("1")]}]},
 {name:"Colchetes",sample:"[x+1]",nodes:()=>[{kind:"group",open:"[",body:[tokenNode("x"),tokenNode("+"),tokenNode("1")]}]},
];
const allSymbols=[...mathSymbols,["α","\\alpha"],["β","\\beta"],["θ","\\theta"],["λ","\\lambda"],["μ","\\mu"],["ω","\\omega"],["γ","\\gamma"],["δ","\\delta"],["σ","\\sigma"],["φ","\\phi"]] as const;
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
 const list=mathAt(tree,path)??[];
 const selected=selection===null?null:list[selection]??null;
 const source=serializeMath(tree);
 const valid=validMathExpression(tree);
 const crumbLabels=path.map((step,i)=>{const n=mathAt(tree,path.slice(0,i))?.[step.index];return n?mathSlots(n).find(s=>s.key===step.slot)?.label??"Expressão":"Expressão";});
 function change(next:MathNode[],focus:number|null){
  const updated=replaceMathAt(tree,path,next);
  if(!updated||!mathTreeValid(updated,true)){setError("Limite de profundidade, 160 elementos ou 300 caracteres atingido.");return false;}
  setTree(updated);setSelection(focus);setPicker(null);setError("");return true;
 }
 function add(nodes:MathNode[]){
  if(disabled||!nodes.length)return;
  const index=position==="end"||selection===null?list.length:position==="before"||position==="replace"?selection:selection+1;
  const remove=position==="replace"&&selection!==null?1:0;
  const next=[...list];next.splice(index,remove,...nodes);change(next,index);
 }
 function openPicker(kind:Picker,at:typeof position){
  setPosition(at);setPicker(kind);setAtom(kind==="numbers"&&at==="replace"&&selected?.kind==="token"?selected.value:"1");setError("");
 }
 function openSlot(index:number,slot:MathPath[number]["slot"]){
  setPath(p=>[...p,{index,slot}]);setSelection(null);setPicker(null);setError("");
 }
 function navigate(depth:number){setPath(p=>p.slice(0,depth));setSelection(null);setPicker(null);setError("");}
 function move(delta:number){
  if(selection===null||disabled)return;
  const to=selection+delta;if(to<0||to>=list.length)return;
  const next=[...list];[next[selection],next[to]]=[next[to],next[selection]];change(next,to);
 }
 const previewStyle="flex min-h-20 min-w-0 items-center justify-center overflow-x-auto rounded-xl border border-border bg-card p-3 text-2xl";
 return <section aria-label="Compositor de estruturas" className="min-w-0 space-y-3">
  <div className="flex items-center justify-between gap-2"><h3 className="text-base font-semibold text-klasse-green dark:text-foreground">Personalizar expressão</h3><Button type="button" variant="ghost" size="sm" onClick={()=>{if(source===serializeMath(initial)||window.confirm("Descartar as alterações feitas nesta expressão?"))onBack();}} disabled={disabled}><ArrowLeft/> Voltar</Button></div>
  <div aria-label="Pré-visualização completa" className={previewStyle}><MathPreview source={source}/></div>
  <nav aria-label="Local da edição" className="flex flex-wrap items-center gap-1 text-xs"><button type="button" className="min-h-11 rounded-xl px-2 font-medium text-klasse-green dark:text-foreground" onClick={()=>navigate(0)}>Expressão</button>{crumbLabels.map((name,i)=><span key={i} className="flex items-center gap-1"><ChevronRight className="size-3"/><button type="button" className="min-h-11 rounded-xl px-2 font-medium" aria-current={i===crumbLabels.length-1?"location":undefined} onClick={()=>navigate(i+1)}>{name}</button></span>)}</nav>
  {path.length>0&&<div aria-label="Pré-visualização da parte" className="flex min-h-12 items-center justify-center overflow-x-auto rounded-xl bg-muted/30 p-2 text-xl"><MathPreview source={serializeMath(list)}/></div>}
  <p className="text-xs text-muted-foreground">Toque num elemento para alterar, inserir antes ou depois, ou abrir uma parte interna.</p>
  <div role="group" aria-label="Elementos da expressão" className="flex flex-wrap gap-1.5">
   {list.map((node,i)=><button key={i} type="button" aria-label={"Elemento "+(i+1)+": "+mathNodeLabel(node)} aria-pressed={selection===i} disabled={disabled} onClick={()=>{setSelection(i);setPicker(null);setError("");}} className={"flex min-h-11 min-w-11 max-w-full flex-wrap items-center justify-center gap-1 rounded-xl border px-2 py-1 text-base "+(selection===i?"border-klasse-gold bg-klasse-gold/10 ring-1 ring-klasse-gold/25":"border-border bg-card")}>
    {node.kind==="token"?(allSymbols.find(s=>s[1]===node.value)?.[0]??mathNodeLabel(node)):node.kind==="script"?<span>{node.symbol==="^"?"xⁿ":"xₙ"} <span className="text-xs">{mathNodeLabel(node)}</span></span>:<MathPreview source={serializeMath([node])}/>}
   </button>)}
   {list.length===0&&<p className="py-2 text-sm text-muted-foreground">Nenhum elemento. Adicione um número, símbolo ou estrutura.</p>}
  </div>
  {selected&&selection!==null&&<div className="space-y-2 rounded-xl border border-border p-3">
   <p className="text-sm font-medium">{mathNodeLabel(selected)}</p>
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
  {!picker&&<div className="grid grid-cols-2 gap-2">
   <Button type="button" variant="outline" disabled={disabled} onClick={()=>openPicker("numbers","end")}><Plus/> Número / variável</Button>
   <Button type="button" variant="outline" disabled={disabled} onClick={()=>openPicker("symbols","end")}><Plus/> Operador / símbolo</Button>
   <Button type="button" variant="outline" disabled={disabled} onClick={()=>openPicker("structures","end")}><Plus/> Estrutura</Button>
   <Button type="button" variant="outline" disabled={disabled} onClick={()=>openPicker("models","end")}><Plus/> Modelo</Button>
  </div>}
  {picker&&<div className="space-y-3 rounded-xl border border-border p-3">
   <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{position==="replace"?"Substituir elemento":position==="before"?"Inserir antes":position==="after"?"Inserir depois":"Adicionar elemento"}</p><Button type="button" variant="ghost" size="sm" onClick={()=>setPicker(null)}>Cancelar selecção</Button></div>
   <div className="flex flex-wrap gap-1">{([["numbers","Número / variável"],["symbols","Símbolo"],["structures","Estrutura"],["models","Modelo"]] as const).map(([key,name])=><Button key={key} type="button" size="sm" variant={picker===key?"secondary":"ghost"} onClick={()=>setPicker(key)} disabled={disabled}>{name}</Button>)}</div>
   {picker==="numbers"?<div className="flex items-end gap-2"><label className="min-w-0 flex-1 text-xs font-medium">Valor ou variável<input aria-label="Valor ou variável" className={fieldStyle} inputMode="text" autoCapitalize="off" autoComplete="off" spellCheck={false} maxLength={16} value={atom} onChange={e=>setAtom(e.target.value)} disabled={disabled}/></label><Button type="button" tone="gold" disabled={disabled||!validMathToken(atom.replace(",","."))} onClick={()=>add([tokenNode(atom.replace(",","."))])}>Aplicar</Button></div>:picker==="symbols"?<div className="grid grid-cols-5 gap-1">{allSymbols.map(([display,value])=><button key={value} type="button" aria-label={"Símbolo "+display} className="min-h-11 rounded-xl border border-border bg-background text-base focus-visible:ring-4 focus-visible:ring-klasse-gold/20" disabled={disabled} onClick={()=>add([tokenNode(value)])}>{display}</button>)}</div>:picker==="structures"?<div className="grid grid-cols-2 gap-2">{structures.map(s=><button key={s.name} type="button" disabled={disabled} onClick={()=>add(s.nodes())} className="flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-border p-2"><MathPreview source={s.sample}/><span className="text-xs">{s.name}</span></button>)}</div>:<><label className="grid gap-1 text-xs">Categoria<select className={fieldStyle} value={category} onChange={e=>setCategory(e.target.value as FormulaCategory)}>{formulaCategories.map(c=><option key={c}>{c}</option>)}</select></label><div className="grid grid-cols-2 gap-2">{formulaModels.filter(m=>m.category===category).map(m=><button key={m.id} type="button" disabled={disabled} onClick={()=>{const nodes=modelMathTree(m.id);if(nodes)add(nodes);else setError("Modelo não suportado nesta estrutura.");}} className="flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-border p-2"><MathPreview source={m.sample}/><span className="text-xs">{m.label}</span></button>)}</div></>}
  </div>}
  <div className="sticky bottom-0 z-10 space-y-2 border-t border-border bg-card pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 group-data-[keyboard-open=true]/modal:static">
   {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
   {!valid&&<p className="text-xs text-muted-foreground">Complete as partes em falta para inserir a expressão.</p>}
   <p className="text-xs text-muted-foreground">{source.length} / {AST_LIMITS.characters} caracteres</p>
   <Button type="button" tone="gold" className="w-full" disabled={disabled||!valid||picker!==null} onClick={()=>{if(valid)onInsert(valid);}}>{label}</Button>
  </div>
 </section>;
}
