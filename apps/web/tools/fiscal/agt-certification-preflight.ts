import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import {
  AGT_CERTIFICATION_REQUIRED_LOCAL_SERIES,
  AGT_CERTIFICATION_REQUIRED_TAX_PROFILES,
  requiredFeSeriesTypes,
  resolveP09Window,
} from "../../src/lib/fiscal/agtCertificationPlan";
import { supabaseServerRole } from "../../src/lib/supabaseServerRole";

const argv = yargs(hideBin(process.argv))
  .option("empresa-id", {
    type: "string",
    demandOption: true,
    describe: "UUID da empresa fiscal usada para o dossiê AGT",
  })
  .option("year", {
    type: "number",
    describe: "Ano das séries FE; por omissão usa o ano atual em Luanda",
  })
  .option("include-re", {
    type: "boolean",
    default: false,
    describe: "Exigir também série RE se RE permanecer no escopo declarado",
  })
  .option("require-p09-window", {
    type: "boolean",
    default: false,
    describe: "Falhar o preflight se a hora real em Luanda já for >= 10:00",
  })
  .strict()
  .help()
  .parseSync();

function currentLuandaYear() {
  return Number(
    new Intl.DateTimeFormat("en", {
      timeZone: "Africa/Luanda",
      year: "numeric",
    }).format(new Date())
  );
}

function kmsLike(value: unknown) {
  return (
    typeof value === "string" &&
    (value.startsWith("kms://") || value.startsWith("arn:aws:kms:"))
  );
}

async function main() {
  const admin = supabaseServerRole() as any;
  const year = argv.year ?? currentLuandaYear();
  const feTypes = requiredFeSeriesTypes({ includeRe: argv.includeRe });

  const [
    companyResult,
    keyResult,
    profileResult,
    localSeriesResult,
    feSeriesResult,
  ] = await Promise.all([
    admin
      .from("fiscal_empresas")
      .select("id,nome,nif,status,certificado_agt_numero")
      .eq("id", argv.empresaId)
      .maybeSingle(),
    admin
      .from("fiscal_chaves")
      .select("key_version,private_key_ref,status")
      .eq("empresa_id", argv.empresaId)
      .eq("status", "active")
      .order("key_version", { ascending: false })
      .limit(10),
    admin
      .from("fiscal_tax_profiles")
      .select("code,version,valid_from,valid_to")
      .in("code", [...AGT_CERTIFICATION_REQUIRED_TAX_PROFILES])
      .lte("valid_from", new Date().toISOString().slice(0, 10))
      .order("code", { ascending: true })
      .order("version", { ascending: false }),
    admin
      .from("fiscal_series")
      .select("tipo_documento,prefixo,origem_documento,agt_status,ativa,descontinuada_em")
      .eq("empresa_id", argv.empresaId)
      .in("tipo_documento", [...AGT_CERTIFICATION_REQUIRED_LOCAL_SERIES])
      .eq("agt_status", "legacy")
      .eq("ativa", true)
      .is("descontinuada_em", null),
    admin
      .from("fiscal_series")
      .select(
        "tipo_documento,prefixo,origem_documento,agt_status,agt_series_code,series_year,series_contingency_indicator,authorized_quantity,first_document_no,last_document_no,ativa,descontinuada_em"
      )
      .eq("empresa_id", argv.empresaId)
      .in("tipo_documento", feTypes)
      .eq("agt_status", "provisioned")
      .eq("series_year", year)
      .eq("series_contingency_indicator", "N")
      .eq("ativa", true)
      .is("descontinuada_em", null),
  ]);

  for (const [label, result] of [
    ["company", companyResult],
    ["keys", keyResult],
    ["taxProfiles", profileResult],
    ["localSeries", localSeriesResult],
    ["feSeries", feSeriesResult],
  ] as const) {
    if (result.error) {
      throw new Error(
        `AGT_CERTIFICATION_PREFLIGHT_${label.toUpperCase()}_FAILED:${result.error.message}`
      );
    }
  }

  const company = companyResult.data;
  const activeKmsKeys = (keyResult.data ?? []).filter(
    (row: { private_key_ref?: string | null }) => kmsLike(row.private_key_ref)
  );

  const today = new Date().toISOString().slice(0, 10);
  const activeProfileCodes = new Set(
    (profileResult.data ?? [])
      .filter(
        (row: { valid_to?: string | null }) =>
          !row.valid_to || row.valid_to >= today
      )
      .map((row: { code: string }) => row.code)
  );
  const localTypes = new Set(
    (localSeriesResult.data ?? []).map(
      (row: { tipo_documento: string }) => row.tipo_documento
    )
  );
  const provisionedFeTypes = new Set(
    (feSeriesResult.data ?? []).map(
      (row: { tipo_documento: string }) => row.tipo_documento
    )
  );

  const missingProfiles = AGT_CERTIFICATION_REQUIRED_TAX_PROFILES.filter(
    (code) => !activeProfileCodes.has(code)
  );
  const missingLocalSeries = AGT_CERTIFICATION_REQUIRED_LOCAL_SERIES.filter(
    (type) => !localTypes.has(type)
  );
  const missingFeSeries = feTypes.filter(
    (type) => !provisionedFeTypes.has(type)
  );

  const p09 = resolveP09Window();
  const blockers: string[] = [];

  if (!company) blockers.push("FISCAL_EMPRESA_NOT_FOUND");
  if (company && !String(company.nif ?? "").trim()) {
    blockers.push("FISCAL_EMPRESA_NIF_MISSING");
  }
  if (company && !String(company.certificado_agt_numero ?? "").trim()) {
    blockers.push("AGT_SOFTWARE_VALIDATION_NUMBER_BINDING_MISSING");
  }
  if (activeKmsKeys.length === 0) {
    blockers.push("FISCAL_ACTIVE_KMS_KEY_MISSING");
  }
  if (missingProfiles.length > 0) {
    blockers.push(`FISCAL_TAX_PROFILES_MISSING:${missingProfiles.join(",")}`);
  }
  if (missingLocalSeries.length > 0) {
    blockers.push(`FISCAL_LOCAL_SERIES_MISSING:${missingLocalSeries.join(",")}`);
  }
  if (missingFeSeries.length > 0) {
    blockers.push(`AGT_FE_SERIES_MISSING:${missingFeSeries.join(",")}`);
  }
  if (argv.requireP09Window && !p09.eligible) {
    blockers.push("AGT_P09_REAL_TIME_WINDOW_CLOSED");
  }

  const output = {
    ok: blockers.length === 0,
    empresa: company
      ? {
          id: company.id,
          nome: company.nome,
          nif: company.nif,
          status: company.status,
          certificateBound: Boolean(
            String(company.certificado_agt_numero ?? "").trim()
          ),
        }
      : null,
    year,
    activeTaxpayerKmsKeys: activeKmsKeys.length,
    requiredTaxProfiles: [...AGT_CERTIFICATION_REQUIRED_TAX_PROFILES],
    missingTaxProfiles: missingProfiles,
    requiredLocalSeries: [...AGT_CERTIFICATION_REQUIRED_LOCAL_SERIES],
    missingLocalSeries,
    requiredFeSeries: feTypes,
    provisionedFeSeries: [...provisionedFeTypes].sort(),
    missingFeSeries,
    p09Window: p09,
    requireP09Window: argv.requireP09Window,
    blockers,
    networkRequestSent: false,
    documentsEmitted: 0,
  };

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

  if (!output.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        networkRequestSent: false,
        documentsEmitted: 0,
      },
      null,
      2
    )}\n`
  );
  process.exitCode = 1;
});
