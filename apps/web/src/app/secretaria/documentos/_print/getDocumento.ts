import "server-only";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export type DocumentoSnapshot = {
  aluno_id: string;
  aluno_nome?: string | null;
  aluno_bi?: string | null;
  matricula_id?: string | null;
  turma_id?: string | null;
  turma_nome?: string | null;
  turma_turno?: string | null;
  classe_nome?: string | null;
  curso_nome?: string | null;
  ano_letivo?: number | null;
  tipo_documento?: string | null;
  numero_sequencial?: number | null;
  hash_validacao?: string | null;
};

export type DocumentoEmitido = {
  id: string;
  public_id: string;
  escola_id: string;
  tipo: string;
  created_at: string;
  dados_snapshot: DocumentoSnapshot;
};

export async function getDocumentoEmitido(docId: string) {
  const supabase = await supabaseServerTyped();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) {
    return { error: "Não autenticado" } as const;
  }

  const { data: doc, error } = await supabase
    .from("documentos_emitidos")
    .select("id, public_id, escola_id, tipo, created_at, dados_snapshot, numero_sequencial")
    .eq("id", docId)
    .single();

  if (error || !doc) {
    return { error: "Documento não encontrado" } as const;
  }

  const escolaId = await resolveEscolaIdForUser(supabase as any, user.id, doc.escola_id as string);
  if (!escolaId || escolaId !== doc.escola_id) {
    return { error: "Sem permissão" } as const;
  }

  const { data: escola } = await supabase
    .from("escolas")
    .select("nome, validation_base_url")
    .eq("id", doc.escola_id)
    .maybeSingle();
  const escolaRow = escola as { nome?: string | null; validation_base_url?: string | null } | null;
  const rawSnapshot = doc.dados_snapshot;
  const snapshot =
    rawSnapshot && typeof rawSnapshot === "object" && !Array.isArray(rawSnapshot)
      ? (rawSnapshot as DocumentoSnapshot)
      : ({} as DocumentoSnapshot);

  return {
    doc: {
      id: doc.id,
      public_id: doc.public_id,
      escola_id: doc.escola_id,
      tipo: doc.tipo,
      created_at: doc.created_at,
      dados_snapshot: {
        ...snapshot,
        numero_sequencial: doc.numero_sequencial ?? snapshot.numero_sequencial ?? null,
      },
    },
    escolaNome: escolaRow?.nome ?? "Escola",
    validationBaseUrl: escolaRow?.validation_base_url ?? null,
  } as const;
}
