import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import {
  CERTIFICATION_EXECUTION_ACK,
  manifestSha256,
  runCertificationDataset,
} from "../../src/lib/fiscal/certification/runner";
import { CertificationHttpTransport } from "../../src/lib/fiscal/certification/httpTransport";
import type { CertificationPreflight } from "../../src/lib/fiscal/certification/types";

const argv = yargs(hideBin(process.argv))
  .option("empresa-id", { type: "string", demandOption: true })
  .option("year", { type: "number", default: 2026 })
  .option("run-id", { type: "string" })
  .option("out-dir", {
    type: "string",
    default: "agents/outputs/fiscal/agt/certificacao-0000498",
  })
  .option("base-url", { type: "string" })
  .option("escola-id", { type: "string" })
  .option("execute", { type: "boolean", default: false })
  .option("ack", { type: "string" })
  .option("preflight-json", { type: "string" })
  .option("rc-payment-id", { type: "string" })
  .option("now", {
    type: "string",
    describe: "Clock injectável SOMENTE em dry-run/teste.",
  })
  .strict()
  .help()
  .parseSync();

function runId() {
  if (argv.runId?.trim()) return argv.runId.trim();
  return new Date().toISOString().replace(/[-:.]/g, "").replace("Z", "Z");
}

async function loadPreflight(): Promise<CertificationPreflight> {
  if (!argv.preflightJson) {
    return {
      ok: false,
      blockers: ["CERTIFICATION_PREFLIGHT_JSON_REQUIRED_FOR_EXECUTION"],
    };
  }
  const parsed = JSON.parse(await readFile(argv.preflightJson, "utf8")) as {
    ok?: boolean;
    blockers?: unknown[];
  };
  return {
    ok: parsed.ok === true,
    blockers: Array.isArray(parsed.blockers)
      ? parsed.blockers.map((item) => String(item))
      : [],
  };
}

async function main() {
  if (argv.execute && argv.now) {
    throw new Error("AGT_CERTIFICATION_CLOCK_OVERRIDE_FORBIDDEN_ON_EXECUTE");
  }
  if (argv.execute && argv.ack !== CERTIFICATION_EXECUTION_ACK) {
    throw new Error(
      `AGT_CERTIFICATION_EXECUTION_ACK_REQUIRED: use --ack=${CERTIFICATION_EXECUTION_ACK}`
    );
  }
  if (argv.execute && !argv.baseUrl) {
    throw new Error("AGT_CERTIFICATION_BASE_URL_REQUIRED");
  }

  const id = runId();
  const artifactDir = path.join(argv.outDir, id);
  await mkdir(artifactDir, { recursive: true });

  const now = argv.now ? new Date(argv.now) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error("AGT_CERTIFICATION_NOW_INVALID");

  const cookie = process.env.KLASSE_CERTIFICATION_COOKIE?.trim() || null;
  const bearer = process.env.KLASSE_CERTIFICATION_BEARER?.trim() || null;
  if (argv.execute && !cookie && !bearer) {
    throw new Error(
      "AGT_CERTIFICATION_AUTH_REQUIRED: use KLASSE_CERTIFICATION_COOKIE or KLASSE_CERTIFICATION_BEARER environment variable"
    );
  }

  const preflight = await loadPreflight();
  const transport = argv.execute
    ? new CertificationHttpTransport({
        baseUrl: argv.baseUrl!,
        artifactDir,
        escolaId: argv.escolaId,
        cookie,
        bearer,
        preflight: async () => preflight,
      })
    : undefined;

  const manifest = await runCertificationDataset({
    runId: id,
    empresaId: argv.empresaId,
    year: argv.year,
    execute: argv.execute,
    ack: argv.ack,
    now,
    transport,
    rcPaymentId: argv.rcPaymentId,
  });

  if (!argv.execute) {
    manifest.externalBlockers = [...preflight.blockers];
  }

  const manifestPath = path.join(artifactDir, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  process.stdout.write(
    JSON.stringify(
      {
        ok: !Object.values(manifest.points).some(
          (point) => point.status === "failed" || point.status === "uncertain"
        ),
        mode: manifest.mode,
        manifest: manifestPath,
        manifest_sha256: manifestSha256(manifest),
        blockers: manifest.externalBlockers,
        secretsLogged: false,
        agtNetworkRequestSentByCli: false,
      },
      null,
      2
    ) + "\n"
  );
}

main().catch((error) => {
  process.stderr.write(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        secretsLogged: false,
        agtNetworkRequestSentByCli: false,
      },
      null,
      2
    ) + "\n"
  );
  process.exitCode = 1;
});
