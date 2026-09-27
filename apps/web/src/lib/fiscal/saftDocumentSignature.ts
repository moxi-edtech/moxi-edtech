import "server-only";

import { supabaseServerRole } from "@/lib/supabaseServerRole";
import {
  getSaftSigningReadiness,
  signSaftCanonicalString,
} from "@/lib/fiscal/saftDocumentSigner";

type PrepareResult = {
  ok?: boolean;
  documento_id?: string;
  saft_canonical_string?: string;
  saft_hash_control?: number;
  saft_hash_anterior?: string;
};

export class SaftDocumentSignatureError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "SaftDocumentSignatureError";
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function ensureSaftDocumentSignature(documentoId: string) {
  const readiness = getSaftSigningReadiness();
  const admin = supabaseServerRole() as any;

  const { data: prepareData, error: prepareError } = await admin.rpc(
    "fiscal_preparar_assinatura_saft",
    {
      p_documento_id: documentoId,
      p_hash_control_version: readiness.hashControlVersion,
    }
  );

  if (prepareError) {
    throw new SaftDocumentSignatureError(
      "SAFT_PREPARE_FAILED",
      prepareError.message
    );
  }

  const prepared = asRecord(prepareData) as PrepareResult;
  if (
    prepared.ok !== true ||
    !prepared.saft_canonical_string ||
    !prepared.saft_hash_control
  ) {
    throw new SaftDocumentSignatureError(
      "SAFT_PREPARE_INCONSISTENT",
      "Resposta inconsistente ao preparar assinatura SAF-T."
    );
  }

  const signed = signSaftCanonicalString(prepared.saft_canonical_string);
  if (signed.hashControlVersion !== prepared.saft_hash_control) {
    throw new SaftDocumentSignatureError(
      "SAFT_KEY_VERSION_MISMATCH",
      "Versão da chave SAF-T diverge da versão persistida no documento."
    );
  }

  const { data: finalizeData, error: finalizeError } = await admin.rpc(
    "fiscal_finalizar_hash_saft",
    {
      p_documento_id: documentoId,
      p_saft_hash: signed.hash,
      p_saft_hash_control: signed.hashControlVersion,
      p_saft_canonical_string: prepared.saft_canonical_string,
    }
  );

  if (finalizeError) {
    throw new SaftDocumentSignatureError(
      "SAFT_FINALIZE_FAILED",
      finalizeError.message
    );
  }

  const finalized = asRecord(finalizeData);
  if (finalized.ok !== true) {
    throw new SaftDocumentSignatureError(
      "SAFT_FINALIZE_INCONSISTENT",
      "Resposta inconsistente ao finalizar assinatura SAF-T."
    );
  }

  return {
    ok: true as const,
    documentoId,
    hashControlVersion: signed.hashControlVersion,
    previousHashPresent: Boolean(prepared.saft_hash_anterior),
    publicKeyFingerprintSha256: readiness.publicKeyFingerprintSha256,
  };
}
