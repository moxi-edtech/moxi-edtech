import "server-only";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { z } from "zod";

export const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const d = new Date(value + "T00:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
});
export const todayLuanda = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Africa/Luanda", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export const CLOSE_ROLES = ["secretaria", "secretaria_financeiro", "admin_secretaria", "admin_secretario", "admin_financeiro", "admin", "admin_escola", "staff_admin"];
export const CONFIG_ROLES = ["admin_secretaria", "admin_secretario", "admin_financeiro", "admin", "admin_escola", "staff_admin", "diretor"];
export const APPROVE_ROLES = ["financeiro","admin_financeiro","admin","admin_escola","staff_admin","diretor"];
export const READ_ROLES = [...CLOSE_ROLES, "financeiro", "diretor"];

export async function expedienteAccess(requestedSchool: string) {
  const supabase = await supabaseServerTyped<any>();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 };
  const escolaId = await resolveEscolaIdForUser(supabase, user.id, requestedSchool);
  if (!escolaId) return { ok: false as const, status: 403 };
  const { data: rows, error } = await supabase.from("escola_users").select("papel").eq("escola_id", escolaId).eq("user_id", user.id).eq("tenant_type", "k12").in("papel", READ_ROLES).limit(20);
  if (error || !rows?.length) return { ok: false as const, status: 403 };
  const roles = rows.map((row: { papel: string }) => row.papel);
  return { ok: true as const, supabase, escolaId, userId: user.id, canSupervise: roles.some((role: string) => CONFIG_ROLES.includes(role) || APPROVE_ROLES.includes(role)), canClose: roles.some((role: string) => CLOSE_ROLES.includes(role)), canConfigure: roles.some((role: string) => CONFIG_ROLES.includes(role)), canApprove: roles.some((role: string) => APPROVE_ROLES.includes(role)) };
}

type Access = Extract<Awaited<ReturnType<typeof expedienteAccess>>, {ok:true}>;
type ActivityFilter = {entity?:string; actor?:string; late?:boolean};

export async function getExpedienteHistory(access: Access, start: string, end: string) {
  const {supabase,escolaId}=access;
  const [closed,cash,config,capture,pending,rejected]=await Promise.all([
    supabase.from("secretaria_expedientes").select("day_key,closed_at,operation_count").eq("escola_id",escolaId).gte("day_key",start).lte("day_key",end).order("day_key",{ascending:false}),
    supabase.from("fecho_caixa").select("day_key,status,revision,declared_by").eq("escola_id",escolaId).gte("day_key",start).lte("day_key",end),
    supabase.from("secretaria_expediente_config").select("weekdays").eq("escola_id",escolaId).maybeSingle(),
    supabase.rpc("secretaria_expediente_capture_started_at",{p_escola_id:escolaId}),
    supabase.from("fecho_caixa").select("day_key,status,revision,declared_by",{count:"exact"}).eq("escola_id",escolaId).eq("status","declared").order("day_key").limit(20),
    supabase.from("fecho_caixa").select("day_key,status,revision,declared_by",{count:"exact"}).eq("escola_id",escolaId).eq("status","rejected").order("day_key").limit(20),
  ]);
  if([closed,cash,config,capture,pending,rejected].some(r=>r.error)||!capture.data)throw new Error("Não foi possível consultar o histórico.");
  const captureDay=new Intl.DateTimeFormat("sv-SE",{timeZone:"Africa/Luanda",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(capture.data));
  const closedByDay=new Map<string,any>((closed.data??[]).map((r:any)=>[r.day_key,r]));
  const cashByDay=new Map<string,any>((cash.data??[]).map((r:any)=>[r.day_key,r]));
  const days=[];
  for(let date=new Date(end+"T00:00:00Z");date.toISOString().slice(0,10)>=start;date.setUTCDate(date.getUTCDate()-1)){
    const day=date.toISOString().slice(0,10);
    const close=closedByDay.get(day), payment=cashByDay.get(day);
    // Missing days are not assumed to be working days unless the school configured them.
    const expected=day>captureDay && day<todayLuanda() && Boolean(config.data?.weekdays?.includes(date.getUTCDay()||7));
    if(close||payment||expected||day===todayLuanda())days.push({date:day,closedAt:close?.closed_at??null,records:close?.operation_count??null,expected,cashStatus:payment?.status??null,canApprove:Boolean(payment&&access.canApprove&&payment.declared_by!==access.userId)});
  }
  const queue=(rows:any[])=>rows.map(r=>({date:r.day_key,status:r.status,revision:r.revision,canApprove:access.canApprove&&r.declared_by!==access.userId}));
  return {days,closedCount:days.filter(d=>d.closedAt).length,missingCount:days.filter(d=>d.expected&&!d.closedAt).length,pendingCount:pending.count??0,rejectedCount:rejected.count??0,pending:queue(pending.data??[]),rejected:queue(rejected.data??[]),scheduleConfigured:Boolean(config.data),captureDay};
}

export async function getExpediente(access: Extract<Awaited<ReturnType<typeof expedienteAccess>>, { ok: true }>, date: string, cursor = 0, filters: ActivityFilter = {}) {
  const { supabase, escolaId } = access;
  let operationQuery=supabase.from("secretaria_expediente_operacoes").select("id,occurred_at,actor_id,actor_role,origin,entity,entity_id,action,record_kind,transaction_id,is_after_close,detail").eq("escola_id",escolaId).eq("day_key",date).gt("id",cursor);
  if(filters.entity)operationQuery=operationQuery.eq("entity",filters.entity);
  if(filters.actor==="system")operationQuery=operationQuery.eq("origin","service_role");else if(filters.actor)operationQuery=operationQuery.eq("actor_id",filters.actor);
  if(filters.late)operationQuery=operationQuery.eq("is_after_close",true);
  const [closed, operations, late, config, cash, preview, captureStart, variation, actors] = await Promise.all([
    supabase.from("secretaria_expedientes").select("id,day_key,closed_at,closed_by,operation_count,business_count,human_count,system_count,summary").eq("escola_id", escolaId).eq("day_key", date).maybeSingle(),
    operationQuery.order("id",{ascending:true}).limit(51),
    supabase.from("secretaria_expediente_operacoes").select("id", { count: "exact", head: true }).eq("escola_id", escolaId).eq("day_key", date).eq("is_after_close", true),
    supabase.from("secretaria_expediente_config").select("close_time,reminder_minutes,weekdays,enabled,email_summary").eq("escola_id", escolaId).maybeSingle(),
    supabase.from("fecho_caixa").select("id,status,declared_by,declared_cash,declared_tpa,declared_transfer,declared_mcx,system_cash,system_tpa,system_transfer,system_mcx,system_other,system_other_count,revision,revision_reason,approval_note").eq("escola_id", escolaId).eq("day_key", date).maybeSingle(),
    supabase.rpc("secretaria_expediente_resumo", { p_escola_id: escolaId, p_day_key: date }),
    supabase.rpc("secretaria_expediente_capture_started_at", { p_escola_id: escolaId }),
    supabase.rpc("financeiro_fecho_variacao", { p_escola_id: escolaId, p_day_key: date }),
    cursor===0?supabase.rpc("secretaria_expediente_responsaveis",{p_escola_id:escolaId,p_day_key:date}):Promise.resolve({data:[],error:null}),
  ]);
  if (actors.error || variation.error || captureStart.error || !captureStart.data || preview.error || closed.error || operations.error || late.error || config.error || cash.error) throw new Error("Não foi possível consultar o expediente.");
  const revisions = cash.data ? await supabase.from("fecho_caixa_revisoes").select("revision,snapshot,archived_at").eq("escola_id",escolaId).eq("fecho_id",cash.data.id).order("revision",{ascending:false}).limit(20) : null;
  if(revisions?.error)throw new Error("Não foi possível consultar as revisões do caixa.");
  const rows = operations.data ?? [];
  const page = rows.slice(0, 50);
  const filterActorIds:string[]=(actors.data??[]).map((a:{actor_id:string})=>a.actor_id);
  const actorIds = [...new Set<string>([...filterActorIds,...page.map((row: { actor_id: string | null }) => row.actor_id).filter((id: string | null): id is string => id !== null), ...(closed.data ? [closed.data.closed_by] : [])])];
  // Names are optional display enrichment; immutable UUID remains the identity.
  const names = new Map<string, string>();
  for(let i=0;i<actorIds.length;i+=100){
    const profiles=await supabase.from("profiles").select("user_id,nome").in("user_id",actorIds.slice(i,i+100)).eq("escola_id",escolaId);
    for(const profile of profiles.data??[])names.set(profile.user_id,profile.nome??"Funcionário");
  }
  const studentIds = [...new Set<string>(page.map((row:any)=>row.entity==="alunos"?row.entity_id:row.detail?.aluno_id).filter((id:unknown):id is string=>typeof id==="string"&&z.string().uuid().safeParse(id).success))];
  const students=new Map<string,string>();
  if(studentIds.length){const result=await supabase.from("alunos").select("id,nome,nome_completo").eq("escola_id",escolaId).in("id",studentIds);for(const s of result.data??[])students.set(s.id,s.nome_completo||s.nome||"Aluno");}
  return { actorOptions:filterActorIds.map(id=>({id,name:names.get(id)??"Funcionário · "+id.slice(0,6)})), closed: closed.data ? { ...closed.data, closed_by_name: names.get(closed.data.closed_by) ?? "Funcionário" } : null, operations: page.map((row: any) => ({ ...row, student_id:students.has(row.entity==="alunos"?row.entity_id:row.detail?.aluno_id)?(row.entity==="alunos"?row.entity_id:row.detail?.aluno_id):null,student_name:students.get(row.entity==="alunos"?row.entity_id:row.detail?.aluno_id)??null, actor_name: row.origin === "service_role" ? "Sistema · automático" : names.get(row.actor_id) ?? "Funcionário" })), nextCursor: rows.length > 50 ? page[49].id : null, lateCount: late.count ?? 0, preview: preview.data ?? {}, config: config.data, cash: cash.data, cashRevisions: revisions?.data ?? [], variation: variation.data, captureStartedAt: captureStart.data, canSupervise:access.canSupervise, canDeclare: access.canClose || access.canApprove && !access.canConfigure, canClose: access.canClose && date >= new Intl.DateTimeFormat("sv-SE",{timeZone:"Africa/Luanda",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(captureStart.data)), canConfigure: access.canConfigure, canApprove: access.canApprove && cash.data?.declared_by !== access.userId };
}
