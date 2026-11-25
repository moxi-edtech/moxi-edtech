import { mathMarkup } from "./math";

export const formulaCategories=["Aritmética","Álgebra","Geometria","Trigonometria","Análise","Física"] as const;
export type FormulaCategory=typeof formulaCategories[number];
type ModelField={label:string;example:string;kind:"number"|"variable"};
const field=(label:string,example:string,kind:ModelField["kind"]="number"):ModelField=>({label,example,kind});
export const formulaModels=[
 {id:"numero",category:"Aritmética",label:"Número",sample:"3",fields:[field("Valor","3")]},
 {id:"fracao",category:"Aritmética",label:"Fracção",sample:"\\frac{3}{4}",fields:[field("Numerador","3"),field("Denominador","4")]},
 {id:"potencia",category:"Aritmética",label:"Potência",sample:"2^{3}",fields:[field("Base","2"),field("Expoente","3")]},
 {id:"raiz",category:"Aritmética",label:"Raiz quadrada",sample:"\\sqrt{25}",fields:[field("Radicando","25")]},
 {id:"soma_fracoes",category:"Aritmética",label:"Operações com fracções",sample:"\\frac{2}{3}+\\frac{1}{4}",fields:[field("1.º numerador","2"),field("1.º denominador","3"),field("2.º numerador","1"),field("2.º denominador","4")]},
 {id:"cientifica",category:"Aritmética",label:"Notação científica",sample:"3.2\\times10^{5}",fields:[field("Mantissa","3.2"),field("Expoente","5")]},
 {id:"variavel",category:"Álgebra",label:"Variável",sample:"x",fields:[field("Variável","x","variable")]},
 {id:"equacao",category:"Álgebra",label:"Equação do 1.º grau",sample:"2x+5=15",fields:[field("Coeficiente de x","2"),field("Termo constante","5"),field("Segundo membro","15")]},
 {id:"quadratica",category:"Álgebra",label:"Equação do 2.º grau",sample:"2x^{2}-3x+1=0",fields:[field("Coeficiente de x²","2"),field("Coeficiente de x","-3"),field("Termo constante","1")]},
 {id:"fracao_algebrica",category:"Álgebra",label:"Fracção algébrica",sample:"\\frac{3x+2}{5}",fields:[field("Coeficiente","3"),field("Variável","x","variable"),field("Constante","2"),field("Denominador","5")]},
 {id:"exponencial",category:"Álgebra",label:"Equação exponencial",sample:"2^{x+1}=16",fields:[field("Base","2"),field("Variável","x","variable"),field("Termo no expoente","1"),field("Segundo membro","16")]},
 {id:"radical_algebrico",category:"Álgebra",label:"Radical algébrico",sample:"\\sqrt{3x^{2}+5}",fields:[field("Coeficiente","3"),field("Variável","x","variable"),field("Expoente","2"),field("Constante","5")]},
 {id:"resolvente",category:"Álgebra",label:"Fórmula resolvente",sample:"\\frac{-b\\pm\\sqrt{b^{2}-4ac}}{2a}",fields:[field("Coeficiente a","a","variable"),field("Coeficiente b","b","variable"),field("Coeficiente c","c","variable")]},
 {id:"logaritmo",category:"Álgebra",label:"Logaritmo",sample:"\\log_{2}(32)",fields:[field("Base","2"),field("Argumento","32")]},
 {id:"pitagoras",category:"Geometria",label:"Teorema de Pitágoras",sample:"c^{2}=3^{2}+4^{2}",fields:[field("Hipotenusa","c","variable"),field("1.º cateto","3"),field("2.º cateto","4")]},
 {id:"circulo",category:"Geometria",label:"Área do círculo",sample:"A=\\pi\\times5^{2}",fields:[field("Raio","5")]},
 {id:"triangulo",category:"Geometria",label:"Área do triângulo",sample:"A=\\frac{6\\times4}{2}",fields:[field("Base","6"),field("Altura","4")]},
 {id:"seno",category:"Trigonometria",label:"Seno",sample:"\\sin(30^{\\circ})",fields:[field("Ângulo em graus","30")]},
 {id:"cosseno",category:"Trigonometria",label:"Cosseno",sample:"\\cos(60^{\\circ})",fields:[field("Ângulo em graus","60")]},
 {id:"tangente",category:"Trigonometria",label:"Tangente",sample:"\\tan(45^{\\circ})",fields:[field("Ângulo em graus","45")]},
 {id:"identidade_trig",category:"Trigonometria",label:"Identidade trigonométrica",sample:"\\sin^{2}\\theta+\\cos^{2}\\theta=1",fields:[field("Ângulo","θ","variable")]},
 {id:"integral",category:"Análise",label:"Integral definida",sample:"\\int_{0}^{2}x^{2}\\,dx",fields:[field("Limite inferior","0"),field("Limite superior","2"),field("Variável","x","variable"),field("Expoente","2")]},
 {id:"limite",category:"Análise",label:"Limite",sample:"\\lim_{x→0}\\frac{\\sin x}{x}",fields:[field("Variável","x","variable"),field("Tende a","0")]},
 {id:"somatorio",category:"Análise",label:"Somatório",sample:"\\sum_{n=1}^{5}n^{2}",fields:[field("Índice","n","variable"),field("Início","1"),field("Fim","5"),field("Expoente","2")]},
 {id:"velocidade",category:"Física",label:"Velocidade média",sample:"v=\\frac{100}{20}",fields:[field("Distância","100"),field("Tempo","20")]},
 {id:"energia",category:"Física",label:"Energia cinética",sample:"E_{c}=\\frac{mv^{2}}{2}",fields:[field("Massa","m","variable"),field("Velocidade","v","variable")]},
 {id:"forca",category:"Física",label:"Força",sample:"F=5\\times3",fields:[field("Massa","5"),field("Aceleração","3")]},
] as const satisfies readonly {id:string;category:FormulaCategory;label:string;sample:string;fields:readonly ModelField[]}[];
export type FormulaModelId=typeof formulaModels[number]["id"];
function numeric(raw:string):string|null {
 const value=raw.trim().replace(",",".");
 return value.length<=16&&/^-?\d+(?:\.\d+)?$/.test(value)?value:null;
}
const greek:Record<string,string>={"α":"\\alpha","β":"\\beta","θ":"\\theta","π":"\\pi","λ":"\\lambda","μ":"\\mu","ω":"\\omega"};
export function variable(raw:string):string|null {
 const v=raw.trim();
 return /^[A-Za-z]$/.test(v)?v:Object.prototype.hasOwnProperty.call(greek,v)?greek[v]:numeric(v);
}
const signed=(v:string)=>v.startsWith("-")?v:"+"+v;
const grouped=(v:string)=>v.startsWith("-")?"("+v+")":v;
const power=(a:string,b:string)=>grouped(a)+"^{"+b+"}";
export function modelExpression(id:FormulaModelId,values:readonly string[]):string|null {
 const model=formulaModels.find(m=>m.id===id);
 if(!model||values.length!==model.fields.length)return null;
 const terms=values.map((v,i)=>model.fields[i].kind==="variable"?variable(v):numeric(v));
 if(terms.some(v=>v===null))return null;
 const [a,b,c,d]=terms as string[];
 switch(id){
  case "numero":case "variavel":return a;
  case "fracao":return "\\frac{"+a+"}{"+b+"}";
  case "potencia":return power(a,b);
  case "raiz":return "\\sqrt{"+a+"}";
  case "equacao":return a+"x"+signed(b)+"="+c;
  case "quadratica":return a+"x^{2}"+signed(b)+"x"+signed(c)+"=0";
  case "soma_fracoes":return "\\frac{"+a+"}{"+b+"}+\\frac{"+c+"}{"+d+"}";
  case "cientifica":return a+"\\times10^{"+b+"}";
  case "fracao_algebrica":return "\\frac{"+a+b+signed(c)+"}{"+d+"}";
  case "exponencial":return grouped(a)+"^{"+b+signed(c)+"}="+d;
  case "radical_algebrico":return "\\sqrt{"+a+power(b,c)+signed(d)+"}";
  case "resolvente":return "\\frac{-"+grouped(b)+"\\pm\\sqrt{"+power(b,"2")+"-4"+(numeric(a)? "\\times"+grouped(a):a)+(numeric(c)?"\\times"+grouped(c):c)+"}}{2"+(numeric(a)?"\\times"+grouped(a):a)+"}";
  case "logaritmo":return "\\log_{"+a+"}("+b+")";
  case "pitagoras":return power(a,"2")+"="+power(b,"2")+"+"+power(c,"2");
  case "circulo":return "A=\\pi\\times"+power(a,"2");
  case "triangulo":return "A=\\frac{"+a+"\\times"+grouped(b)+"}{2}";
  case "seno":return "\\sin("+a+"^{\\circ})";
  case "cosseno":return "\\cos("+a+"^{\\circ})";
  case "tangente":return "\\tan("+a+"^{\\circ})";
  case "identidade_trig":return "\\sin^{2}"+a+"+\\cos^{2}"+a+"=1";
  case "integral":return "\\int_{"+a+"}^{"+b+"}"+power(c,d)+"\\,d"+c;
  case "limite":return "\\lim_{"+a+"→"+b+"}\\frac{\\sin "+a+"}{"+a+"}";
  case "somatorio":return "\\sum_{"+a+"="+b+"}^{"+c+"}"+power(a,d);
  case "velocidade":return "v=\\frac{"+a+"}{"+b+"}";
  case "energia":return "E_{c}=\\frac{"+a+(numeric(b)?"\\times":"")+power(b,"2")+"}{2}";
  case "forca":return "F="+a+"\\times"+grouped(b);
 }
}
export const formulaOperators=[{id:"+",label:"+"},{id:"-",label:"−"},{id:"\\times",label:"×"},{id:"\\div",label:"÷"},{id:"=",label:"="},{id:"\\pm",label:"±"},{id:"\\leq",label:"≤"},{id:"\\geq",label:"≥"},{id:"\\neq",label:"≠"}] as const;
export type FormulaOperator=typeof formulaOperators[number]["id"];
export type FormulaPart={id:number;operator:FormulaOperator;opens?:number;closes?:number}&({model:FormulaModelId;values:string[]}|{existing:string});
export function completeExpression(value:string):boolean {
 return !/\\placeholder\b|\{\s*\}/.test(value)&&Boolean(mathMarkup(value));
}
export function partExpression(part:FormulaPart){return "existing" in part?part.existing:modelExpression(part.model,part.values);}
export const MAX_FORMULA_PARTS=12;
export function composeExpression(parts:readonly FormulaPart[],ending=false):string|null {
 if(parts.length===0||parts.length>MAX_FORMULA_PARTS)return null;
 const terms=parts.map(partExpression);
 if(terms.some(v=>v===null))return null;
 let depth=0;
 for(const part of parts){const opens=part.opens??0,closes=part.closes??0;if(!Number.isInteger(opens)||!Number.isInteger(closes)||opens<0||closes<0||opens>4||closes>4)return null;depth+=opens;if(depth>4)return null;depth-=closes;if(depth<0)return null;}
 if(depth)return null;
 const output=terms.map((v,i)=>(i===0?"":parts[i].operator+(parts[i].operator.startsWith("\\")?" ":""))+"(".repeat(parts[i].opens??0)+v+")".repeat(parts[i].closes??0)).join("")+(ending?"=":"");
 return completeExpression(output)?output:null;
}

/** A starter may expand into independent, editable terms instead of a fixed equation. */
export function modelStarter(id:FormulaModelId,values:readonly string[]):Omit<Extract<FormulaPart,{model:FormulaModelId}>,"id">[]{
 if(id==="soma_fracoes")return [{operator:"+",model:"fracao",values:values.slice(0,2)},{operator:"+",model:"fracao",values:values.slice(2,4)}];
 return [{operator:"+",model:id,values:[...values]}];
}
