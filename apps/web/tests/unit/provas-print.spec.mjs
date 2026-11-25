import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
// tsx registers the TS require hook; the web package uses CommonJS semantics.
const require = createRequire(import.meta.url);
const { provaHtml } = require("../../src/lib/provas/print.ts");
const base={titulo:"Prova",classe:"8.ª Classe",disciplina:"Física",ano_lectivo:"2026/2027",trimestre:1,duracao:90,serie:"A",conteudo:[
 {tipo:"grupo",texto:"I Grupo",linhas:0},{tipo:"discursiva",texto:"Define energia.",linhas:2},{tipo:"alinea",texto:"Justifica.",linhas:1},{tipo:"verdadeiro_falso",texto:"A Terra gira.",linhas:0},
 {tipo:"grupo",texto:"II Grupo",linhas:0},{tipo:"calculo",texto:"√9 = ",linhas:4}]};
test("A4 renderer numbers questions, resets groups, and supports handwriting space",()=>{
 const html=provaHtml(base,"Curtume");
 assert.match(html,/@page\{size:A4/);
 assert.match(html,/1\. Define energia\./);
 assert.match(html,/a\) Justifica\./);
 assert.match(html,/2\. A Terra gira\.<span class="vf"/);
 assert.match(html,/1\. √9/);
 assert.equal((html.match(/class="linha"/g)||[]).length,3);
 assert.match(html,/height:32mm/);
 assert.match(html,/Ano lectivo: 2026\/2027/);
});
test("all user values are escaped, draft preview contains no script or external resources",()=>{
 const evil='<img src=x onerror=alert(1)><script>alert(1)</script>';
 const html=provaHtml({...base,titulo:evil,disciplina:evil,conteudo:[{tipo:"texto",texto:evil,linhas:0}]},evil,{draft:true});
 assert.doesNotMatch(html,/<(?:script|img)\b/i);
 assert.match(html,/&lt;img/);
 assert.match(html,/RASCUNHO/);
 assert.doesNotMatch(html,/window\.print/);
});
test("approved print uses only a nonce-bound fixed script, preview line count is bounded",()=>{
 const html=provaHtml({...base,conteudo:[{tipo:"discursiva",texto:"Q",linhas:1e9}]}, "Curtume",{nonce:"nonce-1"});
 assert.equal((html.match(/class="linha"/g)||[]).length,20);
 assert.match(html,/<script nonce="nonce-1">/);
 assert.match(html,/window\.print/);
});

test("rich text and KaTeX MathML share the escaped A4 renderer",()=>{
 const formula="\\frac{2}{5}+\\sqrt{9}";
 const evil="<img src=x onerror=alert(1)>";
 const rich={version:1,segments:[{kind:"text",text:evil,marks:["bold","italic"]},{kind:"break"},{kind:"math",latex:formula}]};
 const html=provaHtml({...base,conteudo:[{tipo:"calculo",texto:evil+"\n"+formula,linhas:2,rich}]},"Curtume");
 assert.match(html,/<em><strong>&lt;img/);
 assert.match(html,/<math\b/);
 assert.match(html,/<mfrac>/);
 assert.match(html,/<msqrt>/);
 assert.doesNotMatch(html,/<img\b|<script\b|<a\b/);
});
test("untrusted commands never generate active markup",()=>{
 for(const latex of ["\\href{https://evil.test}{x}","\\includegraphics{evil}","\\htmlClass{x}{y}","\\def\\x{\\x}\\x","\\frac{1}"]){
  const rich={version:1,segments:[{kind:"math",latex}]};
  const html=provaHtml({...base,conteudo:[{tipo:"calculo",texto:latex,linhas:0,rich}]},"Curtume");
  assert.doesNotMatch(html,/<math\b|<img\b|<a\b|<script\b/);
 }
});

test("write contract retains required academic UUIDs while print uses snapshots",()=>{
 const {provaSchema,provaWriteSchema,mutationSchema}=require("../../src/lib/provas/schema.ts");
 const input={...base,ano_letivo_id:"20000000-0000-4000-8000-000000000001",curso_matriz_id:"70000000-0000-4000-8000-000000000001"};
 const parsed=provaWriteSchema.parse(input);
 assert.equal(parsed.ano_letivo_id,input.ano_letivo_id);
 assert.equal(parsed.curso_matriz_id,input.curso_matriz_id);
 assert.equal(mutationSchema.safeParse({acao:"criar",dados:parsed}).success,true);
 assert.equal(provaWriteSchema.safeParse(base).success,false);
 assert.equal(provaWriteSchema.safeParse({...input,curso_matriz_id:"invalid"}).success,false);
 assert.equal(provaSchema.safeParse(base).success,true);
});

test("shared physical layout reserves print margins and exact writing space",()=>{
 const {PROVA_PAPER,respostaLayout}=require("../../src/lib/provas/layout.ts");
 assert.equal(PROVA_PAPER.marginLeft,20);assert.equal(PROVA_PAPER.marginRight,20);
 assert.equal(PROVA_PAPER.marginTop,18);assert.equal(PROVA_PAPER.marginBottom,18);
 assert.equal(PROVA_PAPER.questionGap,6);assert.equal(PROVA_PAPER.answerGap,3);
 assert.equal(respostaLayout("discursiva",6).heightMm,48);
 assert.equal(respostaLayout("calculo",1).heightMm,24);
 assert.equal(respostaLayout("desenho",0).heightMm,0);
 assert.equal(respostaLayout("desenho",20).heightMm,160);
 assert.equal(respostaLayout("grupo",20).kind,"none");
 const html=provaHtml({...base,conteudo:[{tipo:"desenho",texto:"Desenhe.",linhas:0},{tipo:"calculo",texto:"Calcule.",linhas:6},{tipo:"discursiva",texto:"Explique.",linhas:3}]},"Curtume");
 assert.match(html,/@page\{size:A4;margin:18mm 20mm 18mm 20mm\}/);
 assert.match(html,/height:48mm/);
 assert.equal((html.match(/class="espaco"/g)||[]).length,1);
 assert.equal((html.match(/class="linha"/g)||[]).length,3);
 assert.match(html,/class="resposta resposta-inicio"/);
 assert.match(html,/class="student-line"/);
 assert.doesNotMatch(html,/_{20,}/);
});
