import type { Bloco } from "./schema";
// Physical units shared by authoring controls and the single print renderer.
export const PROVA_PAPER = {width:210,height:297,marginTop:18,marginBottom:18,marginLeft:20,marginRight:20,questionGap:6,answerGap:3,lineHeight:8,maxLines:20,minBoxHeight:24} as const;
export function respostaLayout(tipo:Bloco["tipo"],linhas:number){
 const count=Number.isFinite(linhas)?Math.max(0,Math.min(PROVA_PAPER.maxLines,Math.trunc(linhas))):0;
 if(tipo==="grupo"||tipo==="texto"||count===0)return {kind:"none" as const,count:0,heightMm:0};
 if(tipo==="calculo"||tipo==="desenho")return {kind:"box" as const,count,heightMm:Math.max(PROVA_PAPER.minBoxHeight,count*PROVA_PAPER.lineHeight)};
 return {kind:"lines" as const,count,heightMm:count*PROVA_PAPER.lineHeight};
}
