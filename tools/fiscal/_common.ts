import { createHash, createPublicKey, verify, constants } from "node:crypto";

import postgres from "postgres";

export type FiscalDocumentoRow = {
  id: string;
  empresa_id: string;
  serie_id: string;
  numero: number;
  numero_formatado: string;
  status: string;
  hash_control: string;
  hash_anterior: string | null;
  assinatura_base64: string | null;
  canonical_string: string | null;
  key_version: number;
  created_at: string;
  system_entry: string;
};

export type FiscalChaveRow = {
  empresa_id: string;
  key_version: number;
  algorithm: string;
  public_key_pem: string;
  status: string;
};

export type VerifySignatureResult = {
  ok: boolean;
  algorithm: string;
  detail: string;
};

export function resolveDbUrl(input?: string): string {
  const raw =
    input?.trim() ||
    process.env.DB_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    process.env.SUPABASE_DB_URL?.trim() ||
    "";
  if (!raw) {
    throw new Error("DB_URL/DATABASE_URL/SUPABASE_DB_URL nao definido.");
  }
  return raw;
}

export function createSqlClient(dbUrl: string) {
  return postgres(dbUrl, { max: 1 });
}

export function computeHashControl(canonicalString: string): string {
  return createHash("sha256").update(canonicalString, "utf8").digest("hex");
}

function normalizePem(pem: string): string {
  const withLines = pem.includes("\\n") ? pem.replace(/\\n/g, "\n") : pem;
  return withLines.trim();
}

export function verifyWithAlgorithm(params: {
  canonicalString: string;
  assinaturaBase64: string;
  publicKeyPem: string;
  algorithm: string;
}): VerifySignatureResult {
  const { canonicalString, assinaturaBase64, publicKeyPem } = params;
  const algorithm = params.algorithm.toUpperCase().trim();

  const signature = Buffer.from(assinaturaBase64, "base64");
  const key = createPublicKey(normalizePem(publicKeyPem));
  const message = Buffer.from(canonicalString, "utf8");

  if (algorithm === "RSASSA_PSS_SHA_256") {
    const ok = verify("sha256", message, {
      key,
      padding: constants.RSA_PKCS1_PSS_PADDING,
      saltLength: constants.RSA_PSS_SALTLEN_DIGEST,
    }, signature);
    return { ok, algorithm, detail: "RSA-PSS SHA-256" };
  }

  if (algorithm === "RSASSA_PSS_SHA_384") {
    const ok = verify("sha384", message, {
      key,
      padding: constants.RSA_PKCS1_PSS_PADDING,
      saltLength: constants.RSA_PSS_SALTLEN_DIGEST,
    }, signature);
    return { ok, algorithm, detail: "RSA-PSS SHA-384" };
  }

  if (algorithm === "RSASSA_PSS_SHA_512") {
    const ok = verify("sha512", message, {
      key,
      padding: constants.RSA_PKCS1_PSS_PADDING,
      saltLength: constants.RSA_PSS_SALTLEN_DIGEST,
    }, signature);
    return { ok, algorithm, detail: "RSA-PSS SHA-512" };
  }

  if (algorithm === "RSASSA_PKCS1_V1_5_SHA_256") {
    const ok = verify("sha256", message, {
      key,
      padding: constants.RSA_PKCS1_PADDING,
    }, signature);
    return { ok, algorithm, detail: "RSA PKCS#1 v1.5 SHA-256" };
  }

  if (algorithm === "RSASSA_PKCS1_V1_5_SHA_384") {
    const ok = verify("sha384", message, {
      key,
      padding: constants.RSA_PKCS1_PADDING,
    }, signature);
    return { ok, algorithm, detail: "RSA PKCS#1 v1.5 SHA-384" };
  }

  if (algorithm === "RSASSA_PKCS1_V1_5_SHA_512") {
    const ok = verify("sha512", message, {
      key,
      padding: constants.RSA_PKCS1_PADDING,
    }, signature);
    return { ok, algorithm, detail: "RSA PKCS#1 v1.5 SHA-512" };
  }

  return {
    ok: false,
    algorithm,
    detail: `Algoritmo nao suportado pelo verificador externo: ${algorithm}`,
  };
}

export async function loadDocumentos(sql: postgres.Sql, input: {
  empresaId?: string;
  serieId?: string;
  documentoId?: string;
  limit: number;
}) {
  const { empresaId, serieId, documentoId, limit } = input;
  if (documentoId) {
    return sql<FiscalDocumentoRow[]>`
      select
        id, empresa_id, serie_id, numero, numero_formatado, status,
        hash_control, hash_anterior, assinatura_base64, canonical_string,
        key_version, created_at, system_entry
      from public.fiscal_documentos
      where id = ${documentoId}
      order by numero asc
      limit 1
    `;
  }

  if (!empresaId) {
    throw new Error("empresaId obrigatorio quando documentoId nao for informado.");
  }

  if (serieId) {
    return sql<FiscalDocumentoRow[]>`
      select
        id, empresa_id, serie_id, numero, numero_formatado, status,
        hash_control, hash_anterior, assinatura_base64, canonical_string,
        key_version, created_at, system_entry
      from public.fiscal_documentos
      where empresa_id = ${empresaId}
        and serie_id = ${serieId}
      order by numero asc
      limit ${limit}
    `;
  }

  return sql<FiscalDocumentoRow[]>`
    select
      id, empresa_id, serie_id, numero, numero_formatado, status,
      hash_control, hash_anterior, assinatura_base64, canonical_string,
      key_version, created_at, system_entry
    from public.fiscal_documentos
    where empresa_id = ${empresaId}
    order by serie_id asc, numero asc
    limit ${limit}
  `;
}

export async function loadChavePublica(sql: postgres.Sql, input: {
  empresaId: string;
  keyVersion: number;
}) {
  const rows = await sql<FiscalChaveRow[]>`
    select empresa_id, key_version, algorithm, public_key_pem, status
    from public.fiscal_chaves
    where empresa_id = ${input.empresaId}
      and key_version = ${input.keyVersion}
    order by updated_at desc
    limit 1
  `;

  return rows[0] ?? null;
}
