import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
const require=createRequire(import.meta.url);
const { provaHtml }=require("../../src/lib/provas/print.ts");
const { PROVA_PAPER:P,chooseComposicao,COMPOSICAO }=require("../../src/lib/provas/layout.ts");
const { PDFDocument }=require("pdf-lib");
const {PROVA_FOOTER}=require("../../src/lib/provas/branding.ts");
const logo="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAAAoCAIAAADmAupWAAAAT0lEQVR4nO3PQRHAIADAMMAIQpCE//9cbHddoqCd+57xJ+vrgLcZrjNcZ7jOcJ3hOsN1husM1xmuM1xnuM5wneE6w3WG6wzXGa4zXGe47gEClwEVK6MyPwAAAABJRU5ErkJggg==";
const { chromium }=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const base={titulo:"Prova de Matemática",classe:"8.ª Classe",disciplina:"Matemática",ano_lectivo:"2026/2027",trimestre:1,duracao:90,serie:"A"};
const formula="\\frac{2}{5}+\\sqrt{9}";
const conteudo=[
 {tipo:"grupo",texto:"I Grupo",linhas:0},
 {tipo:"calculo",texto:"Calcula: "+formula,linhas:4,rich:{version:1,segments:[{kind:"text",text:"Calcula: ",marks:["bold"]},{kind:"math",latex:formula}]}},
 ...Array.from({length:12},(_,i)=>({tipo:"discursiva",texto:"Questão "+(i+2)+". Justifica a resposta.",linhas:5})),
 {tipo:"grupo",texto:"II Grupo",linhas:0},
 {tipo:"discursiva",texto:"Texto longo. ".repeat(120),linhas:20},
 {tipo:"discursiva",texto:"Última pergunta.",linhas:2}
];
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1024,height:900}});
 const external=[];
 await page.route("**/*",route=>{external.push(route.request().url());return route.abort();});
 await page.setContent(provaHtml({...base,conteudo},"Escola de teste",{draft:true,logo}),{waitUntil:"load"});
 assert.equal(await page.locator("math mfrac").count(),1);
 assert.equal(await page.locator("math msqrt").count(),1);
 const math=await page.locator("math").boundingBox();
 assert.ok(math&&math.width>0&&math.height>0,"MathML is visible");
 assert.equal(await page.locator(".linha").count(),82);
 assert.equal(await page.locator(".questao.long").count(),1);
 assert.equal(await page.locator(".draft").count(),1);
 assert.equal(await page.locator(".school-logo").count(),1);
 assert.equal(await page.locator(".screen-footer").innerText(),PROVA_FOOTER);
 const geometry=await page.evaluate(()=>{
   const paper=document.querySelector(".paper"),q=document.querySelector(".questao"),line=document.querySelector(".linha");
   const first=document.querySelector(".resposta"),box=document.querySelector(".espaco");
   return {margin:getComputedStyle(paper).paddingLeft,gap:getComputedStyle(q).marginBottom,line:line.getBoundingClientRect().height,answerGap:getComputedStyle(first).marginTop,box:box.getBoundingClientRect().height};
 });
 const px=mm=>mm*96/25.4;
 const composition=COMPOSICAO[chooseComposicao(conteudo,undefined,true)];
 for(const [actual,expected] of [[parseFloat(geometry.margin),P.marginLeft],[parseFloat(geometry.gap),composition.questionGap],[geometry.line,P.lineHeight],[parseFloat(geometry.answerGap),composition.answerGap],[geometry.box,4*P.lineHeight]])assert.ok(Math.abs(actual-px(expected))<1.5,JSON.stringify(geometry));
 await mkdir("apps/web/visual-evidence/provas",{recursive:true});
 await page.screenshot({path:"apps/web/visual-evidence/provas/preview.png",fullPage:true});
 await page.setContent(provaHtml({...base,conteudo},"Escola de teste",{nonce:"browser-test",logo}),{waitUntil:"load"});
 await page.emulateMedia({media:"print"});
 assert.equal(await page.locator(".controls").isVisible(),false);
 const pdf=await page.pdf({preferCSSPageSize:true,printBackground:true});
 const doc=await PDFDocument.load(pdf);
 assert.ok(doc.getPageCount()>=3&&doc.getPageCount()<=8,"unexpected page count: "+doc.getPageCount());
 for(const p of doc.getPages()){
   const {width,height}=p.getSize();
   assert.ok(Math.abs(width-595.28)<2&&Math.abs(height-841.89)<2,"not A4");
 }
 assert.equal(external.length,0,"unexpected external requests");
 const output="apps/web/visual-evidence/provas/prova-a4.pdf";
 await writeFile(output,pdf);
 // PDF physical coordinates, not just screen CSS. Inspect every text word on each page.
 const bbox=execFileSync("pdftotext",["-bbox",output,"-"],{encoding:"utf8"});
 const points=mm=>mm*72/25.4;
 const words=[...bbox.matchAll(/<word xMin="([^"]+)" yMin="([^"]+)" xMax="([^"]+)" yMax="([^"]+)"/g)];
 assert.ok(words.length>100,"PDF text bounds unavailable");
 for(const m of words){
   const [x1,y1,x2,y2]=m.slice(1).map(Number);
   assert.ok(x1>=points(P.marginLeft)-2&&x2<=points(P.width-P.marginRight)+2&&y1>=points(P.marginTop)-2&&y2<=points(P.height)-points(3),"text outside safe sheet: "+m[0]);
   if(y2>points(P.height-P.marginBottom)+2)assert.ok(y1>=points(P.height-P.marginBottom)-2,"text crosses body/footer boundary");
 }
 const checkFooters=path=>{
  const pages=execFileSync("pdftotext",["-layout",path,"-"],{encoding:"utf8"}).split(String.fromCharCode(12)).filter(s=>s.trim());
  for(const [i,p] of pages.entries()){assert.equal(p.split(PROVA_FOOTER).length-1,1,"one footer per physical page");const pageLabel=new RegExp("Página(?: do lote)?\\s+"+(i+1)+"\\s+de\\s+"+pages.length);assert.match(p,pageLabel,"physical page numbering");assert.ok(p.replace(PROVA_FOOTER,"").replace(pageLabel,"").trim(),"no blank footer-only pages");}
  return pages;
 };
 const assertLogo=path=>{const images=execFileSync("pdfimages",["-list",path],{encoding:"utf8"});assert.match(images,/\b80\s+40\b/,"embedded raster in actual PDF");};
 checkFooters(output);assertLogo(output);
 console.log("Physical text bounds validated:",words.length,"words");
 console.log("A4 browser smoke passed; pages:",doc.getPageCount());
 const one={matricula_id:"b0000000-0000-4000-8000-000000000001",turma_id:"80000000-0000-4000-8000-000000000001",turma:"ESG-8ª Classe-T-Z",letra:"A",curso:"Ensino Geral",turno:"M",sala:"12",nome:"Estudante ALFA",numero_processo:"P-001",numero_chamada:1};
 const two={...one,matricula_id:"b0000000-0000-4000-8000-000000000002",nome:"Estudante BETA",numero_processo:"P-002",numero_chamada:2};
 await page.setContent(provaHtml({...base,tipo_prova:"trimestral",conteudo},"Escola de teste",{nonce:"browser-batch",recipients:[one,two],logo}),{waitUntil:"load"});
 const batch=await page.pdf({preferCSSPageSize:true,printBackground:true});
 const batchDoc=await PDFDocument.load(batch);
 const batchPath="apps/web/visual-evidence/provas/lote-nominal.pdf";
 await writeFile(batchPath,batch);
 const pages=checkFooters(batchPath);assertLogo(batchPath);
 const embedded=execFileSync("pdfimages",["-list",batchPath],{encoding:"utf8"}).split("\n").filter(l=>/\b80\s+40\b/.test(l));
 assert.ok(embedded.length>=2,"logo appears for each nominal copy");
 assert.equal(pages.length,batchDoc.getPageCount(),"PDF pages must contain content");
 assert.ok(pages.length>=6,"two multi-page copies");
 assert.match(pages[0],/Estudante ALFA/);
 assert.match(pages[0],/Turma A/);
 assert.match(pages[0],/Manhã/);
 assert.doesNotMatch(pages.join("\n"),/ESG-8ª Classe-T-Z/);
 const nextPage=pages.findIndex(p=>p.includes("Estudante BETA"));
 assert.ok(nextPage>=3,"second student starts after first full copy");
 assert.ok(!pages.slice(0,nextPage).some(p=>p.includes("Estudante BETA")));
 assert.ok(!pages.slice(nextPage).some(p=>p.includes("Estudante ALFA")));
 assert.equal(pages.filter(p=>p.includes("Estudante ALFA")).length,1);
 assert.equal(pages.filter(p=>p.includes("Estudante BETA")).length,1);
 console.log("Nominal copies start on separate pages:",nextPage+1,"total:",pages.length);
 // Borderline fixture: the automatic profile fits seven two-line questions on one
 // A4 page without reducing the writing area; spacious presentation flows naturally.
 const fit=Array.from({length:7},(_,i)=>({tipo:"discursiva",texto:"Questão "+(i+1)+". Define energia.",linhas:2}));
 const pageCounts={};
 for(const mode of ["automatica","compacta","espacosa"]){
   const input={...base,apresentacao:mode,conteudo:fit};
   await page.setContent(provaHtml(input,"Escola de teste"),{waitUntil:"load"});
   assert.equal(await page.locator(".linha").count(),14);
   assert.ok(Math.abs(await page.locator(".linha").first().evaluate(el=>el.getBoundingClientRect().height)-px(P.lineHeight))<1.5);
   assert.equal(await page.locator(".paper").getAttribute("data-layout"),chooseComposicao(fit,mode));
   const data=await page.pdf({preferCSSPageSize:true,printBackground:true});
   const path="apps/web/visual-evidence/provas/paginacao-"+mode+".pdf";
   await writeFile(path,data);
   pageCounts[mode]=(await PDFDocument.load(data)).getPageCount();
   const text=checkFooters(path).join("\n");
   assert.match(text,/Questão 7/,"last question survives");
 }
 assert.equal(pageCounts.automatica,1,"automatic fit fixture");
 assert.equal(pageCounts.compacta,1,"compact fit fixture");
 assert.ok(pageCounts.espacosa>=pageCounts.automatica);
 console.log("Adaptive physical PDF page counts:",pageCounts);
 const design={...base,apresentacao:"automatica",conteudo:[
  {tipo:"discursiva",texto:"Define energia.",linhas:2,cotacao_cent:200},
  {tipo:"escolha",texto:"Qual é a unidade de energia?",linhas:0,cotacao_cent:200,alternativas:["Watt","Joule","Newton","Pascal"]},
  {tipo:"calculo",texto:"Calcula a energia cinética.",linhas:6,cotacao_cent:400}
 ]};
 await page.setContent(provaHtml(design,"Complexo Escolar Privado Adventista de Curtume",{logo}),{waitUntil:"load"});
 const cols=await page.locator(".alternativas li").evaluateAll(els=>els.map(el=>({x:el.getBoundingClientRect().x,y:el.getBoundingClientRect().y})));
 assert.ok(cols[1].x>cols[0].x&&Math.abs(cols[1].y-cols[0].y)<2,"short alternatives in row-major columns");
 assert.equal(await page.locator(".linha").count(),2);
 assert.ok(Math.abs(await page.locator(".espaco").evaluate(el=>el.getBoundingClientRect().height)-px(48))<1.5);
 const layoutPdf=await page.pdf({preferCSSPageSize:true,printBackground:true});
 const layoutPath="apps/web/visual-evidence/provas/layout-institucional.pdf";
 await writeFile(layoutPath,layoutPdf);
 assert.equal((await PDFDocument.load(layoutPdf)).getPageCount(),1);
 assert.match(checkFooters(layoutPath)[0],/Define energia/);

}finally{await browser.close();}
