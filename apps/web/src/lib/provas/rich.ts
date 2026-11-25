import { z } from "zod";

// Deliberately small, versioned document format. No HTML, URLs or arbitrary node attrs.
const marks=["bold","italic","underline"] as const;
const commands=new Set("frac dfrac tfrac sqrt pi times div pm mp cdot left right sin cos tan log ln exp lim sum prod int infty in notin cup cap subset subseteq supset supseteq le leq ge geq ne neq approx equiv alpha beta gamma delta theta lambda mu sigma omega phi Delta Omega Gamma Sigma vec overline underline hat bar text mathrm mathbf mathit quad qquad degree circ percent".split(" "));
export function safeLatex(value:string):boolean{
 if(!value.trim()||value.length>300||/[\u0000-\u001f\u007f<>&$#%]/u.test(value))return false;
 let depth=0;
 for(const c of value){if(c==="{"){if(++depth>8)return false;}else if(c==="}"&&--depth<0)return false;}
 if(depth!==0)return false;
 for(const match of value.matchAll(/\\([A-Za-z]+|.)/gu)){
  if(!commands.has(match[1])&&![" ",",",";","!","(",")","[","]","|","{","}","_"].includes(match[1]))return false;
 }
 return !value.endsWith("\\");
}
export const richSegmentSchema=z.discriminatedUnion("kind",[
 z.object({kind:z.literal("text"),text:z.string().min(1).max(3000),marks:z.array(z.enum(marks)).max(3).refine(v=>new Set(v).size===v.length)}).strict(),
 z.object({kind:z.literal("break")}).strict(),
 z.object({kind:z.literal("math"),latex:z.string().max(300).refine(safeLatex,"Expressão matemática não suportada")}).strict()
]);
export const richSchema=z.object({version:z.literal(1),segments:z.array(richSegmentSchema).min(1).max(200)}).strict()
 .refine(v=>v.segments.filter(s=>s.kind==="math").length<=12,"Até 12 fórmulas por pergunta");
export type RichSegment=z.infer<typeof richSegmentSchema>;
export type RichDocument=z.infer<typeof richSchema>;
export function richText(doc:RichDocument):string{
 return doc.segments.map(s=>s.kind==="text"?s.text:s.kind==="math"?s.latex:"\n").join("").trim();
}
