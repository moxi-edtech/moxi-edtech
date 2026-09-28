export type AgtSoftwareInfoMode = "docs-example" | "table-strict";

export type AgtSoftwareInfoIdentity = Readonly<{
  productId: string;
  productVersion: string;
  softwareValidationNumber: string;
  signatureVersion: number;
}>;

export function parseAgtSoftwareInfoMode(
  value: string | null | undefined,
): AgtSoftwareInfoMode {
  const normalized = (value ?? "docs-example").trim().toLowerCase();
  if (normalized === "docs-example" || normalized === "table-strict") {
    return normalized;
  }
  throw new Error("AGT_SOFTWARE_INFO_MODE_INVALID");
}

export function buildAgtSoftwareInfoDetail(
  identity: AgtSoftwareInfoIdentity,
  mode: AgtSoftwareInfoMode,
): Record<string, string | number> {
  const detail: Record<string, string | number> = {
    productId: identity.productId,
    productVersion: identity.productVersion,
    softwareValidationNumber: identity.softwareValidationNumber,
  };

  if (mode === "table-strict") {
    detail.signatureVersion = identity.signatureVersion;
  }

  return detail;
}

export function assertAgtHomologationEnvironment(input: {
  environment: "hml" | "prod";
  baseUrl: string;
}) {
  if (input.environment !== "hml") {
    throw new Error("AGT_HML_PROBE_PRODUCTION_ENV_FORBIDDEN");
  }

  const url = new URL(input.baseUrl);
  if (url.protocol !== "https:" || url.hostname !== "sifphml.minfin.gov.ao") {
    throw new Error("AGT_HML_PROBE_HOST_INVALID");
  }
}
