import { notFound } from "next/navigation";
import ProvasWorkspace from "./ProvasWorkspace";
import { provaAccess } from "@/lib/provas/access";
import { PORTAL_PAGE_INSET } from "@/lib/layout/portal-page";

/** Portal entry points share the same authorized workspace, not another document engine. */
export default async function ProvasPortalPage({escolaParam,portal}:{escolaParam:string;portal:"secretaria"|"operacoes"}){
 const access=await provaAccess(escolaParam);
 if(!access.ok||!access.distribute)notFound();
 const printOnly=!access.admin;
 return <div className={PORTAL_PAGE_INSET+(portal === "professor" ? " max-md:px-0 max-md:py-0" : " max-sm:px-2 max-sm:py-4")}><ProvasWorkspace key={access.escolaId+":"+portal} escolaId={access.escolaId} printOnly={printOnly}/></div>;
}
