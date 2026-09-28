import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSeriesIdempotencyKey,
  classifySeriesProvisionState,
  reconcileSeriesRequestsLocally,
} from "../../src/lib/fiscal/certification/seriesSafety";

const base = {
  documentType: "FT" as const,
  year: 2026,
  establishmentNumber: "SEDE",
  contingencyIndicator: "N" as const,
};

test("series idempotency key is stable for the same AGT series identity", () => {
  const a = buildSeriesIdempotencyKey({
    empresaId: "11111111-1111-4111-8111-111111111111",
    documentType: "FT",
    year: 2026,
    establishmentNumber: "SEDE",
    contingencyIndicator: "N",
  });
  const b = buildSeriesIdempotencyKey({
    empresaId: "11111111-1111-4111-8111-111111111111",
    documentType: "FT",
    year: 2026,
    establishmentNumber: " SEDE ",
    contingencyIndicator: "N",
  });
  assert.equal(a, b);
});

test("uncertain series request always blocks automatic resubmission", () => {
  const state = classifySeriesProvisionState({
    ...base,
    series: [],
    requests: [{
      id: "r1",
      status: "uncertain",
      submission_uuid: "22222222-2222-4222-8222-222222222222",
      idempotency_key: "key",
      document_type: "FT",
      series_year: 2026,
      establishment_number: "SEDE",
      contingency_indicator: "N",
      fiscal_serie_id: null,
    }],
  });
  assert.equal(state.state, "uncertain");
  assert.equal(state.safeToSubmit, false);
  assert.match(state.blocker ?? "", /REQUIRES_RECONCILIATION/);
});

test("local series with same submission UUID reconciles uncertain request without a new request", () => {
  const rows = reconcileSeriesRequestsLocally({
    requests: [{
      id: "r1",
      status: "uncertain",
      submission_uuid: "22222222-2222-4222-8222-222222222222",
      idempotency_key: "key",
      document_type: "FT",
      series_year: 2026,
      establishment_number: "SEDE",
      contingency_indicator: "N",
      fiscal_serie_id: null,
    }],
    series: [{
      id: "s1",
      tipo_documento: "FT",
      agt_submission_uuid: "22222222-2222-4222-8222-222222222222",
      agt_series_code: "FT HML2026",
      series_year: 2026,
      establishment_number: "SEDE",
      series_contingency_indicator: "N",
      agt_status: "provisioned",
      ativa: true,
    }],
  });

  assert.equal(rows[0].resolution, "LOCAL_PROVISIONED_SERIES_FOUND");
  assert.equal(rows[0].safe_to_resubmit, false);
  assert.equal(rows[0].fiscal_serie_id, "s1");
});

test("unresolved uncertain request requires external confirmation and remains non-resubmittable", () => {
  const rows = reconcileSeriesRequestsLocally({
    requests: [{
      id: "r1",
      status: "uncertain",
      submission_uuid: "22222222-2222-4222-8222-222222222222",
      idempotency_key: "key",
      document_type: "FT",
      series_year: 2026,
      establishment_number: "SEDE",
      contingency_indicator: "N",
      fiscal_serie_id: null,
    }],
    series: [],
  });
  assert.equal(rows[0].resolution, "EXTERNAL_CONFIRMATION_REQUIRED");
  assert.equal(rows[0].safe_to_resubmit, false);
});
