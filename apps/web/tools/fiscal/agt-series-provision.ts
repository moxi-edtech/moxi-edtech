import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { loadSeriesOperationalSnapshot } from "../../src/lib/fiscal/certification/seriesRepository";
import {
  AGT_SERIES_PROVISION_ACK,
  assertCertificationSeriesType,
  buildSeriesIdempotencyKey,
  classifySeriesProvisionState,
} from "../../src/lib/fiscal/certification/seriesSafety";
import { sanitizeAgtEvidence } from "../../src/lib/fiscal/certification/sanitizer";

const argv = yargs(hideBin(process.argv))
  .option("empresa-id", { type: "string", demandOption: true })
  .option("type", { type: "string", demandOption: true })
  .option("year", { type: "number", default: 2026 })
  .option("establishment", { type: "string", default: "SEDE" })
  .option("contingency", { choices: ["N", "C"] as const, default: "N" as const })
  .option("base-url", { type: "string" })
  .option("escola-id", { type: "string" })
  .option("execute", { type: "boolean", default: false })
  .option("ack", { type: "string" })
  .strict()
  .help()
  .parseSync();

async function main() {
  const type = argv.type.trim().toUpperCase();
  assertCertificationSeriesType(type);
  const snapshot = await loadSeriesOperationalSnapshot(argv.empresaId);
  const state = classifySeriesProvisionState({
    documentType: type,
    year: argv.year,
    establishmentNumber: argv.establishment,
    contingencyIndicator: argv.contingency,
    requests: snapshot.requests,
    series: snapshot.series,
  });
  const idempotencyKey = buildSeriesIdempotencyKey({
    empresaId: argv.empresaId,
    documentType: type,
    year: argv.year,
    establishmentNumber: argv.establishment,
    contingencyIndicator: argv.contingency,
  });

  const plan = {
    empresa_id: argv.empresaId,
    tipo_documento: type,
    series_year: argv.year,
    establishment_number: argv.establishment,
    series_contingency_indicator: argv.contingency,
    idempotency_key: idempotencyKey,
    state,
  };

  if (!argv.execute) {
    process.stdout.write(JSON.stringify(sanitizeAgtEvidence({
      ok: state.state === "provisioned" || state.safeToSubmit,
      mode: "dry-run",
      plan,
      networkRequestSent: false,
      databaseMutationPerformed: false,
    }), null, 2) + "\n");
    return;
  }

  if (argv.ack !== AGT_SERIES_PROVISION_ACK) {
    throw new Error(
      `AGT_SERIES_PROVISION_ACK_REQUIRED: use --ack=${AGT_SERIES_PROVISION_ACK}`
    );
  }
  if (!state.safeToSubmit) {
    throw new Error(state.blocker ?? `AGT_SERIES_NOT_SAFE_TO_SUBMIT:${state.state}`);
  }
  if (!snapshot.empresa?.certificado_agt_numero) {
    throw new Error("AGT_SOFTWARE_VALIDATION_NUMBER_BINDING_MISSING");
  }
  if (snapshot.activeKmsKeys === 0) throw new Error("FISCAL_ACTIVE_KMS_KEY_MISSING");
  if (!argv.baseUrl) throw new Error("AGT_SERIES_BASE_URL_REQUIRED");

  const cookie = process.env.KLASSE_CERTIFICATION_COOKIE?.trim();
  const bearer = process.env.KLASSE_CERTIFICATION_BEARER?.trim();
  if (!cookie && !bearer) throw new Error("AGT_SERIES_AUTH_REQUIRED");

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "Idempotency-Key": idempotencyKey,
    "X-Klasse-AGT-Environment-Expected": "hml",
  };
  if (cookie) headers.cookie = cookie;
  if (bearer) headers.authorization = `Bearer ${bearer}`;
  if (argv.escolaId) headers["x-escola-id"] = argv.escolaId;

  let response: Response;
  try {
    response = await fetch(
      `${argv.baseUrl.replace(/\/$/, "")}/api/fiscal/provisioning/series`,
      {
        method: "POST",
        headers,
        cache: "no-store",
        body: JSON.stringify({
          empresa_id: argv.empresaId,
          tipo_documento: type,
          series_year: argv.year,
          establishment_number: argv.establishment,
          series_contingency_indicator: argv.contingency,
        }),
      }
    );
  } catch (error) {
    process.stdout.write(JSON.stringify({
      ok: false,
      mode: "execute",
      outcome: "uncertain",
      error: "AGT_SERIES_HTTP_OUTCOME_UNCERTAIN",
      rule: "Do not retry automatically. Run fiscal:agt:series:reconcile.",
      networkRequestSent: true,
    }, null, 2) + "\n");
    return;
  }

  const body = await response.json().catch(() => null);
  const evidence = sanitizeAgtEvidence({
    ok: response.ok,
    mode: "execute",
    http_status: response.status,
    response: body,
    idempotency_key: idempotencyKey,
    networkRequestSent: true,
  });
  process.stdout.write(JSON.stringify(evidence, null, 2) + "\n");
  if (!response.ok) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
    networkRequestSent: false,
    databaseMutationPerformed: false,
  }, null, 2) + "\n");
  process.exitCode = 1;
});
