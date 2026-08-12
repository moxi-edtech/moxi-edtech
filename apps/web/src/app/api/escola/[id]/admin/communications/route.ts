import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { requireRoleInSchool } from "@/lib/authz";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: requestedEscolaId } = await context.params;

  try {
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

    const [{ data: inbox, error: inboxError }, { data: legacy, error: legacyError }] = await Promise.all([
      (supabase as any)
        .from("notificacoes")
        .select("id, titulo, corpo, prioridade, action_label, action_url, lida, created_at")
        .eq("escola_id", escolaId)
        .eq("destinatario_id", user.id)
        .eq("lida", false)
        .order("created_at", { ascending: false })
        .limit(50),
      (supabase as any)
        .from("notifications")
        .select("id, tipo, titulo, mensagem, link_acao, lida, created_at")
        .eq("escola_id", escolaId)
        .eq("target_role", "financeiro")
        .eq("lida", false)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (inboxError || legacyError) {
      console.error("[admin/communications] query failed", { inboxError, legacyError });
      return jsonNoStore({ ok: false, error: "Falha ao carregar comunicações" }, { status: 500 });
    }

    const items = [
      ...(inbox ?? []).map((item: any) => ({
        id: `inbox:${item.id}`,
        source: "inbox",
        type: "notificacao",
        title: item.titulo,
        message: item.corpo,
        priority: item.prioridade === "urgente" ? "urgente" : item.prioridade === "atencao" ? "importante" : "informativa",
        actionLabel: item.action_label,
        actionUrl: item.action_url,
        read: item.lida,
        createdAt: item.created_at,
      })),
      ...(legacy ?? []).map((item: any) => ({
        id: `legacy:${item.id}`,
        source: "legacy",
        type: item.tipo,
        title: item.titulo,
        message: item.mensagem,
        priority: "importante",
        actionLabel: item.link_acao ? "Abrir" : null,
        actionUrl: item.link_acao,
        read: item.lida,
        createdAt: item.created_at,
      })),
    ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 50);

    return jsonNoStore({ ok: true, items, serverNow: new Date().toISOString() });
  } catch (error) {
    console.error("[admin/communications] unexpected failure", error);
    return jsonNoStore({ ok: false, error: "Erro inesperado" }, { status: 500 });
  }
}
