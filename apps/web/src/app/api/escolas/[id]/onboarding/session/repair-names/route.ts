import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { hasPermission } from "@/lib/permissions";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

// POST /api/escolas/[id]/onboarding/session/repair-names
// Admin-only: Renames existing sessions to the canonical format YYYY/YYYY+1 based on data_inicio
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await params;

  try {
    const s = await supabaseServer();
    const { data: auth } = await s.auth.getUser();
    const user = auth?.user;
    if (!user)
      return NextResponse.json(
        { ok: false, error: "Não autenticado" },
        { status: 401 }
      );

    // Authorization: escola admin or vínculo com permissão configurar_escola
    let allowed = false;
    try {
      const { data: vinc } = await s
        .from("escola_usuarios")
        .select("papel")
        .eq("escola_id", escolaId)
        .eq("user_id", user.id)
        .maybeSingle();
      const papel = (vinc as any)?.papel as string | undefined;
      if (!allowed) allowed = !!papel && hasPermission(papel as any, "configurar_escola");
    } catch {}
    if (!allowed) {
      try {
        const { data: adminLink } = await s
          .from("escola_administradores")
          .select("user_id")
          .eq("escola_id", escolaId)
          .eq("user_id", user.id)
          .limit(1);
        allowed = Boolean(adminLink && (adminLink as any[]).length > 0);
      } catch {}
    }
    if (!allowed) {
      try {
        const { data: prof } = await s
          .from("profiles")
          .select("role, escola_id")
          .eq("user_id", user.id)
          .eq("escola_id", escolaId)
          .limit(1);
        allowed = Boolean(
          prof && prof.length > 0 && (prof[0] as any).role === "admin"
        );
      } catch {}
    }
    if (!allowed)
      return NextResponse.json(
        { ok: false, error: "Sem permissão" },
        { status: 403 }
      );

    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      return NextResponse.json(
        { ok: false, error: "Configuração Supabase ausente." },
        { status: 500 }
      );
    }

    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Load sessions
    const { data: sessions, error } = await (admin as any)
      .from("school_sessions")
      .select("id, nome, data_inicio, data_fim, status")
      .eq("escola_id", escolaId);
    if (error)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      );

    const toUpdate: Array<{ id: string; novo: string; antigo: string }> = [];
    for (const sRow of (sessions || []) as any[]) {
      const di = new Date(String(sRow.data_inicio));
      const year = di.getFullYear();
      if (!Number.isFinite(year)) continue;
      const canonical = `${year}/${year + 1}`;
      if (typeof sRow.nome !== "string") {
        toUpdate.push({ id: sRow.id, novo: canonical, antigo: String(sRow.nome ?? "") });
        continue;
      }
      // If already canonical, skip; otherwise schedule update
      if (sRow.nome.trim() !== canonical) {
        toUpdate.push({ id: sRow.id, novo: canonical, antigo: sRow.nome.trim() });
      }
    }

    let updated = 0;
    for (const patch of toUpdate) {
      const { error: updErr } = await (admin as any)
        .from("school_sessions")
        .update({ nome: patch.novo } as any)
        .eq("id", patch.id);
      if (!updErr) updated++;
    }

    return NextResponse.json({
      ok: true,
      escolaId,
      updated,
      total: (sessions || []).length,
      changes: toUpdate,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

