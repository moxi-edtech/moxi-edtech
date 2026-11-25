import { NextResponse } from "next/server";
import { provaAccess } from "@/lib/provas/access";
import { parseDistribution,distributionError,distributionResult,rpcArgs,recipientSchema,turmaSchema } from "@/lib/provas/distribution";
export const dynamic="force-dynamic";
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"}});
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 const access=await provaAccess((await params).id);
 if(!access.ok)return json({error:"Acesso não autorizado."},access.status);
 if(!access.distribute)return json({error:"Sem autorização para distribuição nominal."},403);
 const parsed=parseDistribution(new URL(req.url).searchParams);
 if(!parsed.success)return json({error:"Selecção inválida."},400);
 const result=await access.db.rpc("provas_destinatarios",rpcArgs(access.escolaId,parsed.data));
 if(result.error){const e=distributionError(result.error);return json({error:e.message},e.status);}
 const valid=distributionResult.safeParse(result.data);
 if(!valid.success)return json({error:"Resposta de distribuição inválida."},500);
 const items=(parsed.data.modo==="turmas"?turmaSchema.array():recipientSchema.array()).safeParse(valid.data.items);
 if(!items.success)return json({error:"Destinatários inválidos."},500);
 return json({...valid.data,items:items.data});
}
