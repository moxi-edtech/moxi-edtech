import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { runPerfGate } from "../perf/gate";

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option("scan", { type: "string", demandOption: true })
    .option("contracts", { type: "string", demandOption: false })
    .option("out", { type: "string", demandOption: true })
    .strict()
    .parse();

  await runPerfGate({ scanJson: argv.scan, outDir: argv.out });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
