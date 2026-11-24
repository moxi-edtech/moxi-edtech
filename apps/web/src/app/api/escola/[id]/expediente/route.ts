import { NextResponse } from "next/server";
import { z } from "zod";
import { daySchema, expedienteAccess, getExpediente, todayLuanda } from "@/lib/secretaria/expediente";

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
    if (url.searchParams.get("view") === "summary") {
      const { data, error } = await access.supabase.from("secretaria_expedientes").select("closed_at,operation_count").eq("escola_id",access.escolaId).eq("day_key",date.data).maybeSingle();
      if(error) return json({ok:false,error:"Falha ao consultar estado."},500);
      return json({ok:true,closed:data,canClose:access.canClose});
    }
    return json({ ok: true, date: date.data, ...await getExpediente(access, date.data, cursor) });
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
