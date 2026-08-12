import { supabaseRouteClient } from "@/lib/supabaseServer";
import type { Database } from "~types/supabase";
import { ACTIVE_MATRICULA_STATUSES } from "@/lib/matriculas/status";
import { resolveAuthorizedStudentIds } from "@/lib/portalAlunoAuth";

export type AlunoContext = {
  userId: string;
  escolaId: string | null;
  alunoId: string | null;
  alunoIds: string[];
  matriculaId: string | null;
  turmaId: string | null;
  anoLetivo: number | null;
};

export async function getAlunoContext() {
  const supabase = await supabaseRouteClient<Database>();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) return { supabase, ctx: null as null };

  let escolaId: string | null = null;
  let alunoId: string | null = null;
  let alunoIds: string[] = [];
  let matriculaId: string | null = null;
  let turmaId: string | null = null;
  let anoLetivo: number | null = null;

  try {
    const { data: vinc } = await supabase
      .from("escola_users")
      .select("escola_id, papel")
      .eq('user_id', user.id)
      .limit(10);
    const vincPortal = (vinc || []).find((row) => row.papel === "aluno" || row.papel === "encarregado");
    escolaId = vincPortal?.escola_id ?? null;

    if (!escolaId) {
      const { data: directAluno } = await supabase
        .from("alunos")
        .select("escola_id")
        .eq("profile_id", user.id)
        .limit(1)
        .maybeSingle();
      escolaId = directAluno?.escola_id ?? null;
    }

    if (escolaId) {
      alunoIds = await resolveAuthorizedStudentIds({
        supabase,
        userId: user.id,
        escolaId,
        userEmail: user.email,
      });
    }
    alunoId = alunoIds[0] ?? null;

    if (alunoId) {
      let activeAno: number | null = null;

      if (escolaId) {
        const { data: activeAnoRow } = await supabase
          .from("anos_letivos")
          .select("ano")
          .eq('escola_id', escolaId)
          .eq('ativo', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        activeAno = typeof activeAnoRow?.ano === 'number' ? activeAnoRow.ano : null;
      }

      let matQuery = supabase
        .from("matriculas")
        .select("id, turma_id, escola_id, ano_letivo")
        .eq('aluno_id', alunoId)
        .in('status', ACTIVE_MATRICULA_STATUSES)
        .order('ano_letivo', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1);
      if (escolaId) matQuery = matQuery.eq('escola_id', escolaId);
      if (activeAno !== null) matQuery = matQuery.eq('ano_letivo', activeAno);

      let { data: mats } = await matQuery;

      if ((!mats || mats.length === 0) && escolaId) {
        const fallbackQuery = supabase
          .from("matriculas")
          .select("id, turma_id, escola_id, ano_letivo")
          .eq('aluno_id', alunoId)
          .eq('escola_id', escolaId)
          .in('status', ACTIVE_MATRICULA_STATUSES)
          .order('ano_letivo', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1);
        const fallback = await fallbackQuery;
        mats = fallback.data;
      }

      const mat = mats?.[0];
      matriculaId = mat?.id ?? null;
      turmaId = mat?.turma_id ?? null;
      escolaId = escolaId ?? (mat?.escola_id ?? null);
      anoLetivo = typeof mat?.ano_letivo === 'number' ? mat.ano_letivo : null;
    }
  } catch {}

  return {
    supabase,
    ctx: {
      userId: user.id,
      escolaId,
      alunoId,
      alunoIds,
      matriculaId,
      turmaId,
      anoLetivo,
    } as AlunoContext,
  };
}
