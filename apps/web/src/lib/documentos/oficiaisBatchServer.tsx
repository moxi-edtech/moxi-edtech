import { pdf } from "@react-pdf/renderer";
import { BoletimBatchV1, type BoletimSnapshot } from "@/templates/pdf/ministerio/BoletimBatchV1";
import { CertificadoBatchV1, type CertificadoSnapshot } from "@/templates/pdf/ministerio/CertificadoBatchV1";
import { buildBoletimSnapshot } from "@/lib/documentos/boletimSnapshot";
import { buildCertificadoSnapshot } from "@/lib/documentos/certificadoSnapshot";

type QueryError = { message?: string } | null;

type SupabaseQuery<T> = PromiseLike<{ data: T | null; error: QueryError }> & {
  eq(column: string, value: unknown): SupabaseQuery<T>;
  in(column: string, values: unknown[]): SupabaseQuery<T>;
  select(query: string): SupabaseQuery<T>;
  single(): SupabaseQuery<T>;
  maybeSingle(): SupabaseQuery<T>;
};

type SupabaseRpc<T> = PromiseLike<{ data: T | null; error: QueryError }>;

type SupabasePdfClient = {
  from<T>(table: string): {
    select(query: string): SupabaseQuery<T>;
  };
  rpc<T>(fn: string, args: Record<string, unknown>): SupabaseRpc<T>;
};

type TurmaLookup = { id?: string | null; escola_id?: string | null; ano_letivo?: number | string | null; session_id?: string | null };
type MatriculaLookup = { id: string; aluno_id: string };
type DocumentoEmitidoLookup = { dados_snapshot?: Record<string, unknown> | null; hash_validacao?: string | null };
type DocumentoFinalResult = { docId?: string | null };

const buildQrDataUrl = (value: string) =>
  `https://quickchart.io/qr?text=${encodeURIComponent(value)}&margin=1&size=240`;

export async function renderBoletimPdfBuffer(params: {
  supabase: unknown;
  escolaId: string;
  turmaId: string;
  jobId: string;
  alunosIds?: string[];
}): Promise<Buffer> {
  const supabase = params.supabase as SupabasePdfClient;
  const { escolaId, turmaId, jobId, alunosIds = [] } = params;

  const { data: turma } = await supabase
    .from<TurmaLookup>("turmas")
    .select("id, escola_id, ano_letivo, session_id")
    .eq("id", turmaId)
    .eq("escola_id", escolaId)
    .single();

  if (!turma?.id || !turma.session_id) throw new Error("Turma ou ano letivo não encontrado");

  let query = supabase
    .from<MatriculaLookup[]>("matriculas")
    .select("id, aluno_id")
    .eq("escola_id", escolaId)
    .eq("turma_id", turmaId)
    .eq("session_id", turma.session_id)
    .in("status", ["concluido", "reprovado"]);
  if (alunosIds.length > 0) query = query.in("aluno_id", alunosIds);

  const { data: matriculas, error: matError } = await query;
  if (matError) throw new Error(matError.message);
  if (!matriculas?.length || (alunosIds.length && new Set(matriculas.map(m => m.aluno_id)).size !== new Set(alunosIds).size)) throw new Error("DOCUMENT_BATCH_INCOMPLETE");

  const snapshots: BoletimSnapshot[] = [];
  for (const m of matriculas || []) {
    const { data: docRes, error: emitError } = await supabase.rpc<DocumentoFinalResult>("documento_final_lote_item", {
      p_job_id: jobId,
      p_turma_id: turmaId,
      p_matricula_id: m.id,
      p_tipo: "boletim_trimestral",
    });
    if (emitError || !docRes?.docId) throw new Error("DOCUMENT_BATCH_BLOCKED");

    const { data: row, error: rowError } = await supabase
      .from<DocumentoEmitidoLookup>("documentos_emitidos")
      .select("dados_snapshot, hash_validacao")
      .eq("id", docRes.docId)
      .eq("escola_id", escolaId)
      .maybeSingle();

    if (rowError || !row?.dados_snapshot || row.dados_snapshot.matricula_id !== m.id) throw new Error("DOCUMENT_BATCH_SCOPE_MISMATCH");
    const snapshot = row.dados_snapshot;
    const hashValidacao =
      row?.hash_validacao ?? (typeof snapshot.hash_validacao === "string" ? snapshot.hash_validacao : null);

    const boletim = await buildBoletimSnapshot({
      supabase,
      escolaId,
      turmaId,
      matriculaId: m.id,
      baseSnapshot: snapshot,
      hashValidacao,
    });

    snapshots.push({
      ...boletim,
      qrCodeDataUrl: hashValidacao ? buildQrDataUrl(String(hashValidacao)) : null,
    });
  }

  const blob = await pdf(<BoletimBatchV1 snapshots={snapshots} />).toBlob();
  return Buffer.from(await blob.arrayBuffer());
}

export async function renderCertificadoPdfBuffer(params: {
  supabase: unknown;
  escolaId: string;
  turmaId: string;
  jobId: string;
  alunosIds?: string[];
}): Promise<Buffer> {
  const supabase = params.supabase as SupabasePdfClient;
  const { escolaId, turmaId, jobId, alunosIds = [] } = params;

  const { data: turma } = await supabase
    .from<TurmaLookup>("turmas")
    .select("id, escola_id, ano_letivo, session_id")
    .eq("id", turmaId)
    .eq("escola_id", escolaId)
    .single();

  if (!turma?.id || !turma.session_id) throw new Error("Turma ou ano letivo não encontrado");

  let query = supabase
    .from<MatriculaLookup[]>("matriculas")
    .select("id, aluno_id")
    .eq("escola_id", escolaId)
    .eq("turma_id", turmaId)
    .eq("session_id", turma.session_id)
    .in("status", ["concluido", "reprovado"]);
  if (alunosIds.length > 0) query = query.in("aluno_id", alunosIds);

  const { data: matriculas, error: matError } = await query;
  if (matError) throw new Error(matError.message);
  if (!matriculas?.length || (alunosIds.length && new Set(matriculas.map(m => m.aluno_id)).size !== new Set(alunosIds).size)) throw new Error("DOCUMENT_BATCH_INCOMPLETE");

  const snapshots: CertificadoSnapshot[] = [];
  for (const m of matriculas || []) {
    const { data: docRes, error: emitError } = await supabase.rpc<DocumentoFinalResult>("documento_final_lote_item", {
      p_job_id: jobId,
      p_turma_id: turmaId,
      p_matricula_id: m.id,
      p_tipo: "certificado",
    });
    if (emitError || !docRes?.docId) throw new Error("DOCUMENT_BATCH_BLOCKED");

    const { data: row, error: rowError } = await supabase
      .from<DocumentoEmitidoLookup>("documentos_emitidos")
      .select("dados_snapshot, hash_validacao")
      .eq("id", docRes.docId)
      .eq("escola_id", escolaId)
      .maybeSingle();

    if (rowError || !row?.dados_snapshot || row.dados_snapshot.matricula_id !== m.id) throw new Error("DOCUMENT_BATCH_SCOPE_MISMATCH");
    const snapshot = row.dados_snapshot;
    const hashValidacao =
      row?.hash_validacao ?? (typeof snapshot.hash_validacao === "string" ? snapshot.hash_validacao : null);
    const certificado = await buildCertificadoSnapshot({
      supabase,
      escolaId,
      alunoId: m.aluno_id,
      baseSnapshot: snapshot,
      hashValidacao,
    });
    const alunoNome = certificado.aluno_nome || String(snapshot.aluno_nome ?? "");

    snapshots.push({
      ...certificado,
      aluno_nome: alunoNome,
      qrCodeDataUrl: certificado.hash_validacao ? buildQrDataUrl(String(certificado.hash_validacao)) : null,
    });
  }

  const blob = await pdf(<CertificadoBatchV1 snapshots={snapshots} />).toBlob();
  return Buffer.from(await blob.arrayBuffer());
}
