"use client";
import {useState} from "react";
import {parseCotacao} from "@/lib/provas/cotacao";
import {formatCotacao} from "@/lib/provas/questionTemplates";
const format=(v:number|undefined)=>v===undefined?"":formatCotacao(v);
export default function CotacaoInput({value,onChange,disabled,label,className}:{value:number|undefined;onChange:(v:number|undefined)=>void;disabled:boolean;label:string;className:string}){
 const [local,setLocal]=useState({value,raw:format(value)});
 if(local.value!==value)setLocal({value,raw:format(value)});
 return <input type="text" inputMode="decimal" aria-label={label} className={className} placeholder="Ex.: 2,5" value={local.value===value?local.raw:format(value)} disabled={disabled} onBlur={()=>setLocal({value,raw:format(value)})} onChange={e=>{
  const next=e.target.value;
  if(!/^(?:\d{1,2}(?:[.,]\d{0,2})?)?$/.test(next))return;
  const cent=parseCotacao(next);setLocal({value:cent,raw:next});onChange(cent);
 }}/>;
}
