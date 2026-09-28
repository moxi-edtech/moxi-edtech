import assert from "node:assert/strict";
import test from "node:test";

import {
  CERTIFICATION_EXECUTION_ACK,
  runCertificationDataset,
} from "../../src/lib/fiscal/certification/runner";
import { sanitizeAgtEvidence } from "../../src/lib/fiscal/certification/sanitizer";
import type {
  CertificationTransport,
  FiscalIssueRequest,
  IssueSuccess,
  TransportOutcome,
} from "../../src/lib/fiscal/certification/types";

class FakeTransport implements CertificationTransport {
  issued: FiscalIssueRequest[] = [];
  annuls: string[] = [];
  pdfs: string[] = [];
  uncertainPoint: string | null = null;
  counter = 0;

  async preflight() {
    return { ok: true, blockers: [] };
  }

  async issue(request: FiscalIssueRequest): Promise<TransportOutcome<IssueSuccess>> {
    this.issued.push(request);
    const point = String(request.metadata?.certification_point ?? "");
    if (this.uncertainPoint === point) {
      return {
        kind: "uncertain",
        code: "TEST_UNCERTAIN",
        message: "unknown outcome",
      };
    }
    this.counter += 1;
    return {
      kind: "success",
      data: {
        documentoId: `00000000-0000-4000-8000-${String(this.counter).padStart(12, "0")}`,
        numero: `${request.tipo_documento} TEST/${this.counter}`,
        tipoDocumento: request.tipo_documento,
        agtSubmission: { queued: false },
      },
    };
  }

  async annul(input: { documentoId: string }) {
    this.annuls.push(input.documentoId);
    return { kind: "success" as const, data: { documentoId: input.documentoId } };
  }

  async capturePdf(input: {
    documentoId: string;
    fileName: string;
    variant: "current" | "before-annulment" | "after-annulment";
  }) {
    this.pdfs.push(`${input.documentoId}:${input.variant}`);
    return {
      kind: "success" as const,
      data: { path: `/tmp/${input.fileName}`, sha256: "a".repeat(64) },
    };
  }
}

test("runner is dry-run by default and never calls transport", async () => {
  const manifest = await runCertificationDataset({
    runId: "run-dry",
    empresaId: "11111111-1111-4111-8111-111111111111",
    year: 2026,
    execute: false,
    now: new Date("2026-09-28T07:30:00Z"),
  });

  assert.equal(manifest.mode, "dry-run");
  assert.equal(manifest.points.P13.status, "na");
  assert.equal(manifest.points.P09.status, "planned");
  assert.equal(manifest.points.P16.status, "blocked");
  assert.equal(manifest.points.P17.status, "blocked");
});

test("runner blocks P09 outside the real Luanda window in dry-run", async () => {
  const manifest = await runCertificationDataset({
    runId: "run-p09",
    empresaId: "11111111-1111-4111-8111-111111111111",
    year: 2026,
    execute: false,
    now: new Date("2026-09-28T09:00:00Z"),
  });

  assert.equal(manifest.points.P09.status, "blocked");
  assert.deepEqual(manifest.points.P09.blockers, [
    "AGT_P09_REAL_TIME_WINDOW_CLOSED",
  ]);
});

test("execute requires the literal ACK", async () => {
  const transport = new FakeTransport();
  await assert.rejects(
    runCertificationDataset({
      runId: "run-no-ack",
      empresaId: "11111111-1111-4111-8111-111111111111",
      year: 2026,
      execute: true,
      ack: "WRONG",
      transport,
    }),
    /AGT_CERTIFICATION_EXECUTION_ACK_REQUIRED/
  );
  assert.equal(transport.issued.length, 0);
});

test("runner preserves PP -> FT -> NC ordering and captures P02 before/after PDFs", async () => {
  const transport = new FakeTransport();
  const manifest = await runCertificationDataset({
    runId: "run-sequence",
    empresaId: "11111111-1111-4111-8111-111111111111",
    year: 2026,
    execute: true,
    ack: CERTIFICATION_EXECUTION_ACK,
    transport,
    now: new Date("2026-09-28T07:30:00Z"),
  });

  const issuedTypes = transport.issued.map((request) => request.tipo_documento);
  assert.equal(issuedTypes[0], "FT");
  assert.equal(issuedTypes[1], "FT");
  assert.equal(issuedTypes[2], "PP");
  assert.equal(issuedTypes[3], "FT");
  assert.equal(issuedTypes[4], "NC");

  const p03Id = manifest.points.P03.documents[0].documentoId;
  const p04Request = transport.issued[3];
  assert.equal(p04Request.documento_origem_id, p03Id);

  const p04Id = manifest.points.P04.documents[0].documentoId;
  const p05Request = transport.issued[4];
  assert.equal(p05Request.rectifica_documento_id, p04Id);

  assert.equal(transport.annuls.length, 1);
  assert.equal(
    manifest.points.P02.documents[0].pdf?.map((pdf) => pdf.variant).join(","),
    "before-annulment,after-annulment"
  );
});

test("uncertain issuance is never retried inside the runner", async () => {
  const transport = new FakeTransport();
  transport.uncertainPoint = "P06";

  const manifest = await runCertificationDataset({
    runId: "run-uncertain",
    empresaId: "11111111-1111-4111-8111-111111111111",
    year: 2026,
    execute: true,
    ack: CERTIFICATION_EXECUTION_ACK,
    transport,
    now: new Date("2026-09-28T07:30:00Z"),
  });

  assert.equal(manifest.points.P06.status, "uncertain");
  assert.equal(
    transport.issued.filter(
      (request) => request.metadata?.certification_point === "P06"
    ).length,
    1
  );
});

test("sanitizer removes credentials and replaces complete JWS/signatures by hashes", () => {
  const sanitized = sanitizeAgtEvidence({
    Authorization: "Basic dXNlcjpwYXNz",
    password: "secret",
    private_key_ref: "kms://private/ref",
    jwsSoftwareSignature: "header.payload.signature",
    nested: {
      token: "abc",
      requestID: "REQ-123",
      submissionUUID: "11111111-1111-4111-8111-111111111111",
    },
  }) as any;

  assert.equal(sanitized.Authorization, "[REDACTED]");
  assert.equal(sanitized.password, "[REDACTED]");
  assert.equal(sanitized.private_key_ref, "[REDACTED]");
  assert.equal(sanitized.nested.token, "[REDACTED]");
  assert.equal(sanitized.nested.requestID, "REQ-123");
  assert.match(sanitized.jwsSoftwareSignature.sha256, /^[a-f0-9]{64}$/);
});
