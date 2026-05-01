import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabaseServer";
import { isSuperAdminRole } from "@/lib/auth/requireSuperAdminAccess";
import { recordAuditServer } from "@/lib/audit";

export const dynamic = "force-dynamic";

async function assertSuperAdmin(s: SupabaseClient) {
  const { data: sess } = await s.auth.getUser();
  const user = sess?.user;
  if (!user) return { ok: false as const, response: NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 }), userId: null };

  const { data: roles } = await s
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const role = (roles?.[0] as { role?: string } | undefined)?.role;
  if (!isSuperAdminRole(role)) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "Somente Super Admin" }, { status: 403 }), userId: user.id };
  }

  return { ok: true as const, userId: user.id };
}

export async function PUT(request: Request, context: { params: Promise<{ escolaId: string }> }) {
  try {
    const { escolaId } = await context.params;
    const normalizedEscolaId = String(escolaId || "").trim();
    if (!normalizedEscolaId) return NextResponse.json({ ok: false, error: "escolaId ausente" }, { status: 400 });

    const body = (await request.json().catch(() => null)) as { notes?: unknown } | null;
    const notes = String(body?.notes ?? "").trim().slice(0, 2000);

    const s = (await supabaseServer()) as unknown as SupabaseClient;
    const auth = await assertSuperAdmin(s);
    if (!auth.ok) return auth.response;

    const { data, error } = await s
      .from("centros_formacao")
      .update({
        commercial_notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("escola_id", normalizedEscolaId)
      .select("escola_id,commercial_notes")
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ ok: false, error: "Centro não encontrado" }, { status: 404 });

    await recordAuditServer({
      escolaId: normalizedEscolaId,
      portal: "super_admin",
      acao: "FORMACAO_COMMERCIAL_NOTES_UPDATED",
      entity: "centros_formacao",
      entityId: normalizedEscolaId,
      details: { actor_id: auth.userId },
    });

    return NextResponse.json({ ok: true, item: data });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro interno" }, { status: 500 });
  }
}
