import { completeExpression,composeExpression,formulaModels,formulaOperators,modelExpression,modelStarter,MAX_FORMULA_PARTS,type FormulaModelId,type FormulaOperator,type FormulaPart } from "./formulaModels";

type EditablePart=Extract<FormulaPart,{model:FormulaModelId}>;
const escapeRegex=(s:string)=>s.replace(/[.*+?^{}()|[\]\\]/g,"\\$&");
const digits=["91827364","82736451","73645182","64518273"];
const letters=["J","Q","W","Z"];
const symbols:Record<string,string>={"\\alpha":"α","\\beta":"β","\\theta":"θ","\\pi":"π","\\lambda":"λ","\\mu":"μ","\\omega":"ω"};
type Matcher={model:FormulaModelId;regex:RegExp;negative:boolean[];variable:boolean[]};
// Generate reverse matchers from the forward model itself. No user-controlled regex.
// A match is accepted only when rebuilding it produces the exact original string.
function buildMatchers():Matcher[]{
 const result:Matcher[]=[];
 for(const model of [...formulaModels].sort((a,b)=>b.sample.length-a.sample.length)){
  const vars=model.fields.map(f=>f.kind==="variable");
  for(let mask=0;mask<(1<<model.fields.length);mask++){
   if(vars.some((v,i)=>v&&Boolean(mask&(1<<i))))continue;
   const negative=vars.map((v,i)=>!v&&Boolean(mask&(1<<i)));
   const markers=vars.map((v,i)=>v?letters[i]:digits[i]);
   const sample=modelExpression(model.id,markers.map((m,i)=>negative[i]?"-"+m:m));
   if(!sample)continue;
   const seen=new Set<number>();
   let pattern="";
   for(let pos=0;pos<sample.length;){
    const i=markers.findIndex(m=>sample.startsWith(m,pos));
    if(i<0){pattern+=escapeRegex(sample[pos++]);continue;}
    if(seen.has(i))pattern+="\\k<f"+i+">";
    else{
     const token=vars[i]?"(?:[A-Za-z]|\\\\(?:alpha|beta|theta|pi|lambda|mu|omega))":"\\d{1,16}(?:\\.\\d{1,15})?";
     pattern+="(?<f"+i+">"+token+")";seen.add(i);
    }
    pos+=markers[i].length;
   }
   if(seen.size===markers.length)result.push({model:model.id,regex:new RegExp("^"+pattern+"$"),negative,variable:vars});
  }
 }
 return result;
}
let matchers:Matcher[]|undefined;
function recognize(value:string,id:number,operator:FormulaOperator):EditablePart|null{
 matchers??=buildMatchers();
 for(const m of matchers){
  const match=m.regex.exec(value);
  if(!match?.groups)continue;
  const values=m.negative.map((neg,i)=>{
   const token=match.groups?.["f"+i]??"";
   return m.variable[i]?(symbols[token]??token):(neg?"-":"")+token;
  });
  if(modelExpression(m.model,values)===value)return {id,operator,model:m.model,values};
 }
 return null;
}
function topLevelParts(source:string):{operator:FormulaOperator;value:string}[]|null{
 let depth=0,round=0,square=0,start=0,operator:FormulaOperator="+";
 const parts:{operator:FormulaOperator;value:string}[]=[];
 const emit=(end:number)=>{parts.push({operator,value:source.slice(start,end)});};
 for(let i=0;i<source.length;i++){
  const c=source[i];
  if(c==="{"){depth++;continue;}if(c==="}"){depth--;continue;}
  if(c==="("){round++;continue;}if(c===")"){round--;continue;}
  if(c==="["){square++;continue;}if(c==="]"){square--;continue;}
  if(c==="\\"){
   const command=source.slice(i).match(/^\\(?:[A-Za-z]+|.)/)?.[0]??"\\";
   const op=formulaOperators.find(o=>o.id===command);
   if(!depth&&!round&&!square&&i>start&&op&&source[i+command.length]===" "){
    emit(i);operator=op.id;start=i+command.length+1;i=start-1;continue;
   }
   i+=command.length-1;continue;
  }
  if(!depth&&!round&&!square&&i>start&&["+", "-", "="].includes(c)&&!["^","_","+","-","="].includes(source[i-1])){
   emit(i);operator=c as FormulaOperator;start=i+1;
  }
 }
 emit(source.length);
 return depth===0&&round===0&&square===0&&parts.length<=12&&parts.every(p=>p.value.length>0)?parts:null;
}
export function recoverFormulaParts(source:string):FormulaPart[]{
 if(!source)return [];
 const fallback:FormulaPart[]=[{id:0,operator:"+",existing:source}];
 if(!completeExpression(source))return fallback;
 const whole=recognize(source,0,"+");
 if(whole)return [whole];
 const chunks=topLevelParts(source);
 if(!chunks||chunks.length<2)return fallback;
 const recovered=chunks.map((p,i)=>recognize(p.value,i,p.operator));
 if(recovered.some(p=>p===null))return fallback;
 const parts=recovered as EditablePart[];
 return composeExpression(parts)===source?parts:fallback;
}

export type FormulaValueSlot={start:number;end:number;value:string;singleScript:boolean};
// For non-model expressions, edit numeric literals without rebuilding the structure.
// Text/formatting commands and ambiguous unbraced arguments are deliberately opaque.
export function formulaValueSlots(source:string):FormulaValueSlot[]{
 if(!completeExpression(source))return [];
 const slots:FormulaValueSlot[]=[];
 for(let i=0;i<source.length;){
  if(source[i]==="\\"){
   const cmd=source.slice(i).match(/^\\(?:[A-Za-z]+|.)/)?.[0]??"\\";
   i+=cmd.length;
   if(["\\frac","\\dfrac","\\tfrac","\\sqrt"].includes(cmd)){
    let j=i;while(source[j]===" ")j++;
    if(cmd==="\\sqrt"&&source[j]==="["){const end=source.indexOf("]",j);if(end<0)return [];j=end+1;while(source[j]===" ")j++;}
    if(source[j]!=="{")return [];
    if(cmd!=="\\sqrt"){
     let depth=1;j++;
     while(j<source.length&&depth){if(source[j]==="{")depth++;else if(source[j]==="}")depth--;j++;}
     while(source[j]===" ")j++;
     if(depth||source[j]!=="{")return [];
    }
   }
   if(["\\text","\\mathrm","\\mathbf","\\mathit","\\vec","\\overline","\\underline","\\hat","\\bar"].includes(cmd)){
    while(source[i]===" ")i++;
    if(source[i]!=="{")return [];
    let depth=1;i++;
    while(i<source.length&&depth){if(source[i]==="{")depth++;else if(source[i]==="}")depth--;i++;}
    if(depth)return [];
   }
   continue;
  }
  if(/\d/.test(source[i])){
   let previous=i-1;while(previous>=0&&source[previous]===" ")previous--;
   const script=previous>=0&&["^","_"].includes(source[previous]);
   // Decimal literals with omitted leading zero are left intact rather than risk a second decimal point.
   if(source[i-1]==="."){i+=source.slice(i).match(/^\d+/)?.[0].length??1;continue;}
   const value=script?source[i]:source.slice(i).match(/^\d+(?:\.\d+)?/)?.[0]??source[i];
   if(value.length<=16)slots.push({start:i,end:i+value.length,value,singleScript:script});
   i+=value.length;continue;
  }
  i++;
 }
 return slots.length<=24?slots:[];
}
export function updateFormulaValues(source:string,values:readonly string[]):string|null{
 const slots=formulaValueSlots(source);
 if(!slots.length||values.length!==slots.length)return null;
 let output="",offset=0;
 for(let i=0;i<slots.length;i++){
  const slot=slots[i],value=values[i].trim().replace(",",".");
  // Signs and operators remain exactly where the author placed them.
  if(value.length>16||!/^\d+(?:\.\d+)?$/.test(value))return null;
  output+=source.slice(offset,slot.start)+(slot.singleScript&&value!==slot.value?"{"+value+"}":value);
  offset=slot.end;
 }
 output+=source.slice(offset);
 return completeExpression(output)?output:null;
}

/** Recover modular starters, terminal equality and explicit parentheses without changing stored LaTeX. */
export function recoverEditableExpression(source:string):{parts:FormulaPart[];ending:boolean}{
 if(!source)return {parts:[],ending:false};
 const fallback={parts:recoverFormulaParts(source),ending:false};
 const ending=source.endsWith("=");
 const expression=ending?source.slice(0,-1):source;
 function unpack(value:string,operator:FormulaOperator,depth=0):FormulaPart[]|null{
  if(depth>4||!value)return null;
  const whole=recognize(value,0,operator);
  if(whole){
   if(whole.model==="soma_fracoes")return modelStarter(whole.model,whole.values).map((p,i)=>({...p,id:0,operator:i? p.operator:operator}));
   return [whole];
  }
  const chunks=topLevelParts(value);
  if(chunks&&chunks.length>1){
   const children:FormulaPart[]=[];
   for(const [i,c] of chunks.entries()){const result=unpack(c.value,i?c.operator:operator,depth);if(!result)return null;children.push(...result);if(children.length>MAX_FORMULA_PARTS)return null;}
   return children;
  }
  if(value.startsWith("(")&&value.endsWith(")")){
   let level=0,wrapped=true;
   for(let i=0;i<value.length;i++){if(value[i]==="(")level++;else if(value[i]===")")level--;if(level===0&&i<value.length-1){wrapped=false;break;}}
   if(wrapped&&level===0){
    const children=unpack(value.slice(1,-1),operator,depth+1);
    if(children?.length){children[0]={...children[0],opens:(children[0].opens??0)+1};const last=children.length-1;children[last]={...children[last],closes:(children[last].closes??0)+1};return children;}
   }
  }
  return null;
 }
 const parts=unpack(expression,"+")?.map((p,id)=>({...p,id}));
 return parts&&composeExpression(parts,ending)===source?{parts,ending}:fallback;
}
