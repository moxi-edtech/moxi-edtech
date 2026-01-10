import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { runScan } from "../scan/index";

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option("repo", { type: "string", demandOption: true })
    .option("contracts", { type: "string", demandOption: true })
    .option("out", { type: "string", demandOption: true })
    .strict()
    .parse();

  await runScan({
    repoRoot: argv.repo,
    contractsDir: argv.contracts,
    outDir: argv.out,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
