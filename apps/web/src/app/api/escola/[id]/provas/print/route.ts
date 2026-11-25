import { randomUUID } from "node:crypto";
import { z } from "zod";
import { provaAccess } from "@/lib/provas/access";
import { provaHtml } from "@/lib/provas/print";
import { provaSchema } from "@/lib/provas/schema";
export const dynamic="force-dynamic";
export const runtime="nodejs";
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","X-Robots-Tag":"noindex, nofollow"};
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 const access=await provaAccess((await params).id);
 if(!access.ok)return new Response("Acesso não autorizado.",{status:access.status,headers});
 const id=new URL(req.url).searchParams.get("prova");
 if(!z.string().uuid().safeParse(id).success)return new Response("Identificador inválido.",{status:400,headers});
 const [row,school]=await Promise.all([
  access.db.from("provas_pedagogicas").select("titulo,classe,disciplina,ano_lectivo,trimestre,duracao,serie,conteudo").eq("escola_id",access.escolaId).eq("id",id).eq("estado","aprovada").maybeSingle(),
  access.db.from("escolas").select("nome").eq("id",access.escolaId).maybeSingle()
 ]);
 if(row.error||school.error)return new Response("Não foi possível gerar a prova.",{status:500,headers});
 if(!row.data||!school.data)return new Response("Prova aprovada não encontrada.",{status:404,headers});
 const parsed=provaSchema.safeParse(row.data);
 if(!parsed.success)return new Response("Conteúdo inválido.",{status:422,headers});
 const nonce=randomUUID();
 return new Response(provaHtml(parsed.data,school.data.nome,{nonce}),{headers:{...headers,"Content-Type":"text/html; charset=utf-8","Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-"+nonce+"'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"}});
}
