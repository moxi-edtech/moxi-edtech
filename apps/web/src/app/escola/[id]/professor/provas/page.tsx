import { redirect } from "next/navigation";
import ProvasWorkspace from "@/components/provas/ProvasWorkspace";
import { provaAccess } from "@/lib/provas/access";
import { PORTAL_PAGE_INSET } from "@/lib/layout/portal-page";
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{id:string}>}){
 const access=await provaAccess((await params).id);
 if(!access.ok||!access.author)redirect("/redirect");
 return <div className={PORTAL_PAGE_INSET+" max-sm:px-2 max-sm:py-4"}><ProvasWorkspace key={access.escolaId} escolaId={access.escolaId}/></div>;
}
