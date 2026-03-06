import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { authorizeTurmasManage } from "@/lib/escola/disciplinas";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type HorarioVersaoRow = { id: string; status: string; publicado_em: string | null; created_at: string | null };

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

    const { data: versoes } = await supabase
      .from("horario_versoes")
      .select("id, status, publicado_em, created_at")
      .eq("escola_id", escolaId)
      .eq("turma_id", turmaId)
      .order("created_at", { ascending: false });

    const versoesRows = (versoes || []) as HorarioVersaoRow[];
    const publicada = versoesRows.find((row) => row.status === "publicada") ?? null;
    let draft = versoesRows.find((row) => row.status === "draft") ?? null;

    if (!draft) {
      const { data: createdDraft, error: createDraftError } = await supabase
        .from("horario_versoes")
        .insert({ escola_id: escolaId, turma_id: turmaId, status: "draft" })
        .select("id, status, publicado_em, created_at")
        .single();

      if (createDraftError) {
        return NextResponse.json({ ok: false, error: createDraftError.message }, { status: 400 });
      }

      draft = createdDraft as HorarioVersaoRow;
    }

    return NextResponse.json({
      ok: true,
      versao_id: draft?.id ?? null,
      versao_publicada_id: publicada?.id ?? null,
      versoes: versoesRows,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Erro desconhecido" }, { status: 500 });
  }
}
