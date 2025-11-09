import { supabaseServerTyped } from "@/lib/supabaseServer";

export type AlunoContext = {
  userId: string;
  escolaId: string | null;
  alunoId: string | null;
  matriculaId: string | null;
  turmaId: string | null;
};

export async function getAlunoContext() {
  const supabase = await supabaseServerTyped<any>();
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) return { supabase, ctx: null as null };

  let escolaId: string | null = null;
  let alunoId: string | null = null;
  let matriculaId: string | null = null;
  let turmaId: string | null = null;

  try {
    const { data: vinc } = await supabase
      .from('escola_usuarios')
      .select('escola_id, papel')
      .eq('user_id', user.id)
      .eq('papel', 'aluno')
      .limit(1);
    escolaId = (vinc?.[0] as any)?.escola_id ?? null;

    const { data: alunos } = await supabase
      .from('alunos')
      .select('id')
      .eq('profile_id', user.id)
      .limit(1);
    alunoId = (alunos?.[0] as any)?.id ?? null;

    if (alunoId) {
      const { data: mats } = await supabase
        .from('matriculas')
        .select('id, turma_id')
        .eq('aluno_id', alunoId)
        .order('created_at', { ascending: false })
        .limit(1);
      const mat = mats?.[0] as any;
      matriculaId = mat?.id ?? null;
      turmaId = mat?.turma_id ?? null;
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
    } as AlunoContext,
  };
}

