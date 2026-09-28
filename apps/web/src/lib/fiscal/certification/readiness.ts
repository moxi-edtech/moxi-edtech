import { certificationEvidenceMonths, type P16Evidence } from "@/lib/fiscal/certification/p16";
import type { CertificationManifest, CertificationPoint } from "@/lib/fiscal/certification/types";

export type CertificationReadinessPoint = {
  point: CertificationPoint;
  status: "READY" | "NA" | "BLOCKED" | "DATASET_PENDING";
  blockers: string[];
};

export function buildCertificationReadiness(input: {
  manifest: CertificationManifest;
  p16?: P16Evidence | null;
  p17?: {
    generatorReady: boolean;
    xsdOk?: boolean;
    semanticOk?: boolean;
    coverageExact?: boolean;
    checksumSha256?: string | null;
    softwareCertificateNumber?: string | null;
  } | null;
  externalBlockers?: string[];
}) {
  const points = (Object.keys(input.manifest.points) as CertificationPoint[]).map(
    (point): CertificationReadinessPoint => {
      const entry = input.manifest.points[point];
      if (entry.status === "na") {
        return { point, status: "NA", blockers: [] };
      }
      if (point === "P16") {
        return input.p16
          ? { point, status: "READY", blockers: [] }
          : { point, status: "DATASET_PENDING", blockers: ["P16_EVIDENCE_NOT_GENERATED"] };
      }
      if (point === "P17") {
        const blockers: string[] = [];
        if (!input.p17?.generatorReady) blockers.push("P17_GENERATOR_NOT_READY");
        if (!input.p17?.xsdOk) blockers.push("P17_XSD_NOT_VALIDATED");
        if (!input.p17?.semanticOk) blockers.push("P17_SEMANTIC_NOT_VALIDATED");
        if (!input.p17?.coverageExact) blockers.push("P17_MANIFEST_COVERAGE_NOT_EXACT");
        if (!input.p17?.softwareCertificateNumber || input.p17.softwareCertificateNumber === "0") {
          blockers.push("P17_SOFTWARE_CERTIFICATE_NUMBER_MISSING");
        }
        return {
          point,
          status: blockers.length === 0 ? "READY" : "DATASET_PENDING",
          blockers,
        };
      }
      const ready = ["executed", "reused", "validated"].includes(entry.status);
      return {
        point,
        status: ready && entry.blockers.length === 0 ? "READY" : "BLOCKED",
        blockers: [...entry.blockers, ...(ready ? [] : [`POINT_STATUS_${entry.status.toUpperCase()}`])],
      };
    }
  );

  const blockers = [...(input.externalBlockers ?? []), ...input.manifest.externalBlockers];
  if (input.p16) {
    const months = certificationEvidenceMonths(input.p16);
    if (months.length < 2) blockers.push("CERTIFICATION_TWO_DISTINCT_MONTHS_REQUIRED");
  } else {
    blockers.push("CERTIFICATION_P16_REQUIRED_FOR_MONTH_CHECK");
  }

  const uniqueBlockers = Array.from(new Set(blockers));
  return {
    ok:
      uniqueBlockers.length === 0 &&
      points.every((point) => point.status === "READY" || point.status === "NA"),
    points,
    externalBlockers: uniqueBlockers,
  };
}
