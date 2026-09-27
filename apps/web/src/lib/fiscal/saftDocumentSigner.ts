import "server-only";

import {
  constants,
  createPrivateKey,
  createPublicKey,
  createHash,
  sign,
} from "node:crypto";

type SaftSigningConfig = {
  privateKeyPem: string;
  hashControlVersion: number;
};

function resolvePrivateKeyPem() {
  const direct = process.env.SAFT_PRIVATE_KEY_PEM?.trim();
  if (direct) return direct.replace(/\\n/g, "\n");

  const encoded = process.env.SAFT_PRIVATE_KEY_PEM_B64?.trim();
  if (encoded) {
    return Buffer.from(encoded, "base64").toString("utf8").trim();
  }

  throw new Error(
    "SAFT_SIGNING_CONFIG_MISSING: configure SAFT_PRIVATE_KEY_PEM ou SAFT_PRIVATE_KEY_PEM_B64."
  );
}

function resolveHashControlVersion() {
  const raw = (process.env.SAFT_HASH_CONTROL_VERSION ?? "1").trim();
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      "SAFT_HASH_CONTROL_VERSION inválido: informe inteiro sequencial positivo."
    );
  }
  return value;
}

function getConfig(): SaftSigningConfig {
  return {
    privateKeyPem: resolvePrivateKeyPem(),
    hashControlVersion: resolveHashControlVersion(),
  };
}

function validatePrivateKey(privateKeyPem: string) {
  const key = createPrivateKey(privateKeyPem);
  if (key.asymmetricKeyType !== "rsa") {
    throw new Error("SAFT_SIGNING_KEY_INVALID: a chave SAF-T deve ser RSA.");
  }

  const modulusLength = key.asymmetricKeyDetails?.modulusLength;
  if (modulusLength !== 1024) {
    throw new Error(
      `SAFT_SIGNING_KEY_INVALID: SAF-T exige chave RSA 1024 bits; configurada=${modulusLength ?? "desconhecida"}.`
    );
  }

  return key;
}

export function getSaftSigningReadiness() {
  const { privateKeyPem, hashControlVersion } = getConfig();
  const privateKey = validatePrivateKey(privateKeyPem);
  const publicKeyPem = createPublicKey(privateKey)
    .export({ format: "pem", type: "spki" })
    .toString();

  return {
    ready: true as const,
    algorithm: "RSA-1024-SHA1" as const,
    hashControlVersion,
    publicKeyFingerprintSha256: createHash("sha256")
      .update(publicKeyPem, "utf8")
      .digest("hex"),
  };
}

export function signSaftCanonicalString(canonicalString: string) {
  if (!canonicalString || /[\r\n]/.test(canonicalString)) {
    throw new Error(
      "SAFT_CANONICAL_INVALID: mensagem vazia ou contendo quebra de linha."
    );
  }

  const { privateKeyPem, hashControlVersion } = getConfig();
  const privateKey = validatePrivateKey(privateKeyPem);
  const signature = sign("RSA-SHA1", Buffer.from(canonicalString, "utf8"), {
    key: privateKey,
    padding: constants.RSA_PKCS1_PADDING,
  });
  const hash = signature.toString("base64");

  if (hash.length !== 172) {
    throw new Error(
      `SAFT_HASH_LENGTH_INVALID: assinatura SAF-T deve ter 172 caracteres; obtido=${hash.length}.`
    );
  }

  return {
    hash,
    hashControlVersion,
  };
}
