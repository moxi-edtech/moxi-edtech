import "server-only";

import { supabaseServerRole } from "@/lib/supabaseServerRole";

export type CertificationCompanySnapshot = {
  id: string;
  nome: string;
  nif: string;
  endereco: string | null;
  certificadoAgtNumero: string | null;
  metadata: Record<string, unknown>;
};

export type CertificationItemSnapshot = {
  linha_no: number;
  descricao: string;
  product_code: string | null;
  product_number_code: string | null;
  quantidade: number | string;
  preco_unit: number | string;
  taxa_iva: number | string;
  total_liquido_aoa: number | string;
  total_impostos_aoa: number | string;
  total_bruto_aoa: number | string;
  tax_exemption_code: string | null;
  tax_exemption_reason: string | null;
  tax_profile_code: string | null;
  tax_profile_version: number | string | null;
  tax_type: string | null;
  tax_code: string | null;
  tax_country_region: string | null;
  operation_type: string | null;
  unit_of_measure: string | null;
  product_type: string | null;
  unit_price_base: number | string | null;
  settlement_amount: number | string | null;
  total_liquido_moeda: number | string | null;
  total_impostos_moeda: number | string | null;
  total_bruto_moeda: number | string | null;
};

export type CertificationDocumentSnapshot = {
  id: string;
  numero: number;
  numero_formatado: string;
  tipo_documento: string;
  invoice_date: string;
  system_entry: string;
  cliente_nome: string;
  cliente_nif: string | null;
  payload: Record<string, unknown>;
  moeda: string;
  taxa_cambio_aoa: number | string | null;
  payment_mechanism: string | null;
  total_liquido_aoa: number | string;
  total_impostos_aoa: number | string;
  total_bruto_aoa: number | string;
  hash_control: string;
  saft_hash: string | null;
  saft_hash_control: number | null;
  saft_required: boolean;
  status: string;
  serie_id: string;
  documento_origem_id: string | null;
  rectifica_documento_id: string | null;
  created_by: string | null;
  agt_document_status: string;
  agt_rejected_document_id: string | null;
  agt_rejected_document_no: string | null;
  reference_reason: string | null;
  contingency_indicator: string;
  items: CertificationItemSnapshot[];
  cancellation: {
    created_at: string;
    motivo: string | null;
    created_by: string | null;
  } | null;
  series: {
    origem_documento: string;
    prefixo: string;
    agt_series_code: string | null;
  };
  originDocument: {
    id: string;
    numero_formatado: string;
    invoice_date: string;
  } | null;
  agtSubmission: {
    submission_id: string;
    submission_uuid: string;
    request_id: string | null;
    status: string;
    result_code: number | null;
    validation_status: string;
    error_list: unknown[];
  } | null;
};

export type CertificationDatasetSnapshot = {
  company: CertificationCompanySnapshot;
  documents: CertificationDocumentSnapshot[];
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function loadCertificationDatasetSnapshot(input: {
  empresaId: string;
  documentIds: string[];
}): Promise<CertificationDatasetSnapshot> {
  const ids = Array.from(new Set(input.documentIds));
  if (ids.length === 0) throw new Error("CERTIFICATION_DOCUMENT_IDS_REQUIRED");

  const admin = supabaseServerRole() as any;
  const [companyRes, docsRes] = await Promise.all([
    admin
      .from("fiscal_empresas")
      .select("id,nome,nif,endereco,certificado_agt_numero,metadata")
      .eq("id", input.empresaId)
      .maybeSingle(),
    admin
      .from("fiscal_documentos")
      .select(
        "id,numero,numero_formatado,tipo_documento,invoice_date,system_entry,cliente_nome,cliente_nif,payload,moeda,taxa_cambio_aoa,payment_mechanism,total_liquido_aoa,total_impostos_aoa,total_bruto_aoa,hash_control,saft_hash,saft_hash_control,saft_required,status,serie_id,documento_origem_id,rectifica_documento_id,created_by,agt_document_status,agt_rejected_document_id,agt_rejected_document_no,reference_reason,contingency_indicator"
      )
      .eq("empresa_id", input.empresaId)
      .in("id", ids),
  ]);

  if (companyRes.error) throw new Error(`CERTIFICATION_COMPANY_LOOKUP_FAILED:${companyRes.error.message}`);
  if (!companyRes.data) throw new Error("CERTIFICATION_COMPANY_NOT_FOUND");
  if (docsRes.error) throw new Error(`CERTIFICATION_DOCUMENT_LOOKUP_FAILED:${docsRes.error.message}`);

  const docs = docsRes.data ?? [];
  if (docs.length !== ids.length) {
    const found = new Set(docs.map((doc: { id: string }) => String(doc.id)));
    const missing = ids.filter((id) => !found.has(id));
    throw new Error(`CERTIFICATION_DOCUMENTS_MISSING:${missing.join(",")}`);
  }

  const seriesIds = Array.from(new Set(docs.map((doc: any) => String(doc.serie_id))));
  const referencedIds = Array.from(
    new Set(
      docs
        .map((doc: any) => doc.documento_origem_id ?? doc.rectifica_documento_id)
        .filter(Boolean)
    )
  );

  const [itemsRes, cancellationsRes, seriesRes, refsRes, linksRes] = await Promise.all([
    admin
      .from("fiscal_documento_itens")
      .select(
        "documento_id,linha_no,descricao,product_code,product_number_code,quantidade,preco_unit,taxa_iva,total_liquido_aoa,total_impostos_aoa,total_bruto_aoa,tax_exemption_code,tax_exemption_reason,tax_profile_code,tax_profile_version,tax_type,tax_code,tax_country_region,operation_type,unit_of_measure,product_type,unit_price_base,settlement_amount,total_liquido_moeda,total_impostos_moeda,total_bruto_moeda"
      )
      .in("documento_id", ids)
      .order("documento_id")
      .order("linha_no"),
    admin
      .from("fiscal_documentos_eventos")
      .select("documento_id,payload,created_at,created_by")
      .in("documento_id", ids)
      .eq("tipo_evento", "ANULADO")
      .order("created_at", { ascending: false }),
    admin
      .from("fiscal_series")
      .select("id,origem_documento,prefixo,agt_series_code")
      .in("id", seriesIds),
    referencedIds.length
      ? admin
          .from("fiscal_documentos")
          .select("id,numero_formatado,invoice_date")
          .eq("empresa_id", input.empresaId)
          .in("id", referencedIds)
      : Promise.resolve({ data: [], error: null }),
    admin
      .from("fiscal_agt_submission_documentos")
      .select("documento_id,submission_id,validation_status,error_list")
      .eq("empresa_id", input.empresaId)
      .in("documento_id", ids),
  ]);

  for (const [label, result] of [
    ["ITEMS", itemsRes],
    ["CANCELLATIONS", cancellationsRes],
    ["SERIES", seriesRes],
    ["REFERENCES", refsRes],
    ["AGT_LINKS", linksRes],
  ] as const) {
    if (result.error) throw new Error(`CERTIFICATION_${label}_LOOKUP_FAILED:${result.error.message}`);
  }

  const submissionIds = Array.from(
    new Set((linksRes.data ?? []).map((row: any) => row.submission_id).filter(Boolean))
  );
  const submissionsRes = submissionIds.length
    ? await admin
        .from("fiscal_agt_submissions")
        .select("id,submission_uuid,request_id,status,result_code")
        .eq("empresa_id", input.empresaId)
        .in("id", submissionIds)
    : { data: [], error: null };

  if (submissionsRes.error) {
    throw new Error(`CERTIFICATION_AGT_SUBMISSIONS_LOOKUP_FAILED:${submissionsRes.error.message}`);
  }

  const itemsByDoc = new Map<string, any[]>();
  for (const item of itemsRes.data ?? []) {
    const list = itemsByDoc.get(String(item.documento_id)) ?? [];
    list.push(item);
    itemsByDoc.set(String(item.documento_id), list);
  }

  const cancellationByDoc = new Map<string, any>();
  for (const event of cancellationsRes.data ?? []) {
    const id = String(event.documento_id);
    if (cancellationByDoc.has(id)) continue;
    cancellationByDoc.set(id, {
      created_at: String(event.created_at),
      motivo: typeof objectValue(event.payload).motivo === "string"
        ? String(objectValue(event.payload).motivo)
        : null,
      created_by: event.created_by ? String(event.created_by) : null,
    });
  }

  const seriesById = new Map((seriesRes.data ?? []).map((row: any) => [String(row.id), row]));
  const refsById = new Map((refsRes.data ?? []).map((row: any) => [String(row.id), row]));
  const submissionById = new Map((submissionsRes.data ?? []).map((row: any) => [String(row.id), row]));
  const linkByDoc = new Map<string, any>();
  for (const link of linksRes.data ?? []) {
    const docId = String(link.documento_id);
    if (!linkByDoc.has(docId)) linkByDoc.set(docId, link);
  }

  const documents = docs.map((doc: any): CertificationDocumentSnapshot => {
    const series = seriesById.get(String(doc.serie_id));
    if (!series) throw new Error(`CERTIFICATION_SERIES_MISSING:${doc.serie_id}`);
    const refId = doc.documento_origem_id ?? doc.rectifica_documento_id;
    const ref = refId ? refsById.get(String(refId)) : null;
    const link = linkByDoc.get(String(doc.id));
    const submission = link ? submissionById.get(String(link.submission_id)) : null;

    return {
      id: String(doc.id),
      numero: Number(doc.numero),
      numero_formatado: String(doc.numero_formatado),
      tipo_documento: String(doc.tipo_documento),
      invoice_date: String(doc.invoice_date),
      system_entry: String(doc.system_entry),
      cliente_nome: String(doc.cliente_nome),
      cliente_nif: doc.cliente_nif ? String(doc.cliente_nif) : null,
      payload: objectValue(doc.payload),
      moeda: String(doc.moeda ?? "AOA").toUpperCase(),
      taxa_cambio_aoa: doc.taxa_cambio_aoa,
      payment_mechanism: doc.payment_mechanism ? String(doc.payment_mechanism) : null,
      total_liquido_aoa: doc.total_liquido_aoa,
      total_impostos_aoa: doc.total_impostos_aoa,
      total_bruto_aoa: doc.total_bruto_aoa,
      hash_control: String(doc.hash_control),
      saft_hash: doc.saft_hash ? String(doc.saft_hash) : null,
      saft_hash_control: doc.saft_hash_control == null ? null : Number(doc.saft_hash_control),
      saft_required: Boolean(doc.saft_required),
      status: String(doc.status),
      serie_id: String(doc.serie_id),
      documento_origem_id: doc.documento_origem_id ? String(doc.documento_origem_id) : null,
      rectifica_documento_id: doc.rectifica_documento_id ? String(doc.rectifica_documento_id) : null,
      created_by: doc.created_by ? String(doc.created_by) : null,
      agt_document_status: String(doc.agt_document_status ?? "N"),
      agt_rejected_document_id: doc.agt_rejected_document_id ? String(doc.agt_rejected_document_id) : null,
      agt_rejected_document_no: doc.agt_rejected_document_no ? String(doc.agt_rejected_document_no) : null,
      reference_reason: doc.reference_reason ? String(doc.reference_reason) : null,
      contingency_indicator: String(doc.contingency_indicator ?? "N"),
      items: (itemsByDoc.get(String(doc.id)) ?? []).map((item: any) => ({
        ...item,
        linha_no: Number(item.linha_no),
      })),
      cancellation: cancellationByDoc.get(String(doc.id)) ?? null,
      series: {
        origem_documento: String(series.origem_documento ?? "interno"),
        prefixo: String(series.prefixo ?? ""),
        agt_series_code: series.agt_series_code ? String(series.agt_series_code) : null,
      },
      originDocument: ref
        ? {
            id: String(ref.id),
            numero_formatado: String(ref.numero_formatado),
            invoice_date: String(ref.invoice_date),
          }
        : null,
      agtSubmission: link && submission
        ? {
            submission_id: String(link.submission_id),
            submission_uuid: String(submission.submission_uuid),
            request_id: submission.request_id ? String(submission.request_id) : null,
            status: String(submission.status),
            result_code: submission.result_code == null ? null : Number(submission.result_code),
            validation_status: String(link.validation_status),
            error_list: Array.isArray(link.error_list) ? link.error_list : [],
          }
        : null,
    };
  });

  return {
    company: {
      id: String(companyRes.data.id),
      nome: String(companyRes.data.nome),
      nif: String(companyRes.data.nif),
      endereco: companyRes.data.endereco ? String(companyRes.data.endereco) : null,
      certificadoAgtNumero: companyRes.data.certificado_agt_numero
        ? String(companyRes.data.certificado_agt_numero)
        : null,
      metadata: objectValue(companyRes.data.metadata),
    },
    documents,
  };
}
