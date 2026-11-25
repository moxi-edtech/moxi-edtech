import type { ProvaInput } from "./schema";
const esc=(s:unknown)=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
export function provaHtml(prova:ProvaInput,escola:string,options:{nonce?:string;draft?:boolean}={}){
 let number=0,letter=0;
 const blocks=prova.conteudo.map(b=>{
   if(b.tipo==="grupo"){number=0;letter=0;return '<h3>'+esc(b.texto)+'</h3>';}
   if(b.tipo==="texto")return '<div class="apoio">'+esc(b.texto)+'</div>';
   const prefix=b.tipo==="alinea"?String.fromCharCode(97+(letter++%26))+')':String(++number)+'.';
   if(b.tipo!=="alinea")letter=0;
   const suffix=b.tipo==="verdadeiro_falso"?' (   )':"";
   const lines=Array.from({length:b.linhas},()=>'<div class="linha"></div>').join("");
   const space=b.tipo==="desenho"||b.tipo==="calculo"?'<div class="espaco" style="height:'+Math.max(20,b.linhas*7)+'mm"></div>':lines;
   return '<section class="questao '+(b.tipo==="alinea"?"alinea":"")+'"><div class="enunciado">'+esc(prefix)+' '+esc(b.texto)+suffix+'</div>'+space+'</section>';
 }).join("");
 const tr=["I","II","III"][prova.trimestre-1]??"";
 const controls=options.nonce?'<div class="controls"><button id="print">Imprimir / Guardar PDF</button><span>Use papel A4. Defina o número de cópias na impressora.</span></div><script nonce="'+esc(options.nonce)+'">document.getElementById("print").addEventListener("click",()=>window.print());</script>':"";
 return '<!doctype html><html lang="pt-AO"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'+esc(prova.titulo)+'</title><style>'+
 '@page{size:A4;margin:14mm}*{box-sizing:border-box}body{margin:0;background:#eef2f6;color:#111;font:12pt/1.35 "Times New Roman",serif}.paper{max-width:210mm;min-height:297mm;background:#fff;margin:16px auto;padding:14mm}.school{text-align:center;font-size:13pt;font-weight:bold;text-transform:uppercase;margin:0 0 5mm}.meta{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;font-size:11pt}.title{text-align:center;font-size:14pt;margin:3mm 0}.student{margin:5mm 0;border-bottom:1px solid #333;padding-bottom:3mm}.questao{margin:3mm 0;break-inside:avoid;page-break-inside:avoid}.enunciado,.apoio,h3{white-space:pre-wrap;overflow-wrap:anywhere}h3{text-align:center;font-size:12pt;margin:4mm 0 2mm;break-after:avoid}.alinea{margin-left:6mm}.linha{height:7mm;border-bottom:1px solid #aaa}.espaco{min-height:20mm;border:1px solid #bbb;margin-top:2mm}.controls{display:flex;align-items:center;gap:12px;justify-content:center;padding:12px;background:#fff;font:14px system-ui}.controls button{border:0;background:#E3B23C;color:#241b05;border-radius:10px;padding:10px 16px;cursor:pointer}.draft{text-align:center;color:#555;font-size:10pt;letter-spacing:.1em}@media print{body{background:#fff}.paper{margin:0;padding:0;max-width:none;min-height:0}.controls{display:none}}'+
 '</style></head><body>'+controls+'<main class="paper">'+(options.draft?'<p class="draft">RASCUNHO — NÃO DISTRIBUIR</p>':'')+
 '<h1 class="school">'+esc(escola)+'</h1><div class="meta"><span>'+esc(prova.classe)+'</span><span>'+tr+' Trimestre</span><span>Ano lectivo: '+esc(prova.ano_lectivo)+'</span></div>'+
 '<h2 class="title">'+esc(prova.titulo)+' — '+esc(prova.disciplina)+'</h2><div class="meta"><span>Duração: '+esc(prova.duracao)+' min.</span><span>Sala nº ______</span><span>Série '+esc(prova.serie)+'</span></div><div class="student">Nome do aluno: ____________________________________________________</div>'+blocks+'</main></body></html>';
}
