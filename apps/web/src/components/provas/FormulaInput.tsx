"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
const loading=()=> <p role="status" className="text-sm text-muted-foreground">A carregar editor matemático...</p>;
const Mobile=dynamic(()=>import("./MobileFormulaInput"),{ssr:false,loading});
const Desktop=dynamic(()=>import("./DesktopFormulaInput"),{ssr:false,loading});
export default function FormulaInput(props:{initial:string;onInsert:(latex:string)=>void;onCancel:()=>void;disabled?:boolean}){
 // Keep the selected editor for this session: rotating a device must not discard a draft.
 const [mobile]=useState(()=>typeof window!=="undefined"&&window.matchMedia("(max-width: 639px), (pointer: coarse)").matches);
 return mobile?<Mobile {...props}/>:<Desktop {...props}/>;
}
