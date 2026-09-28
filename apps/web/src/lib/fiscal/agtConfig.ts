import "server-only";

import { parseSafeInteger } from "@/lib/fiscal/decimal";
import { parseAgtSoftwareInfoMode } from "@/lib/fiscal/agtContract";

export type AgtEnvironment = "hml" | "prod";

export function resolveAgtConfig() {
  const environment = (
    process.env.FISCAL_AGT_ENV ??
    process.env.AGT_FE_ENV ??
    "hml"
  ).trim().toLowerCase();
  if (environment !== "hml" && environment !== "prod") {
    throw new Error("AGT_FE_ENV_INVALID");
  }

  const configuredBaseUrl =
    process.env.FISCAL_AGT_BASE_URL?.trim() ||
    process.env.AGT_FE_BASE_URL?.trim() ||
    "";
  const baseUrl =
    configuredBaseUrl ||
    (environment === "prod"
      ? "https://sifp.minfin.gov.ao/sigt/fe/v1"
      : "https://sifphml.minfin.gov.ao/sigt/fe/v1");

  const username =
    process.env.FISCAL_AGT_USERNAME?.trim() ||
    process.env.AGT_FE_USERNAME?.trim() ||
    "";
  const password =
    process.env.FISCAL_AGT_PASSWORD ??
    process.env.AGT_FE_PASSWORD ??
    "";
  const productId =
    process.env.FISCAL_AGT_SOFTWARE_PRODUCT_ID?.trim() ||
    process.env.AGT_SOFTWARE_PRODUCT_ID?.trim() ||
    "";
  const productVersion =
    process.env.FISCAL_AGT_SOFTWARE_PRODUCT_VERSION?.trim() ||
    process.env.AGT_SOFTWARE_PRODUCT_VERSION?.trim() ||
    "";
  const softwareValidationNumber =
    process.env.FISCAL_AGT_SOFTWARE_VALIDATION_NUMBER?.trim() ||
    process.env.AGT_SOFTWARE_VALIDATION_NUMBER?.trim() ||
    "";
  const softwarePrivateKeyRef =
    process.env.FISCAL_AGT_SOFTWARE_KMS_KEY_REF?.trim() ||
    process.env.AGT_SOFTWARE_KMS_KEY_REF?.trim() ||
    "";
  const signatureVersionRaw =
    process.env.FISCAL_AGT_SOFTWARE_SIGNATURE_VERSION?.trim() ||
    process.env.AGT_SOFTWARE_SIGNATURE_VERSION?.trim() ||
    "1";
  const signatureVersion = parseSafeInteger(
    signatureVersionRaw,
    "AGT_SOFTWARE_SIGNATURE_VERSION",
    { min: 1 }
  );
  const softwareInfoMode = parseAgtSoftwareInfoMode(
    process.env.FISCAL_AGT_SOFTWARE_INFO_MODE ??
      process.env.AGT_SOFTWARE_INFO_MODE
  );

  if (!username || !password) throw new Error("AGT_FE_BASIC_AUTH_MISSING");
  if (!productId || !productVersion || !softwareValidationNumber) {
    throw new Error("AGT_SOFTWARE_INFO_MISSING");
  }
  if (!softwarePrivateKeyRef) {
    throw new Error("AGT_SOFTWARE_KMS_KEY_REF_MISSING");
  }

  return {
    environment: environment as AgtEnvironment,
    baseUrl: baseUrl.replace(/\/$/, ""),
    username,
    password,
    productId,
    productVersion,
    softwareValidationNumber,
    softwarePrivateKeyRef,
    signatureVersion,
    softwareInfoMode,
  };
}

export function buildAgtBasicAuthorization(username: string, password: string) {
  const token = Buffer.from(`${username}:${password}`, "utf8").toString("base64");
  return `Basic ${token}`;
}

export function resolveAgtTimeoutMs() {
  return parseSafeInteger(
    process.env.FISCAL_AGT_TIMEOUT_MS ??
      process.env.AGT_FE_TIMEOUT_MS ??
      "12000",
    "FISCAL_AGT_TIMEOUT_MS",
    { min: 1000, fallback: 12000 }
  );
}
