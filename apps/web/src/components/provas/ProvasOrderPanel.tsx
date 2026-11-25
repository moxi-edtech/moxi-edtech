"use client";
import { useState } from "react";
import { DndContext,DragOverlay,PointerSensor,useSensor,useSensors,useDraggable,useDroppable,closestCenter,type DragEndEvent } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { tipos,type Bloco } from "@/lib/provas/schema";

function excerpt(block:Bloco){
 const normalized=block.texto.replace(/\s+/g," ").trim();
 const chars=Array.from(normalized);
 return chars.length>64?chars.slice(0,64).join("")+"…":normalized||"Sem enunciado";
}
function Row({block,rowId,index,total,disabled,onMove}:{block:Bloco;rowId:number;index:number;total:number;disabled:boolean;onMove:(from:number,to:number)=>void}){
 const {setNodeRef:setDragRef,attributes,listeners,isDragging}=useDraggable({id:"drag-"+rowId,data:{index},disabled});
 const {setNodeRef:setDropRef,isOver}=useDroppable({id:"drop-"+rowId,data:{index},disabled});
 return <li ref={setDropRef} data-testid={"prova-order-row-"+index} className={"flex min-w-0 items-center gap-2 rounded-xl border bg-card p-2 sm:gap-3 sm:p-3 "+(isOver?"border-klasse-gold ring-1 ring-klasse-gold/25":"border-border")+(isDragging?" opacity-40":"")}>
  <button ref={setDragRef} type="button" {...listeners} {...attributes} aria-label={"Arrastar bloco "+(index+1)} disabled={disabled} className="flex min-h-11 w-11 shrink-0 touch-none cursor-grab items-center justify-center rounded-xl text-muted-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 active:cursor-grabbing disabled:opacity-50"><GripVertical className="size-5"/></button>
  <span className="w-7 shrink-0 text-center text-sm font-semibold tabular-nums text-klasse-green dark:text-foreground">{index+1}</span>
  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{excerpt(block)}</p><p className="truncate text-xs text-muted-foreground">{tipos[block.tipo]}</p></div>
  <label className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"><span className="hidden sm:inline">Posição</span><select key={index} aria-label={"Posição do bloco "+(index+1)} defaultValue={String(index)} disabled={disabled} className="min-h-11 w-14 rounded-xl border border-border bg-background px-1 text-sm focus:outline-none focus:ring-4 focus:ring-klasse-gold/20" onChange={e=>{const target=Number(e.currentTarget.value);if(target!==index)onMove(index,target);}}>{Array.from({length:total},(_,i)=><option key={i} value={String(i)}>{i+1}</option>)}</select></label>
 </li>;
}
export default function ProvasOrderPanel({blocks,disabled,onMove}:{blocks:readonly Bloco[];disabled:boolean;onMove:(from:number,to:number)=>void}){
 // Preserve block and DnD identity across moves. Remount only the native select
 // when its position changes: WebKit can retain a stale selection on a moved node.
 // Its initial value is the actual position, not a disabled placeholder.
 const [rowKeys]=useState(()=>new Map(blocks.map((block,index)=>[block,index])));
 const [dragIndex,setDragIndex]=useState<number|null>(null);
 const [announcement,setAnnouncement]=useState("");
 const sensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:6}}));
 function move(from:number,to:number){
  if(disabled||from===to||!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=blocks.length||to>=blocks.length)return;
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
  <DndContext id="provas-order" sensors={sensors} collisionDetection={closestCenter} onDragStart={e=>setDragIndex(typeof e.active.data.current?.index==="number"?e.active.data.current.index:null)} onDragEnd={finish} onDragCancel={()=>setDragIndex(null)}>
   <ol aria-label="Ordem dos blocos" className="min-w-0 space-y-2">{blocks.map((block,index)=><Row key={rowKeys.get(block)??index} rowId={rowKeys.get(block)??index} block={block} index={index} total={blocks.length} disabled={disabled||blocks.length<2} onMove={move}/>)}</ol>
   <DragOverlay dropAnimation={null}>{dragIndex!==null&&blocks[dragIndex]?<div className="max-w-[280px] truncate rounded-xl border border-klasse-gold bg-card p-3 text-sm font-medium shadow-sm">{excerpt(blocks[dragIndex])}</div>:null}</DragOverlay>
  </DndContext>
  <p role="status" className="sr-only">{announcement}</p>
 </section>;
}
