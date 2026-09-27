import "server-only";

import { resolveAgtConfig } from "@/lib/fiscal/agtConfig";
import { signAgtJwsRs256 } from "@/lib/fiscal/agtJws";

export type AgtSoftwareIdentity = Readonly<{
  productId: string;
  productVersion: string;
  softwareValidationNumber: string;
  signatureVersion: number;
}>;

export function resolveAgtSoftwareIdentity(): AgtSoftwareIdentity {
  const cfg = resolveAgtConfig();
  return {
    productId: cfg.productId,
    productVersion: cfg.productVersion,
    softwareValidationNumber: cfg.softwareValidationNumber,
    signatureVersion: cfg.signatureVersion,
  };
}

export function assertAgtSoftwareValidationNumber(
  expected: string | null | undefined,
  actual: string
) {
  const normalized = (expected ?? "").trim();
  if (normalized && normalized !== actual) {
    throw new Error("AGT_SOFTWARE_VALIDATION_NUMBER_MISMATCH");
  }
}

export async function buildAgtSoftwareInfo(options?: {
  expectedSoftwareValidationNumber?: string | null;
}) {
  const cfg = resolveAgtConfig();
  const softwareInfoDetail = {
    productId: cfg.productId,
    productVersion: cfg.productVersion,
    softwareValidationNumber: cfg.softwareValidationNumber,
  };

  assertAgtSoftwareValidationNumber(
    options?.expectedSoftwareValidationNumber,
    softwareInfoDetail.softwareValidationNumber
  );

  const jwsSoftwareSignature = await signAgtJwsRs256(softwareInfoDetail, {
    privateKeyRef: cfg.softwarePrivateKeyRef,
  });

  return {
    identity: {
      ...softwareInfoDetail,
      signatureVersion: cfg.signatureVersion,
    } satisfies AgtSoftwareIdentity,
    softwareInfo: {
      softwareInfoDetail,
      jwsSoftwareSignature,
    },
  };
}
