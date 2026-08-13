type Db = any;

export async function loadAulaRelatorio(supabase: Db, escolaId: string, aulaId: string) {
  const { data: aula, error } = await supabase.from("aulas").select("id, escola_id, data, inicio_previsto, fim_previsto, inicio_real, fim_real, status, resumo, observacoes, conteudo, turma_disciplina_id, professor_id").eq("id", aulaId).eq("escola_id", escolaId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!aula) return null;
  const { data: td } = await supabase.from("turma_disciplinas").select("id, turma_id, curso_matriz_id").eq("id", aula.turma_disciplina_id).eq("escola_id", escolaId).maybeSingle();
  const [{ data: turma }, { data: matriz }, { data: professor }, { data: presencas }, { data: plano }, { data: atividades }] = await Promise.all([
    td?.turma_id ? supabase.from("turmas").select("id, nome").eq("id", td.turma_id).eq("escola_id", escolaId).maybeSingle() : Promise.resolve({ data: null }),
    td?.curso_matriz_id ? supabase.from("curso_matriz").select("disciplina_id").eq("id", td.curso_matriz_id).eq("escola_id", escolaId).maybeSingle() : Promise.resolve({ data: null }),
    aula.professor_id ? supabase.from("professores").select("id, nome_completo").eq("id", aula.professor_id).eq("escola_id", escolaId).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("frequencias").select("matricula_id, status").eq("escola_id", escolaId).eq("aula_id", aula.id).limit(500),
    supabase.from("planos_aula").select("id, status, tema, objetivos, conteudos, metodologia, avaliacao, tarefa_casa").eq("escola_id", escolaId).eq("aula_id", aula.id).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("atividades_pedagogicas").select("id, titulo, status, nota_maxima").eq("escola_id", escolaId).eq("aula_id", aula.id).limit(50),
  ]);
  const matriculaIds = Array.from(new Set((presencas ?? []).map((row: any) => row.matricula_id).filter(Boolean)));
  const { data: matriculas } = matriculaIds.length
    ? await supabase.from("matriculas").select("id, alunos:aluno_id(id, nome, nome_completo, numero_processo)").eq("escola_id", escolaId).in("id", matriculaIds)
    : { data: [] };
  const alunoMap = new Map((matriculas ?? []).map((row: any) => [row.id, row.alunos]));
  const { data: disciplina } = matriz?.disciplina_id ? await supabase.from("disciplinas_catalogo").select("id, nome").eq("id", matriz.disciplina_id).eq("escola_id", escolaId).maybeSingle() : { data: null };
  const attendance = (presencas ?? []).reduce((acc: { presentes: number; faltas: number; atrasos: number; total: number }, row: any) => { acc.total += 1; if (row.status === "presente") acc.presentes += 1; if (row.status === "falta") acc.faltas += 1; if (row.status === "atraso") acc.atrasos += 1; return acc; }, { presentes: 0, faltas: 0, atrasos: 0, total: 0 });
  const attendanceRows = (presencas ?? []).map((row: any) => ({ matricula_id: row.matricula_id, status: row.status, aluno: alunoMap.get(row.matricula_id) ?? null })).sort((a: any, b: any) => String(a.aluno?.nome_completo ?? a.aluno?.nome ?? "").localeCompare(String(b.aluno?.nome_completo ?? b.aluno?.nome ?? ""), "pt"));
  return { aula, turma, disciplina, professor, attendance, attendanceRows, plano: plano ?? null, atividades: atividades ?? [] };
}
