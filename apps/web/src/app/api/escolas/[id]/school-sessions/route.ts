import { NextRequest, NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params;

  try {
    const supabase = await supabaseServerTyped<any>();
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
          .select("role, escola_id")
          .eq("user_id", user.id)
          .eq("escola_id", escolaId)
          .limit(1);
        allowed = Boolean(prof && prof.length > 0 && (prof[0] as any).role === "admin");
      } catch {}
    }

    if (!allowed) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const computeAno = (row: any): string | null => {
      const name = String(row?.nome ?? "").trim();
      const matches = name.match(/\b(19|20)\d{2}\s*[\/-]\s*(19|20)\d{2}\b/);
      if (matches && matches[0]) return matches[0];
      const yearOnly = name.match(/\b(19|20)\d{2}\b/);
      if (yearOnly && yearOnly[0]) return yearOnly[0];
      const si = row?.data_inicio ? new Date(row.data_inicio) : null;
      const sf = row?.data_fim ? new Date(row.data_fim) : null;
      if (si && !isNaN(si.getTime()) && sf && !isNaN(sf.getTime())) {
        return `${si.getFullYear()}/${sf.getFullYear()}`;
      }
      if (si && !isNaN(si.getTime())) {
        const a = si.getFullYear();
        return `${a}/${a + 1}`;
      }
      return null;
    };

    if (!adminUrl || !serviceRole) {
      const { data, error } = await supabase
        .from("school_sessions")
        .select("id, nome, data_inicio, data_fim, status")
        .eq("escola_id", escolaId)
        .order("data_inicio", { ascending: false });

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      }

      const items = (data || []).map((row: any) => ({
        id: row.id,
        nome: row.nome,
        data_inicio: row.data_inicio,
        data_fim: row.data_fim,
        status: row.status,
        ano: computeAno(row),
        ano_letivo: computeAno(row),
      }));

      return NextResponse.json({ ok: true, items });
    }

    const admin = createAdminClient<Database>(adminUrl, serviceRole);
    const { data, error } = await (admin as any)
      .from("school_sessions")
      .select("id, nome, data_inicio, data_fim, status")
      .eq("escola_id", escolaId)
      .order("data_inicio", { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const items = (data || []).map((row: any) => ({
      id: row.id,
      nome: row.nome,
      data_inicio: row.data_inicio,
      data_fim: row.data_fim,
      status: row.status,
      ano: computeAno(row),
      ano_letivo: computeAno(row),
    }));

    return NextResponse.json({ ok: true, items });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

