import { NextResponse } from "next/server";
import { z } from "zod";
import { provaAccess,summaryColumns,detailColumns } from "@/lib/provas/access";
import { mutationSchema } from "@/lib/provas/schema";
import { loadProvaLogo } from "@/lib/provas/loadLogo";
export const dynamic="force-dynamic";
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"private, no-store"}});
type Context={params:Promise<{id:string}>};
export async function GET(req:Request,{params}:Context){
 const access=await provaAccess((await params).id);
 if(!access.ok)return json({error:"Acesso não autorizado."},access.status);
 const {db,escolaId}=access;
 const query=new URL(req.url).searchParams;
 if(query.get("branding")==="1"){
   const school=await db.from("escolas").select("logo_url").eq("id",escolaId).maybeSingle();
   return json({logo:school.error?null:await loadProvaLogo(school.data?.logo_url,escolaId)});
 }
 if(query.get("contexto")==="1"){
   if(!access.author)return json({error:"Sem autorização para elaborar provas."},403);
   const ano=query.get("ano");
   if(ano!==null&&!z.string().uuid().safeParse(ano).success)return json({error:"Ano lectivo inválido."},400);
   const result=await db.rpc("provas_contexto",{p_escola:escolaId,p_ano:ano});
   if(result.error)return json({error:"Contexto académico indisponível. Consulte a Direção."},result.error.code==="42501"?403:result.error.code==="22023"?409:500);
   return json({items:result.data??[]});
 }
 const printOnly=query.get("aprovadas")==="1";
 if(printOnly&&!access.distribute)return json({error:"Sem autorização para distribuição."},403);
 const id=query.get("prova");
 if(id){
   if(!z.string().uuid().safeParse(id).success)return json({error:"Identificador inválido."},400);
   const detail=db.from("provas_pedagogicas").select(detailColumns).eq("escola_id",escolaId).eq("id",id);
   const result=await (printOnly?detail.eq("estado","aprovada"):detail).maybeSingle();
   if(result.error)return json({error:"Não foi possível consultar a prova."},500);
   if(!result.data)return json({error:"Prova não encontrada."},404);
   return json({prova:result.data});
 }
 const offset=Number(query.get("offset")??0);
 if(!Number.isSafeInteger(offset)||offset<0||offset>10000)return json({error:"Página inválida."},400);
 const list=db.from("provas_pedagogicas").select(summaryColumns).eq("escola_id",escolaId);
 const [result,school]=await Promise.all([
   (printOnly?list.eq("estado","aprovada"):list).order("atualizado_em",{ascending:false}).order("id",{ascending:false}).range(offset,offset+29),
   db.from("escolas").select("nome").eq("id",escolaId).maybeSingle()
 ]);
 if(result.error||school.error||!school.data)return json({error:"Não foi possível consultar as provas."},500);
 return json({provas:result.data??[],escola:school.data.nome,permissions:{author:!printOnly&&access.author,admin:!printOnly&&access.admin,distribute:access.distribute,userId:access.userId}});
}
export async function POST(req:Request,{params}:Context){
 const access=await provaAccess((await params).id);
 if(!access.ok)return json({error:"Acesso não autorizado."},access.status);
 if(!access.author)return json({error:"Sem autorização para editar provas."},403);
 // Only same-origin browser writes; content is never included in error logs.
 const origin=req.headers.get("origin");
 if(origin&&origin!==new URL(req.url).origin)return json({error:"Origem inválida."},403);
 if(!req.headers.get("content-type")?.includes("application/json"))return json({error:"Formato inválido."},415);
 const body=await req.text();
 if(new TextEncoder().encode(body).byteLength>160000)return json({error:"Prova demasiado extensa."},413);
 let raw:unknown;
 try{raw=JSON.parse(body);}catch{return json({error:"Pedido inválido."},400);}
 const parsed=mutationSchema.safeParse(raw);
 if(!parsed.success)return json({error:"Verifique os campos e as perguntas da prova."},400);
 const data=parsed.data;
 const result=await access.db.rpc("provas_mutar",{p_escola:access.escolaId,p_id:"id" in data?data.id:null,p_versao:"versao" in data?data.versao:null,p_acao:data.acao,p_dados:"dados" in data?data.dados:null});
 if(result.error){
   const status=result.error.code==="40001"?409:result.error.code==="42501"?403:result.error.code?.startsWith("22")||result.error.code?.startsWith("23")?400:500;
   if(result.error.code==="22023"&&result.error.message==="invalid_exam_cotacao")return json({error:"A cotação deve corresponder à escala da classe, com valores positivos em todas as perguntas numéricas."},400);
   if(result.error.code==="22023"&&result.error.message==="unavailable_exam_scale")return json({error:"Escala indisponível ou incompatível entre turmas. Consulte a Direção."},400);
   return json({error:status===409?"A prova foi alterada. Reabra a versão mais recente.":status===403?result.error.message==="invalid_academic_context"?"Seleccione um contexto académico publicado e autorizado.":"Operação não autorizada neste estado.":status===400?"Verifique os dados e o estado da prova.":"Não foi possível guardar a prova."},status);
 }
 return json({prova:result.data});
}
