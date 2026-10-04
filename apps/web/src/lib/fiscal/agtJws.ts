import "server-only";

import { KMSClient, SignCommand } from "@aws-sdk/client-kms";
import { prepareVercelAwsWebIdentity } from "./awsKmsRuntime";

type JwsSignOptions = {
  privateKeyRef: string;
};

function parseKmsPrivateKeyRef(privateKeyRef: string) {
  const ref = privateKeyRef.trim();
  if (!ref) throw new Error("AGT_JWS_KEY_REF_MISSING");

  if (ref.startsWith("arn:aws:kms:")) {
    const parts = ref.split(":");
    const region = parts[3] || "";
    if (!region) throw new Error("AGT_JWS_KMS_REGION_MISSING");
    return { region, keyId: ref };
  }

  if (ref.startsWith("kms://")) {
    const raw = ref.slice("kms://".length).replace(/^\/+/, "");
    const slash = raw.indexOf("/");
    if (slash > 0) {
      const first = raw.slice(0, slash);
      const rest = raw.slice(slash + 1);
      if (/^[a-z]{2}-[a-z]+-\d+$/.test(first) && rest) {
        return { region: first, keyId: rest };
      }
    }

    const region = process.env.AWS_REGION?.trim() || "";
    if (!region || !raw) throw new Error("AGT_JWS_KMS_CONFIG_MISSING");
    return { region, keyId: raw };
  }

  const region = process.env.AWS_REGION?.trim() || "";
  if (!region) throw new Error("AGT_JWS_KMS_REGION_MISSING");
  return { region, keyId: ref };
}

function base64Url(input: Buffer | string) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return buffer
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function canonicalJson(payload: Record<string, unknown>) {
  return JSON.stringify(payload);
}

export async function signAgtJwsRs256(
  payload: Record<string, unknown>,
  options: JwsSignOptions
) {
  const { region, keyId } = parseKmsPrivateKeyRef(options.privateKeyRef);
  const configuredTyp = (process.env.AGT_JWS_TYP?.trim().toUpperCase() || "JWT");
  if (configuredTyp !== "JWT" && configuredTyp !== "JOSE") {
    throw new Error("AGT_JWS_TYP_INVALID");
  }
  const header = { alg: "RS256", typ: configuredTyp };
  const signingInput = `${base64Url(canonicalJson(header))}.${base64Url(canonicalJson(payload))}`;

  await prepareVercelAwsWebIdentity();
  const kms = new KMSClient({ region });
  const result = await kms.send(
    new SignCommand({
      KeyId: keyId,
      Message: Buffer.from(signingInput, "utf8"),
      MessageType: "RAW",
      SigningAlgorithm: "RSASSA_PKCS1_V1_5_SHA_256",
    })
  );

  if (!result.Signature) {
    throw new Error("AGT_JWS_SIGNATURE_EMPTY");
  }

  return `${signingInput}.${base64Url(Buffer.from(result.Signature))}`;
}
