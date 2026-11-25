import React,{useState} from "react";
import { createRoot } from "react-dom/client";
import ProvasWorkspace from "../src/components/provas/ProvasWorkspace";
import ProvasModal from "../src/components/provas/ProvasModal";
import "./fixture.css";
import "../src/app/globals.css";
const escolaId="00000000-0000-4000-8000-000000000001";
const query=new URLSearchParams(location.search);
function Fixture(){
 const [open,setOpen]=useState(false);
 return query.get("modal")==="1"?<><button type="button" onClick={()=>setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>Abrir central de provas</button>{open&&<ProvasModal escolaId={escolaId} onClose={()=>setOpen(false)}/>}</>:<ProvasWorkspace teacherWizard={query.get("portal")!=="secretaria"} escolaId={escolaId} printOnly={query.get("portal")==="secretaria"}/>;
}
createRoot(document.getElementById("root")!).render(<main className="mx-auto w-full min-w-0 max-w-6xl px-6 py-8 max-sm:px-2 max-sm:py-4"><Fixture/></main>);
