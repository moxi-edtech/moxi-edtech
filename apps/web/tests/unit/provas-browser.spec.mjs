import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const require=createRequire(import.meta.url);
const { provaHtml }=require("../../src/lib/provas/print.ts");
const { PDFDocument }=require("pdf-lib");
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
 await page.setContent(provaHtml({...base,conteudo},"Escola de teste",{draft:true}),{waitUntil:"load"});
 assert.equal(await page.locator("math mfrac").count(),1);
 assert.equal(await page.locator("math msqrt").count(),1);
 const math=await page.locator("math").boundingBox();
 assert.ok(math&&math.width>0&&math.height>0,"MathML is visible");
 assert.equal(await page.locator(".linha").count(),82);
 assert.equal(await page.locator(".questao.long").count(),1);
 assert.equal(await page.locator(".draft").count(),1);
 await mkdir("apps/web/visual-evidence/provas",{recursive:true});
 await page.screenshot({path:"apps/web/visual-evidence/provas/preview.png",fullPage:true});
 await page.setContent(provaHtml({...base,conteudo},"Escola de teste",{nonce:"browser-test"}),{waitUntil:"load"});
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
 await writeFile("apps/web/visual-evidence/provas/prova-a4.pdf",pdf);
 console.log("A4 browser smoke passed; pages:",doc.getPageCount());
}finally{await browser.close();}
