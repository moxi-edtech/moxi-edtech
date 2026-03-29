import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import {
  computeHashControl,
  createSqlClient,
  loadDocumentos,
  resolveDbUrl,
  type FiscalDocumentoRow,
} from "./_common";

type Resultado = {
  documento_id: string;
  numero_formatado: string;
  serie_id: string;
  status: string;
  canonical_present: boolean;
  hash_esperado: string | null;
  hash_atual: string;
  hash_ok: boolean;
  detalhe: string | null;
};

const argv = yargs(hideBin(process.argv))
  .option("db-url", { type: "string", describe: "Connection string Postgres" })
  .option("empresa-id", { type: "string", describe: "UUID da empresa fiscal" })
  .option("serie-id", { type: "string", describe: "UUID da serie fiscal" })
  .option("documento-id", { type: "string", describe: "UUID do documento fiscal" })
  .option("limit", { type: "number", default: 500, describe: "Maximo de documentos" })
  .option("json", { type: "boolean", default: false, describe: "Saida JSON" })
  .check((args) => {
    if (!args.documentoId && !args.empresaId) {
      throw new Error("Informe --documento-id ou --empresa-id.");
    }
    return true;
  })
  .strict()
  .help()
  .parseSync();

function avaliarDocumento(doc: FiscalDocumentoRow): Resultado {
  if (!doc.canonical_string || doc.canonical_string.trim().length === 0) {
    return {
      documento_id: doc.id,
      numero_formatado: doc.numero_formatado,
      serie_id: doc.serie_id,
      status: doc.status,
      canonical_present: false,
      hash_esperado: null,
      hash_atual: doc.hash_control,
      hash_ok: false,
      detalhe: "canonical_string ausente; nao e possivel recomputar hash_control.",
    };
  }

  const esperado = computeHashControl(doc.canonical_string);
  return {
    documento_id: doc.id,
    numero_formatado: doc.numero_formatado,
    serie_id: doc.serie_id,
    status: doc.status,
    canonical_present: true,
    hash_esperado: esperado,
    hash_atual: doc.hash_control,
    hash_ok: esperado === doc.hash_control,
    detalhe: esperado === doc.hash_control ? null : "hash_control divergente do SHA-256 do canonical_string.",
  };
}

async function main() {
  const dbUrl = resolveDbUrl(argv.dbUrl);
  const sql = createSqlClient(dbUrl);

  try {
    const docs = await loadDocumentos(sql, {
      empresaId: argv.empresaId,
      serieId: argv.serieId,
      documentoId: argv.documentoId,
      limit: Math.max(1, Math.trunc(argv.limit)),
    });

    const resultados = docs.map(avaliarDocumento);
    const total = resultados.length;
    const ok = resultados.filter((r) => r.hash_ok).length;
    const fail = total - ok;
    const blockers = resultados.filter((r) => !r.canonical_present).length;

    const summary = {
      tool: "verify-hash-control",
      total_documentos: total,
      hash_ok: ok,
      hash_fail: fail,
      canonical_ausente: blockers,
      status: fail === 0 ? "PASS" : "FAIL",
    };

    if (argv.json) {
      console.log(JSON.stringify({ summary, resultados }, null, 2));
      return;
    }

    console.log("# Fiscal Hash Control Verification");
    console.log(`status: ${summary.status}`);
    console.log(`documentos: ${total}`);
    console.log(`hash_ok: ${ok}`);
    console.log(`hash_fail: ${fail}`);
    console.log(`canonical_ausente: ${blockers}`);
    console.log("");

    for (const r of resultados) {
      const flag = r.hash_ok ? "OK" : "FAIL";
      console.log(
        `${flag} | ${r.numero_formatado} | doc=${r.documento_id} | serie=${r.serie_id} | status=${r.status}`
      );
      if (!r.hash_ok) {
        console.log(`  hash_atual:    ${r.hash_atual}`);
        console.log(`  hash_esperado: ${r.hash_esperado ?? "n/a"}`);
        if (r.detalhe) console.log(`  detalhe: ${r.detalhe}`);
      }
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`ERROR verify-hash-control: ${message}`);
  process.exitCode = 1;
});
