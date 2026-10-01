import assert from "node:assert/strict";
import test from "node:test";
import {
  createSign,
  generateKeyPairSync,
} from "node:crypto";

import { verifyAgtJwsRs256 } from "../../src/lib/fiscal/agtJwsVerify";

function base64Url(input: Buffer | string) {
  return (Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8"))
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signLocal(payload: Record<string, unknown>, privateKeyPem: string) {
  const header = { alg: "RS256", typ: "JWT" };
  const signingInput =
    `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  return `${signingInput}.${base64Url(signer.sign(privateKeyPem))}`;
}

function keys() {
  return generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
}

test("AGT JWS verifies a valid RS256 signature", () => {
  const pair = keys();
  const jws = signLocal(
    { productId: "KLASSE", softwareValidationNumber: "123/AGT/2026" },
    pair.privateKey
  );
  assert.deepEqual(verifyAgtJwsRs256(jws, pair.publicKey), {
    ok: true,
    reason: null,
  });
});

test("AGT JWS rejects tampered payload", () => {
  const pair = keys();
  const jws = signLocal({ amount: 100 }, pair.privateKey);
  const parts = jws.split(".");
  parts[1] = base64Url(JSON.stringify({ amount: 101 }));
  assert.deepEqual(verifyAgtJwsRs256(parts.join("."), pair.publicKey), {
    ok: false,
    reason: "AGT_JWS_SIGNATURE_INVALID",
  });
});

test("AGT JWS rejects signature verified with a different key", () => {
  const signer = keys();
  const verifier = keys();
  const jws = signLocal({ documentNo: "FT TEST/1" }, signer.privateKey);
  assert.deepEqual(verifyAgtJwsRs256(jws, verifier.publicKey), {
    ok: false,
    reason: "AGT_JWS_SIGNATURE_INVALID",
  });
});

test("AGT JWS refuses a retired or revoked key before cryptographic verification", () => {
  const pair = keys();
  const jws = signLocal({ documentNo: "FT TEST/1" }, pair.privateKey);
  assert.deepEqual(verifyAgtJwsRs256(jws, pair.publicKey, "retired"), {
    ok: false,
    reason: "AGT_JWS_KEY_NOT_ACTIVE",
  });
  assert.deepEqual(verifyAgtJwsRs256(jws, pair.publicKey, "revoked"), {
    ok: false,
    reason: "AGT_JWS_KEY_NOT_ACTIVE",
  });
});
