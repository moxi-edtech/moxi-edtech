import "server-only";

import { KMSClient, SignCommand } from "@aws-sdk/client-kms";

const DEFAULT_ALGORITHM = "RSASSA_PSS_SHA_256" as const;

type SigningAlgorithm = typeof DEFAULT_ALGORITHM | "RSASSA_PKCS1_V1_5_SHA_256";

export type FiscalKmsProbeStatus = "not_run" | "ok" | "denied" | "error";

export type FiscalKmsReadiness = {
  configured: boolean;
  region: string | null;
  keyIdMasked: string | null;
  algorithm: SigningAlgorithm;
  missing: string[];
  probeStatus: FiscalKmsProbeStatus;
  probeMessage: string | null;
};

function parseAlgorithm(value: string | undefined): SigningAlgorithm {
  if (value === "RSASSA_PKCS1_V1_5_SHA_256") {
    return value;
  }
  return DEFAULT_ALGORITHM;
}

function maskKeyId(keyId: string): string {
  if (keyId.length <= 12) return keyId;
  return `${keyId.slice(0, 8)}...${keyId.slice(-4)}`;
}

function getConfig() {
  const region = process.env.AWS_REGION?.trim() || "";
  const keyId = process.env.AWS_KMS_KEY_ID?.trim() || "";
  const algorithm = parseAlgorithm(process.env.AWS_KMS_SIGNING_ALGORITHM?.trim());

  const missing: string[] = [];
  if (!region) missing.push("AWS_REGION");
  if (!keyId) missing.push("AWS_KMS_KEY_ID");

  return {
    region,
    keyId,
    algorithm,
    missing,
    configured: missing.length === 0,
  };
}

function classifyProbeError(error: unknown): { status: FiscalKmsProbeStatus; message: string } {
  if (error instanceof Error) {
    const name = error.name || "";
    const message = error.message || "Falha desconhecida na verificação KMS.";
    const text = `${name} ${message}`.toLowerCase();
    if (
      text.includes("accessdenied") ||
      text.includes("not authorized") ||
      text.includes("unauthorized")
    ) {
      return {
        status: "denied",
        message: "IAM sem permissão kms:Sign para a chave configurada.",
      };
    }
    return { status: "error", message };
  }
  return { status: "error", message: "Falha desconhecida na verificação KMS." };
}

async function runSignProbe(region: string, keyId: string, algorithm: SigningAlgorithm) {
  const client = new KMSClient({ region });
  const command = new SignCommand({
    KeyId: keyId,
    Message: Buffer.from("klasse-fiscal-kms-probe", "utf8"),
    MessageType: "RAW",
    SigningAlgorithm: algorithm,
  });
  const result = await client.send(command);
  if (!result.Signature) {
    throw new Error("KMS retornou resposta sem assinatura no probe.");
  }
}

export async function getFiscalKmsReadiness(options?: { probeSign?: boolean }) {
  const cfg = getConfig();
  const base: FiscalKmsReadiness = {
    configured: cfg.configured,
    region: cfg.region || null,
    keyIdMasked: cfg.keyId ? maskKeyId(cfg.keyId) : null,
    algorithm: cfg.algorithm,
    missing: cfg.missing,
    probeStatus: "not_run",
    probeMessage: null,
  };

  if (!options?.probeSign || !cfg.configured) {
    return base;
  }

  try {
    await runSignProbe(cfg.region, cfg.keyId, cfg.algorithm);
    return {
      ...base,
      probeStatus: "ok",
      probeMessage: "Assinatura KMS executada com sucesso.",
    } satisfies FiscalKmsReadiness;
  } catch (error) {
    const classified = classifyProbeError(error);
    return {
      ...base,
      probeStatus: classified.status,
      probeMessage: classified.message,
    } satisfies FiscalKmsReadiness;
  }
}

