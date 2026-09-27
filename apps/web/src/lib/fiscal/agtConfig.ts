import "server-only";

export type AgtEnvironment = "hml" | "prod";

export function resolveAgtConfig() {
  const environment = (process.env.AGT_FE_ENV ?? "hml").trim().toLowerCase();
  if (environment !== "hml" && environment !== "prod") {
    throw new Error("AGT_FE_ENV_INVALID");
  }

  const configuredBaseUrl = process.env.AGT_FE_BASE_URL?.trim() || "";
  const baseUrl =
    configuredBaseUrl ||
    (environment === "prod"
      ? "https://sifp.minfin.gov.ao/sigt/fe/v1"
      : "");

  if (!baseUrl) {
    throw new Error("AGT_FE_BASE_URL_REQUIRED_FOR_HML");
  }

  const username = process.env.AGT_FE_USERNAME?.trim() || "";
  const password = process.env.AGT_FE_PASSWORD ?? "";
  const productId = process.env.AGT_SOFTWARE_PRODUCT_ID?.trim() || "";
  const productVersion = process.env.AGT_SOFTWARE_PRODUCT_VERSION?.trim() || "";
  const softwareValidationNumber =
    process.env.AGT_SOFTWARE_VALIDATION_NUMBER?.trim() || "";
  const softwarePrivateKeyRef =
    process.env.AGT_SOFTWARE_KMS_KEY_REF?.trim() || "";
  const signatureVersionRaw =
    process.env.AGT_SOFTWARE_SIGNATURE_VERSION?.trim() || "1";
  const signatureVersion = Number(signatureVersionRaw);

  if (!username || !password) throw new Error("AGT_FE_BASIC_AUTH_MISSING");
  if (!productId || !productVersion || !softwareValidationNumber) {
    throw new Error("AGT_SOFTWARE_INFO_MISSING");
  }
  if (!softwarePrivateKeyRef) {
    throw new Error("AGT_SOFTWARE_KMS_KEY_REF_MISSING");
  }
  if (!Number.isSafeInteger(signatureVersion) || signatureVersion <= 0) {
    throw new Error("AGT_SOFTWARE_SIGNATURE_VERSION_INVALID");
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
  };
}

export function buildAgtBasicAuthorization(username: string, password: string) {
  const token = Buffer.from(`${username}:${password}`, "utf8").toString("base64");
  return `Basic ${token}`;
}

export function resolveAgtTimeoutMs() {
  const value = Number(process.env.AGT_FE_TIMEOUT_MS ?? 12000);
  return Number.isFinite(value) && value >= 1000 ? value : 12000;
}
