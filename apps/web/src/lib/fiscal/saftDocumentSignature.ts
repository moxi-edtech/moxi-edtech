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

const SAFT_HASHED_DOCUMENT_TYPES = new Set([
  "FT", "FR", "GF", "FG", "AC", "AR", "ND", "NC", "AF", "TV",
  "RP", "RE", "CS", "LD", "RA",
  "PP",
  "GR", "GT", "GA", "GD",
]);

export async function ensureSaftDocumentSignature(documentoId: string) {
  const admin = supabaseServerRole() as any;
  const { data: documento, error: documentoError } = await admin
    .from("fiscal_documentos")
    .select("id,tipo_documento")
    .eq("id", documentoId)
    .maybeSingle();

  if (documentoError || !documento) {
    throw new SaftDocumentSignatureError(
      "SAFT_DOCUMENT_LOOKUP_FAILED",
      documentoError?.message ?? "Documento fiscal não encontrado."
    );
  }

  const tipoDocumento = String(documento.tipo_documento ?? "").trim().toUpperCase();
  if (!SAFT_HASHED_DOCUMENT_TYPES.has(tipoDocumento)) {
    return {
      ok: true as const,
      skipped: true as const,
      documentoId,
      reason: "DOCUMENT_TYPE_NOT_HASHED_IN_SAFT" as const,
      hashControlVersion: 0,
      previousHashPresent: false,
      publicKeyFingerprintSha256: null,
    };
  }

  const readiness = getSaftSigningReadiness();

  if (!readiness.required) {
    return {
      ok: true as const,
      skipped: true as const,
      documentoId,
      hashControlVersion: 0,
      previousHashPresent: false,
      publicKeyFingerprintSha256: null,
    };
  }

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
