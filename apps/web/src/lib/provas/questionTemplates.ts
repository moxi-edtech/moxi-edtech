import { tipos,type Bloco } from "./schema";

export type QuestionType=Bloco["tipo"];
export const isQuestion=(type:QuestionType)=>type!=="grupo"&&type!=="texto";
export const questionTypes=(Object.keys(tipos) as QuestionType[]).filter(isQuestion);
export const structureTypes=["grupo","texto"] as const;
export const structureLabels={grupo:"Grupo de perguntas",texto:"Texto de apoio"} as const;
export const structureHelp={grupo:"Organiza a prova em secções e reinicia a numeração das perguntas.",texto:"Conteúdo de referência para as perguntas seguintes. Não tem cotação nem espaço de resposta."} as const;
/** Keep the existing printed numbering independent from structural block position. */
export function blockNumbering(blocks:readonly Bloco[]){
 let number=0,letter=0,group=0;
 return blocks.map(b=>{
  if(b.tipo==="grupo"){number=0;letter=0;group++;return {prefix:null,label:"Grupo de perguntas",short:"G",group};}
  if(b.tipo==="texto")return {prefix:null,label:"Texto de apoio",short:"T",group};
  if(b.tipo==="alinea"){const prefix=String.fromCharCode(97+(letter++%26))+")";return {prefix,label:"Alínea "+prefix,short:prefix,group};}
  const prefix=String(++number)+".";letter=0;return {prefix,label:"Pergunta "+number,short:String(number),group};
 });
}
export function blockFieldLabel(tipo:QuestionType):string{return tipo==="texto"?"Texto de apoio":tipo==="grupo"?"Título do grupo":"Enunciado";}
export function questionTemplate(tipo:QuestionType):Bloco{
 const linhas=tipo==="discursiva"||tipo==="alinea"?2:tipo==="calculo"?6:tipo==="desenho"?8:0;
 return {tipo,texto:"",linhas,...(tipo==="escolha"?{alternativas:["","","",""]}:{})};
}
export const placeholders:Record<QuestionType,string>={
 discursiva:"Ex.: Define energia.",verdadeiro_falso:"Ex.: A Terra gira em torno do Sol.",escolha:"Ex.: Qual é a unidade de energia?",lacunas:"Ex.: A unidade de energia é ____.",calculo:"Ex.: Resolve a equação 2x + 5 = 15.",desenho:"Ex.: Desenha um circuito eléctrico.",alinea:"Ex.: Justifica a tua resposta.",grupo:"Ex.: I Grupo — Compreensão",texto:"Ex.: Insira o texto, dados ou situação que os alunos devem consultar."
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
