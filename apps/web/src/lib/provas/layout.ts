import type { Bloco } from "./schema";
// Physical units shared by authoring controls and the single print renderer.
export const PROVA_PAPER = {width:210,height:297,marginTop:18,marginBottom:18,marginLeft:20,marginRight:20,questionGap:6,answerGap:3,lineHeight:8,maxLines:20,minBoxHeight:24} as const;
export const RESPOSTA_FORMATOS=["nenhum","linhas","retangulo"] as const;
export type RespostaFormato=typeof RESPOSTA_FORMATOS[number];
export function respostaLayout(tipo:Bloco["tipo"],linhas:number,formato?:RespostaFormato){
 const count=Number.isFinite(linhas)?Math.max(0,Math.min(PROVA_PAPER.maxLines,Math.trunc(linhas))):0;
 if(tipo==="grupo"||tipo==="texto"||count===0||formato==="nenhum")return {kind:"none" as const,count:0,heightMm:0};
 if(formato==="retangulo"||(!formato&&(tipo==="calculo"||tipo==="desenho")))return {kind:"box" as const,count,heightMm:Math.max(PROVA_PAPER.minBoxHeight,count*PROVA_PAPER.lineHeight)};
 return {kind:"lines" as const,count,heightMm:count*PROVA_PAPER.lineHeight};
}

/** Composition profiles only: A4 margins, writing lines and free answer areas never change. */
export const APRESENTACOES=["automatica","compacta","espacosa"] as const;
export type Apresentacao=typeof APRESENTACOES[number];
export const apresentacoes:Record<Apresentacao,string>={automatica:"Automática (recomendada)",compacta:"Compacta",espacosa:"Espaçosa"};
export const COMPOSICAO={
 normal:{questionGap:6,answerGap:3,lineHeight:1.5,headerGap:7,groupTop:6,groupBottom:4,alternativeGap:2},
 compacta:{questionGap:3,answerGap:2,lineHeight:1.35,headerGap:5,groupTop:4,groupBottom:3,alternativeGap:1},
 espacosa:{questionGap:9,answerGap:4,lineHeight:1.6,headerGap:9,groupTop:8,groupBottom:5,alternativeGap:3}
} as const;
export type Composicao=keyof typeof COMPOSICAO;
// Use columns only for short, single-line choices. Longer options keep the full
// width, and the same predicate is used by the estimator and renderer.
export function alternativesInColumns(options:readonly string[]|undefined):boolean{
 return !!options&&options.length>=4&&options.length<=8&&options.every(a=>!/[\r\n\t]/.test(a)&&Array.from(a).length<=28);
}
const BODY_MM=PROVA_PAPER.height-PROVA_PAPER.marginTop-PROVA_PAPER.marginBottom;
function textLines(text:string,width=82){
 return text.split(/\r?\n/).reduce((n,line)=>n+Math.max(1,Math.ceil(Array.from(line).length/width)),0);
}
/** A bounded, conservative estimate, not a physical page count. Native paged media
 * performs real wrapping and fragmentation, including long questions and formulae. */
export function estimatedPages(blocks:readonly Bloco[],mode:Composicao,hasLogo=false){
 const p=COMPOSICAO[mode], line=12*25.4/72*p.lineHeight;
 let pages=1, used=70+(hasLogo?25:0)+(mode==="espacosa"?2:mode==="compacta"?-2:0);
 for(const b of blocks){
  const answer=respostaLayout(b.tipo,b.linhas,b.resposta_formato);
  const maths=b.rich?.segments.filter(s=>s.kind==="math").length??0;
  const content=textLines(b.texto,b.tipo==="alinea"?78:82)*line+maths*6;
  const alternatives=(alternativesInColumns(b.alternativas)?Math.ceil(b.alternativas!.length/2)*line:(b.alternativas??[]).reduce((n,a)=>n+textLines(a,76)*line,0))+(b.alternativas?.length?p.alternativeGap:0);
  const gap=b.tipo==="grupo"?p.groupTop+p.groupBottom:p.questionGap;
  const figures=b.figuras?.length??0;
  const figureHeight=figures===1?71:figures>1?Math.ceil(figures/3)*43+3:0;
  const height=content+alternatives+figureHeight+gap+answer.heightMm+(answer.kind==="none"?0:p.answerGap);
  // Estimate keep-together for ordinary questions; long material may flow across sheets.
  if(height<=BODY_MM&&used+height>BODY_MM){pages++;used=0;}
  const total=used+height;
  if(total>BODY_MM){pages+=Math.ceil(total/BODY_MM)-1;used=total%BODY_MM||BODY_MM;}else used=total;
 }
 return pages;
}
export function chooseComposicao(blocks:readonly Bloco[],mode:Apresentacao|undefined,hasLogo=false):Composicao{
 if(mode==="compacta"||mode==="espacosa")return mode;
 return estimatedPages(blocks,"compacta",hasLogo)<estimatedPages(blocks,"normal",hasLogo)?"compacta":"normal";
}
