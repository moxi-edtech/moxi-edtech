import { randomUUID } from "node:crypto";
import { z } from "zod";
import { provaAccess } from "@/lib/provas/access";
import { provaHtml } from "@/lib/provas/print";
import { provaSchema } from "@/lib/provas/schema";
import { parseDistribution,distributionError,distributionResult,rpcArgs,recipientSchema,type PrintRecipient } from "@/lib/provas/distribution";
export const dynamic="force-dynamic";
export const runtime="nodejs";
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","X-Robots-Tag":"noindex, nofollow"};
const fail=(message:string,status:number)=>new Response(message,{status,headers:{...headers,"Content-Type":"text/plain; charset=utf-8"}});
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 const access=await provaAccess((await params).id);
 if(!access.ok)return fail("Acesso não autorizado.",access.status);
 const q=new URL(req.url).searchParams,id=q.get("prova");
 if(!z.string().uuid().safeParse(id).success)return fail("Identificador inválido.",400);
 const mode=q.get("modo");
 if(mode!==null&&mode!=="imprimir")return fail("Modalidade inválida.",400);
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
 const [row,school]=await Promise.all([
  access.db.from("provas_pedagogicas").select("titulo,tipo_prova,classe,disciplina,ano_lectivo,trimestre,duracao,serie,conteudo,versao").eq("escola_id",access.escolaId).eq("id",id).eq("estado","aprovada").maybeSingle(),
  access.db.from("escolas").select("nome").eq("id",access.escolaId).maybeSingle()
 ]);
 if(row.error||school.error)return fail("Não foi possível gerar a prova.",500);
 if(!row.data||!school.data)return fail("Prova aprovada não encontrada.",404);
 const {versao,...snapshot}=row.data;
 if(distributionVersion!==undefined&&versao!==distributionVersion)return fail("A versão aprovada mudou.",409);
 const parsed=provaSchema.safeParse(snapshot);
 if(!parsed.success)return fail("Conteúdo inválido.",422);
 const nonce=randomUUID();
 const html=provaHtml(parsed.data,school.data.nome,{nonce,recipients,includeName:q.get("nome")!=="0"});
 if(Buffer.byteLength(html,"utf8")>4*1024*1024)return fail("O lote ultrapassa o limite de impressão. Seleccione um tamanho de lote menor.",413);
 return new Response(html,{headers:{...headers,"Content-Type":"text/html; charset=utf-8","Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-"+nonce+"'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"}});
}
