import { tiposProva, type Bloco, type ProvaPrintInput } from "./schema";
import type { PrintRecipient } from "./distribution";
import { formatClasseProva, turmaProvaLabels } from "./academicLabels";
import { mathMarkup } from "./math";
import { PROVA_FOOTER,safeLogoData } from "./branding";
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
export function provaHtml(prova:ProvaPrintInput,escola:string,options:{nonce?:string;draft?:boolean;recipients?:readonly PrintRecipient[];includeName?:boolean;logo?:string|null}={}){
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
 const recipients=options.recipients??[null];
 const logo=safeLogoData(options.logo);
 const logoDefs=logo?'<svg class="logo-defs" xmlns="http://www.w3.org/2000/svg" width="0" height="0" aria-hidden="true"><defs><symbol id="prova-school-logo" viewBox="0 0 100 100"><image width="100" height="100" preserveAspectRatio="xMidYMid meet" href="'+esc(logo)+'"/></symbol></defs></svg>':'';
 const logoMark=logo?'<svg class="school-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="Logótipo da escola"><use href="#prova-school-logo"/></svg>':'';
 const type=prova.tipo_prova?tiposProva[prova.tipo_prova]:null;
 const documentTitle=type?type+" de "+prova.disciplina:prova.titulo+" — "+prova.disciplina;
 const showTrim=!prova.tipo_prova||["professor","trimestral","segunda_chamada","diagnostica","outro"].includes(prova.tipo_prova);
 const header=(recipient:PrintRecipient|null)=>{
   const named=options.includeName!==false?recipient:null;
   const student=named?'<strong class="student-name">'+esc(named.nome)+'</strong>':'<span class="student-line"></span>';
   const labels=recipient?turmaProvaLabels(prova.classe,{nome:recipient.turma,letra:recipient.letra,turno:recipient.turno,curso:recipient.curso}):null;
   const turma=labels?'<span>'+esc(labels.turma)+'</span>'+(labels.turno?'<span>Turno: '+esc(labels.turno)+'</span>':''):'';
   const course=labels?.curso?'<span>Curso: '+esc(labels.curso)+'</span>':'';
   const room=recipient?.sala?'<span>Sala da turma: '+esc(recipient.sala)+'</span>':'<span>Sala nº ______</span>';
   const process=named&&named.numero_processo?'<span>N.º de processo: '+esc(named.numero_processo)+'</span>':'';
   const call=named&&named.numero_chamada!==null?'<span>N.º de chamada: '+esc(named.numero_chamada)+'</span>':'';
   return '<header class="cabecalho">'+logoMark+'<h1 class="school">'+esc(escola)+'</h1><div class="meta"><span>'+esc(formatClasseProva(prova.classe))+'</span>'+(showTrim?'<span>'+tr+' Trimestre</span>':'')+'<span>Ano lectivo: '+esc(prova.ano_lectivo)+'</span></div>'+
    '<h2 class="title">'+esc(documentTitle)+'</h2>'+(type&&prova.titulo.trim()!=="Prova"&&prova.titulo.trim()!==type?'<p class="subtitle">'+esc(prova.titulo)+'</p>':'')+
    '<div class="meta"><span>Duração: '+esc(prova.duracao)+' min.</span><span>Série '+esc(prova.serie)+'</span>' +turma+room+course+'</div><div class="student"><span>Nome do aluno:</span>'+student+'</div>'+(process||call?'<div class="meta">'+process+call+'</div>':'')+'</header>';
 };
 const controls=options.nonce?'<div class="controls"><button id="print">Imprimir / Guardar PDF</button><span>Use papel A4. '+(options.recipients?esc(recipients.length)+' prova(s) neste lote. Imprima uma cópia do lote.':'Defina o número de cópias na impressora.')+'</span></div><script nonce="'+esc(options.nonce)+'">document.getElementById("print").addEventListener("click",()=>window.print());</script>':"";
 const sheets=recipients.map(recipient=>'<article class="paper">'+(options.draft?'<p class="draft">RASCUNHO — NÃO DISTRIBUIR</p>':'')+header(recipient)+blocks+'<footer class="screen-footer">'+esc(PROVA_FOOTER)+'</footer></article>').join("");
 return '<!doctype html><html lang="pt-AO"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'+esc(prova.titulo)+'</title><style>'+
 `@page{size:A4;margin:${P.marginTop}mm ${P.marginRight}mm ${P.marginBottom}mm ${P.marginLeft}mm}\n @page{@bottom-center{content:"${PROVA_FOOTER}";font:8pt Arial,sans-serif;color:#555;vertical-align:middle}}
 *{box-sizing:border-box}body{margin:0;background:#eef2f6;color:#111;font:12pt/1.5 "Times New Roman",serif}
 .paper{width:100%;max-width:${P.width}mm;min-height:${P.height}mm;background:#fff;display:flex;flex-direction:column;margin:16px auto;padding:${P.marginTop}mm ${P.marginRight}mm ${P.marginBottom}mm ${P.marginLeft}mm}
 .logo-defs{position:absolute;width:0;height:0;overflow:hidden}\n .school-logo{display:block;width:22mm;height:22mm;margin:0 auto 3mm;overflow:hidden}\n .screen-footer{margin-top:auto;padding-top:4mm;border-top:.2mm solid #aaa;text-align:center;color:#555;font:8pt Arial,sans-serif}\n .cabecalho{break-inside:avoid-page;margin-bottom:7mm}
 .school{text-align:center;font-size:13pt;font-weight:bold;text-transform:uppercase;margin:0 0 5mm;overflow-wrap:anywhere}
 .meta{display:flex;justify-content:space-between;flex-wrap:wrap;column-gap:5mm;row-gap:2mm;font-size:11pt}
 .title{text-align:center;font-size:14pt;margin:4mm 0;overflow-wrap:anywhere}
 .student{display:flex;align-items:baseline;gap:3mm;margin-top:6mm;min-height:9mm;font-size:11pt}
 .student span:first-child{flex-shrink:0}.student-name{min-width:0;overflow-wrap:anywhere}.meta span{overflow-wrap:anywhere;min-width:0}.subtitle{text-align:center;margin:0 0 3mm;font-size:11pt}.student-line{flex:1;min-width:0;border-bottom:0.25mm solid #333;min-height:7mm}
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
 @media print{body{background:#fff}.paper{display:block;width:auto;margin:0;padding:0;max-width:none;min-height:0}.screen-footer{display:none}.controls{display:none}.paper+.paper{break-before:page;page-break-before:always}}`+
 '</style></head><body>'+controls+logoDefs+'<main>'+sheets+'</main></body></html>';
}
