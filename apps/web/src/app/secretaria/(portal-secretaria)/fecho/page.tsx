import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { daySchema, todayLuanda } from "@/lib/secretaria/expediente";

export const dynamic = "force-dynamic";

export default async function SecretariaFechoRedirect({searchParams}:{
  searchParams:Promise<{date?:string}>;
}) {
  const supabase=await supabaseServer();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/redirect");
  const escolaId=await resolveEscolaIdForUser(supabase,user.id);
  if(!escolaId)redirect("/redirect");
  const parsed=daySchema.safeParse((await searchParams).date);
  const date=parsed.success&&parsed.data<=todayLuanda()?"&date="+encodeURIComponent(parsed.data):"";
  redirect("/escola/"+encodeURIComponent(escolaId)+"/secretaria/fecho-diario?view=cash"+date);
}
