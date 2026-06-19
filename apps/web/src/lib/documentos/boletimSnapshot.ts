import { notaParaExtensoPTAO } from "@/lib/academico/extenso";
import type { BoletimSnapshot as BoletimSnapshotType } from "@/templates/pdf/ministerio/BoletimBatchV1";
import { clean, toNumber } from "./snapshotUtils";

export type BoletimSnapshot = BoletimSnapshotType;

export async function buildBoletimSnapshot(params: {
  supabase: any;
  escolaId: string;
  turmaId: string;
  matriculaId: string;
  baseSnapshot: Record<string, any>;
  hashValidacao?: string | null;
}) {
  const { supabase, escolaId, turmaId, matriculaId, baseSnapshot, hashValidacao } = params;

  const { data: turmaDisciplinas } = await supabase
    .from("turma_disciplinas")
    .select("id, conta_para_media_med, curso_matriz(disciplina_id, disciplinas_catalogo(nome))")
    .eq("escola_id", escolaId)
    .eq("turma_id", turmaId);

  const tdMap = new Map<string, { nome: string; conta: boolean; disciplina_id: string | null }>();
  for (const td of turmaDisciplinas || []) {
    tdMap.set(td.id, {
      nome: td?.curso_matriz?.disciplinas_catalogo?.nome ?? "Disciplina",
      conta: td?.conta_para_media_med !== false,
      disciplina_id: td?.curso_matriz?.disciplina_id ?? null,
    });
  }

  const { data: boletimRows } = await supabase
    .from("vw_boletim_por_matricula")
    .select("turma_disciplina_id, trimestre, nota_final")
    .eq("escola_id", escolaId)
    .eq("matricula_id", matriculaId);

  const notasByDisciplina = new Map<string, { t1?: number | null; t2?: number | null; t3?: number | null }>();
  for (const rowNota of boletimRows || []) {
    const td = tdMap.get(rowNota.turma_disciplina_id);
    if (!td?.disciplina_id) continue;
    const current = notasByDisciplina.get(td.disciplina_id) ?? {};
    const tri = Number(rowNota.trimestre);
    if (tri === 1) current.t1 = toNumber(rowNota.nota_final);
    if (tri === 2) current.t2 = toNumber(rowNota.nota_final);
    if (tri === 3) current.t3 = toNumber(rowNota.nota_final);
    notasByDisciplina.set(td.disciplina_id, current);
  }

  const disciplinas = Array.from(tdMap.values()).map((disc) => {
    const notas = disc.disciplina_id ? notasByDisciplina.get(disc.disciplina_id) : undefined;
    return {
      nome: disc.nome,
      conta_para_media_med: disc.conta,
      t1: notas?.t1 ?? null,
      t2: notas?.t2 ?? null,
      t3: notas?.t3 ?? null,
    };
  });

  const mediaFinal = typeof baseSnapshot.media_final === "number" ? baseSnapshot.media_final : null;

  const snapshot: BoletimSnapshot = {
    ...(baseSnapshot as any),
    hash_validacao: hashValidacao ?? baseSnapshot.hash_validacao ?? null,
    disciplinas,
    media_extenso:
      clean(baseSnapshot.media_extenso) ?? (mediaFinal != null ? notaParaExtensoPTAO(mediaFinal) : null),
  };

  return snapshot;
}