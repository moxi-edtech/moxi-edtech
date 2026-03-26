import "server-only";

import { KMSClient, SignCommand } from "@aws-sdk/client-kms";

const DEFAULT_ALGORITHM = "RSASSA_PSS_SHA_256" as const;

type SigningAlgorithm = typeof DEFAULT_ALGORITHM | "RSASSA_PKCS1_V1_5_SHA_256";

type SignOptions = {
  privateKeyRef?: string | null;
};

function parseKmsPrivateKeyRef(privateKeyRef: string) {
  const ref = privateKeyRef.trim();
  if (!ref) {
    return { region: null as string | null, keyId: null as string | null };
  }

  if (ref.startsWith("arn:aws:kms:")) {
    const parts = ref.split(":");
    const region = parts[3] || null;
    return { region, keyId: ref };
  }

  if (ref.startsWith("kms://")) {
    const raw = ref.slice("kms://".length).replace(/^\/+/, "");
    if (!raw) return { region: null, keyId: null };

    const slash = raw.indexOf("/");
    if (slash === -1) {
      return { region: null, keyId: raw };
    }

    const first = raw.slice(0, slash);
    const rest = raw.slice(slash + 1);
    const looksLikeRegion = /^[a-z]{2}-[a-z]+-\d+$/.test(first);
    if (looksLikeRegion && rest) {
      return { region: first, keyId: rest };
    }
    return { region: null, keyId: raw };
  }

  return { region: null, keyId: ref };
}

function getKmsConfig(options?: SignOptions) {
  const envRegion = process.env.AWS_REGION?.trim() || "";
  const envKeyId = process.env.AWS_KMS_KEY_ID?.trim() || "";
  const algorithm =
    (process.env.AWS_KMS_SIGNING_ALGORITHM?.trim() as SigningAlgorithm | undefined) ??
    DEFAULT_ALGORITHM;

  const parsed = options?.privateKeyRef
    ? parseKmsPrivateKeyRef(options.privateKeyRef)
    : { region: null, keyId: null };

  const region = parsed.region || envRegion;
  const keyId = parsed.keyId || envKeyId;

  if (!region || !keyId) {
    throw new Error(
      "KMS config missing: informe AWS_REGION e AWS_KMS_KEY_ID ou use private_key_ref válido."
    );
  }

  return { region, keyId, algorithm };
}

export async function signFiscalCanonicalString(canonicalString: string, options?: SignOptions) {
  const { region, keyId, algorithm } = getKmsConfig(options);
  const client = new KMSClient({ region });

  const command = new SignCommand({
    KeyId: keyId,
    Message: Buffer.from(canonicalString, "utf8"),
    MessageType: "RAW",
    SigningAlgorithm: algorithm,
  });

  const result = await client.send(command);

  if (!result.Signature) {
    throw new Error("KMS: assinatura vazia para documento fiscal.");
  }

  return Buffer.from(result.Signature).toString("base64");
}
