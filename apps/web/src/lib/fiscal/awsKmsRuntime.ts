import "server-only";

import { randomUUID } from "node:crypto";
import { rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const DEFAULT_KLASSE_AWS_ROLE_ARN =
  "arn:aws:iam::050046455297:role/KLASSE-Vercel-FiscalSigner-Prod";

export const DEFAULT_AGT_SOFTWARE_KMS_KEY_REF =
  "kms://us-east-2/alias/klasse-agt-software-signing";

const VERCEL_OIDC_TOKEN_FILE = join(
  tmpdir(),
  "klasse-vercel-oidc-token"
);

function hasStaticAwsCredentials() {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID?.trim() ||
      process.env.AWS_SECRET_ACCESS_KEY?.trim() ||
      process.env.AWS_SESSION_TOKEN?.trim()
  );
}

export function resolveKlasseAwsRoleArn() {
  return process.env.AWS_ROLE_ARN?.trim() || DEFAULT_KLASSE_AWS_ROLE_ARN;
}

export async function prepareVercelAwsWebIdentity() {
  const oidcToken = process.env.VERCEL_OIDC_TOKEN?.trim();
  if (!oidcToken) {
    return { mode: "default-chain" as const };
  }

  if (hasStaticAwsCredentials()) {
    throw new Error("AGT_JWS_STATIC_AWS_CREDENTIALS_FORBIDDEN_ON_VERCEL");
  }

  const roleArn = resolveKlasseAwsRoleArn();
  if (!roleArn) {
    throw new Error("AGT_JWS_AWS_ROLE_ARN_MISSING");
  }

  const tempTokenFile =
    `${VERCEL_OIDC_TOKEN_FILE}.${process.pid}.${randomUUID()}`;

  await writeFile(tempTokenFile, oidcToken, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(tempTokenFile, VERCEL_OIDC_TOKEN_FILE);

  process.env.AWS_ROLE_ARN = roleArn;
  process.env.AWS_WEB_IDENTITY_TOKEN_FILE = VERCEL_OIDC_TOKEN_FILE;
  process.env.AWS_ROLE_SESSION_NAME =
    process.env.AWS_ROLE_SESSION_NAME?.trim() || "klasse-vercel-fiscal";

  return {
    mode: "vercel-oidc" as const,
    roleArn,
    tokenFile: VERCEL_OIDC_TOKEN_FILE,
  };
}
