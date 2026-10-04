export const AGT_SERIES_PROVISION_ACK = "PROVISION_AGT_HML_SERIES";
export const AGT_CERTIFICATION_SERIES_TYPES = [
  "FT",
  "FR",
  "NC",
  "ND",
  "RC",
  "FG",
  "RE",
] as const;

export type AgtCertificationSeriesType =
  (typeof AGT_CERTIFICATION_SERIES_TYPES)[number];

export type SeriesRequestSnapshot = {
  id: string;
  status: string;
  submission_uuid: string;
  idempotency_key: string;
  document_type: string;
  series_year: number;
  establishment_number: string;
  contingency_indicator: string;
  fiscal_serie_id: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ProvisionedSeriesSnapshot = {
  id: string;
  tipo_documento: string;
  agt_submission_uuid: string | null;
  agt_series_code: string | null;
  series_year: number | null;
  establishment_number: string | null;
  series_contingency_indicator: string | null;
  agt_status: string;
  ativa: boolean;
};

export function assertCertificationSeriesType(
  value: string
): asserts value is AgtCertificationSeriesType {
  if (
    !AGT_CERTIFICATION_SERIES_TYPES.includes(
      value as AgtCertificationSeriesType
    )
  ) {
    throw new Error(`AGT_SERIES_TYPE_UNSUPPORTED:${value}`);
  }
}

export function buildSeriesIdempotencyKey(input: {
  empresaId: string;
  documentType: AgtCertificationSeriesType;
  year: number;
  establishmentNumber: string;
  contingencyIndicator: "N" | "C";
}) {
  const establishment = input.establishmentNumber
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!establishment) throw new Error("AGT_SERIES_ESTABLISHMENT_INVALID");
  return [
    "agt-series",
    input.empresaId,
    input.documentType.toLowerCase(),
    input.year,
    establishment,
    input.contingencyIndicator.toLowerCase(),
  ].join(":");
}

export function classifySeriesProvisionState(input: {
  documentType: AgtCertificationSeriesType;
  year: number;
  establishmentNumber: string;
  contingencyIndicator: "N" | "C";
  requests: SeriesRequestSnapshot[];
  series: ProvisionedSeriesSnapshot[];
}) {
  const matchingSeries = input.series.filter(
    (row) =>
      row.tipo_documento === input.documentType &&
      row.series_year === input.year &&
      row.establishment_number === input.establishmentNumber &&
      row.series_contingency_indicator === input.contingencyIndicator &&
      row.agt_status === "provisioned" &&
      row.ativa
  );
  if (matchingSeries.length > 0) {
    return {
      state: "provisioned" as const,
      safeToSubmit: false,
      blocker: null,
      series: matchingSeries,
      request: null,
    };
  }

  const requests = input.requests
    .filter(
      (row) =>
        row.document_type === input.documentType &&
        row.series_year === input.year &&
        row.establishment_number === input.establishmentNumber &&
        row.contingency_indicator === input.contingencyIndicator
    )
    .sort((a, b) =>
      String(b.updated_at ?? b.created_at ?? "").localeCompare(
        String(a.updated_at ?? a.created_at ?? "")
      )
    );

  const active = requests.find((row) =>
    ["processing", "uncertain"].includes(row.status)
  );
  if (active) {
    return {
      state: active.status as "processing" | "uncertain",
      safeToSubmit: false,
      blocker: `AGT_SERIES_REQUEST_${active.status.toUpperCase()}_REQUIRES_RECONCILIATION`,
      series: [],
      request: active,
    };
  }

  const rejected = requests.find((row) => row.status === "rejected");
  if (rejected) {
    return {
      state: "rejected" as const,
      safeToSubmit: false,
      blocker: "AGT_SERIES_REJECTED_REQUIRES_MANUAL_DECISION",
      series: [],
      request: rejected,
    };
  }

  return {
    state: "ready" as const,
    safeToSubmit: true,
    blocker: null,
    series: [],
    request: null,
  };
}

export function reconcileSeriesRequestsLocally(input: {
  requests: SeriesRequestSnapshot[];
  series: ProvisionedSeriesSnapshot[];
}) {
  return input.requests
    .filter((row) => row.status === "uncertain")
    .map((request) => {
      const localSeries = input.series.find(
        (serie) =>
          serie.agt_status === "provisioned" &&
          serie.agt_submission_uuid === request.submission_uuid
      );
      return {
        request_id: request.id,
        submission_uuid: request.submission_uuid,
        document_type: request.document_type,
        status: request.status,
        resolution: localSeries
          ? ("LOCAL_PROVISIONED_SERIES_FOUND" as const)
          : ("EXTERNAL_CONFIRMATION_REQUIRED" as const),
        fiscal_serie_id: localSeries?.id ?? null,
        agt_series_code: localSeries?.agt_series_code ?? null,
        safe_to_resubmit: false,
      };
    });
}
