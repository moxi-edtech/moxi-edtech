import "server-only";

import { resolveAgtConfig } from "@/lib/fiscal/agtConfig";
import { signAgtJwsRs256 } from "@/lib/fiscal/agtJws";
import {
  buildAgtSoftwareInfoDetail,
  type AgtSoftwareInfoIdentity as AgtSoftwareIdentity,
  type AgtSoftwareInfoMode,
} from "@/lib/fiscal/agtContract";

export type { AgtSoftwareIdentity };

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
  mode?: AgtSoftwareInfoMode;
}) {
  const cfg = resolveAgtConfig();
  const identity: AgtSoftwareIdentity = {
    productId: cfg.productId,
    productVersion: cfg.productVersion,
    softwareValidationNumber: cfg.softwareValidationNumber,
    signatureVersion: cfg.signatureVersion,
  };
  const mode = options?.mode ?? cfg.softwareInfoMode;
  const softwareInfoDetail = buildAgtSoftwareInfoDetail(identity, mode);

  assertAgtSoftwareValidationNumber(
    options?.expectedSoftwareValidationNumber,
    identity.softwareValidationNumber
  );

  const jwsSoftwareSignature = await signAgtJwsRs256(softwareInfoDetail, {
    privateKeyRef: cfg.softwarePrivateKeyRef,
  });

  return {
    identity,
    softwareInfo: {
      softwareInfoDetail,
      jwsSoftwareSignature,
    },
    mode,
  };
}
