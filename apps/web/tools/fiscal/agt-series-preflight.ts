import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { loadSeriesOperationalSnapshot } from "../../src/lib/fiscal/certification/seriesRepository";
import {
  AGT_CERTIFICATION_SERIES_TYPES,
  classifySeriesProvisionState,
} from "../../src/lib/fiscal/certification/seriesSafety";
import { sanitizeAgtEvidence } from "../../src/lib/fiscal/certification/sanitizer";

const argv = yargs(hideBin(process.argv))
  .option("empresa-id", { type: "string", demandOption: true })
  .option("year", { type: "number", default: 2026 })
  .option("establishment", { type: "string", default: "SEDE" })
  .strict()
  .help()
  .parseSync();

async function main() {
  const snapshot = await loadSeriesOperationalSnapshot(argv.empresaId);
  const blockers: string[] = [];
  if (!snapshot.empresa) blockers.push("FISCAL_EMPRESA_NOT_FOUND");
  if (!snapshot.empresa?.certificado_agt_numero) {
    blockers.push("AGT_SOFTWARE_VALIDATION_NUMBER_BINDING_MISSING");
  }
  if (snapshot.activeKmsKeys === 0) blockers.push("FISCAL_ACTIVE_KMS_KEY_MISSING");

  const states = Object.fromEntries(
    AGT_CERTIFICATION_SERIES_TYPES.map((type) => {
      const state = classifySeriesProvisionState({
        documentType: type,
        year: argv.year,
        establishmentNumber: argv.establishment,
        contingencyIndicator: "N",
        requests: snapshot.requests,
        series: snapshot.series,
      });
      return [type, state];
    })
  );

  process.stdout.write(
    JSON.stringify(
      sanitizeAgtEvidence({
        ok: blockers.length === 0,
        empresa: snapshot.empresa,
        activeKmsKeys: snapshot.activeKmsKeys,
        year: argv.year,
        establishment: argv.establishment,
        states,
        blockers,
        networkRequestSent: false,
        databaseMutationPerformed: false,
      }),
      null,
      2
    ) + "\n"
  );
  if (blockers.length) process.exitCode = 1;
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
