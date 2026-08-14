import type { SupabaseClient } from "@supabase/supabase-js";

type Db = SupabaseClient;
type FrequencyRow = { matricula_id: string; status: string };
type Student = { id?: string; nome?: string | null; nome_completo?: string | null; numero_processo?: string | null };
type StudentRow = { id: string; alunos: Student | null };
type AttendanceRow = { matricula_id: string; status: string; aluno: Student | null };

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
    supabase.from("planos_aula").select("id, status, tema, objetivos, competencias, conteudos, metodologia, recursos, atividades, avaliacao, tarefa_casa, anotacoes_alunos_avaliados").eq("escola_id", escolaId).eq("aula_id", aula.id).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("atividades_pedagogicas").select("id, titulo, status, nota_maxima").eq("escola_id", escolaId).eq("aula_id", aula.id).limit(50),
  ]);
  const frequencyRows = (presencas ?? []) as FrequencyRow[];
  const matriculaIds = Array.from(new Set(frequencyRows.map((row) => row.matricula_id).filter(Boolean)));
  const { data: matriculas } = matriculaIds.length
    ? await supabase.from("matriculas").select("id, alunos:aluno_id(id, nome, nome_completo, numero_processo)").eq("escola_id", escolaId).in("id", matriculaIds)
    : { data: [] };
  const matriculaRows = (matriculas ?? []) as unknown as StudentRow[];
  const alunoMap = new Map<string, Student | null>(matriculaRows.map((row): [string, Student | null] => [row.id, row.alunos]));
  const { data: disciplina } = matriz?.disciplina_id ? await supabase.from("disciplinas_catalogo").select("id, nome").eq("id", matriz.disciplina_id).eq("escola_id", escolaId).maybeSingle() : { data: null };
  const attendance = frequencyRows.reduce((acc: { presentes: number; faltas: number; atrasos: number; total: number }, row) => { acc.total += 1; if (row.status === "presente") acc.presentes += 1; if (row.status === "falta") acc.faltas += 1; if (row.status === "atraso") acc.atrasos += 1; return acc; }, { presentes: 0, faltas: 0, atrasos: 0, total: 0 });
  const attendanceRows: AttendanceRow[] = frequencyRows.map((row) => ({ matricula_id: row.matricula_id, status: row.status, aluno: alunoMap.get(row.matricula_id) ?? null })).sort((a, b) => String(a.aluno?.nome_completo ?? a.aluno?.nome ?? "").localeCompare(String(b.aluno?.nome_completo ?? b.aluno?.nome ?? ""), "pt"));
  return { aula, turma, disciplina, professor, attendance, attendanceRows, plano: plano ?? null, atividades: atividades ?? [] };
}
