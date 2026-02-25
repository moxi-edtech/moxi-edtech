import { supabaseServerTyped } from "@/lib/supabaseServer";
import type { Database } from "~types/supabase";

export type AlunoContext = {
  userId: string;
  escolaId: string | null;
  alunoId: string | null;
  matriculaId: string | null;
  turmaId: string | null;
  anoLetivo: number | null;
};

export async function getAlunoContext() {
  const supabase = await supabaseServerTyped<Database>();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) return { supabase, ctx: null as null };

  let escolaId: string | null = null;
  let alunoId: string | null = null;
  let matriculaId: string | null = null;
  let turmaId: string | null = null;
  let anoLetivo: number | null = null;

  try {
    const { data: vinc } = await supabase
      .from("escola_users")
      .select("escola_id, papel")
      .eq('user_id', user.id)
      .limit(10);
    const vincAluno = (vinc || []).find((row) => row.papel === "aluno");
    escolaId = vincAluno?.escola_id ?? null;

    let alunoQuery = supabase
      .from("alunos")
      .select("id, escola_id")
      .eq('profile_id', user.id)
      .limit(1);
    if (escolaId) alunoQuery = alunoQuery.eq('escola_id', escolaId);

    const { data: alunos } = await alunoQuery;
    alunoId = alunos?.[0]?.id ?? null;
    escolaId = escolaId ?? (alunos?.[0]?.escola_id ?? null);

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
        .in('status', ['ativo', 'ativa', 'active'])
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
          .in('status', ['ativo', 'ativa', 'active'])
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
      matriculaId,
      turmaId,
      anoLetivo,
    } as AlunoContext,
  };
}
