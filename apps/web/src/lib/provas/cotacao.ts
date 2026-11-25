import type { Bloco } from "./schema";
import { isQuestion, formatCotacao } from "./questionTemplates";
export function parseCotacao(raw:string):number|undefined {
 if(!/^\d{1,2}(?:[.,]\d{0,2})?$/.test(raw))return undefined;
 const [whole,fraction=""]=raw.replace(",",".").split(".");
 return Number(whole)*100+Number(fraction.padEnd(2,"0"));
}
export function cotacaoStatus(blocks:readonly Bloco[],max:number|null){
 const questions=blocks.filter(b=>isQuestion(b.tipo));
 const total=questions.reduce((sum,b)=>sum+(b.cotacao_cent??0),0);
 const missing=questions.filter(b=>b.cotacao_cent===undefined||b.cotacao_cent<=0).length;
 const qualitative=max===0,hasNumeric=questions.some(b=>b.cotacao_cent!==undefined);
 const ready=questions.length>0&&(qualitative?!hasNumeric:max!==null&&max>0&&total===max&&missing===0);
 const message=max===null?"Escala indisponível ou incompatível entre turmas. Consulte a Direção.":qualitative?(hasNumeric?"Remova as cotações: avaliação qualitativa.":"Avaliação qualitativa · sem cotação numérica."):total>max?"Excesso de "+formatCotacao(total-max)+" valores.":total<max?"Faltam "+formatCotacao(max-total)+" valores."+(missing?" "+missing+" sem cotação.":""):missing?missing+" pergunta(s) sem cotação positiva.":"Cotação completa.";
 return {total,missing,ready,message,qualitative,hasNumeric};
}
