import "server-only";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export type DocumentoSnapshot = {
  escola_nome?: string | null;
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
  escola_logo_url?: string | null;
  escola_banco?: string | null;
  escola_titular_conta?: string | null;
  escola_iban?: string | null;
  escola_kwik_chave?: string | null;
};

export type DocumentoEmitido = {
  print_count?: number | null;
  last_printed_at?: string | null;
  id: string;
  public_id: string;
  escola_id: string;
  aluno_id?: string | null;
  tipo: string;
  created_at: string;
  hash_validacao?: string | null;
  dados_snapshot: DocumentoSnapshot;
};

export async function getDocumentoEmitido(docId: string, opts?: { incrementPrintCount?: boolean }) {
  const supabase = await supabaseServerTyped();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) {
    return { error: "Não autenticado" } as const;
  }

  const { data: doc, error } = await supabase
    .from("documentos_emitidos")
    .select("id, public_id, escola_id, aluno_id, tipo, created_at, dados_snapshot, numero_sequencial, hash_validacao, print_count, last_printed_at")
    .eq("id", docId)
    .single();

  if (error || !doc) {
    return { error: "Documento não encontrado" } as const;
  }

  const escolaId = await resolveEscolaIdForUser(supabase as any, user.id, doc.escola_id as string);
  if (!escolaId || escolaId !== doc.escola_id) {
    return { error: "Sem permissão" } as const;
  }


  let printMeta: { print_count: number; last_printed_at: string | null } | null = null;
  if (opts?.incrementPrintCount && doc.tipo === "recibo") {
    const { data: printData } = await (supabase as any).rpc("increment_documento_print", {
      p_doc_id: doc.id,
      p_actor_id: user.id,
      p_actor_email: user.email ?? null,
    });

    const printRow = Array.isArray(printData) ? printData[0] : printData;
    if (printRow && typeof printRow.print_count === "number") {
      printMeta = {
        print_count: printRow.print_count,
        last_printed_at: typeof printRow.last_printed_at === "string" ? printRow.last_printed_at : null,
      };
    }
  }

  const rawSnapshot = doc.dados_snapshot;
  const snapshot =
    rawSnapshot && typeof rawSnapshot === "object" && !Array.isArray(rawSnapshot)
      ? (rawSnapshot as DocumentoSnapshot)
      : ({} as DocumentoSnapshot);

  const hasSnapshotBranding =
    Boolean(snapshot.escola_logo_url?.trim()) ||
    Boolean(snapshot.escola_banco?.trim()) ||
    Boolean(snapshot.escola_titular_conta?.trim()) ||
    Boolean(snapshot.escola_iban?.trim()) ||
    Boolean(snapshot.escola_kwik_chave?.trim());
  const needsLiveBranding = !hasSnapshotBranding;
  const needsLiveSchoolName = !snapshot.escola_nome?.trim();

  const [escolaInfoResult, brandingResult] = await Promise.all([
    needsLiveSchoolName
      ? supabase
          .from("vw_escola_info" as any)
          .select("nome")
          .eq("escola_id", doc.escola_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    needsLiveBranding
      ? (supabase as any).rpc("get_escola_document_branding", {
          p_escola_id: doc.escola_id,
        })
      : Promise.resolve({ data: null }),
  ]);

  const escolaInfoRow = (escolaInfoResult?.data ?? null) as { nome?: string | null } | null;
  const brandingRow = brandingResult?.data ?? null;
  const escolaRow = (Array.isArray(brandingRow) ? brandingRow[0] : brandingRow) as {
    escola_id?: string | null;
    validation_base_url?: string | null;
    logo_url?: string | null;
    dados_pagamento?: Record<string, unknown> | null;
  } | null;
  const rawLogoUrl =
    escolaRow?.logo_url?.trim() || snapshot.escola_logo_url?.trim() || null;
  const rawPagamento =
    (escolaRow?.dados_pagamento as Record<string, unknown> | null) ??
    ({
      banco: snapshot.escola_banco ?? null,
      titular_conta: snapshot.escola_titular_conta ?? null,
      iban: snapshot.escola_iban ?? null,
      kwik_chave: snapshot.escola_kwik_chave ?? null,
    } as Record<string, unknown>);

  return {
    doc: {
      id: doc.id,
      public_id: doc.public_id,
      escola_id: doc.escola_id,
      aluno_id: doc.aluno_id ?? null,
      tipo: doc.tipo,
      created_at: doc.created_at,
      hash_validacao: doc.hash_validacao ?? null,
      print_count: printMeta?.print_count ?? doc.print_count ?? 0,
      last_printed_at: printMeta?.last_printed_at ?? doc.last_printed_at ?? null,
      dados_snapshot: {
        ...snapshot,
        hash_validacao: snapshot.hash_validacao ?? doc.hash_validacao ?? null,
        numero_sequencial: doc.numero_sequencial ?? snapshot.numero_sequencial ?? null,
      },
    },
    escolaNome: snapshot.escola_nome?.trim() || escolaInfoRow?.nome || "Escola",
    validationBaseUrl: escolaRow?.validation_base_url ?? null,
    logoUrl: rawLogoUrl,
    dadosPagamento: rawPagamento
      ? {
          banco: typeof rawPagamento.banco === "string" ? rawPagamento.banco : null,
          titular_conta: typeof rawPagamento.titular_conta === "string" ? rawPagamento.titular_conta : null,
          iban: typeof rawPagamento.iban === "string" ? rawPagamento.iban : null,
          kwik_chave: typeof rawPagamento.kwik_chave === "string" ? rawPagamento.kwik_chave : null,
        }
      : null,
  } as const;
}
