"use client";
import dynamic from "next/dynamic";
import {useRef} from "react";
const ProvasWorkspace=dynamic(()=>import("./ProvasWorkspace"),{ssr:false,loading:()=> <p role="status" className="sr-only">A carregar provas...</p>});
export default function ProvasModal({escolaId,onClose}:{escolaId:string;onClose:()=>void}){
 const trigger=useRef<HTMLElement|null>(typeof document!=="undefined"&&document.activeElement instanceof HTMLElement?document.activeElement:null);
 function dismiss(){const target=trigger.current;onClose();requestAnimationFrame(()=>{if(target?.isConnected)target.focus({preventScroll:true});});}
 return <ProvasWorkspace escolaId={escolaId} onDismiss={dismiss}/>;
}
