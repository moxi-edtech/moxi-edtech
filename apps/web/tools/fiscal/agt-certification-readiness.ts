import { readFile, writeFile } from "node:fs/promises";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import type { CertificationManifest } from "../../src/lib/fiscal/certification/types";
import type { P16Evidence } from "../../src/lib/fiscal/certification/p16";
import { buildCertificationReadiness } from "../../src/lib/fiscal/certification/readiness";
import { sanitizeAgtEvidence } from "../../src/lib/fiscal/certification/sanitizer";

const argv = yargs(hideBin(process.argv))
  .option("manifest", { type: "string", demandOption: true })
  .option("p16", { type: "string" })
  .option("p17-validation", { type: "string" })
  .option("preflight-json", { type: "string" })
  .option("out", { type: "string" })
  .strict()
  .help()
  .parseSync();

async function readJson<T>(file: string | undefined): Promise<T | null> {
  if (!file) return null;
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function main() {
  const manifest = await readJson<CertificationManifest>(argv.manifest);
  if (!manifest) throw new Error("CERTIFICATION_MANIFEST_REQUIRED");

  const p16 = await readJson<P16Evidence>(argv.p16);
  const p17Validation = await readJson<any>(argv.p17Validation);
  const preflight = await readJson<{ blockers?: unknown[] }>(argv.preflightJson);

  const readiness = buildCertificationReadiness({
    manifest,
    p16,
    p17: p17Validation
      ? {
          generatorReady: true,
          xsdOk: p17Validation.xsd?.ok === true,
          semanticOk:
            p17Validation.semantic?.ok === true &&
            p17Validation.cross_surface?.ok === true,
          coverageExact: p17Validation.coverage?.exact === true,
          checksumSha256:
            typeof p17Validation.checksum_sha256 === "string"
              ? p17Validation.checksum_sha256
              : null,
          softwareCertificateNumber:
            typeof p17Validation.software_certificate_number === "string"
              ? p17Validation.software_certificate_number
              : null,
        }
      : { generatorReady: true },
    externalBlockers: Array.isArray(preflight?.blockers)
      ? preflight!.blockers!.map((value) => String(value))
      : [],
  });

  const sanitized = sanitizeAgtEvidence(readiness);
  if (argv.out) {
    await writeFile(argv.out, JSON.stringify(sanitized, null, 2) + "\n", "utf8");
  }
  process.stdout.write(JSON.stringify(sanitized, null, 2) + "\n");
  if (!readiness.ok) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    ) + "\n"
  );
  process.exitCode = 1;
});
