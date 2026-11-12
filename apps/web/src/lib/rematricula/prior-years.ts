/** The path consists only of actual school enrollments, never inferred years. */
export async function readPriorYears(db: any, escolaId: string, alunoId: string, targetYear: number) {
  const { data, error } = await db.from("v_student_lifecycle_status_v2")
    .select("matricula_id,ano_letivo,situacao_resultado,status_persistido")
    .eq("escola_id", escolaId).eq("aluno_id", alunoId).lt("ano_letivo", targetYear)
    .order("ano_letivo", { ascending: true }).order("matricula_id", { ascending: true }).limit(50);
  if (error) throw error;
  if ((data ?? []).length === 50) throw new Error("Percurso extenso: confira as matrículas anteriores.");
  const rows = data ?? [];
  const seen = new Set<number>();
  let gap = false;
  for (const row of rows) {
    if (seen.has(Number(row.ano_letivo))) throw new Error("Existe mais de uma matrícula no mesmo ano. Confira o percurso.");
    seen.add(Number(row.ano_letivo));
  }
  const years = [...seen];
  gap = years.some((year, i) => i > 0 && year !== years[i - 1] + 1);
  return { ids: rows.map((row: any) => String(row.matricula_id)),
    pending: gap || rows.some((row: any) => !["transferido", "trancado", "desistente", "anulado"].includes(row.status_persistido) && row.situacao_resultado !== "homologado") };
}
