import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-client";

export const dynamic = "force-dynamic";

async function requireSuperAdmin() {
  const supabase = await createRouteClient();
  const { data: isSuperAdmin, error } = await supabase.rpc("check_super_admin_role");

  if (error || !isSuperAdmin) {
    return { supabase, error: NextResponse.json({ ok: false, error: "Somente Super Admin" }, { status: 403 }) };
  }

  return { supabase, error: null };
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await ctx.params;

  try {
    const { supabase, error: authResponse } = await requireSuperAdmin();
    if (authResponse) return authResponse;

    const { data, error } = await supabase
      .from("escola_notas_internas")
      .select("nota, updated_at")
      .eq("escola_id", escolaId)
      .limit(1);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    const note = data?.[0];
    return NextResponse.json({ ok: true, nota: note?.nota ?? "", updated_at: note?.updated_at ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await ctx.params;

  try {
    const body: unknown = await req.json().catch(() => ({}));
    const nota = typeof body === "object" && body !== null && "nota" in body && typeof body.nota === "string"
      ? body.nota
      : "";

    const { supabase, error: authResponse } = await requireSuperAdmin();
    if (authResponse) return authResponse;

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id ?? null;

    const { error } = await supabase
      .from("escola_notas_internas")
      .upsert(
        {
          escola_id: escolaId,
          nota,
          created_by: userId,
          updated_by: userId,
        },
        { onConflict: "escola_id" }
      );

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
