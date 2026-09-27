import "server-only";

import { signAgtJwsRs256 } from "@/lib/fiscal/agtJws";
import { buildAgtSoftwareInfo } from "@/lib/fiscal/agtSoftwareInfo";
import { buildAgtBasicAuthorization, resolveAgtConfig, resolveAgtTimeoutMs } from "@/lib/fiscal/agtConfig";

export type AgtSeriesProvisionInput = {
  submissionUuid: string;
  taxRegistrationNumber: string;
  documentType: string;
  seriesYear: number;
  establishmentNumber: string;
  contingencyIndicator: "N" | "C";
  taxpayerPrivateKeyRef: string;
  expectedSoftwareValidationNumber?: string | null;
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

export async function provisionAgtSeries(
  input: AgtSeriesProvisionInput
): Promise<AgtSeriesProvisionResult> {
  const cfg = resolveAgtConfig();
  const { softwareInfo } = await buildAgtSoftwareInfo({
    expectedSoftwareValidationNumber: input.expectedSoftwareValidationNumber,
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
    softwareInfo,
    seriesYear: input.seriesYear,
    documentType: input.documentType,
    establishmentNumber: input.establishmentNumber,
    jwsSignature,
    seriesContingencyIndicator: input.contingencyIndicator,
  };

  const controller = new AbortController();
  const timeoutMs = resolveAgtTimeoutMs();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const authorization = buildAgtBasicAuthorization(cfg.username, cfg.password);

    const response = await fetch(`${cfg.baseUrl}/solicitarSerie`, {
      method: "POST",
      signal: controller.signal,
      cache: "no-store",
      headers: {
        Authorization: authorization,
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
