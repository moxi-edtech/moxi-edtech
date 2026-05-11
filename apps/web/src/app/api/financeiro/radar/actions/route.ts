import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";

const schema = z.object({
  aluno_id: z.string().uuid(),
  action: z.enum(["set_status", "registrar_contato"]),
  status_operacional: z.enum(["novo", "em_contato", "promessa", "escalado", "resolvido"]).optional(),
  nota: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  try {
    const s = await supabaseServerTyped();
    const { data: { user } } = await s.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(s as any, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Payload inválido" }, { status: 400 });
    const payload = parsed.data;

    const status = payload.action === "set_status"
      ? payload.status_operacional ?? "novo"
      : "em_contato";
    const sAny = s as any;

    const now = new Date().toISOString();
    const upsertPayload: Record<string, any> = {
      escola_id: escolaId,
      aluno_id: payload.aluno_id,
      status_operacional: status,
      updated_at: now,
      owner_user_id: status === "em_contato" ? user.id : undefined,
    };
    if (payload.action === "registrar_contato") upsertPayload.last_contact_at = now;

    const { data: caseRow, error: upsertError } = await sAny
      .from("financeiro_cobranca_cases")
      .upsert(upsertPayload, { onConflict: "escola_id,aluno_id" })
      .select("id, status_operacional, owner_user_id, last_contact_at, next_action_at, sla_at")
      .single();
    if (upsertError) return NextResponse.json({ ok: false, error: upsertError.message }, { status: 500 });

    const eventType = payload.action === "registrar_contato" ? "contato" : "status_change";
    await sAny.from("financeiro_cobranca_events").insert({
      escola_id: escolaId,
      case_id: caseRow.id,
      aluno_id: payload.aluno_id,
      event_type: eventType,
      payload: {
        action: payload.action,
        status_operacional: status,
        nota: payload.nota ?? null,
      },
      created_by: user.id,
    });

    return NextResponse.json({ ok: true, case: caseRow });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
