import "server-only";

import { signAgtJwsRs256 } from "@/lib/fiscal/agtJws";

export type AgtSeriesProvisionInput = {
  submissionUuid: string;
  taxRegistrationNumber: string;
  documentType: string;
  seriesYear: number;
  establishmentNumber: string;
  contingencyIndicator: "N" | "C";
  taxpayerPrivateKeyRef: string;
};

export type AgtSeriesProvisionResult = {
  seriesCode: string;
  authorizedQuantity: number;
  firstDocumentNo: string;
  lastDocumentNo: string;
  raw: unknown;
};

type AgtErrorItem = {
  idError?: string;
  descriptionError?: string;
};

function resolveAgtConfig() {
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

  if (!username || !password) throw new Error("AGT_FE_BASIC_AUTH_MISSING");
  if (!productId || !productVersion || !softwareValidationNumber) {
    throw new Error("AGT_SOFTWARE_INFO_MISSING");
  }
  if (!softwarePrivateKeyRef) throw new Error("AGT_SOFTWARE_KMS_KEY_REF_MISSING");

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    username,
    password,
    productId,
    productVersion,
    softwareValidationNumber,
    softwarePrivateKeyRef,
  };
}

export async function provisionAgtSeries(
  input: AgtSeriesProvisionInput
): Promise<AgtSeriesProvisionResult> {
  const cfg = resolveAgtConfig();

  const softwareInfoDetail = {
    productId: cfg.productId,
    productVersion: cfg.productVersion,
    softwareValidationNumber: cfg.softwareValidationNumber,
  };

  const jwsSoftwareSignature = await signAgtJwsRs256(softwareInfoDetail, {
    privateKeyRef: cfg.softwarePrivateKeyRef,
  });

  const requestSignaturePayload = {
    taxRegistrationNumber: input.taxRegistrationNumber,
    seriesYear: input.seriesYear,
    documentType: input.documentType,
    establishmentNumber: input.establishmentNumber,
    seriesContingencyIndicator: input.contingencyIndicator,
  };

  const jwsSignature = await signAgtJwsRs256(requestSignaturePayload, {
    privateKeyRef: input.taxpayerPrivateKeyRef,
  });

  const payload = {
    schemaVersion: "2.0",
    submissionUUID: input.submissionUuid,
    taxRegistrationNumber: input.taxRegistrationNumber,
    submissionTimeStamp: new Date().toISOString(),
    softwareInfo: {
      softwareInfoDetail,
      jwsSoftwareSignature,
    },
    seriesYear: input.seriesYear,
    documentType: input.documentType,
    establishmentNumber: input.establishmentNumber,
    jwsSignature,
    seriesContingencyIndicator: input.contingencyIndicator,
  };

  const controller = new AbortController();
  const timeoutMs = Number(process.env.AGT_FE_TIMEOUT_MS ?? 12000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const authorization = Buffer.from(
      `${cfg.username}:${cfg.password}`,
      "utf8"
    ).toString("base64");

    const response = await fetch(`${cfg.baseUrl}/solicitarSerie`, {
      method: "POST",
      signal: controller.signal,
      cache: "no-store",
      headers: {
        Authorization: `Basic ${authorization}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = (await response.json().catch(() => null)) as
      | {
          resultCode?: number | string;
          errorList?: AgtErrorItem[];
          seriesFEResult?: {
            seriesCode?: string;
            authorizedQuantity?: number | string;
            firstDocumentNo?: string;
            lastDocumentNo?: string;
          };
        }
      | null;

    if (!response.ok || !json?.seriesFEResult?.seriesCode) {
      const errors = Array.isArray(json?.errorList)
        ? json!.errorList!
            .map((item) =>
              [item.idError, item.descriptionError].filter(Boolean).join(": ")
            )
            .filter(Boolean)
        : [];

      throw new Error(
        `AGT_SERIES_REJECTED:${response.status}:${errors.join(" | ") || "unknown"}`
      );
    }

    const authorizedQuantity = Number(json.seriesFEResult.authorizedQuantity);
    if (!Number.isSafeInteger(authorizedQuantity) || authorizedQuantity <= 0) {
      throw new Error("AGT_SERIES_INVALID_AUTHORIZED_QUANTITY");
    }

    return {
      seriesCode: json.seriesFEResult.seriesCode,
      authorizedQuantity,
      firstDocumentNo: String(json.seriesFEResult.firstDocumentNo ?? ""),
      lastDocumentNo: String(json.seriesFEResult.lastDocumentNo ?? ""),
      raw: json,
    };
  } finally {
    clearTimeout(timeout);
  }
}
