import { NextResponse } from "next/server";
import { z } from "zod";
import { daySchema, expedienteAccess, getExpediente, getExpedienteHistory, todayLuanda } from "@/lib/secretaria/expediente";

export const dynamic = "force-dynamic";
export const revalidate = 0;
type Context = { params: Promise<{ id: string }> };
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
const payload = z.discriminatedUnion("action", [
  z.object({ action: z.literal("close"), date: daySchema }),
  z.object({ action: z.literal("configure"), closeTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), reminderMinutes: z.number().int().min(0).max(180), weekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7), enabled: z.boolean(), emailSummary: z.boolean().default(false) }),
]);
export async function GET(req: Request, { params }: Context) {
  try {
    const { id } = await params;
    const access = await expedienteAccess(id);
    if (!access.ok) return json({ ok: false, error: "Sem acesso ao expediente." }, access.status);
    const url = new URL(req.url);
    const date = daySchema.safeParse(url.searchParams.get("date") ?? todayLuanda());
    const cursor = Number(url.searchParams.get("cursor") ?? 0);
    if (!date.success || date.data > todayLuanda() || !Number.isSafeInteger(cursor) || cursor < 0) return json({ ok: false, error: "Filtro inválido." }, 400);
    const view=url.searchParams.get("view");
    if(view==="history"||view==="supervision"){
      if(view==="supervision"&&!access.canSupervise)return json({ok:false,error:"Sem acesso à supervisão."},403);
      const end=daySchema.safeParse(url.searchParams.get("to")??todayLuanda());
      const start=daySchema.safeParse(url.searchParams.get("from")??todayLuanda().slice(0,8)+"01");
      if(!start.success||!end.success||end.data>todayLuanda()||start.data>end.data||Date.parse(end.data)-Date.parse(start.data)>30*86400000)return json({ok:false,error:"Selecione um período de até 31 dias."},400);
      return json({ok:true,...await getExpedienteHistory(access,start.data,end.data)});
    }
    if (view === "summary") {
      const dashboardScope=url.searchParams.get("scope");
      const supervisor=dashboardScope==="supervision"&&access.canSupervise;
      const [close,cash,pending,rejected]=await Promise.all([access.supabase.from("secretaria_expedientes").select("closed_at,operation_count").eq("escola_id",access.escolaId).eq("day_key",date.data).maybeSingle(),access.supabase.from("fecho_caixa").select("status").eq("escola_id",access.escolaId).eq("day_key",date.data).maybeSingle(),supervisor?access.supabase.from("fecho_caixa").select("id",{count:"exact",head:true}).eq("escola_id",access.escolaId).eq("status","declared"):Promise.resolve({count:null,error:null}),access.supabase.from("fecho_caixa").select("id",{count:"exact",head:true}).eq("escola_id",access.escolaId).eq("status","rejected")]);
      if(close.error||cash.error||pending.error||rejected.error)return json({ok:false,error:"Falha ao consultar estado."},500);
      return json({ok:true,closed:close.data,cashStatus:cash.data?.status??null,pendingCount:pending.count,rejectedCount:rejected.count??0,canClose:access.canClose});
    }
    const filters=z.object({entity:z.string().regex(/^[a-z_]{1,64}$/).optional(),actor:z.union([z.literal("system"),z.string().uuid()]).optional(),late:z.enum(["1","0"]).optional()}).safeParse({entity:url.searchParams.get("entity")??undefined,actor:url.searchParams.get("actor")??undefined,late:url.searchParams.get("late")??undefined});
    if(!filters.success)return json({ok:false,error:"Filtro inválido."},400);
    return json({ ok: true, date: date.data, ...await getExpediente(access, date.data, cursor,{entity:filters.data.entity,actor:filters.data.actor,late:filters.data.late==="1"}) });
  } catch { return json({ ok: false, error: "Não foi possível consultar o expediente." }, 500); }
}
export async function POST(req: Request, { params }: Context) {
  try {
    const { id } = await params;
    const access = await expedienteAccess(id);
    if (!access.ok) return json({ ok: false, error: "Sem acesso ao expediente." }, access.status);
    const parsed = payload.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return json({ ok: false, error: "Dados inválidos." }, 400);
    const p = parsed.data;
    if (p.action === "close") {
      if (!access.canClose) return json({ ok: false, error: "Sem permissão para fechar." }, 403);
      if (p.date > todayLuanda()) return json({ ok: false, error: "Data futura." }, 400);
      const { error } = await access.supabase.rpc("secretaria_fechar_expediente", { p_escola_id: access.escolaId, p_day_key: p.date });
      if (error) return json({ ok: false, error: "Não foi possível fechar o expediente." }, error.code === "42501" ? 403 : 409);
    } else {
      if (!access.canConfigure) return json({ ok: false, error: "Sem permissão para configurar." }, 403);
      const { error } = await access.supabase.rpc("secretaria_configurar_expediente", { p_escola_id: access.escolaId, p_close_time: p.closeTime, p_reminder_minutes: p.reminderMinutes, p_weekdays: [...new Set(p.weekdays)], p_enabled: p.enabled, p_email_summary: p.emailSummary });
      if (error) return json({ ok: false, error: "Não foi possível guardar as preferências." }, error.code === "42501" ? 403 : 400);
    }
    return json({ ok: true });
  } catch { return json({ ok: false, error: "Não foi possível concluir a operação." }, 500); }
}
