import { createHash, randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { recordAuditServer } from "@/lib/audit";

const FINAL_STATUSES = ["concluido", "transferido", "desistente", "trancado", "inativo"] as const;

type EmitParams = {
  supabase: SupabaseClient<Database>;
  escolaId: string;
  matriculaId: string;
  dataHoraEfetivacao: string;
  observacao?: string;
  createdBy?: string | null;
  audit?: {
    portal: "admin_escola" | "secretaria" | "financeiro" | "professor" | "aluno" | "super_admin" | "outro";
    acao: string;
  };
};

type EmitSuccess = {
  ok: true;
  reused?: boolean;
  docId: string;
  publicId: string;
  hash: string;
  printUrl: string;
};

type EmitError = {
  ok: false;
  status: number;
  error: string;
  currentStatus?: string;
};

export type EmitComprovanteResult = EmitSuccess | EmitError;

export async function emitirComprovanteMatricula({
  supabase,
  escolaId,
  matriculaId,
  dataHoraEfetivacao,
  observacao,
  createdBy,
  audit,
}: EmitParams): Promise<EmitComprovanteResult> {
  const { data: matricula, error: matriculaError } = await supabase
    .from("matriculas")
    .select(`
      id,
      escola_id,
      aluno_id,
      turma_id,
      ano_letivo,
      status,
      created_at,
      updated_at,
      data_matricula,
      alunos ( id, nome, nome_completo, bi_numero ),
      turmas ( id, nome, turno )
    `)
    .eq("escola_id", escolaId)
    .eq("id", matriculaId)
    .single();

  if (matriculaError || !matricula) {
    return { ok: false, status: 404, error: "Matrícula não encontrada." };
  }

  const statusMatricula = String(matricula.status ?? "").toLowerCase();
  if (!FINAL_STATUSES.includes(statusMatricula as (typeof FINAL_STATUSES)[number])) {
    return {
      ok: false,
      status: 422,
      error: "Comprovante só pode ser emitido para matrícula em estado final.",
      currentStatus: statusMatricula,
    };
  }

  const { data: existingDoc } = await supabase
    .from("documentos_emitidos")
    .select("id, public_id, hash_validacao, created_at")
    .eq("escola_id", escolaId)
    .eq("aluno_id", String(matricula.aluno_id))
    .eq("tipo", "comprovante_matricula")
    .contains("dados_snapshot", { matricula_id: matriculaId })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingDoc) {
    if (audit) {
      recordAuditServer({
        escolaId,
        portal: audit.portal,
        acao: audit.acao === "COMPROVANTE_MATRICULA_AUTOEMITIDO"
          ? "COMPROVANTE_MATRICULA_REUTILIZADO"
          : audit.acao,
        entity: "documentos_emitidos",
        entityId: existingDoc.id,
        details: {
          matriculaId,
          alunoId: String(matricula.aluno_id),
          documento_public_id: existingDoc.public_id,
          documento_hash: existingDoc.hash_validacao,
          status_final_matricula: statusMatricula,
          data_hora_efetivacao: dataHoraEfetivacao,
          reused: true,
        },
      }).catch(() => null);
    }
    return {
      ok: true,
      reused: true,
      docId: existingDoc.id,
      publicId: existingDoc.public_id,
      hash: existingDoc.hash_validacao,
      printUrl: `/secretaria/documentos/${existingDoc.id}/comprovante-matricula/print`,
    };
  }

  const { data: numeroSequencial, error: numeroError } = await supabase.rpc("next_documento_numero", {
    p_escola_id: escolaId,
  });
  if (numeroError) {
    return { ok: false, status: 400, error: numeroError.message };
  }

  const hashBase = `${randomUUID()}-${matriculaId}-${Date.now()}`;
  const hashValidacao = createHash("sha256").update(hashBase).digest("hex");
  const aluno = (matricula as { alunos?: Record<string, unknown> }).alunos ?? {};
  const turma = (matricula as { turmas?: Record<string, unknown> }).turmas ?? {};

  const snapshot = {
    tipo_documento: "comprovante_matricula",
    matricula_id: matriculaId,
    aluno_id: String(matricula.aluno_id),
    aluno_nome: (aluno.nome_completo as string) || (aluno.nome as string) || "",
    aluno_bi: (aluno.bi_numero as string) || null,
    turma_id: matricula.turma_id ?? null,
    turma_nome: (turma.nome as string) || null,
    turma_turno: (turma.turno as string) || null,
    ano_letivo: matricula.ano_letivo ?? null,
    status_final_matricula: statusMatricula,
    data_hora_efetivacao: dataHoraEfetivacao,
    observacao: observacao ?? null,
    emitido_em: new Date().toISOString(),
    numero_sequencial: numeroSequencial ?? null,
    hash_validacao: hashValidacao,
  };

  const { data: doc, error: docError } = await supabase
    .from("documentos_emitidos")
    .insert({
      escola_id: escolaId,
      aluno_id: String(matricula.aluno_id),
      numero_sequencial: numeroSequencial ?? null,
      tipo: "comprovante_matricula" as Database["public"]["Tables"]["documentos_emitidos"]["Row"]["tipo"],
      dados_snapshot: snapshot as Database["public"]["Tables"]["documentos_emitidos"]["Row"]["dados_snapshot"],
      created_by: createdBy ?? null,
      hash_validacao: hashValidacao,
    })
    .select("id, public_id, hash_validacao")
    .single();

  if (docError || !doc) {
    return { ok: false, status: 400, error: docError?.message || "Falha ao emitir comprovante." };
  }

  if (audit) {
    recordAuditServer({
      escolaId,
      portal: audit.portal,
      acao: audit.acao,
      entity: "documentos_emitidos",
      entityId: doc.id,
      details: {
        matriculaId,
        alunoId: String(matricula.aluno_id),
        documento_public_id: doc.public_id,
        documento_hash: doc.hash_validacao,
        status_final_matricula: statusMatricula,
        data_hora_efetivacao: dataHoraEfetivacao,
        observacao: observacao ?? null,
        reused: false,
      },
    }).catch(() => null);
  }

  return {
    ok: true,
    docId: doc.id,
    publicId: doc.public_id,
    hash: doc.hash_validacao,
    printUrl: `/secretaria/documentos/${doc.id}/comprovante-matricula/print`,
  };
}
