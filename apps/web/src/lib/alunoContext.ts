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
      .from('escola_users')
      .select('*')
      .eq('user_id', user.id)
      .limit(10);
    const vincAluno = (vinc || []).find((v: any) => {
      const papel = (v as any)?.papel ?? (v as any)?.role ?? null;
      return papel === 'aluno';
    }) as any;
    escolaId = vincAluno?.escola_id ?? null;

    let alunoQuery = supabase
      .from('alunos')
      .select('id, escola_id')
      .eq('profile_id', user.id)
      .limit(1);
    if (escolaId) alunoQuery = alunoQuery.eq('escola_id', escolaId);

    const { data: alunos } = await alunoQuery;
    alunoId = (alunos?.[0] as any)?.id ?? null;
    escolaId = escolaId ?? ((alunos?.[0] as any)?.escola_id ?? null);

    if (alunoId) {
      let matQuery = supabase
        .from('matriculas')
        .select('id, turma_id, escola_id')
        .eq('aluno_id', alunoId)
        .order('created_at', { ascending: false })
        .limit(1);
      if (escolaId) matQuery = matQuery.eq('escola_id', escolaId);

      const { data: mats } = await matQuery;
      const mat = mats?.[0] as any;
      matriculaId = mat?.id ?? null;
      turmaId = mat?.turma_id ?? null;
      escolaId = escolaId ?? (mat?.escola_id ?? null);
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
