import "server-only";

import { supabaseServerRole } from "@/lib/supabaseServerRole";
import type {
  ProvisionedSeriesSnapshot,
  SeriesRequestSnapshot,
} from "@/lib/fiscal/certification/seriesSafety";

export type SeriesOperationalSnapshot = {
  empresa: {
    id: string;
    nome: string;
    nif: string;
    certificado_agt_numero: string | null;
  } | null;
  activeKmsKeys: number;
  requests: SeriesRequestSnapshot[];
  series: ProvisionedSeriesSnapshot[];
};

export async function loadSeriesOperationalSnapshot(
  empresaId: string
): Promise<SeriesOperationalSnapshot> {
  const admin = supabaseServerRole() as any;
  const [empresaRes, keysRes, requestsRes, seriesRes] = await Promise.all([
    admin
      .from("fiscal_empresas")
      .select("id,nome,nif,certificado_agt_numero")
      .eq("id", empresaId)
      .maybeSingle(),
    admin
      .from("fiscal_chaves")
      .select("id,private_key_ref,status")
      .eq("empresa_id", empresaId)
      .eq("status", "active"),
    admin
      .from("fiscal_series_requests")
      .select(
        "id,status,submission_uuid,idempotency_key,document_type,series_year,establishment_number,contingency_indicator,fiscal_serie_id,created_at,updated_at"
      )
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false }),
    admin
      .from("fiscal_series")
      .select(
        "id,tipo_documento,agt_submission_uuid,agt_series_code,series_year,establishment_number,series_contingency_indicator,agt_status,ativa"
      )
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false }),
  ]);

  for (const [label, result] of [
    ["EMPRESA", empresaRes],
    ["KEYS", keysRes],
    ["REQUESTS", requestsRes],
    ["SERIES", seriesRes],
  ] as const) {
    if (result.error) {
      throw new Error(`AGT_SERIES_${label}_LOOKUP_FAILED:${result.error.message}`);
    }
  }

  const activeKmsKeys = (keysRes.data ?? []).filter((row: any) => {
    const ref = String(row.private_key_ref ?? "");
    return ref.startsWith("kms://") || ref.startsWith("arn:aws:kms:");
  }).length;

  return {
    empresa: empresaRes.data
      ? {
          id: String(empresaRes.data.id),
          nome: String(empresaRes.data.nome),
          nif: String(empresaRes.data.nif),
          certificado_agt_numero: empresaRes.data.certificado_agt_numero
            ? String(empresaRes.data.certificado_agt_numero)
            : null,
        }
      : null,
    activeKmsKeys,
    requests: (requestsRes.data ?? []).map((row: any) => ({
      id: String(row.id),
      status: String(row.status),
      submission_uuid: String(row.submission_uuid),
      idempotency_key: String(row.idempotency_key),
      document_type: String(row.document_type),
      series_year: Number(row.series_year),
      establishment_number: String(row.establishment_number),
      contingency_indicator: String(row.contingency_indicator),
      fiscal_serie_id: row.fiscal_serie_id ? String(row.fiscal_serie_id) : null,
      created_at: row.created_at ? String(row.created_at) : null,
      updated_at: row.updated_at ? String(row.updated_at) : null,
    })),
    series: (seriesRes.data ?? []).map((row: any) => ({
      id: String(row.id),
      tipo_documento: String(row.tipo_documento),
      agt_submission_uuid: row.agt_submission_uuid
        ? String(row.agt_submission_uuid)
        : null,
      agt_series_code: row.agt_series_code ? String(row.agt_series_code) : null,
      series_year: row.series_year == null ? null : Number(row.series_year),
      establishment_number: row.establishment_number
        ? String(row.establishment_number)
        : null,
      series_contingency_indicator: row.series_contingency_indicator
        ? String(row.series_contingency_indicator)
        : null,
      agt_status: String(row.agt_status),
      ativa: Boolean(row.ativa),
    })),
  };
}
