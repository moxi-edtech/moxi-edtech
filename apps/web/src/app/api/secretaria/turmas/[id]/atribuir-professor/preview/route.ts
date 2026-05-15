import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { authorizeTurmasManage } from "@/lib/escola/disciplinas";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const QuerySchema = z.object({
  disciplina_id: z.string().uuid(),
  professor_user_id: z.string().uuid(),
});

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
    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      disciplina_id: url.searchParams.get("disciplina_id"),
      professor_user_id: url.searchParams.get("professor_user_id"),
    });

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues?.[0]?.message || "Parâmetros inválidos" }, { status: 400 });
    }

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 400 });
    }

    const authz = await authorizeTurmasManage(supabase as any, escolaId, user.id);
    if (!authz.allowed) {
      return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 });
    }

    const { disciplina_id: disciplinaId, professor_user_id: professorUserId } = parsed.data;

    const { data: professorRow } = await supabase
      .from("professores")
      .select("id")
      .eq("escola_id", escolaId)
      .eq("profile_id", professorUserId)
      .maybeSingle();

    const professorId = (professorRow as { id?: string | null } | null)?.id ?? null;
    if (!professorId) {
      return NextResponse.json({ ok: false, error: "Professor não encontrado" }, { status: 404 });
    }

    const { data: versoes } = await supabase
      .from("horario_versoes")
      .select("id, status, publicado_em, created_at")
      .eq("escola_id", escolaId)
      .eq("turma_id", turmaId)
      .order("created_at", { ascending: false });

    const versoesRows = (versoes || []) as HorarioVersaoRow[];
    const effectiveVersion =
      versoesRows.find((row) => row.status === "draft") ??
      versoesRows.find((row) => row.status === "publicada") ??
      versoesRows[0] ??
      null;

    if (!effectiveVersion?.id) {
      return NextResponse.json({
        ok: true,
        data: {
          versao_id: null,
          versao_status: null,
          disciplina_slots_count: 0,
          same_turma_slots_count: 0,
          conflict_slots_count: 0,
          has_quadro_for_disciplina: false,
          conflicting_items: [],
        },
      });
    }

    const { data: disciplinaRows, error: disciplinaRowsError } = await supabase
      .from("quadro_horarios")
      .select("slot_id")
      .eq("escola_id", escolaId)
      .eq("turma_id", turmaId)
      .eq("versao_id", effectiveVersion.id)
      .eq("disciplina_id", disciplinaId);

    if (disciplinaRowsError) {
      return NextResponse.json({ ok: false, error: disciplinaRowsError.message }, { status: 400 });
    }

    const slotIds = Array.from(new Set((disciplinaRows || []).map((row: any) => row.slot_id).filter(Boolean)));
    if (slotIds.length === 0) {
      return NextResponse.json({
        ok: true,
        data: {
          versao_id: effectiveVersion.id,
          versao_status: effectiveVersion.status,
          disciplina_slots_count: 0,
          same_turma_slots_count: 0,
          conflict_slots_count: 0,
          has_quadro_for_disciplina: false,
          conflicting_items: [],
        },
      });
    }

    const { data: sameTurmaRows } = await supabase
      .from("quadro_horarios")
      .select("slot_id")
      .eq("escola_id", escolaId)
      .eq("turma_id", turmaId)
      .eq("versao_id", effectiveVersion.id)
      .eq("professor_id", professorId)
      .in("slot_id", slotIds);

    const { data: conflictRows } = await supabase
      .from("quadro_horarios")
      .select("slot_id, turma_id, disciplina_id")
      .eq("escola_id", escolaId)
      .eq("versao_id", effectiveVersion.id)
      .eq("professor_id", professorId)
      .in("slot_id", slotIds)
      .neq("turma_id", turmaId);

    const conflictingTurmaIds = Array.from(new Set((conflictRows || []).map((row: any) => row.turma_id).filter(Boolean)));
    const conflictingDisciplinaIds = Array.from(new Set((conflictRows || []).map((row: any) => row.disciplina_id).filter(Boolean)));

    const [turmasRes, disciplinasRes] = await Promise.all([
      conflictingTurmaIds.length > 0
        ? supabase.from("turmas").select("id, nome").in("id", conflictingTurmaIds).eq("escola_id", escolaId)
        : Promise.resolve({ data: [] as Array<{ id: string; nome: string | null }> }),
      conflictingDisciplinaIds.length > 0
        ? supabase.from("disciplinas_catalogo").select("id, nome").in("id", conflictingDisciplinaIds).eq("escola_id", escolaId)
        : Promise.resolve({ data: [] as Array<{ id: string; nome: string | null }> }),
    ]);

    const turmaById = new Map<string, string>();
    for (const row of turmasRes.data || []) turmaById.set(row.id, row.nome ?? "Turma");
    const disciplinaById = new Map<string, string>();
    for (const row of disciplinasRes.data || []) disciplinaById.set(row.id, row.nome ?? "Disciplina");

    const conflictingItems = (conflictRows || []).map((row: any) => ({
      slot_id: row.slot_id,
      turma_id: row.turma_id,
      turma_nome: turmaById.get(row.turma_id) ?? "Turma",
      disciplina_id: row.disciplina_id,
      disciplina_nome: disciplinaById.get(row.disciplina_id) ?? "Disciplina",
    }));

    return NextResponse.json({
      ok: true,
      data: {
        versao_id: effectiveVersion.id,
        versao_status: effectiveVersion.status,
        disciplina_slots_count: slotIds.length,
        same_turma_slots_count: (sameTurmaRows || []).length,
        conflict_slots_count: (conflictRows || []).length,
        has_quadro_for_disciplina: slotIds.length > 0,
        conflicting_items: conflictingItems,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Erro desconhecido" }, { status: 500 });
  }
}
