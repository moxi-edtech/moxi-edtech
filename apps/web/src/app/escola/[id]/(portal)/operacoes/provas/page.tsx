import ProvasPortalPage from "@/components/provas/ProvasPortalPage";
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{id:string}>}){
 return <ProvasPortalPage escolaParam={(await params).id} portal="operacoes"/>;
}
