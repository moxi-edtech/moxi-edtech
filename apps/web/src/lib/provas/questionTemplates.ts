import type { Bloco } from "./schema";

export type QuestionType=Bloco["tipo"];
export const isQuestion=(type:QuestionType)=>type!=="grupo"&&type!=="texto";
export function questionTemplate(tipo:QuestionType):Bloco{
 const linhas=tipo==="discursiva"||tipo==="alinea"?2:tipo==="calculo"?6:tipo==="desenho"?8:0;
 return {tipo,texto:"",linhas,...(tipo==="escolha"?{alternativas:["","","",""]}:{})};
}
export const placeholders:Record<QuestionType,string>={
 discursiva:"Ex.: Define energia.",verdadeiro_falso:"Ex.: A Terra gira em torno do Sol.",escolha:"Ex.: Qual é a unidade de energia?",lacunas:"Ex.: A unidade de energia é ____.",calculo:"Ex.: Resolve a equação 2x + 5 = 15.",desenho:"Ex.: Desenha um circuito eléctrico.",alinea:"Ex.: Justifica a tua resposta.",grupo:"Ex.: I Grupo — Compreensão",texto:"Introduz o texto de apoio."
};
export function suggestedTypes(disciplina:string):QuestionType[]{
 const name=disciplina.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 if(/matemat|fisica|quimica/.test(name))return ["calculo","discursiva","escolha","verdadeiro_falso"];
 if(/visual|plastica|desenho/.test(name))return ["desenho","discursiva","escolha"];
 if(/biolog|geograf|ciencias/.test(name))return ["discursiva","desenho","lacunas","verdadeiro_falso"];
 if(/portugues|lingua|literatura/.test(name))return ["texto","discursiva","lacunas","alinea"];
 return ["discursiva","verdadeiro_falso","escolha","lacunas"];
}
export const structures=[
 {label:"Mista",types:["discursiva","verdadeiro_falso","escolha","lacunas"]},
 {label:"Cálculo e teoria",types:["calculo","calculo","discursiva"]},
 {label:"Interpretação de texto",types:["texto","discursiva","discursiva","lacunas"]},
] as const satisfies readonly {label:string;types:readonly QuestionType[]}[];
export function formatCotacao(cent:number){return (cent/100).toFixed(2).replace(/\.?0+$/,"").replace(".",",");}
