import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { loadSeriesOperationalSnapshot } from "../../src/lib/fiscal/certification/seriesRepository";
import { reconcileSeriesRequestsLocally } from "../../src/lib/fiscal/certification/seriesSafety";
import { sanitizeAgtEvidence } from "../../src/lib/fiscal/certification/sanitizer";

const argv = yargs(hideBin(process.argv))
  .option("empresa-id", { type: "string", demandOption: true })
  .option("out", { type: "string" })
  .strict()
  .help()
  .parseSync();

async function main() {
  const snapshot = await loadSeriesOperationalSnapshot(argv.empresaId);
  const reconciliation = reconcileSeriesRequestsLocally({
    requests: snapshot.requests,
    series: snapshot.series,
  });
  const evidence = sanitizeAgtEvidence({
    ok: reconciliation.every(
      (row) => row.resolution === "LOCAL_PROVISIONED_SERIES_FOUND"
    ),
    reconciliation,
    rule: "Never resubmit an uncertain series request automatically.",
    externalLookupPerformed: false,
    blocker:
      reconciliation.some((row) => row.resolution === "EXTERNAL_CONFIRMATION_REQUIRED")
        ? "AGT_SERIES_EXTERNAL_RECONCILIATION_CHANNEL_REQUIRED"
        : null,
    networkRequestSent: false,
    databaseMutationPerformed: false,
  });

  if (argv.out) {
    await mkdir(path.dirname(argv.out), { recursive: true });
    await writeFile(argv.out, JSON.stringify(evidence, null, 2) + "\n", "utf8");
  }
  process.stdout.write(JSON.stringify(evidence, null, 2) + "\n");
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
