import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

type Tax =
  | { kind: "NORMAL_14"; ratePct: "14.0000" }
  | { kind: "REDUZIDA_5"; ratePct: "5.0000" }
  | { kind: "ISENTO"; ratePct: "0.0000"; exemptionCode: string; exemptionReason: string };

type ScenarioLine = {
  lineNo: number;
  productCode: string;
  description: string;
  quantity: string;
  unitPrice: string;
  lineDiscountPct?: string;
  tax: Tax;
};

type Scenario = {
  code: string;
  description: string;
  moeda: string;
  exchangeRateToAoa?: string;
  globalDiscountPct?: string;
  lines: ScenarioLine[];
};

type ValidateResponse = {
  ok: boolean;
  data?: {
    idempotent: boolean;
    snapshot: { id: string; created_at: string; payload_hash: string };
    klasse: { grandTotal: string; taxTotal: string };
    provider: { providerDocumentId: string; grandTotal: string; taxTotal: string; providerStatus: string };
  };
  error?: { code?: string; message?: string };
};

const scenarios: Scenario[] = [
  {
    code: "AGT_P06_DUAS_LINHAS_14_ISENTO",
    description: "Linha 14% + linha isenta Mxx",
    moeda: "AOA",
    lines: [
      { lineNo: 1, productCode: "SERV-14", description: "Servico tributado", quantity: "1.0000", unitPrice: "100.0000", tax: { kind: "NORMAL_14", ratePct: "14.0000" } },
      {
        lineNo: 2,
        productCode: "SERV-M01",
        description: "Servico isento M01",
        quantity: "1.0000",
        unitPrice: "50.0000",
        tax: { kind: "ISENTO", ratePct: "0.0000", exemptionCode: "M01", exemptionReason: "Operacao isenta" },
      },
    ],
  },
  {
    code: "AGT_P07_SETTLEMENT_100x055",
    description: "100 x 0.55 com desconto linha 8.8% + global",
    moeda: "AOA",
    globalDiscountPct: "1.5000",
    lines: [
      {
        lineNo: 1,
        productCode: "QTY100",
        description: "Cenario settlement",
        quantity: "100.0000",
        unitPrice: "0.5500",
        lineDiscountPct: "8.8000",
        tax: { kind: "NORMAL_14", ratePct: "14.0000" },
      },
    ],
  },
  {
    code: "AGT_P08_FX_USD",
    description: "Documento em moeda estrangeira com cambio",
    moeda: "USD",
    exchangeRateToAoa: "920.0000",
    lines: [
      { lineNo: 1, productCode: "FX-001", description: "Servico em USD", quantity: "1.0000", unitPrice: "10.0000", tax: { kind: "NORMAL_14", ratePct: "14.0000" } },
    ],
  },
  {
    code: "AGT_P09_CONSUMIDOR_FINAL",
    description: "Consumidor final (sem NIF) total pequeno",
    moeda: "AOA",
    lines: [
      { lineNo: 1, productCode: "CF-001", description: "Venda consumidor final", quantity: "1.0000", unitPrice: "49.0000", tax: { kind: "NORMAL_14", ratePct: "14.0000" } },
    ],
  },
  {
    code: "AGT_P11_GR_GT_MINIMO",
    description: "Cenario base para guias GR/GT (motor/oraculo)",
    moeda: "AOA",
    lines: [
      { lineNo: 1, productCode: "GRGT-001", description: "Movimento de bens", quantity: "2.0000", unitPrice: "30.0000", tax: { kind: "REDUZIDA_5", ratePct: "5.0000" } },
    ],
  },
  {
    code: "AGT_P14_FATURA_GLOBAL",
    description: "Fatura global consolidada",
    moeda: "AOA",
    lines: [
      { lineNo: 1, productCode: "FG-001", description: "Servico A", quantity: "1.0000", unitPrice: "250.0000", tax: { kind: "NORMAL_14", ratePct: "14.0000" } },
      { lineNo: 2, productCode: "FG-002", description: "Servico B", quantity: "1.0000", unitPrice: "125.0000", tax: { kind: "NORMAL_14", ratePct: "14.0000" } },
    ],
  },
];

const argv = yargs(hideBin(process.argv))
  .option("base-url", { type: "string", demandOption: true, describe: "Base URL KLASSE (ex: https://app.klasse.ao)" })
  .option("empresa-id", { type: "string", demandOption: true, describe: "UUID da empresa fiscal" })
  .option("cookie", { type: "string", describe: "Cookie de sessao autenticada para API KLASSE" })
  .option("auth-bearer", { type: "string", describe: "JWT bearer token para API KLASSE" })
  .option("escola-id", { type: "string", describe: "UUID escola (opcional, enviado no header x-escola-id)" })
  .option("out-dir", { type: "string", default: "agents/outputs/fiscal/agt", describe: "Diretorio de saida" })
  .check((args) => {
    if (!args.cookie && !args.authBearer) {
      throw new Error("Informe --cookie ou --auth-bearer.");
    }
    return true;
  })
  .strict()
  .help()
  .parseSync();

function timestampUtcCompact() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
}

async function executeScenario(s: Scenario) {
  const idempotencyKey = `agt:${s.code.toLowerCase()}:${Date.now()}`;
  const payload = {
    idempotencyKey,
    scenarioCode: s.code,
    empresaId: argv.empresaId,
    moeda: s.moeda,
    exchangeRateToAoa: s.exchangeRateToAoa,
    globalDiscountPct: s.globalDiscountPct,
    lines: s.lines,
  };

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (argv.cookie) headers.cookie = argv.cookie;
  if (argv.authBearer) headers.authorization = `Bearer ${argv.authBearer}`;

  if (argv.escolaId) headers["x-escola-id"] = argv.escolaId;

  const res = await fetch(`${argv.baseUrl.replace(/\/$/, "")}/api/fiscal/compliance/oracle-validate`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const json = (await res.json().catch(() => null)) as ValidateResponse | null;

  return {
    scenario: s,
    idempotencyKey,
    httpStatus: res.status,
    ok: Boolean(res.ok && json?.ok),
    response: json,
  };
}

function buildMarkdownReport(runTs: string, rows: Awaited<ReturnType<typeof executeScenario>>[]) {
  const pass = rows.filter((r) => r.ok).length;
  const fail = rows.length - pass;
  const status = fail === 0 ? "PASS" : "FAIL";

  const lines: string[] = [];
  lines.push("# AGT Oracle Validation Evidence");
  lines.push("");
  lines.push(`timestamp_utc: ${runTs}`);
  lines.push(`ambiente: external_oracle_validation`);
  lines.push(`empresa_id: ${argv.empresaId}`);
  lines.push(`total_scenarios: ${rows.length}`);
  lines.push(`status: ${status}`);
  lines.push("");
  lines.push("## Resumo");
  lines.push("");
  lines.push(`- pass: ${pass}`);
  lines.push(`- fail: ${fail}`);
  lines.push(`- regra divergencia: FAIL HARD quando != 0.0000`);
  lines.push("");
  lines.push("## Resultado por cenario");
  lines.push("");
  lines.push("| cenario | descricao | http | status | snapshot_id | provider_doc | total_klasse | total_oracle |");
  lines.push("|---|---|---:|---|---|---|---:|---:|");

  for (const row of rows) {
    const snapshotId = row.response?.data?.snapshot?.id ?? "n/a";
    const providerDoc = row.response?.data?.provider?.providerDocumentId ?? "n/a";
    const klasseTotal = row.response?.data?.klasse?.grandTotal ?? "n/a";
    const oracleTotal = row.response?.data?.provider?.grandTotal ?? "n/a";
    const statusText = row.ok ? "PASS" : `FAIL (${row.response?.error?.code ?? "UNKNOWN"})`;
    lines.push(
      `| ${row.scenario.code} | ${row.scenario.description} | ${row.httpStatus} | ${statusText} | ${snapshotId} | ${providerDoc} | ${klasseTotal} | ${oracleTotal} |`
    );
  }

  const failed = rows.filter((r) => !r.ok);
  if (failed.length > 0) {
    lines.push("");
    lines.push("## Falhas");
    lines.push("");
    for (const f of failed) {
      lines.push(`- ${f.scenario.code}: ${f.response?.error?.code ?? "UNKNOWN"} - ${f.response?.error?.message ?? "sem detalhe"}`);
    }
  }

  lines.push("");
  lines.push("## Conclusao");
  lines.push("");
  lines.push(
    status === "PASS"
      ? "Todos os cenarios validaram com divergencia 0.0000 entre KLASSE e oraculo externo."
      : "Existem divergencias/falhas. Certificacao AGT permanece NO-GO ate saneamento total."
  );

  return lines.join("\n");
}

async function main() {
  const runTs = timestampUtcCompact();
  mkdirSync(argv.outDir, { recursive: true });

  const results = [] as Awaited<ReturnType<typeof executeScenario>>[];
  for (const s of scenarios) {
    // Execucao sequencial para preservar rastreabilidade e facilitar troubleshooting.
    const result = await executeScenario(s);
    results.push(result);
  }

  const jsonPath = join(argv.outDir, `FISCAL_ORACLE_VALIDATION_${runTs}.json`);
  const mdPath = join(argv.outDir, `FISCAL_ORACLE_VALIDATION_${runTs}.md`);

  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        timestamp_utc: runTs,
        empresa_id: argv.empresaId,
        base_url: argv.baseUrl,
        scenarios: results,
      },
      null,
      2
    )
  );

  writeFileSync(mdPath, buildMarkdownReport(runTs, results));

  const hasFail = results.some((r) => !r.ok);
  console.log(`json: ${jsonPath}`);
  console.log(`md:   ${mdPath}`);
  if (hasFail) process.exitCode = 1;
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`ERROR build-agt-evidence: ${message}`);
  process.exitCode = 1;
});
