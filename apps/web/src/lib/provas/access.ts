import "server-only";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
const ADMINS=["admin","admin_escola","diretor","admin_secretaria","admin_secretario","staff_admin"];
const ROLES=[...ADMINS,"professor","secretaria","secretaria_financeiro"];
export const summaryColumns="id,autor_id,ano_letivo_id,curso_matriz_id,titulo,classe,disciplina,ano_lectivo,trimestre,duracao,serie,estado,versao,atualizado_em";
export const detailColumns="id,autor_id,ano_letivo_id,curso_matriz_id,titulo,classe,disciplina,ano_lectivo,trimestre,duracao,serie,estado,versao,atualizado_em,conteudo";
export async function provaAccess(requested:string){
 const db=await supabaseServerTyped<any>();
 const {data:{user}}=await db.auth.getUser();
 if(!user)return {ok:false as const,status:401};
 const escolaId=await resolveEscolaIdForUser(db,user.id,requested);
 if(!escolaId)return {ok:false as const,status:403};
 const {data,error}=await db.from("escola_users").select("papel").eq("escola_id",escolaId).eq("user_id",user.id).eq("tenant_type","k12").in("papel",ROLES).limit(20);
 if(error||!data?.length)return {ok:false as const,status:403};
 const admin=data.some((r:{papel:string})=>ADMINS.includes(r.papel));
 const author=admin||data.some((r:{papel:string})=>r.papel==="professor");
 return {ok:true as const,db,escolaId,userId:user.id,admin,author};
}
