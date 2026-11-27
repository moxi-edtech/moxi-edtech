"use client";
import { useEffect,useRef,useState } from "react";
import dynamic from "next/dynamic";
import { EditorContent,Node,NodeViewWrapper,ReactNodeViewRenderer,useEditor,useEditorState,type JSONContent,type NodeViewProps } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold,Italic,Underline,Sigma,Check,Undo2,Redo2,SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { richText,type RichDocument,type RichSegment } from "@/lib/provas/rich";
import { mathMarkup } from "@/lib/provas/math";
import type { Bloco } from "@/lib/provas/schema";
const FormulaInput=dynamic(()=>import("./FormulaInput"),{ssr:false,loading:()=> <p role="status" className="text-sm text-muted-foreground">A carregar editor matemático...</p>});

function FormulaView({node,selected,editor,getPos}:NodeViewProps){
 const latex=String(node.attrs.latex??"");
 const html=mathMarkup(latex);
 return <NodeViewWrapper as="span" contentEditable={false}
  onMouseDown={event=>{if(!editor.isEditable||event.button!==0)return;event.preventDefault();event.stopPropagation();}}
  onClick={event=>{if(!editor.isEditable)return;event.stopPropagation();const pos=getPos();if(typeof pos==="number")editor.commands.setNodeSelection(pos);}} className={"inline-block max-w-full cursor-pointer overflow-x-auto rounded-xl px-1 align-middle "+(selected?"ring-2 ring-primary":"")}>
  {html?<span aria-label={latex} dangerouslySetInnerHTML={{__html:html}}/>:<span>{latex}</span>}
 </NodeViewWrapper>;
}
const FormulaNode=Node.create({
 name:"formula",group:"inline",inline:true,atom:true,selectable:true,
 addAttributes(){return {latex:{default:""}};},
 parseHTML(){return [];},
 renderHTML({node}){return ["span",{"data-prova-formula":""},String(node.attrs.latex??"")];},
 addNodeView(){return ReactNodeViewRenderer(FormulaView);}
});
const markNames=["bold","italic","underline"] as const;
function toEditor(block:Bloco):JSONContent{
 const segments:RichSegment[]=block.rich?.segments??block.texto.split("\n").flatMap((text,index)=>[...(index?[{kind:"break" as const}]:[]),...(text?[{kind:"text" as const,text,marks:[]}]:[])]);
 const content:JSONContent[]=[{type:"paragraph",content:[]}];
 for(const s of segments){
  if(s.kind==="break"){content.push({type:"paragraph",content:[]});continue;}
  const p=content[content.length-1].content!;
  if(s.kind==="math")p.push({type:"formula",attrs:{latex:s.latex}});
  else p.push({type:"text",text:s.text,marks:s.marks.map(type=>({type}))});
 }
 return {type:"doc",content};
}
function fromEditor(doc:JSONContent):RichDocument{
 const segments:RichSegment[]=[];
 for(const [i,p] of (doc.content??[]).entries()){
  if(i>0)segments.push({kind:"break"});
  for(const n of p.content??[]){
   if(n.type==="formula")segments.push({kind:"math",latex:String(n.attrs?.latex??"")});
   else if(n.type==="hardBreak")segments.push({kind:"break"});
   else if(n.type==="text"&&n.text)segments.push({kind:"text",text:n.text,marks:markNames.filter(mark=>n.marks?.some(m=>m.type===mark))});
  }
 }
 return {version:1,segments};
}
export default function RichQuestionEditor({block,onChange,onDone,disabled,label,startWithFormula=false}:{block:Bloco;onChange:(patch:Partial<Bloco>)=>void;onDone:()=>void;disabled:boolean;label:string;startWithFormula?:boolean}){
 const changeRef=useRef(onChange);
 useEffect(()=>{changeRef.current=onChange;},[onChange]);
 const [formula,setFormula]=useState<{latex:string;from:number;to:number}|null>(null);
 const [formattingOpen,setFormattingOpen]=useState(false);
 const surface=useRef<HTMLDivElement>(null);
 const editor=useEditor({
  immediatelyRender:false,extensions:[StarterKit.configure({blockquote:false,bulletList:false,orderedList:false,listItem:false,heading:false,codeBlock:false,code:false,strike:false,link:false,horizontalRule:false,trailingNode:false}),FormulaNode],
  content:toEditor(block),
  editorProps:{attributes:{"aria-label":label,role:"textbox","aria-multiline":"true",class:"min-h-32 min-w-0 max-w-full break-words px-3 py-3 text-base leading-relaxed outline-none whitespace-pre-wrap sm:text-sm"}},
  onCreate:({editor})=>{if(startWithFormula){const pos=editor.state.doc.content.size-1;editor.commands.setTextSelection(pos);setFormula({latex:"",from:pos,to:pos});}},
  onUpdate:({editor})=>{const rich=fromEditor(editor.getJSON());changeRef.current({texto:richText(rich),rich:rich.segments.length?rich:undefined});}
 });
 const state=useEditorState({editor,selector:({editor:e})=>({bold:e?.isActive("bold")??false,italic:e?.isActive("italic")??false,underline:e?.isActive("underline")??false,formula:((selection,node)=>Boolean(node?.type.name==="formula"&&selection&&selection.to-selection.from===node.nodeSize))(e?.state.selection,e?.state.doc.nodeAt(e.state.selection.from))})});
 useEffect(()=>{editor?.setEditable(!disabled&&!formula,false);},[editor,disabled,formula]);
 useEffect(()=>{if(editor){const scroll=surface.current?.closest<HTMLElement>("[data-modal-scroll]");if(scroll)scroll.scrollTop=0;}},[editor,formula]);
 if(!editor)return <p role="status" className="text-sm text-muted-foreground">A carregar editor...</p>;
 const blocked=disabled||Boolean(formula);
 function openFormula(){
  if(!editor)return;
  const {from,to}=editor.state.selection;
  const selectedNode=editor.state.doc.nodeAt(from);
  const latex=selectedNode?.type.name==="formula"&&to-from===selectedNode.nodeSize?String(selectedNode.attrs.latex??""):"";
  editor.commands.blur();setFormula({latex,from,to});
 }
 const returnFocus=()=>requestAnimationFrame(()=>{
  // Do not steal focus from a subsequent interaction with the question.
  const active=document.activeElement;
  if(active&&active!==document.body&&active.isConnected)return;
  surface.current?.querySelector<HTMLButtonElement>("#provas-formula-trigger")?.focus({preventScroll:true});
 });
 function cancelFormula(){
  if(!formula)return;
  editor.setEditable(!disabled,false);
  // Blur/hiding the contenteditable can collapse a DOM selection. Restore the
  // original atomic node selection explicitly before returning to the toolbar.
  const node=editor.state.doc.nodeAt(formula.from);
  if(formula.latex&&node?.type.name==="formula"&&formula.to-formula.from===node.nodeSize&&node.attrs.latex===formula.latex){
   editor.commands.setNodeSelection(formula.from);
  }else if(formula.from>=0&&formula.to<=editor.state.doc.content.size){
   editor.commands.setTextSelection({from:formula.from,to:formula.to});
  }
  setFormula(null);returnFocus();
 }
 return <div ref={surface} className="min-w-0 space-y-3 [&_button]:max-sm:min-h-11 [&_button]:max-sm:whitespace-normal">
  <div className={"flex min-w-0 flex-col overflow-hidden rounded-xl border border-border focus-within:ring-4 focus-within:ring-klasse-gold/20 "+(formula?"hidden":"")}>
   <div className="order-first sm:order-last"><EditorContent editor={editor}/></div>
   <div role="group" aria-label="Formatação do enunciado" className="flex flex-wrap items-center gap-1 border-t border-border bg-muted/30 p-1.5 sm:order-first sm:border-b sm:border-t-0 sm:p-2">
    <Button id="provas-formula-trigger" type="button" size="sm" variant="outline" disabled={blocked} onPointerDown={e=>e.preventDefault()} onClick={openFormula}><Sigma/> {state?.formula?"Editar fórmula":"Fórmula"}</Button>
    <Button type="button" size="sm" variant="ghost" className="sm:hidden" aria-expanded={formattingOpen} aria-controls="provas-rich-formatting" disabled={blocked} onPointerDown={e=>e.preventDefault()} onClick={()=>setFormattingOpen(v=>!v)}><SlidersHorizontal/> Formatação</Button>
    <div id="provas-rich-formatting" className={(formattingOpen?"flex":"hidden sm:flex")+" w-full flex-wrap items-center gap-1 sm:w-auto"}>
     <Button type="button" size="sm" variant={state?.bold?"secondary":"ghost"} aria-label="Negrito" aria-pressed={state?.bold} disabled={blocked} onPointerDown={e=>e.preventDefault()} onClick={()=>editor.chain().focus().toggleBold().run()}><Bold/><span className="hidden sm:inline">Negrito</span></Button>
     <Button type="button" size="sm" variant={state?.italic?"secondary":"ghost"} aria-label="Itálico" aria-pressed={state?.italic} disabled={blocked} onPointerDown={e=>e.preventDefault()} onClick={()=>editor.chain().focus().toggleItalic().run()}><Italic/><span className="hidden sm:inline">Itálico</span></Button>
     <Button type="button" size="sm" variant={state?.underline?"secondary":"ghost"} aria-label="Sublinhado" aria-pressed={state?.underline} disabled={blocked} onPointerDown={e=>e.preventDefault()} onClick={()=>editor.chain().focus().toggleUnderline().run()}><Underline/><span className="hidden sm:inline">Sublinhado</span></Button>
     <Button type="button" size="sm" variant="ghost" aria-label="Desfazer" disabled={blocked} onPointerDown={e=>e.preventDefault()} onClick={()=>editor.chain().focus().undo().run()}><Undo2/><span className="hidden sm:inline">Desfazer</span></Button>
     <Button type="button" size="sm" variant="ghost" aria-label="Refazer" disabled={blocked} onPointerDown={e=>e.preventDefault()} onClick={()=>editor.chain().focus().redo().run()}><Redo2/><span className="hidden sm:inline">Refazer</span></Button>
    </div>
   </div>
  </div>
  {formula&&<FormulaInput initial={formula.latex} disabled={disabled} onCancel={cancelFormula} onInsert={latex=>{
    if(disabled)return;
    editor.setEditable(true,false);
    if(!editor.chain().insertContentAt({from:formula.from,to:formula.to},{type:"formula",attrs:{latex}}).run()){editor.setEditable(false,false);return;}
    setFormula(null);returnFocus();
  }}/>}
  {!formula&&<div className="flex justify-end border-t border-border bg-card pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2"><Button type="button" className="w-full sm:w-auto" tone="gold" disabled={blocked} onClick={onDone}><Check/> Concluir edição</Button></div>}
 </div>;
}
