import {NextResponse} from "next/server";
import {z} from "zod";
import {provaAccess} from "@/lib/provas/access";
export const dynamic="force-dynamic";
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
type Context={params:Promise<{id:string}>};
const uuid=z.string().uuid();
const input=z.object({prova:uuid,versao:z.number().int().positive(),turma:uuid,data:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+"T00:00:00Z");return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;}),inicio:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)}).strict();
async function proof(access:Extract<Awaited<ReturnType<typeof provaAccess>>,{ok:true}>,id:string){
 return access.db.from("provas_pedagogicas").select("id,ano_letivo_id,curso_matriz_id,trimestre,tipo_prova,disciplina,duracao,versao,estado").eq("escola_id",access.escolaId).eq("id",id).eq("estado","aprovada").maybeSingle();
}
export async function GET(req:Request,{params}:Context){
 const access=await provaAccess((await params).id);
 if(!access.ok||!access.admin)return json({error:"Sem autorização."},403);
 const id=new URL(req.url).searchParams.get("prova");
 if(!uuid.safeParse(id).success)return json({error:"Prova inválida."},400);
 const p=await proof(access,id!);
 if(p.error||!p.data)return json({error:"Prova publicada não encontrada."},404);
 const {db,escolaId}=access;
 const [td,ts,events]=await Promise.all([
  db.from("turma_disciplinas").select("id,turma_id,periodos_ativos").eq("escola_id",escolaId).eq("curso_matriz_id",p.data.curso_matriz_id).limit(1001),
  db.from("turmas").select("id,nome,turno").eq("escola_id",escolaId).eq("ano_letivo_id",p.data.ano_letivo_id).eq("session_id",p.data.ano_letivo_id).eq("status_validacao","ativo").order("nome").limit(1001),
  db.from("calendario_avaliacoes").select("id,turma_id,data,inicio,fim,estado").eq("escola_id",escolaId).eq("prova_id",id!).neq("estado","cancelado").order("data").limit(1001)
 ]);
 if([td,ts,events].some(r=>r.error||(r.data?.length??0)>1000))return json({error:"Catálogo de agendamento indisponível."},409);
 const trimestre=p.data.trimestre;
 const ids=new Set((td.data??[]).filter((x:{periodos_ativos:number[]|null})=>!x.periodos_ativos||x.periodos_ativos.includes(trimestre)).map((x:{turma_id:string})=>x.turma_id));
 return json({turmas:(ts.data??[]).filter((t:{id:string})=>ids.has(t.id)),eventos:events.data??[]});
}
export async function POST(req:Request,{params}:Context){
 const access=await provaAccess((await params).id);
 if(!access.ok||!access.admin)return json({error:"Sem autorização."},403);
 const origin=req.headers.get("origin");
 if(origin&&origin!==new URL(req.url).origin)return json({error:"Origem inválida."},403);
 if(!req.headers.get("content-type")?.includes("application/json"))return json({error:"Formato inválido."},415);
 const raw=await req.text();if(raw.length>4096)return json({error:"Pedido demasiado grande."},413);
 let body:unknown;try{body=JSON.parse(raw);}catch{return json({error:"Pedido inválido."},400);}
 const parsed=input.safeParse(body);if(!parsed.success)return json({error:"Verifique turma, data e hora."},400);
 const v=parsed.data,p=await proof(access,v.prova);
 if(p.error||!p.data)return json({error:"Prova publicada não encontrada."},404);
 if(p.data.versao!==v.versao)return json({error:"A prova mudou. Reabra a versão actual."},409);
 const {db,escolaId,userId}=access;
 const [td,t,periods,offerings]=await Promise.all([
  db.from("turma_disciplinas").select("id,periodos_ativos").eq("escola_id",escolaId).eq("turma_id",v.turma).eq("curso_matriz_id",p.data.curso_matriz_id).limit(2),
  db.from("turmas").select("id,curso_id").eq("escola_id",escolaId).eq("id",v.turma).eq("ano_letivo_id",p.data.ano_letivo_id).eq("session_id",p.data.ano_letivo_id).eq("status_validacao","ativo").maybeSingle(),
  db.from("periodos_letivos").select("id,offering_id").eq("escola_id",escolaId).eq("ano_letivo_id",p.data.ano_letivo_id).eq("tipo","TRIMESTRE").eq("numero",p.data.trimestre).lte("data_inicio",v.data).gte("data_fim",v.data).limit(151),
  db.from("school_education_offerings").select("id,course_id").eq("escola_id",escolaId).eq("status","active").limit(501)
 ]);
 if([td,t,periods,offerings].some(r=>r.error)||!t.data||td.data?.length!==1||(periods.data?.length??0)>150||(offerings.data?.length??0)>500)return json({error:"Turma ou período académico indisponível."},409);
 const link=td.data[0];if(link.periodos_ativos&&!link.periodos_ativos.includes(p.data.trimestre))return json({error:"Disciplina fora do trimestre."},409);
 const cursoId=t.data.curso_id;
 const offers=new Set((offerings.data??[]).filter((o:{course_id:string})=>o.course_id===cursoId).map((o:{id:string})=>o.id));
 const specific=(periods.data??[]).filter((x:{offering_id:string|null})=>x.offering_id&&offers.has(x.offering_id));
 const eligible=specific.length?specific:(periods.data??[]).filter((x:{offering_id:string|null})=>!x.offering_id);
 if(eligible.length!==1)return json({error:"A data não resolve um período lectivo inequívoco."},409);
 const [h,m]=v.inicio.split(":").map(Number),end=h*60+m+p.data.duracao;
 if(end>=1440)return json({error:"A prova deve terminar no mesmo dia."},400);
 const fim=String(Math.floor(end/60)).padStart(2,"0")+":"+String(end%60).padStart(2,"0");
 const r=await db.from("calendario_avaliacoes").insert({escola_id:escolaId,ano_letivo_id:p.data.ano_letivo_id,periodo_letivo_id:eligible[0].id,turma_id:v.turma,turma_disciplina_id:link.id,prova_id:v.prova,tipo:p.data.tipo_prova==="trimestral"?"Prova trimestral":p.data.tipo_prova==="professor"?"Teste":"Outra",descricao:"Avaliação de "+p.data.disciplina,data:v.data,inicio:v.inicio,fim,estado:"publicado",created_by:userId,updated_by:userId}).select("id").single();
 if(r.error)return json({error:r.error.code==="23P01"?"A turma já tem uma avaliação nesse horário.":r.error.code==="23505"?"Já existe um agendamento. Consulte o calendário de avaliações.":"Não foi possível agendar neste contexto académico."},409);
 return json({id:r.data.id},201);
}
