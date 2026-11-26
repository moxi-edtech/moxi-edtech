import { tipos,type Bloco } from "./schema";

export type QuestionType=Bloco["tipo"];
export const isQuestion=(type:QuestionType)=>type!=="grupo"&&type!=="texto";
export const questionTypes=(Object.keys(tipos) as QuestionType[]).filter(isQuestion);
export const structureTypes=["grupo","texto"] as const;
export const structureLabels={grupo:"Grupo de perguntas",texto:"Texto de apoio"} as const;
export const structureHelp={grupo:"Organiza a prova em secções, com numeração e cotação automáticas.",texto:"Conteúdo de referência para as perguntas seguintes. Não tem cotação nem espaço de resposta."} as const;
/** Groups use the existing non-empty texto contract; "Grupo" is the untitled marker. */
export const UNTITLED_GROUP="Grupo";
export function groupRoman(value:number):string{
 let n=value,result="";
 for(const [v,s] of [[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]] as const){while(n>=v){result+=s;n-=v;}}
 return result;
}
export function groupLabel(ordinal:number){return groupRoman(ordinal)+" Grupo";}
const legacyGroupPrefix=/^\s*(?:(?:[IVXLCDM]+|\d+\.?[ºª]?)\s+Grupo|Grupo\s+(?:[IVXLCDM]+|\d+\.?[ºª]?))(?=\s*[:—–-]|\s*$|\s+)/i;
export function groupTitleInput(text:string):string{
 if(text.trim()===UNTITLED_GROUP)return "";
 return text.replace(legacyGroupPrefix,"").replace(/^\s*[:—–-]\s*/,"").trimStart();
}
export function groupTitle(text:string){return groupTitleInput(text).trim();}
export function groupHeading(ordinal:number,text:string){const title=groupTitle(text);return groupLabel(ordinal)+(title?" — "+title:"");}
export type GroupSummary={ordinal:number;index:number;end:number;label:string;title:string;questions:number;total:number;assigned:number;hasNumeric:boolean};
export function groupSummaries(blocks:readonly Bloco[]):GroupSummary[]{
 const result:GroupSummary[]=[];let active:GroupSummary|undefined;
 blocks.forEach((b,index)=>{
  if(b.tipo==="grupo"){if(active)active.end=index;const ordinal=result.length+1;active={ordinal,index,end:blocks.length,label:groupLabel(ordinal),title:groupHeading(ordinal,b.texto),questions:0,total:0,assigned:0,hasNumeric:false};result.push(active);}
  else if(active&&isQuestion(b.tipo)){active.questions++;active.total+=b.cotacao_cent??0;if(b.cotacao_cent!==undefined){active.hasNumeric=true;if(b.cotacao_cent>0)active.assigned++;}}
 });
 return result;
}
/** Map each existing block to its group header by object identity, not ordinal. */
export function groupOwners(blocks:readonly Bloco[]):Map<Bloco,Bloco|null>{
 const result=new Map<Bloco,Bloco|null>();let active:Bloco|null=null;
 for(const block of blocks){if(block.tipo==="grupo")active=block;else result.set(block,active);}
 return result;
}
export function moveChangesGroup(blocks:readonly Bloco[],from:number,to:number):boolean{
 const next=[...blocks];const [moved]=next.splice(from,1);if(!moved)return false;next.splice(to,0,moved);
 const old=groupOwners(blocks),updated=groupOwners(next);
 return [...old].some(([b,owner])=>updated.get(b)!==owner);
}
/** Keep the existing printed numbering independent from structural block position. */
export function blockNumbering(blocks:readonly Bloco[]){
 let number=0,letter=0,group=0;
 return blocks.map(b=>{
  if(b.tipo==="grupo"){number=0;letter=0;group++;return {prefix:null,label:groupLabel(group),short:groupRoman(group),group};}
  if(b.tipo==="texto")return {prefix:null,label:"Texto de apoio",short:"T",group};
  if(b.tipo==="alinea"){const prefix=String.fromCharCode(97+(letter++%26))+")";return {prefix,label:"Alínea "+prefix,short:prefix,group};}
  const prefix=String(++number)+".";letter=0;return {prefix,label:"Pergunta "+number,short:String(number),group};
 });
}
export function blockFieldLabel(tipo:QuestionType):string{return tipo==="texto"?"Texto de apoio":tipo==="grupo"?"Título do grupo":"Enunciado";}
export function questionTemplate(tipo:QuestionType):Bloco{
 const linhas=tipo==="discursiva"||tipo==="alinea"?2:tipo==="calculo"?6:tipo==="desenho"?8:0;
 return {tipo,texto:tipo==="grupo"?UNTITLED_GROUP:"",linhas,...(tipo==="escolha"?{alternativas:["","","",""]}:{})};
}
export const placeholders:Record<QuestionType,string>={
 discursiva:"Ex.: Define energia.",verdadeiro_falso:"Ex.: A Terra gira em torno do Sol.",escolha:"Ex.: Qual é a unidade de energia?",lacunas:"Ex.: A unidade de energia é ____.",calculo:"Ex.: Resolve a equação 2x + 5 = 15.",desenho:"Ex.: Desenha um circuito eléctrico.",alinea:"Ex.: Justifica a tua resposta.",grupo:"Ex.: Compreensão",texto:"Ex.: Insira o texto, dados ou situação que os alunos devem consultar."
};
export function suggestedTypes(disciplina:string):QuestionType[]{
 const name=disciplina.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 if(/matemat|fisica|quimica/.test(name))return ["calculo","discursiva","escolha","verdadeiro_falso"];
 if(/visual|plastica|desenho/.test(name))return ["desenho","discursiva","escolha"];
 if(/biolog|geograf|ciencias/.test(name))return ["discursiva","desenho","lacunas","verdadeiro_falso"];
 if(/portugues|lingua|literatura/.test(name))return ["discursiva","lacunas","alinea"];
 return ["discursiva","verdadeiro_falso","escolha","lacunas"];
}
export const structures=[
 {label:"Mista",types:["discursiva","verdadeiro_falso","escolha","lacunas"]},
 {label:"Cálculo e teoria",types:["calculo","calculo","discursiva"]},
 {label:"Interpretação de texto",types:["texto","discursiva","discursiva","lacunas"]},
] as const satisfies readonly {label:string;types:readonly QuestionType[]}[];
export function formatCotacao(cent:number){return (cent/100).toFixed(2).replace(/\.?0+$/,"").replace(".",",");}
