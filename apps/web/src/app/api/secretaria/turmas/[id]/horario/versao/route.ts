import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { authorizeTurmasManage } from "@/lib/escola/disciplinas";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { timetablePublicationState } from "@/lib/horarios/timetable-publication-state";
import { AcademicYearContextError, resolveAcademicYearScope } from "@/lib/academic-year/context";

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

    const { data: turma, error: turmaError } = await supabase
      .from("turmas")
      .select("id, session_id")
      .eq("id", turmaId)
      .eq("escola_id", escolaId)
      .maybeSingle();
    if (turmaError) throw turmaError;
    if (!turma) {
      return NextResponse.json({ ok: false, error: "Turma não encontrada na escola." }, { status: 404 });
    }
    if (!turma.session_id) {
      return NextResponse.json({ ok: false, error: "Turma sem ano letivo canónico." }, { status: 409 });
    }
    const year = await resolveAcademicYearScope(supabase, {
      escolaId, requestedAcademicYearId: turma.session_id, operation: "READ",
    });
    const requestedYearId = searchParams.get("ano_letivo_id");
    if (requestedYearId && requestedYearId !== year.id) {
      return NextResponse.json({ ok: false, code: "CROSS_YEAR_ENTITY_MISMATCH", error: "A turma não pertence ao ano solicitado." }, { status: 409 });
    }

    const { data: versoes, error: versoesError } = await supabase
      .from("horario_versoes")
      .select("id, status, publicado_em, created_at")
      .eq("escola_id", escolaId)
      .eq("turma_id", turmaId)
      .order("created_at", { ascending: false });
    if (versoesError) throw versoesError;

    const versoesRows = (versoes || []) as HorarioVersaoRow[];
    const publicada = versoesRows.find((row) => row.status === "publicada") ?? null;
    let draft = versoesRows.find((row) => row.status === "draft") ?? null;

    // Histórico e anos planeados: apenas consultar. Nunca criar draft no GET.
    if (!draft && year.status === "ACTIVE") {
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
      versao_id: year.status === "ACTIVE" ? (draft?.id ?? null) : null,
      versao_publicada_id: publicada?.id ?? null,
      modo: year.status === "ACTIVE" ? "CURRENT" : "HISTORICAL_READ",
      ano_letivo_id: year.id,
      versoes: versoesRows,
      horario_status: timetablePublicationState(versoesRows),
    });
  } catch (err: unknown) {
    if (err instanceof AcademicYearContextError) {
      return NextResponse.json({ ok: false, error: err.message, code: err.code }, { status: err.status });
    }
    return NextResponse.json({ ok: false, error: "Não foi possível consultar as versões de horário." }, { status: 500 });
  }
}
