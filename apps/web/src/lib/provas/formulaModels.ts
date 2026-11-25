import { mathMarkup } from "./math";

const field=(label:string,example:string)=>({label,example});
export const formulaModels=[
 {id:"fracao",label:"Fracção",sample:"\\frac{3}{4}",fields:[field("Numerador","3"),field("Denominador","4")]},
 {id:"potencia",label:"Potência",sample:"2^{3}",fields:[field("Base","2"),field("Expoente","3")]},
 {id:"raiz",label:"Raiz quadrada",sample:"\\sqrt{25}",fields:[field("Radicando","25")]},
 {id:"equacao",label:"Equação do 1.º grau",sample:"2x+5=15",fields:[field("Coeficiente de x","2"),field("Termo constante","5"),field("Segundo membro","15")]},
 {id:"quadratica",label:"Equação do 2.º grau",sample:"2x^{2}-3x+1=0",fields:[field("Coeficiente de x²","2"),field("Coeficiente de x","-3"),field("Termo constante","1")]},
 {id:"soma_fracoes",label:"Soma de fracções",sample:"\\frac{2}{3}+\\frac{1}{4}",fields:[field("1.º numerador","2"),field("1.º denominador","3"),field("2.º numerador","1"),field("2.º denominador","4")]},
 {id:"cientifica",label:"Notação científica",sample:"3.2\\times10^{5}",fields:[field("Mantissa","3.2"),field("Expoente","5")]},
 {id:"velocidade",label:"Velocidade média",sample:"v=\\frac{100}{20}",fields:[field("Distância","100"),field("Tempo","20")]},
] as const;
export type FormulaModelId=typeof formulaModels[number]["id"];
function numeric(raw:string):string|null {
 const value=raw.trim().replace(",",".");
 return value.length<=16&&/^-?\d+(?:\.\d+)?$/.test(value)?value:null;
}
const signed=(v:string)=>v.startsWith("-")?v:"+"+v;
export function modelExpression(id:FormulaModelId,values:readonly string[]):string|null {
 const model=formulaModels.find(m=>m.id===id);
 if(!model||values.length!==model.fields.length)return null;
 const terms=values.map(numeric);
 if(terms.some(v=>v===null))return null;
 const [a,b,c,d]=terms as string[];
 switch(id){
  case "fracao":return "\\frac{"+a+"}{"+b+"}";
  case "potencia":return (a.startsWith("-")?"("+a+")":a)+"^{"+b+"}";
  case "raiz":return "\\sqrt{"+a+"}";
  case "equacao":return a+"x"+signed(b)+"="+c;
  case "quadratica":return a+"x^{2}"+signed(b)+"x"+signed(c)+"=0";
  case "soma_fracoes":return "\\frac{"+a+"}{"+b+"}+\\frac{"+c+"}{"+d+"}";
  case "cientifica":return a+"\\times10^{"+b+"}";
  case "velocidade":return "v=\\frac{"+a+"}{"+b+"}";
 }
}
export function completeExpression(value:string):boolean {
 return !/\\placeholder\b|\{\s*\}/.test(value)&&Boolean(mathMarkup(value));
}
