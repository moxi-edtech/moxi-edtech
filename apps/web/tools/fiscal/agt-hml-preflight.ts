import { resolveAgtConfig } from "../../src/lib/fiscal/agtConfig";
import { assertAgtHomologationEnvironment } from "../../src/lib/fiscal/agtContract";
import { supabaseServerRole } from "../../src/lib/supabaseServerRole";

function isKmsReference(value: string) {
  const ref = value.trim();
  return (
    ref.startsWith("arn:aws:kms:") ||
    ref.startsWith("kms://") ||
    (!!process.env.AWS_REGION?.trim() &&
      !ref.includes("BEGIN ") &&
      !ref.includes("\n"))
  );
}

async function main() {
  const cfg = resolveAgtConfig();

  assertAgtHomologationEnvironment({
    environment: cfg.environment,
    baseUrl: cfg.baseUrl,
  });

  if (!isKmsReference(cfg.softwarePrivateKeyRef)) {
    throw new Error("AGT_HML_PREFLIGHT_SOFTWARE_KEY_NOT_KMS");
  }

  const admin = supabaseServerRole() as any;

  const { data: companies, error: companiesError } = await admin
    .from("fiscal_empresas")
    .select("id")
    .eq("certificado_agt_numero", cfg.softwareValidationNumber);

  if (companiesError) {
    throw new Error(
      `AGT_HML_PREFLIGHT_COMPANY_LOOKUP_FAILED:${companiesError.message}`,
    );
  }

  const companyIds = (companies ?? [])
    .map((row: { id?: string | null }) => row.id ?? null)
    .filter((value: string | null): value is string => Boolean(value));

  if (companyIds.length === 0) {
    throw new Error("AGT_HML_PREFLIGHT_CERTIFICATE_BINDING_MISSING");
  }

  const { data: keys, error: keysError } = await admin
    .from("fiscal_chaves")
    .select("empresa_id,private_key_ref,key_version,status")
    .in("empresa_id", companyIds)
    .eq("status", "active");

  if (keysError) {
    throw new Error(
      `AGT_HML_PREFLIGHT_TAXPAYER_KEY_LOOKUP_FAILED:${keysError.message}`,
    );
  }

  const activeKmsKeys = (keys ?? []).filter(
    (row: { private_key_ref?: string | null }) =>
      typeof row.private_key_ref === "string" &&
      isKmsReference(row.private_key_ref),
  );

  if (activeKmsKeys.length === 0) {
    throw new Error("AGT_HML_PREFLIGHT_ACTIVE_TAXPAYER_KMS_KEY_MISSING");
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        environment: cfg.environment,
        host: new URL(cfg.baseUrl).hostname,
        softwareInfoMode: cfg.softwareInfoMode,
        certificateBoundCompanies: companyIds.length,
        activeTaxpayerKmsKeys: activeKmsKeys.length,
        softwareKmsConfigured: true,
        networkRequestSent: false,
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(
    `${JSON.stringify(
      {
        ok: false,
        error: message,
        networkRequestSent: false,
      },
      null,
      2,
    )}\n`,
  );
  process.exitCode = 1;
});
