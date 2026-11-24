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
export const READ_ROLES = [...CLOSE_ROLES, "diretor"];

export async function expedienteAccess(requestedSchool: string) {
  const supabase = await supabaseServerTyped<any>();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 };
  const escolaId = await resolveEscolaIdForUser(supabase, user.id, requestedSchool);
  if (!escolaId) return { ok: false as const, status: 403 };
  const { data: rows, error } = await supabase.from("escola_users").select("papel").eq("escola_id", escolaId).eq("user_id", user.id).eq("tenant_type", "k12").in("papel", READ_ROLES).limit(20);
  if (error || !rows?.length) return { ok: false as const, status: 403 };
  const roles = rows.map((row: { papel: string }) => row.papel);
  return { ok: true as const, supabase, escolaId, userId: user.id, canClose: roles.some((role: string) => CLOSE_ROLES.includes(role)), canConfigure: roles.some((role: string) => CONFIG_ROLES.includes(role)) };
}

export async function getExpediente(access: Extract<Awaited<ReturnType<typeof expedienteAccess>>, { ok: true }>, date: string, cursor = 0) {
  const { supabase, escolaId } = access;
  const [closed, operations, late, config, cash, preview] = await Promise.all([
    supabase.from("secretaria_expedientes").select("id,day_key,closed_at,closed_by,operation_count,summary").eq("escola_id", escolaId).eq("day_key", date).maybeSingle(),
    supabase.from("secretaria_expediente_operacoes").select("id,occurred_at,actor_id,actor_role,entity,entity_id,action,is_after_close,detail").eq("escola_id", escolaId).eq("day_key", date).gt("id", cursor).order("id", { ascending: true }).limit(51),
    supabase.from("secretaria_expediente_operacoes").select("id", { count: "exact", head: true }).eq("escola_id", escolaId).eq("day_key", date).eq("is_after_close", true),
    supabase.from("secretaria_expediente_config").select("close_time,reminder_minutes,weekdays,enabled").eq("escola_id", escolaId).maybeSingle(),
    supabase.from("fecho_caixa").select("id,status,declared_cash,declared_tpa,declared_transfer,declared_mcx,system_cash,system_tpa,system_transfer,system_mcx").eq("escola_id", escolaId).eq("day_key", date).maybeSingle(),
    supabase.rpc("secretaria_expediente_resumo", { p_escola_id: escolaId, p_day_key: date }),
  ]);
  if (preview.error || closed.error || operations.error || late.error || config.error || cash.error) throw new Error("Não foi possível consultar o expediente.");
  const rows = operations.data ?? [];
  const page = rows.slice(0, 50);
  const actorIds = [...new Set<string>([...page.map((row: { actor_id: string }) => row.actor_id), ...(closed.data ? [closed.data.closed_by] : [])])];
  // Names are optional display enrichment; immutable UUID remains the identity.
  const names = new Map<string, string>();
  if (actorIds.length) {
    const profiles = await supabase.from("profiles").select("user_id,nome").in("user_id", actorIds).eq("escola_id", escolaId);
    for (const profile of profiles.data ?? []) names.set(profile.user_id, profile.nome ?? profile.user_id);
  }
  return { closed: closed.data ? { ...closed.data, closed_by_name: names.get(closed.data.closed_by) ?? closed.data.closed_by } : null, operations: page.map((row: any) => ({ ...row, actor_name: names.get(row.actor_id) ?? row.actor_id })), nextCursor: rows.length > 50 ? page[49].id : null, lateCount: late.count ?? 0, preview: preview.data ?? {}, config: config.data, cash: cash.data, canClose: access.canClose, canConfigure: access.canConfigure };
}
