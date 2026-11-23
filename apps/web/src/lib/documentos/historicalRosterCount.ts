import { classifyMatricula } from "@/lib/documentos/listaNominalPolicy";

/**
 * Contagens do ano de origem para documentos: todos os estados incluídos
 * pela política nominal histórica, sem depender de matrículas "ativas" hoje.
 * Usa cursor de PK e falha fechado se exceder o limite de segurança.
 */
export async function loadHistoricalRosterCounts(
  supabase: any,
  input: { escolaId: string; yearBase: number; turmaIds: string[] },
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (input.turmaIds.length === 0) return counts;

  const allowed = new Set(["activa", "concluida", "transferida", "trancada", "desistente"]);
  const PAGE_SIZE = 500;
  const MAX_PAGES = 30;
  let cursor: string | null = null;
  let complete = false;

  for (let page = 0; page < MAX_PAGES; page++) {
    let query = supabase
      .from("matriculas")
      .select("id, turma_id, status")
      .eq("escola_id", input.escolaId)
      .eq("ano_letivo", input.yearBase)
      .in("turma_id", input.turmaIds)
      .order("id", { ascending: true })
      .limit(PAGE_SIZE);
    if (cursor) query = query.gt("id", cursor);
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data ?? []) as Array<{ id: string; turma_id: string | null; status: string | null }>;
    for (const row of rows) {
      if (row.turma_id && allowed.has(classifyMatricula(row.status))) {
        counts.set(row.turma_id, (counts.get(row.turma_id) ?? 0) + 1);
      }
    }
    if (rows.length < PAGE_SIZE) {
      complete = true;
      break;
    }
    const last = rows[rows.length - 1]?.id;
    if (!last || (cursor && last <= cursor)) throw new Error("Cursor inválido no arquivo nominal.");
    cursor = last;
  }

  if (!complete) throw new Error("Arquivo nominal demasiado grande para consulta segura.");
  return counts;
}
