import { pdf } from "@react-pdf/renderer";
import { notaParaExtensoPTAO } from "@/lib/academico/extenso";
import { BoletimBatchV1, type BoletimSnapshot } from "@/templates/pdf/ministerio/BoletimBatchV1";
import { CertificadoBatchV1, type CertificadoSnapshot } from "@/templates/pdf/ministerio/CertificadoBatchV1";

const buildQrDataUrl = (value: string) =>
  `https://quickchart.io/qr?text=${encodeURIComponent(value)}&margin=1&size=240`;

export async function renderBoletimPdfBuffer(params: {
  supabase: any;
  escolaId: string;
  turmaId: string;
  alunosIds?: string[];
}): Promise<Buffer> {
  const { supabase, escolaId, turmaId, alunosIds = [] } = params;

  const { data: turma } = await supabase
    .from("turmas")
    .select("id, escola_id, ano_letivo")
    .eq("id", turmaId)
    .eq("escola_id", escolaId)
    .single();

  if (!turma?.id) throw new Error("Turma não encontrada");

  let query = supabase
    .from("matriculas")
    .select("id, aluno_id")
    .eq("escola_id", escolaId)
    .eq("turma_id", turmaId)
    .in("status", ["concluido", "reprovado"]);
  if (alunosIds.length > 0) query = query.in("aluno_id", alunosIds);

  const { data: matriculas, error: matError } = await query;
  if (matError) throw new Error(matError.message);

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

  const snapshots: BoletimSnapshot[] = [];
  for (const m of matriculas || []) {
    const { data: docRes, error: emitError } = await supabase.rpc("emitir_documento_final", {
      p_escola_id: escolaId,
      p_aluno_id: m.aluno_id,
      p_ano_letivo: Number(turma.ano_letivo),
      p_tipo_documento: "boletim_trimestral",
    });
    if (emitError || !docRes?.docId) continue;

    const { data: row } = await supabase
      .from("documentos_emitidos")
      .select("dados_snapshot, hash_validacao")
      .eq("id", docRes.docId)
      .eq("escola_id", escolaId)
      .maybeSingle();

    const { data: boletimRows } = await supabase
      .from("vw_boletim_por_matricula")
      .select("turma_disciplina_id, trimestre, nota_final")
      .eq("escola_id", escolaId)
      .eq("matricula_id", m.id);

    const notasByDisciplina = new Map<string, { t1?: number | null; t2?: number | null; t3?: number | null }>();
    for (const rowNota of boletimRows || []) {
      const td = tdMap.get(rowNota.turma_disciplina_id);
      if (!td?.disciplina_id) continue;
      const current = notasByDisciplina.get(td.disciplina_id) ?? {};
      const tri = Number(rowNota.trimestre);
      if (tri === 1) current.t1 = rowNota.nota_final;
      if (tri === 2) current.t2 = rowNota.nota_final;
      if (tri === 3) current.t3 = rowNota.nota_final;
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

    const snapshot = (row?.dados_snapshot || {}) as Record<string, any>;
    const mediaFinal = typeof snapshot.media_final === "number" ? snapshot.media_final : null;
    snapshots.push({
      ...(snapshot as any),
      hash_validacao: row?.hash_validacao ?? snapshot.hash_validacao ?? null,
      disciplinas,
      media_extenso:
        snapshot.media_extenso ?? (typeof mediaFinal === "number" ? notaParaExtensoPTAO(mediaFinal) : null),
      qrCodeDataUrl:
        (row?.hash_validacao ?? snapshot.hash_validacao)
          ? buildQrDataUrl(String(row?.hash_validacao ?? snapshot.hash_validacao))
          : null,
    });
  }

  const blob = await pdf(<BoletimBatchV1 snapshots={snapshots} />).toBlob();
  return Buffer.from(await blob.arrayBuffer());
}

export async function renderCertificadoPdfBuffer(params: {
  supabase: any;
  escolaId: string;
  turmaId: string;
  alunosIds?: string[];
}): Promise<Buffer> {
  const { supabase, escolaId, turmaId, alunosIds = [] } = params;

  const { data: turma } = await supabase
    .from("turmas")
    .select("id, escola_id, ano_letivo")
    .eq("id", turmaId)
    .eq("escola_id", escolaId)
    .single();

  if (!turma?.id) throw new Error("Turma não encontrada");

  let query = supabase
    .from("matriculas")
    .select("id, aluno_id")
    .eq("escola_id", escolaId)
    .eq("turma_id", turmaId)
    .in("status", ["concluido", "reprovado"]);
  if (alunosIds.length > 0) query = query.in("aluno_id", alunosIds);

  const { data: matriculas, error: matError } = await query;
  if (matError) throw new Error(matError.message);

  const snapshots: CertificadoSnapshot[] = [];
  for (const m of matriculas || []) {
    const { data: docRes, error: emitError } = await supabase.rpc("emitir_documento_final", {
      p_escola_id: escolaId,
      p_aluno_id: m.aluno_id,
      p_ano_letivo: Number(turma.ano_letivo),
      p_tipo_documento: "certificado",
    });
    if (emitError || !docRes?.docId) continue;

    const { data: row } = await supabase
      .from("documentos_emitidos")
      .select("dados_snapshot, hash_validacao")
      .eq("id", docRes.docId)
      .eq("escola_id", escolaId)
      .maybeSingle();

    const snapshot = (row?.dados_snapshot || {}) as Record<string, any>;
    const mediaFinal = typeof snapshot.media_final === "number" ? snapshot.media_final : null;
    snapshots.push({
      ...(snapshot as any),
      hash_validacao: row?.hash_validacao ?? snapshot.hash_validacao ?? null,
      media_extenso:
        snapshot.media_extenso ?? (typeof mediaFinal === "number" ? notaParaExtensoPTAO(mediaFinal) : null),
      qrCodeDataUrl:
        (row?.hash_validacao ?? snapshot.hash_validacao)
          ? buildQrDataUrl(String(row?.hash_validacao ?? snapshot.hash_validacao))
          : null,
    });
  }

  const blob = await pdf(<CertificadoBatchV1 snapshots={snapshots} />).toBlob();
  return Buffer.from(await blob.arrayBuffer());
}
