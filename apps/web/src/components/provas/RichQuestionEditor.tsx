"use client";
import { useEffect,useRef,useState } from "react";
import dynamic from "next/dynamic";
import { EditorContent,Node,NodeViewWrapper,ReactNodeViewRenderer,useEditor,useEditorState,type JSONContent,type NodeViewProps } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold,Italic,Underline,Sigma,Check,Undo2,Redo2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { richText,type RichDocument,type RichSegment } from "@/lib/provas/rich";
import { mathMarkup } from "@/lib/provas/math";
import type { Bloco } from "@/lib/provas/schema";
const FormulaInput=dynamic(()=>import("./FormulaInput"),{ssr:false,loading:()=> <p role="status" className="text-sm text-muted-foreground">A carregar editor matemático...</p>});

function FormulaView({node,selected}:NodeViewProps){
 const latex=String(node.attrs.latex??"");
 const html=mathMarkup(latex);
 return <NodeViewWrapper as="span" contentEditable={false} className={"inline-block max-w-full overflow-x-auto rounded-xl px-1 align-middle "+(selected?"ring-2 ring-klasse-gold":"")}>
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
export default function RichQuestionEditor({block,onChange,onDone,disabled,label}:{block:Bloco;onChange:(patch:Partial<Bloco>)=>void;onDone:()=>void;disabled:boolean;label:string}){
 const changeRef=useRef(onChange);
 useEffect(()=>{changeRef.current=onChange;},[onChange]);
 const [formula,setFormula]=useState<{latex:string;from:number;to:number}|null>(null);
 const editor=useEditor({
  immediatelyRender:false,extensions:[StarterKit.configure({blockquote:false,bulletList:false,orderedList:false,listItem:false,heading:false,codeBlock:false,code:false,strike:false,link:false,horizontalRule:false,trailingNode:false}),FormulaNode],
  content:toEditor(block),
  editorProps:{attributes:{"aria-label":label,role:"textbox","aria-multiline":"true",class:"min-h-32 min-w-0 max-w-full break-words px-3 py-3 text-base leading-relaxed outline-none whitespace-pre-wrap sm:text-sm"}},
  onUpdate:({editor})=>{const rich=fromEditor(editor.getJSON());changeRef.current({texto:richText(rich),rich:rich.segments.length?rich:undefined});}
 });
 const state=useEditorState({editor,selector:({editor:e})=>({bold:e?.isActive("bold")??false,italic:e?.isActive("italic")??false,underline:e?.isActive("underline")??false,formula:e?.isActive("formula")??false})});
 useEffect(()=>{editor?.setEditable(!disabled&&!formula,false);},[editor,disabled,formula]);
 if(!editor)return <p role="status" className="text-sm text-muted-foreground">A carregar editor...</p>;
 const blocked=disabled||Boolean(formula);
 function openFormula(){
  if(!editor)return;
  const {from,to}=editor.state.selection;
  setFormula({latex:editor.isActive("formula")?String(editor.getAttributes("formula").latex??""):"",from,to});
 }
 return <div className="min-w-0 space-y-3 [&_button]:max-sm:min-h-11 [&_button]:max-sm:whitespace-normal">
  <div className="min-w-0 overflow-hidden rounded-xl border border-border focus-within:ring-4 focus-within:ring-klasse-gold/20">
   <div role="group" aria-label="Formatação do enunciado" className="grid grid-cols-2 gap-1 border-b border-border bg-muted/30 p-2 sm:flex sm:flex-wrap">
    <Button type="button" size="sm" variant={state?.bold?"secondary":"ghost"} aria-pressed={state?.bold} disabled={blocked} onClick={()=>editor.chain().focus().toggleBold().run()}><Bold/> Negrito</Button>
    <Button type="button" size="sm" variant={state?.italic?"secondary":"ghost"} aria-pressed={state?.italic} disabled={blocked} onClick={()=>editor.chain().focus().toggleItalic().run()}><Italic/> Itálico</Button>
    <Button type="button" size="sm" variant={state?.underline?"secondary":"ghost"} aria-pressed={state?.underline} disabled={blocked} onClick={()=>editor.chain().focus().toggleUnderline().run()}><Underline/> Sublinhado</Button>
    <Button type="button" size="sm" variant="ghost" disabled={blocked} onClick={openFormula}><Sigma/> {state?.formula?"Editar fórmula":"Fórmula"}</Button>
    <Button type="button" size="sm" variant="ghost" disabled={blocked} onClick={()=>editor.chain().focus().undo().run()}><Undo2/> Desfazer</Button>
    <Button type="button" size="sm" variant="ghost" disabled={blocked} onClick={()=>editor.chain().focus().redo().run()}><Redo2/> Refazer</Button>
   </div>
   <EditorContent editor={editor}/>
  </div>
  {formula&&<FormulaInput initial={formula.latex} onCancel={()=>{setFormula(null);editor.setEditable(!disabled,false);editor.commands.focus();}} onInsert={latex=>{
    if(disabled)return;
    editor.setEditable(true,false);
    editor.chain().focus().insertContentAt({from:formula.from,to:formula.to},{type:"formula",attrs:{latex}}).run();
    setFormula(null);
  }}/>}
  <div className="flex justify-end"><Button type="button" className="w-full sm:w-auto" variant="outline" size="sm" disabled={blocked} onClick={onDone}><Check/> Concluir edição</Button></div>
 </div>;
}
