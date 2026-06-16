import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { authorizeTurmasManage } from "@/lib/escola/disciplinas";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { renderHorarioTurmaPdfBuffer } from "@/lib/horarios/renderHorarioTurmaPdf";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const { id: turmaId } = await ctx.params;
    const { data: turmaScope, error: turmaScopeError } = await supabase
      .from("turmas")
      .select("escola_id")
      .eq("id", turmaId)
      .maybeSingle();

    if (turmaScopeError) {
      return NextResponse.json({ ok: false, error: turmaScopeError.message }, { status: 400 });
    }

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id, (turmaScope as any)?.escola_id ?? null);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 403 });

    const authz = await authorizeTurmasManage(supabase as any, escolaId, user.id);
    if (!authz.allowed) {
      return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const { buffer, filename } = await renderHorarioTurmaPdfBuffer({
      supabase: supabase as any,
      escolaId,
      turmaId,
      versaoId: searchParams.get("versao_id"),
    });

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[secretaria/turmas/horario/pdf] error:", e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
