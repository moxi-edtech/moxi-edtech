"use client";
import { useRef,useState } from "react";
import { DndContext,DragOverlay,PointerSensor,useSensor,useSensors,useDraggable,useDroppable,closestCenter,type DragEndEvent } from "@dnd-kit/core";
import { GripVertical,ChevronDown } from "lucide-react";
import { tipos,type Bloco } from "@/lib/provas/schema";

function excerpt(block:Bloco){
 const normalized=block.texto.replace(/\s+/g," ").trim();
 const chars=Array.from(normalized);
 return chars.length>64?chars.slice(0,64).join("")+"…":normalized||"Sem enunciado";
}
function Row({block,rowId,index,total,disabled,expanded,onToggle,onMove}:{block:Bloco;rowId:number;index:number;total:number;disabled:boolean;expanded:boolean;onToggle:()=>void;onMove:(from:number,to:number)=>void}){
 const positionButton=useRef<HTMLButtonElement>(null);
 const positionsId="prova-order-positions-"+rowId;
 const {setNodeRef:setDragRef,attributes,listeners,isDragging}=useDraggable({id:"drag-"+rowId,data:{index},disabled});
 const {setNodeRef:setDropRef,isOver}=useDroppable({id:"drop-"+rowId,data:{index},disabled});
 return <li ref={setDropRef} data-testid={"prova-order-row-"+index} className={"flex min-w-0 flex-wrap items-center gap-2 rounded-xl border bg-card p-2 sm:gap-3 sm:p-3 "+(isOver?"border-klasse-gold ring-1 ring-klasse-gold/25":"border-border")+(isDragging?" opacity-40":"")}>
  <button ref={setDragRef} type="button" {...listeners} {...attributes} aria-label={"Arrastar bloco "+(index+1)} disabled={disabled} className="flex min-h-11 w-11 shrink-0 touch-none cursor-grab items-center justify-center rounded-xl text-muted-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 active:cursor-grabbing disabled:opacity-50"><GripVertical className="size-5"/></button>
  <span className="w-7 shrink-0 text-center text-sm font-semibold tabular-nums text-klasse-green dark:text-foreground">{index+1}</span>
  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{excerpt(block)}</p><p className="truncate text-xs text-muted-foreground">{tipos[block.tipo]}</p></div>
  <button ref={positionButton} type="button" aria-label={"Posição do bloco "+(index+1)} aria-expanded={expanded} aria-controls={expanded?positionsId:undefined} disabled={disabled} onClick={onToggle} className="flex min-h-11 min-w-14 shrink-0 items-center justify-center gap-1 rounded-xl border border-border bg-background px-2 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 disabled:opacity-50"><span>{index+1}</span><ChevronDown className="size-4"/></button>
  {expanded&&<div id={positionsId} role="group" aria-label={"Mover bloco "+(index+1)+" para a posição"} className="w-full basis-full space-y-2 border-t border-border pt-2" onKeyDown={e=>{if(e.key==="Escape"){e.stopPropagation();onToggle();positionButton.current?.focus();}}}>
   <p className="text-xs text-muted-foreground">Mover para a posição</p>
   <div className="grid max-h-48 grid-cols-4 gap-1.5 overflow-y-auto sm:grid-cols-8">{Array.from({length:total},(_,i)=><button key={i} type="button" aria-label={"Mover para posição "+(i+1)} aria-current={i===index?"true":undefined} disabled={disabled||i===index} onClick={()=>{onMove(index,i);positionButton.current?.focus();}} className={"min-h-11 rounded-xl border text-sm tabular-nums focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 "+(i===index?"border-klasse-gold bg-klasse-gold/10 text-klasse-green":"border-border hover:bg-muted")}>{i+1}</button>)}</div>
  </div>}
 </li>;
}
export default function ProvasOrderPanel({blocks,disabled,onMove}:{blocks:readonly Bloco[];disabled:boolean;onMove:(from:number,to:number)=>void}){
 // Stable block identity for React and drag-and-drop. Explicit destination buttons
 // avoid native select event/state inconsistencies on touch browsers.
 const [rowKeys]=useState(()=>new Map(blocks.map((block,index)=>[block,index])));
 const [expandedRow,setExpandedRow]=useState<number|null>(null);
 const [dragIndex,setDragIndex]=useState<number|null>(null);
 const [announcement,setAnnouncement]=useState("");
 const sensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:6}}));
 function move(from:number,to:number){
  if(disabled||from===to||!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=blocks.length||to>=blocks.length)return;
  setExpandedRow(null);
  onMove(from,to);
  setAnnouncement("Bloco "+(from+1)+" movido para a posição "+(to+1)+".");
 }
 function finish(event:DragEndEvent){
  setDragIndex(null);
  const from=event.active.data.current?.index,to=event.over?.data.current?.index;
  if(typeof from==="number"&&typeof to==="number")move(from,to);
 }
 return <section className="min-w-0 space-y-3" aria-label="Organizar perguntas">
  <div><h3 className="text-base font-semibold text-klasse-green dark:text-foreground">Organizar perguntas</h3><p className="text-sm text-muted-foreground">Arraste para alterar a ordem ou escolha a posição.</p></div>
  {blocks.some(b=>b.tipo==="grupo"||b.tipo==="texto"||b.tipo==="alinea")&&<p className="text-xs text-muted-foreground">Grupos, textos de apoio e alíneas também podem ser movidos. Confira a sequência na pré-visualização.</p>}
  <DndContext id="provas-order" sensors={sensors} collisionDetection={closestCenter} onDragStart={e=>{setExpandedRow(null);setDragIndex(typeof e.active.data.current?.index==="number"?e.active.data.current.index:null);}} onDragEnd={finish} onDragCancel={()=>setDragIndex(null)}>
   <ol aria-label="Ordem dos blocos" className="min-w-0 space-y-2">{blocks.map((block,index)=><Row key={rowKeys.get(block)??index} rowId={rowKeys.get(block)??index} block={block} index={index} total={blocks.length} disabled={disabled||blocks.length<2} expanded={expandedRow===(rowKeys.get(block)??index)} onToggle={()=>setExpandedRow(v=>v===(rowKeys.get(block)??index)?null:(rowKeys.get(block)??index))} onMove={move}/>)}</ol>
   <DragOverlay dropAnimation={null}>{dragIndex!==null&&blocks[dragIndex]?<div className="max-w-[280px] truncate rounded-xl border border-klasse-gold bg-card p-3 text-sm font-medium shadow-sm">{excerpt(blocks[dragIndex])}</div>:null}</DragOverlay>
  </DndContext>
  <p role="status" className="sr-only">{announcement}</p>
 </section>;
}
