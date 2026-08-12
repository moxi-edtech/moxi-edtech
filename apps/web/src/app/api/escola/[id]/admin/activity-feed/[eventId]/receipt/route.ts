import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED_STATUSES = new Set(["visto", "em_tratamento", "resolvido"]);

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; eventId: string }> },
) {
  const { id: requestedEscolaId, eventId } = await context.params;

  try {
    const body = await request.json().catch(() => null);
    const status = typeof body?.status === "string" ? body.status : "";
    if (!ALLOWED_STATUSES.has(status)) {
      return jsonNoStore({ ok: false, error: "Estado de acompanhamento inválido" }, { status: 400 });
    }

    const supabase = await createRouteClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return jsonNoStore({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id, requestedEscolaId);
    if (!escolaId) return jsonNoStore({ ok: false, error: "Sem permissão" }, { status: 403 });

    const roleCheck = await requireRoleInSchool({
      supabase: supabase as any,
      escolaId,
      roles: ["admin_escola", "admin", "staff_admin", "secretaria", "admin_financeiro", "diretor"],
    });
    if (roleCheck.error) return roleCheck.error;

    const { data: event, error: eventError } = await (supabase as any)
      .from("admin_activity_events")
      .select("id, escola_id")
      .eq("id", eventId)
      .eq("escola_id", escolaId)
      .maybeSingle();

    if (eventError) {
      console.error("[admin/activity-feed/receipt] event lookup failed", eventError);
      return jsonNoStore({ ok: false, error: "Falha ao validar actividade" }, { status: 500 });
    }
    if (!event) return jsonNoStore({ ok: false, error: "Actividade não encontrada" }, { status: 404 });

    const now = new Date().toISOString();
    const receipt = {
      event_id: event.id,
      escola_id: escolaId,
      user_id: user.id,
      status,
      seen_at: status === "visto" || status === "em_tratamento" || status === "resolvido" ? now : null,
      resolved_at: status === "resolvido" ? now : null,
      updated_at: now,
    };

    const { data, error } = await (supabase as any)
      .from("admin_activity_event_receipts")
      .upsert(receipt, { onConflict: "event_id,user_id" })
      .select("id, event_id, status, seen_at, resolved_at, updated_at")
      .single();

    if (error) {
      console.error("[admin/activity-feed/receipt] upsert failed", error);
      return jsonNoStore({ ok: false, error: "Falha ao guardar acompanhamento" }, { status: 500 });
    }

    return jsonNoStore({ ok: true, receipt: data });
  } catch (error) {
    console.error("[admin/activity-feed/receipt] unexpected failure", error);
    return jsonNoStore({ ok: false, error: "Erro inesperado" }, { status: 500 });
  }
}
