import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_AGT_SOFTWARE_KMS_KEY_REF,
  DEFAULT_KLASSE_AWS_ROLE_ARN,
  prepareVercelAwsWebIdentity,
  resolveKlasseAwsRoleArn,
} from "../../src/lib/fiscal/awsKmsRuntime";

const managedEnvKeys = [
  "VERCEL_OIDC_TOKEN",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "AWS_ROLE_ARN",
  "AWS_WEB_IDENTITY_TOKEN_FILE",
  "AWS_ROLE_SESSION_NAME",
] as const;

function snapshotEnv() {
  return Object.fromEntries(
    managedEnvKeys.map((key) => [key, process.env[key]])
  ) as Record<(typeof managedEnvKeys)[number], string | undefined>;
}

function restoreEnv(snapshot: ReturnType<typeof snapshotEnv>) {
  for (const key of managedEnvKeys) {
    const value = snapshot[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

test("KLASSE AWS runtime uses the provisioned production role and AGT software alias by default", () => {
  const snapshot = snapshotEnv();
  try {
    delete process.env.AWS_ROLE_ARN;
    assert.equal(
      DEFAULT_KLASSE_AWS_ROLE_ARN,
      "arn:aws:iam::050046455297:role/KLASSE-Vercel-FiscalSigner-Prod"
    );
    assert.equal(
      DEFAULT_AGT_SOFTWARE_KMS_KEY_REF,
      "kms://us-east-2/alias/klasse-agt-software-signing"
    );
    assert.equal(resolveKlasseAwsRoleArn(), DEFAULT_KLASSE_AWS_ROLE_ARN);
  } finally {
    restoreEnv(snapshot);
  }
});

test("KLASSE AWS runtime preserves the normal AWS credential chain outside Vercel", async () => {
  const snapshot = snapshotEnv();
  try {
    delete process.env.VERCEL_OIDC_TOKEN;
    const result = await prepareVercelAwsWebIdentity();
    assert.deepEqual(result, { mode: "default-chain" });
  } finally {
    restoreEnv(snapshot);
  }
});

test("KLASSE AWS runtime fails closed when Vercel OIDC and static AWS credentials coexist", async () => {
  const snapshot = snapshotEnv();
  try {
    process.env.VERCEL_OIDC_TOKEN = "test-only-oidc-token";
    process.env.AWS_ACCESS_KEY_ID = "AKIA_TEST_ONLY";
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_SESSION_TOKEN;

    await assert.rejects(
      prepareVercelAwsWebIdentity(),
      /AGT_JWS_STATIC_AWS_CREDENTIALS_FORBIDDEN_ON_VERCEL/
    );
  } finally {
    restoreEnv(snapshot);
  }
});
