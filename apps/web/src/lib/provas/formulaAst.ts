import { safeLatex } from "./rich";
import { mathMarkup } from "./math";
import { formulaModels,modelExpression,type FormulaModelId } from "./formulaModels";

export type MathNode =
 | {kind:"token";value:string}
 | {kind:"group";open:"("|"["|"{";body:MathNode[]}
 | {kind:"fraction";command:"\\frac"|"\\dfrac"|"\\tfrac";numerator:MathNode[];denominator:MathNode[]}
 | {kind:"root";index?:MathNode[];body:MathNode[]}
 | {kind:"script";symbol:"^"|"_";body:MathNode[];braced:boolean};
export type MathSlot="body"|"numerator"|"denominator"|"index";
export type MathPath=readonly {index:number;slot:MathSlot}[];
export const AST_LIMITS={depth:8,nodes:160,characters:300} as const;
const closing={"(":")","[":"]","{":"}"} as const;
const forbiddenCommands=new Set(["\\text","\\mathrm","\\mathbf","\\mathit","\\left","\\right","\\vec","\\overline","\\underline","\\hat","\\bar"]);
const tokenPattern=/^(?:\\[A-Za-z]+|\\[,;! ]|\d+(?:\.\d+)?|\.\d+|[A-Za-z]|[+\-=*/.,:;|!′°→≤≥≠×÷±∞]| +)$/u;
export function tokenNode(value:string):MathNode{return {kind:"token",value};}
export function mathSlots(node:MathNode):{key:MathSlot;label:string;nodes:MathNode[]}[]{
 switch(node.kind){
  case "fraction":return [{key:"numerator",label:"Numerador",nodes:node.numerator},{key:"denominator",label:"Denominador",nodes:node.denominator}];
  case "root":return [...(node.index?[{key:"index" as const,label:"Índice da raiz",nodes:node.index}]:[]),{key:"body",label:"Radicando",nodes:node.body}];
  case "script":return [{key:"body",label:node.symbol==="^"?"Expoente":"Índice",nodes:node.body}];
  case "group":return [{key:"body",label:node.open==="("?"Parênteses":node.open==="["?"Colchetes":"Expressão interna",nodes:node.body}];
  default:return [];
 }
}
export function serializeMath(nodes:readonly MathNode[]):string{
 let out="";
 for(const n of nodes){
  const value=n.kind==="token"?n.value:n.kind==="group"?n.open+serializeMath(n.body)+closing[n.open]:n.kind==="fraction"?n.command+"{"+serializeMath(n.numerator)+"}{"+serializeMath(n.denominator)+"}":n.kind==="root"?"\\sqrt"+(n.index?"["+serializeMath(n.index)+"]":"")+"{"+serializeMath(n.body)+"}":n.symbol+(n.braced?"{"+serializeMath(n.body)+"}":serializeMath(n.body));
  // A newly adjacent alphabetic token must not extend a TeX command name.
  if(/\\[A-Za-z]+$/.test(out)&&/^[A-Za-z]/.test(value))out+=" ";
  out+=value;
 }
 return out;
}
export function mathTreeValid(nodes:readonly MathNode[],allowEmpty=false):boolean{
 let count=0;
 function walk(list:readonly MathNode[],depth:number):boolean{
  if(depth>AST_LIMITS.depth||(!allowEmpty&&!list.length))return false;
  for(const n of list){
   if(++count>AST_LIMITS.nodes)return false;
   if(n.kind==="token"&&(!tokenPattern.test(n.value)||forbiddenCommands.has(n.value)))return false;
   if(n.kind==="script"&&!n.braced&&(n.body.length!==1||n.body[0].kind!=="token"||!/^[A-Za-z0-9]$/.test(n.body[0].value)))return false;
   for(const slot of mathSlots(n))if(!walk(slot.nodes,depth+1))return false;
  }
  return true;
 }
 return walk(nodes,0)&&serializeMath(nodes).length<=AST_LIMITS.characters;
}
export function validMathExpression(nodes:readonly MathNode[]):string|null{
 if(!mathTreeValid(nodes))return null;
 const latex=serializeMath(nodes);
 // A script must have a base; reject empty required arguments and dangling
 // binary operators, except a final equality reserved for the pupil.
 if(/(?:^|[({[])[\^_]/.test(latex)||/\\(?:frac|dfrac|tfrac|sqrt)\s*\{\s*\}/.test(latex)||/[+\-*/]$/.test(latex)||/\\(?:times|div|pm|leq|geq|neq)\s*$/.test(latex))return null;
 return safeLatex(latex)&&mathMarkup(latex)?latex:null;
}
/** Parse only the supported structural grammar. Unsupported legacy TeX stays unchanged. */
export function parseMath(source:string):MathNode[]|null{
 if(!safeLatex(source)||!mathMarkup(source))return null;
 let pos=0,count=0;
 function takeGroup(open:"("|"["|"{",depth:number):MathNode[]{
  if(source[pos]!==open)throw Error("group");
  pos++;
  const body=sequence(closing[open],depth+1);
  if(source[pos]!==closing[open])throw Error("close");
  pos++;return body;
 }
 function sequence(stop:string,depth:number):MathNode[]{
  if(depth>AST_LIMITS.depth)throw Error("depth");
  const nodes:MathNode[]=[];
  while(pos<source.length&&source[pos]!==stop){
   if(++count>AST_LIMITS.nodes)throw Error("size");
   const c=source[pos];
   if(c==="("||c==="["||c==="{"){nodes.push({kind:"group",open:c,body:takeGroup(c,depth)});continue;}
   if(c===")"||c==="]"||c==="}")throw Error("unexpected close");
   if(c==="^"||c==="_"){
    pos++;
    if(source[pos]==="{")nodes.push({kind:"script",symbol:c,body:takeGroup("{",depth),braced:true});
    else if(/^[A-Za-z0-9]$/.test(source[pos]??""))nodes.push({kind:"script",symbol:c,body:[tokenNode(source[pos++])],braced:false});
    else throw Error("script");
    continue;
   }
   const lexeme=source.slice(pos).match(/^(?:\\[A-Za-z]+|\\[,;! ]|\d+(?:\.\d+)?|\.\d+|[A-Za-z]|[+\-=*/.,:;|!′°→≤≥≠×÷±∞]| +)/u)?.[0];
   if(!lexeme||forbiddenCommands.has(lexeme))throw Error("token");
   pos+=lexeme.length;
   if(lexeme==="\\frac"||lexeme==="\\dfrac"||lexeme==="\\tfrac"){
    nodes.push({kind:"fraction",command:lexeme,numerator:takeGroup("{",depth),denominator:takeGroup("{",depth)});
   }else if(lexeme==="\\sqrt"){
    const index=source[pos]==="["?takeGroup("[",depth):undefined;
    nodes.push({kind:"root",index,body:takeGroup("{",depth)});
   }else nodes.push(tokenNode(lexeme));
  }
  return nodes;
 }
 try{const nodes=sequence("",0);return pos===source.length&&mathTreeValid(nodes)&&serializeMath(nodes)===source?nodes:null;}catch{return null;}
}
export function modelMathTree(id:FormulaModelId):MathNode[]|null{
 const model=formulaModels.find(m=>m.id===id);
 if(!model)return null;
 const value=modelExpression(id,model.fields.map(f=>f.example));
 return value?parseMath(value):null;
}
export function mathAt(nodes:MathNode[],path:MathPath):MathNode[]|null{
 let list=nodes;
 for(const step of path){const n=list[step.index];const slot=n&&mathSlots(n).find(s=>s.key===step.slot);if(!slot)return null;list=slot.nodes;}
 return list;
}
export function replaceMathAt(nodes:MathNode[],path:MathPath,replacement:MathNode[]):MathNode[]|null{
 if(!path.length)return replacement;
 const [step,...rest]=path,n=nodes[step.index],slot=n&&mathSlots(n).find(s=>s.key===step.slot);
 if(!slot)return null;
 const value=replaceMathAt(slot.nodes,rest,replacement);if(!value)return null;
 return nodes.map((item,i)=>i===step.index?{...item,[step.slot]:value,...(item.kind==="script"?{braced:true}:{})}:item);
}
export function mathNodeLabel(node:MathNode):string{
 switch(node.kind){
  case "fraction":return "Fracção";
  case "root":return "Raiz";
  case "script":return node.symbol==="^"?"Expoente":"Índice";
  case "group":return node.open==="("?"Parênteses":node.open==="["?"Colchetes":"Grupo interno";
  default:return /^\s+$/.test(node.value)?"Espaço":node.value==="\\,"?"Espaço fino":node.value;
 }
}
export const mathSymbols=[["+", "+"],["−","-"],["×","\\times"],["÷","\\div"],["=","="],["±","\\pm"],["≤","\\leq"],["≥","\\geq"],["≠","\\neq"],["·","\\cdot"],["π","\\pi"],["∞","\\infty"],["sin","\\sin"],["cos","\\cos"],["tan","\\tan"],["log","\\log"],["ln","\\ln"],["∫","\\int"],["∑","\\sum"],["lim","\\lim"],["→","→"],["°","\\circ"]] as const;
export function editableMathToken(value:string):boolean{return /^(?:\d+(?:\.\d+)?|\.\d+|[A-Za-z])$/.test(value);}
export function validMathToken(value:string):boolean{return editableMathToken(value)&&value.length<=16;}
