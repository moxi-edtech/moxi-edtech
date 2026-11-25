import { redirect } from "next/navigation";
import ExpedienteWorkspace from "@/components/secretaria/ExpedienteWorkspace";
import { daySchema, expedienteAccess, todayLuanda } from "@/lib/secretaria/expediente";
export const dynamic = "force-dynamic";
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{date?:string;history?:string;view?:string}>}){
 const {id}=await params;
 const access=await expedienteAccess(id);
 if(!access.ok)redirect("/redirect");
 const queryParams=await searchParams;
 const query=daySchema.safeParse(queryParams.date);
 const date=query.success&&query.data<=todayLuanda()?query.data:todayLuanda();
 return <ExpedienteWorkspace escolaId={access.escolaId} initialDate={date} portal="secretaria" initialHistory={queryParams.history==="1"} initialCash={queryParams.view==="cash"}/>;
}
