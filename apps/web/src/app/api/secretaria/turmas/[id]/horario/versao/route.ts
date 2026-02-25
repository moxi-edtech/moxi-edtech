import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { authorizeTurmasManage } from "@/lib/escola/disciplinas";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const { id: turmaId } = await ctx.params;
    const { searchParams } = new URL(req.url);
    const requestedEscolaId = searchParams.get("escola_id");
    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id, requestedEscolaId);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Usuário não vinculado a nenhuma escola" }, { status: 403 });
    }

    const authz = await authorizeTurmasManage(supabase as any, escolaId, user.id);
    if (!authz.allowed) {
      return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 });
    }

    const { data } = await supabase
      .from("quadro_horarios")
      .select("versao_id, created_at")
      .eq("escola_id", escolaId)
      .eq("turma_id", turmaId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({ ok: true, versao_id: data?.versao_id ?? null });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Erro desconhecido" }, { status: 500 });
  }
}
