import { randomUUID } from "node:crypto";
import { z } from "zod";
import { provaAccess } from "@/lib/provas/access";
import { provaHtml,folhaGenericaHtml } from "@/lib/provas/print";
import { provaSchema } from "@/lib/provas/schema";
import { loadProvaLogo } from "@/lib/provas/loadLogo";
import { parseDistribution,distributionError,distributionResult,rpcArgs,recipientSchema,type PrintRecipient } from "@/lib/provas/distribution";
export const dynamic="force-dynamic";
export const runtime="nodejs";
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","X-Robots-Tag":"noindex, nofollow"};
const fail=(message:string,status:number)=>new Response(message,{status,headers:{...headers,"Content-Type":"text/plain; charset=utf-8"}});
function printResponse(html:string,nonce:string){
 return new Response(html,{headers:{...headers,"Content-Type":"text/html; charset=utf-8","Content-Security-Policy":"default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'nonce-"+nonce+"'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"}});
}
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 const access=await provaAccess((await params).id);
 if(!access.ok)return fail("Acesso não autorizado.",access.status);
 const q=new URL(req.url).searchParams,id=q.get("prova");
 const mode=q.get("modo");
 if(mode==="folha_generica"){
  // No recipient, assessment or client-provided school data may enter this path.
  if(Array.from(q.keys()).length!==1)return fail("Selecção inválida.",400);
  if(!access.author&&!access.distribute)return fail("Acesso não autorizado.",403);
  const school=await access.db.from("escolas").select("nome,logo_url").eq("id",access.escolaId).maybeSingle();
  if(school.error)return fail("Não foi possível gerar a folha.",500);
  if(!school.data)return fail("Escola não encontrada.",404);
  const nonce=randomUUID();
  const logo=await loadProvaLogo(school.data.logo_url,access.escolaId);
  return printResponse(folhaGenericaHtml(school.data.nome,{nonce,logo}),nonce);
 }
 if(!z.string().uuid().safeParse(id).success)return fail("Identificador inválido.",400);
 const conference=mode==="conferencia",historical=mode==="historico";
 if(historical&&!access.admin)return fail("Sem autorização para reimpressão histórica.",403);
 if(conference&&!access.admin)return fail("Sem autorização para conferência.",403);
 if(mode!==null&&mode!=="imprimir"&&!conference&&!historical)return fail("Modalidade inválida.",400);
 let recipients:PrintRecipient[]|undefined;
 let distributionVersion:number|undefined;
 if(mode==="imprimir"){
  if(!access.distribute)return fail("Sem autorização para distribuição nominal.",403);
  const parsed=parseDistribution(q);
  const snapshot=q.get("snapshot");
  if(!parsed.success||!snapshot||!z.string().regex(/^[a-f0-9]{32}$/).safeParse(snapshot).success||!["0","1"].includes(q.get("nome")??"1"))return fail("Selecção inválida.",400);
  distributionVersion=parsed.data.versao;
  const result=await access.db.rpc("provas_destinatarios",rpcArgs(access.escolaId,parsed.data));
  if(result.error){const e=distributionError(result.error);return fail(e.message,e.status);}
  const validated=distributionResult.safeParse(result.data);
  if(!validated.success)return fail("Resposta de distribuição inválida.",500);
  if(validated.data.snapshot!==snapshot)return fail("A lista de destinatários mudou. Reabra a distribuição antes de imprimir.",409);
  const items=recipientSchema.array().min(1).max(40).safeParse(validated.data.items);
  if(!items.success)return fail("Destinatários inválidos.",500);
  recipients=items.data;
 }else if(q.has("turmas")||q.has("matricula")||q.has("snapshot"))return fail("Modalidade inválida.",400);
 const proof=access.db.from("provas_pedagogicas").select("titulo,tipo_prova,apresentacao,classe,disciplina,ano_lectivo,trimestre,duracao,serie,conteudo,versao,data_realizacao,hora_inicio").eq("escola_id",access.escolaId).eq("id",id);
 const [row,school]=await Promise.all([
  (conference?proof.in("estado",["rascunho","em_revisao"]):historical?proof.eq("estado","arquivada").not("aprovado_em","is",null):proof.eq("estado","aprovada")).maybeSingle(),
  access.db.from("escolas").select("nome,logo_url").eq("id",access.escolaId).maybeSingle()
 ]);
 if(row.error||school.error)return fail("Não foi possível gerar a prova.",500);
 if(!row.data||!school.data)return fail("Prova aprovada não encontrada.",404);
 const {versao,...snapshot}=row.data;
 if(distributionVersion!==undefined&&versao!==distributionVersion)return fail("A versão aprovada mudou.",409);
 const parsed=provaSchema.safeParse(snapshot);
 if(!parsed.success)return fail("Conteúdo inválido.",422);
 const nonce=randomUUID();
 const logo=await loadProvaLogo(school.data.logo_url,access.escolaId);
 let schedules:Record<string,{data:string;inicio:string}>|undefined;
 if(recipients?.length){
   const ids=[...new Set(recipients.map(r=>r.turma_id))];
   const events=await access.db.from("calendario_avaliacoes").select("turma_id,data,inicio").eq("escola_id",access.escolaId).eq("prova_id",id).eq("estado","publicado").in("turma_id",ids);
   if(events.error)return fail("Não foi possível confirmar o agendamento das turmas.",500);
   schedules=Object.fromEntries((events.data??[]).map((e:{turma_id:string;data:string;inicio:string})=>[e.turma_id,{data:e.data,inicio:e.inicio}]));
 }
 const html=provaHtml(parsed.data,school.data.nome,{nonce,recipients,logo,draft:conference,historical,schedules,includeName:q.get("nome")!=="0"});
 if(Buffer.byteLength(html,"utf8")>4*1024*1024)return fail("O lote ultrapassa o limite de impressão. Seleccione um tamanho de lote menor.",413);
 return printResponse(html,nonce);
}
