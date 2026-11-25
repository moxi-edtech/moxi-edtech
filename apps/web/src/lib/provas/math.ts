import katex from "katex";
import { safeLatex } from "./rich";
export function escapeText(value:unknown):string {
 return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"} as Record<string,string>)[c]);
}
// MathML requires no external CSS/fonts and is natively rendered in modern browsers.
// Never enable trust; no user macros, external resources or arbitrary HTML.
export function mathMarkup(latex:string):string|null{
 if(!safeLatex(latex))return null;
 try{return katex.renderToString(latex,{output:"mathml",trust:false,throwOnError:true,strict:"error",maxExpand:100,maxSize:10,macros:{}});}
 catch{return null;}
}
