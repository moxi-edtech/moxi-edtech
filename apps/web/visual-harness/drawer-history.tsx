import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { PortalDrawerNavigator, PortalDrawerPushButton, usePortalDrawerGuard } from "@/components/portal/ui/PortalDrawerNavigator";

function Child() {
  const [value,setValue]=useState("");
  const [busy,setBusy]=useState(false);
  usePortalDrawerGuard(Boolean(value),busy);
  return <><label>Rascunho<input value={value} onChange={event=>setValue(event.target.value)} /></label><button onClick={()=>setBusy(v=>!v)}>{busy?"Terminar operação":"Iniciar operação"}</button><a href="?route=other">Sair da rota</a></>;
}
function Workspace({scope}:{scope:string}) {
  const [a,setA]=useState(false), [b,setB]=useState(false);
  return <>
    <p data-testid="scope">{scope}</p>
    <button onClick={()=>{setB(false);setA(true)}}>Abrir A</button>
    <button onClick={()=>{setA(false);setB(true)}}>Abrir B</button>
    <PortalDrawerNavigator open={a} onClose={()=>setA(false)} onReopen={()=>setA(true)} root={{id:scope+":a",title:"Drawer A",description:"Raiz A",content:<PortalDrawerPushButton frame={{id:scope+":a:child",title:"Filho A",description:"Editor",content:<Child/>}}>Abrir filho</PortalDrawerPushButton>}}/>
    <PortalDrawerNavigator open={b} onClose={()=>setB(false)} onReopen={()=>setB(true)} root={{id:scope+":b",title:"Drawer B",description:"Raiz B",content:<Child/>}}/>
  </>;
}
function App() {
  const [scope,setScope]=useState(new URLSearchParams(location.search).get("school")??"a");
  useEffect(()=>{
    const sync=()=>setScope(new URLSearchParams(location.search).get("school")??"a");
    window.addEventListener("popstate",sync);
    window.addEventListener("fixture-scope",sync);
    return ()=>{window.removeEventListener("popstate",sync);window.removeEventListener("fixture-scope",sync)};
  },[]);
  return <Workspace key={scope} scope={scope}/>;
}
history.replaceState({...history.state,fixtureRouter:"retained"},"");
createRoot(document.getElementById("root")!).render(<StrictMode><App/></StrictMode>);
