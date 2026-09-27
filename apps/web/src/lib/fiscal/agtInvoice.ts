import "server-only";

import { signAgtJwsRs256 } from "@/lib/fiscal/agtJws";
import {
  buildAgtBasicAuthorization,
  resolveAgtConfig,
  resolveAgtTimeoutMs,
} from "@/lib/fiscal/agtConfig";

export type AgtDocumentTotals = {
  taxPayable: number;
  netTotal: number;
  grossTotal: number;
  currency?: {
    currencyCode: string;
    currencyAmount: number;
    exchangeRate: number;
  };
};

export type AgtInvoiceDocument = Record<string, unknown> & {
  documentNo: string;
  documentStatus: "N" | "C";
  documentDate: string;
  documentType: string;
  systemEntryDate: string;
  customerTaxID: string;
  customerCountry: string;
  companyName: string;
  documentTotals: AgtDocumentTotals;
};

export type AgtPreparedDocument = {
  document: AgtInvoiceDocument;
  signaturePayload: Record<string, unknown>;
};

export type AgtRegisterResult = {
  requestID: string;
  errorList: unknown[];
  requestPayload: Record<string, unknown>;
  responsePayload: unknown;
};

export type AgtStatusResult = {
  requestID: string;
  resultCode: number;
  taxRegistrationNumber?: string;
  documentStatusList?: Array<{
    documentNo?: string;
    documentStatus?: "V" | "I" | string;
    errorList?: unknown[];
  }>;
  requestErrorList?: unknown[];
  successRequestID?: string;
  responsePayload: unknown;
};

export class AgtHttpError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number,
    public readonly payload: unknown
  ) {
    super(message);
    this.name = "AgtHttpError";
  }
}

async function buildSoftwareInfo() {
  const cfg = resolveAgtConfig();
  const softwareInfoDetail = {
    productId: cfg.productId,
    productVersion: cfg.productVersion,
    softwareValidationNumber: cfg.softwareValidationNumber,
  };
  const jwsSoftwareSignature = await signAgtJwsRs256(softwareInfoDetail, {
    privateKeyRef: cfg.softwarePrivateKeyRef,
  });
  return { cfg, softwareInfo: { softwareInfoDetail, jwsSoftwareSignature } };
}

async function postAgt(path: string, payload: Record<string, unknown>) {
  const cfg = resolveAgtConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), resolveAgtTimeoutMs());
  try {
    const response = await fetch(`${cfg.baseUrl}/${path}`, {
      method: "POST",
      signal: controller.signal,
      cache: "no-store",
      headers: {
        Authorization: buildAgtBasicAuthorization(cfg.username, cfg.password),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    const json = await response.json().catch(() => null);
    if (!response.ok) {
      throw new AgtHttpError(
        `AGT_HTTP_${response.status}`,
        response.status,
        json
      );
    }
    return json;
  } finally {
    clearTimeout(timeout);
  }
}

export async function registerAgtInvoices(input: {
  submissionUuid: string;
  taxRegistrationNumber: string;
  taxpayerPrivateKeyRef: string;
  documents: AgtPreparedDocument[];
  submissionTimeStamp?: string;
}): Promise<AgtRegisterResult> {
  if (input.documents.length < 1 || input.documents.length > 30) {
    throw new Error("AGT_REGISTER_DOCUMENT_COUNT_INVALID");
  }
  const { softwareInfo } = await buildSoftwareInfo();
  const documents = [];
  for (const item of input.documents) {
    const jwsDocumentSignature = await signAgtJwsRs256(item.signaturePayload, {
      privateKeyRef: input.taxpayerPrivateKeyRef,
    });
    documents.push({ ...item.document, jwsDocumentSignature });
  }
  const requestPayload = {
    schemaVersion: "2.0",
    submissionUUID: input.submissionUuid,
    taxRegistrationNumber: input.taxRegistrationNumber,
    submissionTimeStamp: input.submissionTimeStamp ?? new Date().toISOString(),
    softwareInfo,
    numberOfEntries: documents.length,
    documents,
  };
  const responsePayload = (await postAgt("registarFactura", requestPayload)) as
    | { requestID?: string; errorList?: unknown[] }
    | null;
  const requestID = String(responsePayload?.requestID ?? "").trim();
  if (!requestID || requestID.length > 15) {
    throw new AgtHttpError(
      "AGT_REGISTER_REQUEST_ID_MISSING",
      200,
      responsePayload
    );
  }
  return {
    requestID,
    errorList: Array.isArray(responsePayload?.errorList)
      ? responsePayload!.errorList!
      : [],
    requestPayload,
    responsePayload,
  };
}

export async function getAgtInvoiceStatus(input: {
  requestID: string;
  taxRegistrationNumber: string;
  taxpayerPrivateKeyRef: string;
}): Promise<AgtStatusResult> {
  const { softwareInfo } = await buildSoftwareInfo();
  const signaturePayload = {
    taxRegistrationNumber: input.taxRegistrationNumber,
    requestID: input.requestID,
  };
  const jwsSignature = await signAgtJwsRs256(signaturePayload, {
    privateKeyRef: input.taxpayerPrivateKeyRef,
  });
  const requestPayload = {
    schemaVersion: "2.0",
    submissionUUID: crypto.randomUUID(),
    taxRegistrationNumber: input.taxRegistrationNumber,
    submissionTimeStamp: new Date().toISOString(),
    softwareInfo,
    jwsSignature,
    requestID: input.requestID,
  };
  const responsePayload = (await postAgt("obterEstado", requestPayload)) as
    | {
        requestID?: string;
        resultCode?: number | string;
        taxRegistrationNumber?: string;
        documentStatusList?: AgtStatusResult["documentStatusList"];
        requestErrorList?: unknown[];
        successRequestID?: string;
      }
    | null;
  const resultCode = Number(responsePayload?.resultCode);
  if (!Number.isInteger(resultCode) || ![0, 1, 2, 7, 8, 9].includes(resultCode)) {
    throw new AgtHttpError("AGT_STATUS_RESULT_CODE_INVALID", 200, responsePayload);
  }
  return {
    requestID: String(responsePayload?.requestID ?? input.requestID),
    resultCode,
    taxRegistrationNumber: responsePayload?.taxRegistrationNumber,
    documentStatusList: Array.isArray(responsePayload?.documentStatusList)
      ? responsePayload!.documentStatusList
      : [],
    requestErrorList: Array.isArray(responsePayload?.requestErrorList)
      ? responsePayload!.requestErrorList
      : [],
    successRequestID: responsePayload?.successRequestID,
    responsePayload,
  };
}
