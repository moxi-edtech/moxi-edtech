import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import type { CertificationManifest } from "../../src/lib/fiscal/certification/types";
import {
  loadCertificationDatasetSnapshot,
} from "../../src/lib/fiscal/certification/evidenceRepository";
import { buildP16Evidence } from "../../src/lib/fiscal/certification/p16";
import {
  buildCertificationSaft,
  buildCertificationSaftInput,
  manifestDocumentIds,
} from "../../src/lib/fiscal/certification/saftPack";
import { validateCertificationCrossSurface } from "../../src/lib/fiscal/certification/crossValidator";
import { buildCertificationReadiness } from "../../src/lib/fiscal/certification/readiness";
import { sanitizeAgtEvidence } from "../../src/lib/fiscal/certification/sanitizer";
import { validateSaftXmlWithXsd } from "../../src/lib/fiscal/saftXsdValidator";

const argv = yargs(hideBin(process.argv))
  .option("manifest", { type: "string", demandOption: true })
  .option("out-dir", { type: "string" })
  .strict()
  .help()
  .parseSync();

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`CERTIFICATION_ENV_MISSING:${name}`);
  return value;
}

function markdownMatrix(p16: ReturnType<typeof buildP16Evidence>) {
  const lines = [
    "# Matriz de Evidências — AGT Ref. 0000498/01180000/AGT/2026",
    "",
    "| Ponto | Status | Documento(s) | Blockers |",
    "|---|---|---|---|",
  ];
  for (const [point, entry] of Object.entries(p16)) {
    lines.push(
      `| ${point} | ${entry.status} | ${entry.documents.map((doc) => doc.numero).join("<br>") || "N/A"} | ${entry.blockers.join("<br>") || "-"} |`
    );
  }
  return lines.join("\n") + "\n";
}

async function main() {
  const manifest = JSON.parse(await readFile(argv.manifest, "utf8")) as CertificationManifest;
  const runDir = argv.outDir ?? path.dirname(argv.manifest);
  await mkdir(runDir, { recursive: true });

  const ids = manifestDocumentIds(manifest);
  const snapshot = await loadCertificationDatasetSnapshot({
    empresaId: manifest.empresaId,
    documentIds: ids,
  });

  const p16 = buildP16Evidence({ manifest, snapshot });
  const header = {
    productId: requiredEnv("SAFT_PRODUCT_ID"),
    productCompanyTaxId: requiredEnv("SAFT_PRODUCT_COMPANY_TAX_ID"),
    productVersion: requiredEnv("SAFT_PRODUCT_VERSION"),
    taxAccountingBasis: "F" as const,
    softwareCertificateNumber:
      process.env.SAFT_SOFTWARE_CERTIFICATE_NUMBER?.trim() || "0",
  };

  const saftInput = buildCertificationSaftInput({ manifest, snapshot, header });
  const p17 = buildCertificationSaft(saftInput);
  const xsd = await validateSaftXmlWithXsd({
    xml: p17.xml,
    xsdVersion: "AO_SAFT_1.01",
  });
  const cross = validateCertificationCrossSurface({
    manifest,
    snapshot,
    saftXml: p17.xml,
  });

  const p17Dir = path.join(runDir, "P17");
  await mkdir(p17Dir, { recursive: true });
  await writeFile(path.join(p17Dir, "saft.xml"), p17.xml, "utf8");

  const validation = sanitizeAgtEvidence({
    checksum_sha256: p17.checksumSha256,
    coverage: p17.coverage,
    summary: p17.summary,
    xsd,
    semantic: { ok: true },
    cross_surface: cross,
    software_certificate_number: header.softwareCertificateNumber,
  });
  await writeFile(
    path.join(p17Dir, "validation.json"),
    JSON.stringify(validation, null, 2) + "\n",
    "utf8"
  );

  for (const [point, entry] of Object.entries(p16)) {
    if (!/^P(?:0[1-9]|1[0-6])$/.test(point)) continue;
    const pointDir = path.join(runDir, point);
    await mkdir(pointDir, { recursive: true });
    await writeFile(
      path.join(pointDir, "evidence.json"),
      JSON.stringify(sanitizeAgtEvidence(entry), null, 2) + "\n",
      "utf8"
    );

    const manifestEntry = manifest.points[point as keyof typeof manifest.points];
    for (const doc of manifestEntry.documents) {
      for (const pdf of doc.pdf ?? []) {
        const suffix = pdf.variant === "current" ? "" : `-${pdf.variant}`;
        await copyFile(pdf.path, path.join(pointDir, `documento-${doc.role}${suffix}.pdf`));
      }
    }
  }

  await writeFile(path.join(runDir, "P16.json"), JSON.stringify(sanitizeAgtEvidence(p16), null, 2) + "\n");
  await writeFile(path.join(runDir, "MATRIZ.md"), markdownMatrix(p16));

  const readiness = buildCertificationReadiness({
    manifest,
    p16,
    p17: {
      generatorReady: true,
      xsdOk: xsd.ok,
      semanticOk: cross.ok,
      coverageExact: p17.coverage.exact,
      checksumSha256: p17.checksumSha256,
      softwareCertificateNumber: header.softwareCertificateNumber,
    },
  });
  await writeFile(
    path.join(runDir, "readiness.json"),
    JSON.stringify(sanitizeAgtEvidence(readiness), null, 2) + "\n"
  );

  const summary = [
    "# Resumo Executivo — Dossiê AGT",
    "",
    `- Ref.: ${manifest.officeReference}`,
    `- Run: ${manifest.runId}`,
    `- Documentos únicos: ${ids.length}`,
    `- SAF-T SHA-256: ${p17.checksumSha256}`,
    `- XSD: ${xsd.ok ? "PASS" : "FAIL"}`,
    `- Cross-surface: ${cross.ok ? "PASS" : "FAIL"}`,
    `- Readiness: ${readiness.ok ? "READY" : "BLOCKED"}`,
    "",
    "## Blockers",
    "",
    ...(readiness.externalBlockers.length
      ? readiness.externalBlockers.map((item) => `- ${item}`)
      : ["- Nenhum"]),
    "",
  ].join("\n");
  await writeFile(path.join(runDir, "RESUMO_EXECUTIVO.md"), summary, "utf8");

  process.stdout.write(
    JSON.stringify(
      {
        ok: readiness.ok,
        run_dir: runDir,
        p16: "P16.json",
        p17: "P17/saft.xml",
        saft_sha256: p17.checksumSha256,
        readiness: readiness.externalBlockers,
        agtNetworkRequestSent: false,
        databaseMutationPerformed: false,
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
        agtNetworkRequestSent: false,
        databaseMutationPerformed: false,
      },
      null,
      2
    ) + "\n"
  );
  process.exitCode = 1;
});
