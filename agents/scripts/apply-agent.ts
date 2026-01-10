import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import fs from "node:fs/promises";
import { applyPlan } from "../apply/apply";
import type { PatchPlanItem } from "../scan/types";

type GateJson = { status: "PASS" | "FAIL" };

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option("plan", { type: "string", demandOption: true })
    .option("gate", { type: "string", demandOption: true })
    .option("repo", { type: "string", demandOption: true })
    .option("mode", { type: "string", default: "safe" })
    .strict()
    .parse();

  const plan = JSON.parse(await fs.readFile(argv.plan, "utf8")) as PatchPlanItem[];
  const gate = JSON.parse(await fs.readFile(argv.gate, "utf8")) as GateJson;

  const result = await applyPlan({
    repoRoot: argv.repo,
    plan,
    gateStatus: gate.status,
    mode: argv.mode === "dry-run" ? "dry-run" : "safe",
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
