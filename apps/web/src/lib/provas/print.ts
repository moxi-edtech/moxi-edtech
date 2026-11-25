import type { Bloco, ProvaPrintInput } from "./schema";
import { mathMarkup } from "./math";
import { PROVA_PAPER as P,respostaLayout } from "./layout";
const esc=(s:unknown)=>String(s??"").replace(/[&<>"']/g,c=>(({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"} as Record<string,string>)[c]!));
export function blocoHtml(b:Bloco):string{
 if(!b.rich)return esc(b.texto);
 return b.rich.segments.map(s=>{
  if(s.kind==="break")return "<br>";
  if(s.kind==="math")return '<span class="formula">'+(mathMarkup(s.latex)??esc(s.latex))+'</span>';
  let text=esc(s.text);
  if(s.marks.includes("bold"))text="<strong>"+text+"</strong>";
  if(s.marks.includes("italic"))text="<em>"+text+"</em>";
  if(s.marks.includes("underline"))text="<u>"+text+"</u>";
  return text;
 }).join("");
}
export function provaHtml(prova:ProvaPrintInput,escola:string,options:{nonce?:string;draft?:boolean}={}){
 let number=0,letter=0;
 const blocks=prova.conteudo.map(b=>{
   if(b.tipo==="grupo"){number=0;letter=0;return '<h3>'+blocoHtml(b)+'</h3>';}
   if(b.tipo==="texto")return '<div class="apoio">'+blocoHtml(b)+'</div>';
   const prefix=b.tipo==="alinea"?String.fromCharCode(97+(letter++%26))+')':String(++number)+'.';
   if(b.tipo!=="alinea")letter=0;
   const suffix=b.tipo==="verdadeiro_falso"?'<span class="vf" aria-label="Verdadeiro ou falso">( &nbsp; )</span>':"";
   const answer=respostaLayout(b.tipo,b.linhas);
   const lines=Array.from({length:answer.count},()=>'<div class="linha"></div>');
   const first=answer.kind==="lines"?'<div class="resposta resposta-inicio">'+lines[0]+'</div>':answer.kind==="box"?'<div class="resposta"><div class="espaco" style="height:'+answer.heightMm+'mm"></div></div>':"";
   const rest=answer.kind==="lines"&&answer.count>1?'<div class="resposta-cont">'+lines.slice(1).join("")+'</div>':"";
   const long=b.texto.length>1000||answer.heightMm>=104;
   return '<section class="questao '+(b.tipo==="alinea"?"alinea":"")+(long?" long":"")+'"><div class="questao-inicio"><div class="enunciado">'+esc(prefix)+' '+blocoHtml(b)+suffix+'</div>'+first+'</div>'+rest+'</section>';
 }).join("");
 const tr=["I","II","III"][prova.trimestre-1]??"";
 const controls=options.nonce?'<div class="controls"><button id="print">Imprimir / Guardar PDF</button><span>Use papel A4. Defina o número de cópias na impressora.</span></div><script nonce="'+esc(options.nonce)+'">document.getElementById("print").addEventListener("click",()=>window.print());</script>':"";
 return '<!doctype html><html lang="pt-AO"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'+esc(prova.titulo)+'</title><style>'+
 `@page{size:A4;margin:${P.marginTop}mm ${P.marginRight}mm ${P.marginBottom}mm ${P.marginLeft}mm}
 *{box-sizing:border-box}body{margin:0;background:#eef2f6;color:#111;font:12pt/1.5 "Times New Roman",serif}
 .paper{width:100%;max-width:${P.width}mm;min-height:${P.height}mm;background:#fff;margin:16px auto;padding:${P.marginTop}mm ${P.marginRight}mm ${P.marginBottom}mm ${P.marginLeft}mm}
 .cabecalho{break-inside:avoid-page;margin-bottom:7mm}
 .school{text-align:center;font-size:13pt;font-weight:bold;text-transform:uppercase;margin:0 0 5mm;overflow-wrap:anywhere}
 .meta{display:flex;justify-content:space-between;flex-wrap:wrap;column-gap:5mm;row-gap:2mm;font-size:11pt}
 .title{text-align:center;font-size:14pt;margin:4mm 0;overflow-wrap:anywhere}
 .student{display:flex;align-items:baseline;gap:3mm;margin-top:6mm;min-height:9mm;font-size:11pt}
 .student span:first-child{flex-shrink:0}.student-line{flex:1;min-width:0;border-bottom:0.25mm solid #333;min-height:7mm}
 .questao{margin:0 0 ${P.questionGap}mm;break-inside:avoid-page;page-break-inside:avoid}
 .questao.long{break-inside:auto;page-break-inside:auto}
 .questao-inicio{break-inside:avoid-page;page-break-inside:avoid}
 .questao.long .questao-inicio{break-inside:auto;page-break-inside:auto}
 .enunciado{orphans:3;widows:3;break-after:avoid-page}
 .enunciado,.apoio,h3{white-space:pre-wrap;overflow-wrap:anywhere}
 .apoio{margin:0 0 ${P.questionGap}mm;orphans:3;widows:3}
 h3{text-align:center;font-size:12pt;margin:6mm 0 4mm;break-after:avoid-page;page-break-after:avoid}
 .formula{display:inline-block;vertical-align:middle;max-width:100%;break-inside:avoid-page}.formula math{font-size:1.05em}
 .alinea{margin-left:5mm}.vf{display:inline-block;white-space:nowrap;margin-left:3mm;min-width:9mm}
 .resposta{margin-top:${P.answerGap}mm;break-before:avoid-page}.linha,.espaco{break-inside:avoid-page;page-break-inside:avoid}
 .linha{height:${P.lineHeight}mm;border-bottom:0.2mm solid #777}
 .espaco{border:0.25mm solid #777;max-width:100%}
 .controls{display:flex;flex-wrap:wrap;align-items:center;gap:12px;justify-content:center;padding:12px;background:#fff;font:14px system-ui}
 .controls button{border:0;background:#E3B23C;color:#241b05;border-radius:10px;padding:10px 16px;min-height:44px;cursor:pointer}
 .draft{text-align:center;color:#555;font-size:10pt;letter-spacing:.1em}
 @media screen and (max-width:600px){.paper{min-height:0;margin:0 auto;padding:16px 12px}.meta{gap:6px}.school{font-size:12pt}.title{font-size:13pt}.student{flex-wrap:wrap}.student-line{min-width:50px}}
 @media print{body{background:#fff}.paper{width:auto;margin:0;padding:0;max-width:none;min-height:0}.controls{display:none}}`+
 '</style></head><body>'+controls+'<main class="paper">'+(options.draft?'<p class="draft">RASCUNHO — NÃO DISTRIBUIR</p>':'')+
 '<header class="cabecalho"><h1 class="school">'+esc(escola)+'</h1><div class="meta"><span>'+esc(prova.classe)+'</span><span>'+tr+' Trimestre</span><span>Ano lectivo: '+esc(prova.ano_lectivo)+'</span></div>'+
 '<h2 class="title">'+esc(prova.titulo)+' — '+esc(prova.disciplina)+'</h2><div class="meta"><span>Duração: '+esc(prova.duracao)+' min.</span><span>Sala nº ______</span><span>Série '+esc(prova.serie)+'</span></div><div class="student"><span>Nome do aluno:</span><span class="student-line"></span></div></header>'+blocks+'</main></body></html>';
}
