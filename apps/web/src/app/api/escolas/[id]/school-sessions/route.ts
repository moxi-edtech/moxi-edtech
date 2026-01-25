import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-client";
import { applyKf2ListInvariants } from "@/lib/kf2";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params;

  try {
    const supabase = await createRouteClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    let allowed = false;

    // Super admin
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);
      const role = (prof?.[0] as any)?.role as string | undefined;
      if (role === "super_admin") allowed = true;
    } catch {}

    // Vínculo direto na escola
    if (!allowed) {
      try {
        const { data: vinc } = await supabase
          .from("escola_users")
          .select("papel")
          .eq("escola_id", escolaId)
          .eq("user_id", user.id)
          .maybeSingle();
        allowed = Boolean((vinc as any)?.papel);
      } catch {}
    }

    // Administrador legado
    if (!allowed) {
      try {
        const { data: adminLink } = await supabase
          .from("escola_administradores")
          .select("user_id")
          .eq("escola_id", escolaId)
          .eq("user_id", user.id)
          .limit(1);
        allowed = Boolean(adminLink && (adminLink as any[]).length > 0);
      } catch {}
    }

    // Admin da própria escola
    if (!allowed) {
      try {
        const { data: prof } = await supabase
          .from("profiles")
          .select("role, escola_id, current_escola_id")
          .eq("user_id", user.id)
          .limit(1);

        const profRow = prof?.[0] as any;
        const escolaFromProfile = profRow?.escola_id || profRow?.current_escola_id;

        allowed = Boolean(profRow && profRow.role === "admin" && escolaFromProfile === escolaId);
      } catch {}
    }

    if (!allowed) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    const mapAnoLetivoRows = (rows: any[]) =>
      (rows || []).map((row: any) => ({
        id: row.id,
        nome: `${row.ano}/${row.ano + 1}`,
        data_inicio: row.data_inicio,
        data_fim: row.data_fim,
        status: row.ativo ? "ativa" : "arquivada",
        ano: row.ano,
        ano_letivo: `${row.ano}/${row.ano + 1}`,
      }));

    const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, escolaId);
    if (!userEscolaId || userEscolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    let adminQuery = (supabase as any)
      .from("anos_letivos")
      .select("id, ano, data_inicio, data_fim, ativo")
      .eq("escola_id", escolaId)
      .order("ano", { ascending: false });

    adminQuery = applyKf2ListInvariants(adminQuery, { defaultLimit: 200 });

    const { data, error } = await adminQuery;

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const items = mapAnoLetivoRows(data || []);

    return NextResponse.json({ ok: true, items });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
