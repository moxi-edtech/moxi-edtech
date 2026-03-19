import "server-only";

import { KMSClient, SignCommand } from "@aws-sdk/client-kms";

const DEFAULT_ALGORITHM = "RSASSA_PSS_SHA_256" as const;

type SigningAlgorithm = typeof DEFAULT_ALGORITHM | "RSASSA_PKCS1_V1_5_SHA_256";

function getKmsConfig() {
  const region = process.env.AWS_REGION?.trim();
  const keyId = process.env.AWS_KMS_KEY_ID?.trim();
  const algorithm =
    (process.env.AWS_KMS_SIGNING_ALGORITHM?.trim() as SigningAlgorithm | undefined) ??
    DEFAULT_ALGORITHM;

  if (!region || !keyId) {
    throw new Error("KMS config missing: AWS_REGION e AWS_KMS_KEY_ID são obrigatórios.");
  }

  return { region, keyId, algorithm };
}

export async function signFiscalCanonicalString(canonicalString: string) {
  const { region, keyId, algorithm } = getKmsConfig();
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
