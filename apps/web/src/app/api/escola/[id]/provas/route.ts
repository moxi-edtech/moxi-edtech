import { NextResponse } from "next/server";
import { z } from "zod";
import { provaAccess,summaryColumns,detailColumns } from "@/lib/provas/access";
import { mutationSchema,blockSchema,TIPOS_PROVA } from "@/lib/provas/schema";
import { groupSummaries } from "@/lib/provas/questionTemplates";
import { EXAM_REQUEST_MAX_BYTES } from "@/lib/provas/figures";
import { loadProvaLogo } from "@/lib/provas/loadLogo";
export const dynamic="force-dynamic";
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"private, no-store"}});
type Context={params:Promise<{id:string}>};
export async function GET(req:Request,{params}:Context){
 const access=await provaAccess((await params).id);
 if(!access.ok)return json({error:"Acesso não autorizado."},access.status);
 const {db,escolaId}=access;
 const query=new URL(req.url).searchParams;
 if(query.get("professores")==="1"){
   if(!access.admin)return json({error:"Sem autorização."},403);
   const r=await db.from("professores").select("id,nome,nome_completo").eq("escola_id",escolaId).order("nome").order("id").limit(1001);
   if(r.error||r.data?.length>1000)return json({error:"Não foi possível consultar o catálogo docente."},409);
   return json({items:(r.data??[]).map((p:{id:string;nome:string|null;nome_completo:string|null})=>({id:p.id,nome:p.nome_completo||p.nome||"Professor sem nome"}))});
 }
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
 const filters=z.object({professor:z.string().uuid().optional(),tipo:z.enum(TIPOS_PROVA).optional(),estado:z.enum(["rascunho","em_revisao","aprovada","arquivada"]).optional(),trimestre:z.enum(["1","2","3"]).optional(),ano:z.string().regex(/^\d{4}\/\d{4}$/).optional(),classe:z.string().trim().min(1).max(80).optional(),disciplina:z.string().trim().min(1).max(120).optional(),autoria:z.enum(["sistema","utilizador"]).optional(),periodo:z.enum(["sem_data","futuras","passadas"]).optional()}).safeParse(Object.fromEntries(["professor","tipo","estado","trimestre","ano","classe","disciplina","autoria","periodo"].flatMap(k=>query.has(k)?[[k,query.get(k)]]:[])));
 if(!filters.success)return json({error:"Filtros inválidos."},400);
 const f=filters.data;
 if(f.professor&&!access.admin)return json({error:"Sem autorização para filtro docente."},403);
 let list=(f.professor?db.rpc("provas_por_professor",{p_escola:escolaId,p_professor:f.professor}).select(summaryColumns):db.from("provas_pedagogicas").select(summaryColumns)).eq("escola_id",escolaId);
 if(f.tipo)list=list.eq("tipo_prova",f.tipo);
 if(f.estado)list=list.eq("estado",f.estado);
 if(f.trimestre)list=list.eq("trimestre",Number(f.trimestre));
 if(f.ano)list=list.eq("ano_lectivo",f.ano);
 if(f.classe)list=list.eq("classe",f.classe);
 if(f.disciplina)list=list.eq("disciplina",f.disciplina);
 if(f.autoria)list=f.autoria==="sistema"?list.is("autor_id",null):list.not("autor_id","is",null);
 const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Luanda",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 const today=["year","month","day"].map(k=>parts.find(p=>p.type===k)?.value).join("-");
 if(f.periodo==="sem_data")list=list.is("data_realizacao",null);
 if(f.periodo==="futuras")list=list.gte("data_realizacao",today);
 if(f.periodo==="passadas")list=list.lt("data_realizacao",today);
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
 const declared=Number(req.headers.get("content-length")??0);
 if(declared>EXAM_REQUEST_MAX_BYTES)return json({error:"Prova demasiado extensa."},413);
 const body=await req.text();
 if(new TextEncoder().encode(body).byteLength>EXAM_REQUEST_MAX_BYTES)return json({error:"Prova demasiado extensa."},413);
 let raw:unknown;
 try{raw=JSON.parse(body);}catch{return json({error:"Pedido inválido."},400);}
 const parsed=mutationSchema.safeParse(raw);
 if(!parsed.success)return json({error:"Verifique os campos e as perguntas da prova."},400);
 const data=parsed.data;
 // Check the persisted, tenant-scoped version, never client-provided group totals.
 // The RPC still validates permissions, state and expected version atomically.
 if(data.acao==="submeter"||data.acao==="aprovar"){
   const current=await access.db.from("provas_pedagogicas").select("conteudo,versao").eq("escola_id",access.escolaId).eq("id",data.id).maybeSingle();
   if(current.error)return json({error:"Não foi possível validar os grupos da prova."},500);
   if(current.data&&current.data.versao===data.versao){
     const blocks=blockSchema.array().min(1).max(80).safeParse(current.data.conteudo);
     if(!blocks.success)return json({error:"Verifique o conteúdo da prova."},400);
     const empty=groupSummaries(blocks.data).filter(g=>g.questions===0);
     if(empty.length)return json({error:"Adicione perguntas a "+empty.map(g=>g.label).join(", ")+" antes de continuar."},400);
   }
 }
 const result=await access.db.rpc("provas_mutar",{p_escola:access.escolaId,p_id:"id" in data?data.id:null,p_versao:"versao" in data?data.versao:null,p_acao:data.acao,p_dados:"dados" in data?data.dados:null});
 if(result.error){
   const status=result.error.code==="40001"?409:result.error.code==="42501"?403:result.error.code?.startsWith("22")||result.error.code?.startsWith("23")?400:500;
   if(result.error.code==="22023"&&result.error.message==="invalid_exam_cotacao")return json({error:"A cotação deve corresponder à escala da classe, com valores positivos em todas as perguntas numéricas."},400);
   if(result.error.code==="22023"&&result.error.message==="unavailable_exam_scale")return json({error:"Escala indisponível ou incompatível entre turmas. Consulte a Direção."},400);
   return json({error:status===409?"A prova foi alterada. Reabra a versão mais recente.":status===403?result.error.message==="invalid_academic_context"?"Seleccione um contexto académico publicado e autorizado.":"Operação não autorizada neste estado.":status===400?"Verifique os dados e o estado da prova.":"Não foi possível guardar a prova."},status);
 }
 return json({prova:result.data});
}
