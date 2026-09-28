import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { loadSeriesOperationalSnapshot } from "../../src/lib/fiscal/certification/seriesRepository";
import { sanitizeAgtEvidence } from "../../src/lib/fiscal/certification/sanitizer";

const argv = yargs(hideBin(process.argv))
  .option("empresa-id", { type: "string", demandOption: true })
  .strict()
  .help()
  .parseSync();

loadSeriesOperationalSnapshot(argv.empresaId)
  .then((snapshot) => {
    process.stdout.write(
      JSON.stringify(
        sanitizeAgtEvidence({
          ok: true,
          ...snapshot,
          networkRequestSent: false,
          databaseMutationPerformed: false,
        }),
        null,
        2
      ) + "\n"
    );
  })
  .catch((error) => {
    process.stderr.write(JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      networkRequestSent: false,
      databaseMutationPerformed: false,
    }, null, 2) + "\n");
    process.exitCode = 1;
  });
