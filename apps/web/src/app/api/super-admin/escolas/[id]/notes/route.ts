import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { isSuperAdminRole } from "@/lib/auth/requireSuperAdminAccess";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await ctx.params;
  try {
    const s = await supabaseServer();
    const { data: sess } = await s.auth.getUser();
    const user = sess?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const { data: rows } = await s
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const role = (rows?.[0] as any)?.role as string | undefined;
    if (!isSuperAdminRole(role)) {
      return NextResponse.json({ ok: false, error: "Somente Super Admin" }, { status: 403 });
    }

    const { data, error } = await (s as any)
      .from("escola_notas_internas")
      .select("nota, updated_at")
      .eq("escola_id", escolaId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, nota: data?.nota ?? "", updated_at: data?.updated_at ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await ctx.params;
  try {
    const body = await req.json().catch(() => ({}));
    const nota = typeof body?.nota === "string" ? body.nota : "";

    const s = await supabaseServer();
    const { data: sess } = await s.auth.getUser();
    const user = sess?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const { data: rows } = await s
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const role = (rows?.[0] as any)?.role as string | undefined;
    if (!isSuperAdminRole(role)) {
      return NextResponse.json({ ok: false, error: "Somente Super Admin" }, { status: 403 });
    }

    const { data: existing, error: fetchError } = await (s as any)
      .from("escola_notas_internas")
      .select("escola_id")
      .eq("escola_id", escolaId)
      .maybeSingle();
    if (fetchError) {
      return NextResponse.json({ ok: false, error: fetchError.message }, { status: 400 });
    }

    if (existing?.escola_id) {
      const { error } = await (s as any)
        .from("escola_notas_internas")
        .update({ nota, updated_by: user.id })
        .eq("escola_id", escolaId);
      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      }
    } else {
      const { error } = await (s as any)
        .from("escola_notas_internas")
        .insert({
          escola_id: escolaId,
          nota,
          created_by: user.id,
          updated_by: user.id,
        });
      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
