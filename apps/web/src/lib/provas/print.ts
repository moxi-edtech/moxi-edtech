import { provaDisplayTitle,provaSubtitle, type Bloco, type ProvaPrintInput } from "./schema";
import type { PrintRecipient } from "./distribution";
import { formatClasseProva, turmaProvaLabels } from "./academicLabels";
import { mathMarkup } from "./math";
import { PROVA_FOOTER,safeLogoData } from "./branding";
import { PROVA_PAPER as P,respostaLayout,chooseComposicao,COMPOSICAO,alternativesInColumns } from "./layout";
import { formatCotacao,blockNumbering,groupSummaries,groupTitleInput } from "./questionTemplates";
import { safeProvaFigure,figureDimensions } from "./figures";
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
export function provaHtml(prova:ProvaPrintInput,escola:string,options:{nonce?:string;draft?:boolean;recipients?:readonly PrintRecipient[];includeName?:boolean;logo?:string|null;blankSheet?:boolean}={}){
 const figureIds=new Map<string,{id:string;width:number;height:number}>();
 const figuresHtml=(b:Bloco)=>{
  const figures=(b.figuras??[]).slice(0,6).flatMap(value=>{
   const f=safeProvaFigure(value);if(!f)return [];
   let entry=figureIds.get(f.src);
   if(!entry){const dims=figureDimensions(f.src)!;entry={id:"prova-figure-"+figureIds.size,...dims};figureIds.set(f.src,entry);}
   return ['<svg class="question-figure" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="'+esc(f.alt)+'" viewBox="0 0 '+entry.width+' '+entry.height+'"><use href="#'+entry.id+'"/></svg>'];
  });
  return figures.length?'<div class="figure-grid figures-'+Math.min(3,figures.length)+'">'+figures.join("")+'</div>':"";
 };
 const numbering=blockNumbering(prova.conteudo);
 const groups=groupSummaries(prova.conteudo);
 const blocks=options.blankSheet?'<section class="blank-writing" aria-label="Espaço para respostas">'+Array.from({length:18},()=>'<div class="linha"></div>').join("")+'</section>':prova.conteudo.map((b,index)=>{
   if(b.tipo==="grupo"){
    const group=groups[numbering[index].group-1];
    // Preserve legacy rich content; strip an old ordinal only when it is wholly
    // contained in the first text segment, so formatting is not destroyed.
    let title=esc(group.title);
    if(b.rich){
     const first=b.rich.segments[0];
     const prefix=first?.kind==="text"?groupTitleInput(first.text):null;
     const segments=first?.kind==="text"&&prefix!==null?[...(prefix?[{...first,text:prefix}]:[]),...b.rich.segments.slice(1)]:b.rich.segments;
     const content=blocoHtml({...b,rich:{...b.rich,segments}});
     title=esc(group.label)+(content?" — "+content:"");
    }
    const total=group.hasNumeric&&group.assigned===group.questions?'<span class="group-total"> · '+esc(formatCotacao(group.total))+' val.</span>':"";
    return '<h3>'+title+total+'</h3>';
   }
   if(b.tipo==="texto")return '<div class="apoio">'+blocoHtml(b)+figuresHtml(b)+'</div>';
   const prefix=numbering[index].prefix;
   const suffix=b.tipo==="verdadeiro_falso"?'<span class="vf" aria-label="Verdadeiro ou falso">( &nbsp; ) V &nbsp; ( &nbsp; ) F</span>':"";
   const cotacao=b.cotacao_cent===undefined?"":'<span class="cotacao">('+esc(formatCotacao(b.cotacao_cent))+' val.)</span>';
   const alternatives=b.tipo==="escolha"&&b.alternativas?'<ol class="alternativas'+(alternativesInColumns(b.alternativas)?' duas-colunas':'')+'">'+b.alternativas.map((a,i)=>'<li><span class="opcao">□ '+String.fromCharCode(65+i)+') </span>'+esc(a)+'</li>').join("")+'</ol>':"";
   const answer=respostaLayout(b.tipo,b.linhas);
   const lines=Array.from({length:answer.count},()=>'<div class="linha"></div>');
   const first=answer.kind==="lines"?'<div class="resposta resposta-inicio">'+lines[0]+'</div>':answer.kind==="box"?'<div class="resposta"><div class="espaco" style="height:'+answer.heightMm+'mm"></div></div>':"";
   const rest=answer.kind==="lines"&&answer.count>1?'<div class="resposta-cont">'+lines.slice(1).join("")+'</div>':"";
   const long=b.texto.length+(b.alternativas?.reduce((n,a)=>n+a.length,0)??0)>1000||answer.heightMm>=104;
   return '<section class="questao '+(b.tipo==="alinea"?"alinea":"")+(long?" long":"")+'"><div class="questao-inicio"><div class="enunciado">'+cotacao+'<strong class="question-number">'+esc(prefix)+'</strong> '+blocoHtml(b)+suffix+'</div>'+figuresHtml(b)+alternatives+first+'</div>'+rest+'</section>';
 }).join("");
 const tr=["I","II","III"][prova.trimestre-1]??"";
 const recipients=options.recipients??[null];
 const logo=safeLogoData(options.logo);
 // One profile for all copies; nominal data never changes the chosen composition.
 const composition=chooseComposicao(prova.conteudo,prova.apresentacao,Boolean(logo));
 const spacing=COMPOSICAO[composition];
 const logoDefs=logo?'<svg class="logo-defs" xmlns="http://www.w3.org/2000/svg" width="0" height="0" aria-hidden="true"><defs><symbol id="prova-school-logo" viewBox="0 0 100 100"><image width="100" height="100" preserveAspectRatio="xMidYMid meet" href="'+esc(logo)+'"/></symbol></defs></svg>':'';
 const logoMark=logo?'<svg class="school-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="Logótipo da escola"><use href="#prova-school-logo"/></svg>':'';
 const figureDefs=figureIds.size?'<svg class="logo-defs" xmlns="http://www.w3.org/2000/svg" width="0" height="0" aria-hidden="true"><defs>'+Array.from(figureIds,([src,f])=>'<symbol id="'+f.id+'" viewBox="0 0 '+f.width+' '+f.height+'"><image width="'+f.width+'" height="'+f.height+'" href="'+esc(src)+'"/></symbol>').join("")+'</defs></svg>':"";
 const documentTitle=provaDisplayTitle(prova);
 const subtitle=provaSubtitle(prova);
 const showTrim=!prova.tipo_prova||["professor","trimestral","segunda_chamada","diagnostica","outro"].includes(prova.tipo_prova);
 const header=(recipient:PrintRecipient|null)=>{
   if(options.blankSheet)return '<header class="cabecalho"><div class="institution">'+logoMark+'<h1 class="school">'+esc(escola)+'</h1><p class="school-year">Ano lectivo: ____________</p></div><h2 class="title">Folha de prova</h2><div class="student"><span>Nome do aluno:</span><span class="student-line"></span></div><div class="meta distribution-meta"><span>Disciplina: ____________________</span><span>Classe: ______</span><span>Turma: ______</span></div><div class="meta distribution-meta"><span>Tipo de prova: ____________________</span><span>Trimestre: ____</span><span>Data: ____/____/______</span></div><div class="meta distribution-meta"><span>N.º de chamada: ____</span><span>Turno: ______</span><span>Sala: ______</span><span>Classificação: ______</span></div></header>';
   const named=options.includeName!==false?recipient:null;
   const student=named?'<strong class="student-name">'+esc(named.nome)+'</strong>':'<span class="student-line"></span>';
   const labels=recipient?turmaProvaLabels(prova.classe,{nome:recipient.turma,letra:recipient.letra,turno:recipient.turno,curso:recipient.curso}):null;
   const turma=labels?'<span>'+esc(labels.turma)+'</span>'+(labels.turno?'<span>Turno: '+esc(labels.turno)+'</span>':''):'<span>Turma: ______</span><span>Turno: ______</span>';
   const course=labels?.curso?'<span>Curso: '+esc(labels.curso)+'</span>':'';
   const room=recipient?.sala?'<span>Sala da turma: '+esc(recipient.sala)+'</span>':'<span>Sala nº ______</span>';
   const process=named&&named.numero_processo?'<span>N.º de processo: '+esc(named.numero_processo)+'</span>':'';
   const call=named&&named.numero_chamada!==null?'<span>N.º de chamada: '+esc(named.numero_chamada)+'</span>':'';
   return '<header class="cabecalho"><div class="institution">'+logoMark+'<h1 class="school">'+esc(escola)+'</h1><p class="school-year">Ano lectivo: '+esc(prova.ano_lectivo)+'</p></div>'+
    '<h2 class="title">'+esc(documentTitle)+'</h2>'+(subtitle?'<p class="subtitle">'+esc(subtitle)+'</p>':'')+
    '<div class="meta academic-meta"><span>'+esc(formatClasseProva(prova.classe))+'</span>'+(showTrim?'<span>'+tr+' Trimestre</span>':'')+'<span>Série '+esc(prova.serie)+'</span><span>Duração: '+esc(prova.duracao)+' min.</span></div><div class="meta distribution-meta">'+turma+room+course+'</div><div class="student"><span>Nome do aluno:</span>'+student+'</div>'+(process||call?'<div class="meta student-meta">'+process+call+'</div>':'')+'</header>';
 };
 const controls=options.nonce?'<div class="controls"><button id="print">Imprimir / Guardar PDF</button><span>Use papel A4. '+(options.recipients?esc(recipients.length)+' prova(s) neste lote. Imprima uma cópia do lote.':'Defina o número de cópias na impressora.')+'</span></div><script nonce="'+esc(options.nonce)+'">document.getElementById("print").addEventListener("click",()=>window.print());</script>':"";
 const sheets=recipients.map(recipient=>'<article class="paper" data-layout="'+composition+'">'+(options.draft?'<p class="draft">RASCUNHO — NÃO DISTRIBUIR</p>':'')+header(recipient)+blocks+'<footer class="screen-footer">'+esc(PROVA_FOOTER)+'</footer></article>').join("");
 return '<!doctype html><html lang="pt-AO"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'+esc(prova.titulo)+'</title><style>'+
 `@page{size:A4;margin:${P.marginTop}mm ${P.marginRight}mm ${P.marginBottom}mm ${P.marginLeft}mm}\n @page{@bottom-left{content:"${PROVA_FOOTER}";font:8pt Arial,sans-serif;color:#555;vertical-align:middle}@bottom-right{content:"${recipients.length>1?"Página do lote ":"Página "}" counter(page) " de " counter(pages);font:8pt Arial,sans-serif;color:#555;vertical-align:middle}}
 *{box-sizing:border-box}body{margin:0;background:#eeeeee;color:#171717;font:12pt/1.5 Arial,"Liberation Sans",sans-serif}
 .paper{--question-gap:${spacing.questionGap}mm;--answer-gap:${spacing.answerGap}mm;--text-leading:${spacing.lineHeight};--header-gap:${spacing.headerGap}mm;--group-top:${spacing.groupTop}mm;--group-bottom:${spacing.groupBottom}mm;--alternative-gap:${spacing.alternativeGap}mm;line-height:var(--text-leading);width:100%;max-width:${P.width}mm;min-height:${P.height}mm;background:#fff;display:flex;flex-direction:column;margin:16px auto;padding:${P.marginTop}mm ${P.marginRight}mm ${P.marginBottom}mm ${P.marginLeft}mm}
 .logo-defs{position:absolute;width:0;height:0;overflow:hidden}\n .school-logo{display:block;width:20mm;height:20mm;margin:0 auto 2mm;overflow:hidden}\n .screen-footer{margin-top:auto;padding-top:3mm;border-top:.2mm solid #aaa;text-align:left;color:#555;font:8pt Arial,sans-serif}\n .cabecalho{break-inside:avoid-page;margin-bottom:var(--header-gap);border-bottom:.25mm solid #777;padding-bottom:3mm}
 .institution{border-bottom:.25mm solid #777;padding-bottom:3mm;text-align:center}
 .school{text-align:center;font-size:12pt;font-weight:bold;text-transform:uppercase;margin:0;overflow-wrap:anywhere}
 .school-year{font-size:10pt;color:#444;margin:1mm 0 0}
 .meta{display:flex;justify-content:space-between;flex-wrap:wrap;column-gap:5mm;row-gap:1mm;font-size:10pt}
 .academic-meta{justify-content:center}
 .distribution-meta,.student-meta{margin-top:2mm;justify-content:flex-start}
 .title{text-align:center;font-size:15pt;line-height:1.25;margin:3mm 0 2mm;overflow-wrap:anywhere}
 .student{display:flex;align-items:baseline;gap:3mm;margin-top:3mm;min-height:8mm;font-size:11pt}
 .student span:first-child{flex-shrink:0}.student-name{min-width:0;overflow-wrap:anywhere}.meta span{overflow-wrap:anywhere;min-width:0}.subtitle{text-align:center;margin:0 0 3mm;font-size:11pt}.student-line{flex:1;min-width:0;border-bottom:0.25mm solid #555;min-height:7mm}
 .questao{margin:0 0 var(--question-gap);break-inside:avoid-page;page-break-inside:avoid}
 .questao.long{break-inside:auto;page-break-inside:auto}
 .questao-inicio{break-inside:avoid-page;page-break-inside:avoid}
 .questao.long .questao-inicio{break-inside:auto;page-break-inside:auto}
 .enunciado{display:flow-root;orphans:3;widows:3;break-after:avoid-page;page-break-after:avoid}.question-number{font-weight:700}
 .enunciado,.apoio,h3{white-space:pre-wrap;overflow-wrap:anywhere}
 .apoio{margin:0 0 var(--question-gap);orphans:3;widows:3}
 .group-total{font-size:10pt;font-weight:normal;white-space:nowrap}\n h3{text-align:center;font-size:12pt;margin:var(--group-top) 0 var(--group-bottom);break-after:avoid-page;page-break-after:avoid}
 .figure-grid{display:grid;gap:3mm;margin:3mm 0;break-inside:avoid-page;page-break-inside:avoid}.figures-1{grid-template-columns:1fr}.figures-2{grid-template-columns:repeat(2,minmax(0,1fr))}.figures-3{grid-template-columns:repeat(3,minmax(0,1fr))}.question-figure{display:block;width:100%;height:40mm;max-width:100%;overflow:hidden}.figures-1 .question-figure{height:65mm}.figure-grid+*{break-before:avoid-page}
 .formula{display:inline-block;vertical-align:middle;max-width:100%;break-inside:avoid-page}.formula math{font-size:1.05em}
 .cotacao{float:right;margin-left:4mm;font-size:10pt;font-weight:normal;color:#444;white-space:nowrap}.alternativas{list-style:none;margin:var(--alternative-gap) 0 0;padding:0 0 0 5mm}.alternativas.duas-colunas{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:5mm;row-gap:1mm;break-inside:avoid-page}.alternativas li{white-space:pre-wrap;overflow-wrap:anywhere;break-inside:avoid-page;page-break-inside:avoid}.alternativas li:last-child{break-after:avoid-page}.opcao{white-space:nowrap}\n .alinea{margin-left:5mm}.vf{display:inline-block;white-space:nowrap;margin-left:3mm;min-width:9mm}
 .resposta{margin-top:var(--answer-gap);break-before:avoid-page}.linha,.espaco{break-inside:avoid-page;page-break-inside:avoid}
 .linha{height:${P.lineHeight}mm;border-bottom:0.2mm solid #777}
 .espaco{border:0.25mm solid #777;max-width:100%}
 .controls{display:flex;flex-wrap:wrap;align-items:center;gap:12px;justify-content:center;padding:12px;background:#fff;font:14px system-ui}
 .controls button{border:0;background:#222;color:#fff;border-radius:10px;padding:10px 16px;min-height:44px;cursor:pointer}
 .draft{text-align:center;color:#555;font-size:10pt;letter-spacing:.1em}
 @media screen and (max-width:600px){.paper{min-height:0;margin:0 auto;padding:16px 12px}.meta{gap:6px}.school{font-size:12pt}.title{font-size:13pt}.student{flex-wrap:wrap}.student-line{min-width:50px}.alternativas.duas-colunas{grid-template-columns:1fr}}
 @media print{body{background:#fff}.paper{display:block;width:auto;margin:0;padding:0;max-width:none;min-height:0}.screen-footer{display:none}.controls{display:none}.paper+.paper{break-before:page;page-break-before:always}}`+
 '</style></head><body>'+controls+logoDefs+figureDefs+'<main>'+sheets+'</main></body></html>';
}

/** Independent writing sheet: no assessment, enrollment or academic snapshot is persisted. */
export function folhaGenericaHtml(escola:string,options:{nonce?:string;logo?:string|null}={}){
 return provaHtml({titulo:"Folha de prova",classe:"",disciplina:"",ano_lectivo:"",trimestre:1,duracao:1,serie:"",conteudo:[]},escola,{...options,blankSheet:true});
}
