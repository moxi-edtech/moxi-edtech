import { createHash } from "node:crypto";

import { resolveP09Window } from "@/lib/fiscal/agtCertificationPlan";
import {
  buildP01,
  buildP02,
  buildP03,
  buildP04,
  buildP05,
  buildP06,
  buildP07,
  buildP08,
  buildP09,
  buildP10,
  buildP11,
  buildP14,
  buildP15Nd,
} from "@/lib/fiscal/certification/scenarios";
import type {
  CertificationManifest,
  CertificationPoint,
  CertificationPointEntry,
  CertificationRunnerOptions,
  CertificationTransport,
  FiscalIssueRequest,
  IssueSuccess,
  TransportOutcome,
} from "@/lib/fiscal/certification/types";

export const CERTIFICATION_EXECUTION_ACK = "EXECUTE_AGT_CERTIFICATION_DATASET";

const TITLES: Record<CertificationPoint, string> = {
  P01: "Fatura para cliente identificado com NIF",
  P02: "Fatura anulada com PDF antes/depois",
  P03: "Pró-forma",
  P04: "Fatura originada da pró-forma",
  P05: "Nota de crédito da P04",
  P06: "Duas linhas: tributada + isenta",
  P07: "100 x 0,55 + desconto 8,8% + desconto global",
  P08: "Documento em moeda estrangeira",
  P09: "Cliente identificado sem NIF < 50 AOA antes das 10h",
  P10: "Segundo cliente identificado sem NIF",
  P11: "Duas guias GR/GT",
  P12: "Orçamento/pró-forma",
  P13: "Fatura genérica/auto-faturação",
  P14: "Fatura global",
  P15: "Outros tipos emitidos pela aplicação",
  P16: "Matriz ponto -> evidência",
  P17: "SAF-T único do dossiê",
};

function emptyEntry(point: CertificationPoint, scenarioCode: string): CertificationPointEntry {
  return {
    point,
    title: TITLES[point],
    scenarioCode,
    status: "planned",
    documents: [],
    blockers: [],
    error: null,
  };
}

function isoDateInLuanda(now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Luanda",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function createManifest(options: CertificationRunnerOptions): CertificationManifest {
  const points = {} as Record<CertificationPoint, CertificationPointEntry>;
  for (let index = 1; index <= 17; index += 1) {
    const point = `P${String(index).padStart(2, "0")}` as CertificationPoint;
    points[point] = emptyEntry(point, `AGT_${point}`);
  }
  points.P04.dependsOn = ["P03"];
  points.P05.dependsOn = ["P04"];
  points.P12.dependsOn = ["P03"];
  points.P15.dependsOn = ["P01"];
  points.P13.status = "na";
  points.P13.blockers = [];
  points.P13.metadata = {
    justification:
      "KLASSE não expõe GF/auto-faturação no contrato canónico; não criar feature artificial para certificação.",
  };
  points.P16.status = "blocked";
  points.P16.blockers = ["P16_GENERATION_PENDING"];
  points.P17.status = "blocked";
  points.P17.blockers = ["P17_GENERATION_PENDING"];

  const now = options.now ?? new Date();
  return {
    schemaVersion: 1,
    officeReference: "0000498/01180000/AGT/2026",
    runId: options.runId,
    empresaId: options.empresaId,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    mode: options.execute ? "execute" : "dry-run",
    agtEnvironment: "hml",
    externalBlockers: [],
    points,
  };
}

function requireExecutionSafety(options: CertificationRunnerOptions) {
  if (!options.execute) return;
  if (options.ack !== CERTIFICATION_EXECUTION_ACK) {
    throw new Error("AGT_CERTIFICATION_EXECUTION_ACK_REQUIRED");
  }
  if (!options.transport) {
    throw new Error("AGT_CERTIFICATION_EXECUTION_TRANSPORT_REQUIRED");
  }
}

function toDocRef(role: string, result: IssueSuccess) {
  return {
    role,
    documentoId: result.documentoId,
    numero: result.numero,
    tipoDocumento: result.tipoDocumento,
  };
}

function applyOutcome(
  entry: CertificationPointEntry,
  outcome: TransportOutcome<IssueSuccess>,
  role: string
) {
  if (outcome.kind === "success") {
    entry.documents.push(toDocRef(role, outcome.data));
    entry.agtSubmission = outcome.data.agtSubmission ?? null;
    entry.status = "executed";
    return outcome.data;
  }
  entry.status = outcome.kind === "uncertain" ? "uncertain" : "failed";
  entry.error = {
    code: outcome.code,
    message: outcome.message,
  };
  return null;
}

async function issue(
  manifest: CertificationManifest,
  point: CertificationPoint,
  role: string,
  request: FiscalIssueRequest,
  transport: CertificationTransport
) {
  const entry = manifest.points[point];
  if (entry.status === "uncertain") {
    entry.blockers.push("UNCERTAIN_OUTCOME_REQUIRES_MANUAL_RECONCILIATION");
    return null;
  }
  const outcome = await transport.issue(request);
  return applyOutcome(entry, outcome, role);
}

async function capturePdf(
  manifest: CertificationManifest,
  point: CertificationPoint,
  role: string,
  documentoId: string,
  variant: "current" | "before-annulment" | "after-annulment",
  transport: CertificationTransport
) {
  const fileName = `${point}-${role}-${variant}.pdf`;
  const outcome = await transport.capturePdf({ documentoId, fileName, variant });
  if (outcome.kind !== "success") {
    const entry = manifest.points[point];
    entry.status = outcome.kind === "uncertain" ? "uncertain" : "failed";
    entry.error = { code: outcome.code, message: outcome.message };
    return;
  }
  const doc = manifest.points[point].documents.find(
    (candidate) => candidate.documentoId === documentoId && candidate.role === role
  );
  if (!doc) return;
  doc.pdf = [
    ...(doc.pdf ?? []),
    {
      path: outcome.data.path,
      sha256: outcome.data.sha256,
      variant,
    },
  ];
}

export async function runCertificationDataset(
  options: CertificationRunnerOptions
): Promise<CertificationManifest> {
  requireExecutionSafety(options);
  const manifest = createManifest(options);
  const now = options.now ?? new Date();
  const invoiceDate = isoDateInLuanda(now);
  const ctx = {
    runId: options.runId,
    empresaId: options.empresaId,
    invoiceDate,
  };

  const p09Window = resolveP09Window(now);
  manifest.points.P09.metadata = { p09Window };

  if (!options.execute) {
    if (!p09Window.eligible) {
      manifest.points.P09.status = "blocked";
      manifest.points.P09.blockers.push("AGT_P09_REAL_TIME_WINDOW_CLOSED");
    }
    if (!options.rcPaymentId) {
      manifest.points.P15.blockers.push("RC_PAYMENT_ID_REQUIRED_FOR_RC_EVIDENCE");
    }
    manifest.updatedAt = now.toISOString();
    return manifest;
  }

  const transport = options.transport!;
  const preflight = await transport.preflight({
    empresaId: options.empresaId,
    year: options.year,
  });
  manifest.externalBlockers = [...preflight.blockers];
  if (!preflight.ok) {
    for (const entry of Object.values(manifest.points)) {
      if (entry.status === "planned") {
        entry.status = "blocked";
        entry.blockers.push(...preflight.blockers);
      }
    }
    manifest.updatedAt = new Date().toISOString();
    return manifest;
  }

  const p01 = await issue(manifest, "P01", "ft", buildP01(ctx), transport);
  if (p01) await capturePdf(manifest, "P01", "ft", p01.documentoId, "current", transport);

  const p02 = await issue(manifest, "P02", "ft", buildP02(ctx), transport);
  if (p02) {
    await capturePdf(manifest, "P02", "ft", p02.documentoId, "before-annulment", transport);
    const annul = await transport.annul({
      documentoId: p02.documentoId,
      motivo: "Anulação de exemplo para certificação AGT",
      metadata: {
        certification_run_id: options.runId,
        certification_point: "P02",
      },
    });
    if (annul.kind === "success") {
      await capturePdf(manifest, "P02", "ft", p02.documentoId, "after-annulment", transport);
    } else {
      manifest.points.P02.status = annul.kind === "uncertain" ? "uncertain" : "failed";
      manifest.points.P02.error = { code: annul.code, message: annul.message };
    }
  }

  const p03 = await issue(manifest, "P03", "pp", buildP03(ctx), transport);
  if (p03) await capturePdf(manifest, "P03", "pp", p03.documentoId, "current", transport);

  const p04 = p03
    ? await issue(manifest, "P04", "ft", buildP04(ctx, p03.documentoId), transport)
    : null;
  if (!p03) {
    manifest.points.P04.status = "blocked";
    manifest.points.P04.blockers.push("P03_REQUIRED");
  }
  if (p04) await capturePdf(manifest, "P04", "ft", p04.documentoId, "current", transport);

  const p05 = p04
    ? await issue(manifest, "P05", "nc", buildP05(ctx, p04.documentoId), transport)
    : null;
  if (!p04) {
    manifest.points.P05.status = "blocked";
    manifest.points.P05.blockers.push("P04_REQUIRED");
  }
  if (p05) await capturePdf(manifest, "P05", "nc", p05.documentoId, "current", transport);

  for (const [point, role, request] of [
    ["P06", "ft", buildP06(ctx)],
    ["P07", "ft", buildP07(ctx)],
    ["P08", "ft", buildP08(ctx)],
  ] as const) {
    const result = await issue(manifest, point, role, request, transport);
    if (result) await capturePdf(manifest, point, role, result.documentoId, "current", transport);
  }

  if (!p09Window.eligible) {
    manifest.points.P09.status = "blocked";
    manifest.points.P09.blockers.push("AGT_P09_REAL_TIME_WINDOW_CLOSED");
  } else {
    const p09 = await issue(manifest, "P09", "ft", buildP09(ctx), transport);
    if (p09) await capturePdf(manifest, "P09", "ft", p09.documentoId, "current", transport);
  }

  const p10 = await issue(manifest, "P10", "ft", buildP10(ctx), transport);
  if (p10) await capturePdf(manifest, "P10", "ft", p10.documentoId, "current", transport);

  for (const request of buildP11(ctx)) {
    const role = request.tipo_documento.toLowerCase();
    const result = await issue(manifest, "P11", role, request, transport);
    if (result) await capturePdf(manifest, "P11", role, result.documentoId, "current", transport);
  }

  if (p03) {
    manifest.points.P12.status = "reused";
    manifest.points.P12.documents = [
      {
        ...toDocRef("reuse-p03", p03),
        pdf: manifest.points.P03.documents[0]?.pdf,
      },
    ];
  } else {
    manifest.points.P12.status = "blocked";
    manifest.points.P12.blockers.push("P03_REQUIRED");
  }

  const p14 = await issue(manifest, "P14", "fg", buildP14(ctx), transport);
  if (p14) await capturePdf(manifest, "P14", "fg", p14.documentoId, "current", transport);

  if (p01) {
    const nd = await issue(manifest, "P15", "nd", buildP15Nd(ctx, p01.documentoId), transport);
    if (nd) await capturePdf(manifest, "P15", "nd", nd.documentoId, "current", transport);
  } else {
    manifest.points.P15.status = "blocked";
    manifest.points.P15.blockers.push("P01_REQUIRED_FOR_ND");
  }

  if (options.rcPaymentId && transport.issueReceipt) {
    const rcOutcome = await transport.issueReceipt({
      paymentId: options.rcPaymentId,
      idempotencyKey: `agt-cert:${options.runId}:P15:rc`,
    });
    if (rcOutcome.kind === "success") {
      const entry = manifest.points.P15;
      entry.documents.push(toDocRef("rc", rcOutcome.data));
      entry.status = entry.status === "failed" || entry.status === "uncertain"
        ? entry.status
        : "executed";
      await capturePdf(manifest, "P15", "rc", rcOutcome.data.documentoId, "current", transport);
    } else {
      manifest.points.P15.blockers.push(
        rcOutcome.kind === "uncertain"
          ? "RC_OUTCOME_UNCERTAIN"
          : `RC_${rcOutcome.code}`
      );
      if (rcOutcome.kind === "uncertain") manifest.points.P15.status = "uncertain";
    }
  } else {
    manifest.points.P15.blockers.push("RC_PAYMENT_ID_REQUIRED_FOR_RC_EVIDENCE");
  }

  manifest.updatedAt = new Date().toISOString();
  return manifest;
}

export function manifestSha256(manifest: CertificationManifest) {
  return createHash("sha256")
    .update(JSON.stringify(manifest))
    .digest("hex");
}
