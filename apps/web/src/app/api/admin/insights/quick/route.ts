import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = await supabaseServer();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;

    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const metaEscolaId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null;
    const resolvedEscolaId = await resolveEscolaIdForUser(
      supabase as any,
      user.id,
      null,
      metaEscolaId ? String(metaEscolaId) : null
    );

    if (!resolvedEscolaId) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    const [{ data: topTurmas, error: turmasError }, { data: topCursos, error: cursosError }] =
      await Promise.all([
        supabase
          .from("vw_top_turmas_hoje")
          .select("turma_nome, percent")
          .eq("escola_id", resolvedEscolaId)
          .order("percent", { ascending: false })
          .limit(10),
        supabase
          .from("vw_top_cursos_media")
          .select("curso_nome, media")
          .eq("escola_id", resolvedEscolaId)
          .order("media", { ascending: false })
          .limit(10),
      ]);

    if (turmasError) {
      return NextResponse.json({ ok: false, error: turmasError.message }, { status: 500 });
    }
    if (cursosError) {
      return NextResponse.json({ ok: false, error: cursosError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      topTurmas: (topTurmas ?? []).map((row) => ({
        turma_nome: row.turma_nome,
        percent: Number(row.percent ?? 0),
      })),
      topCursos: (topCursos ?? []).map((row) => ({
        curso_nome: row.curso_nome,
        media: Number(row.media ?? 0),
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
