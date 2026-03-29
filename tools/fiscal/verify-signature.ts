import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import {
  computeHashControl,
  createSqlClient,
  loadChavePublica,
  loadDocumentos,
  resolveDbUrl,
  verifyWithAlgorithm,
} from "./_common";

type SignatureResultado = {
  documento_id: string;
  numero_formatado: string;
  status_documento: string;
  key_version: number;
  algorithm: string | null;
  canonical_ok: boolean;
  signature_persisted: boolean;
  signature_ok: boolean;
  blocker: boolean;
  detalhe: string | null;
};

const argv = yargs(hideBin(process.argv))
  .option("db-url", { type: "string", describe: "Connection string Postgres" })
  .option("empresa-id", { type: "string", describe: "UUID da empresa fiscal" })
  .option("serie-id", { type: "string", describe: "UUID da serie fiscal" })
  .option("documento-id", { type: "string", describe: "UUID do documento fiscal" })
  .option("limit", { type: "number", default: 200, describe: "Maximo de documentos" })
  .option("algorithm", {
    type: "string",
    describe: "Override do algoritmo (ex: RSASSA_PSS_SHA_256)",
  })
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

    const resultados: SignatureResultado[] = [];
    for (const doc of docs) {
      const canonical = doc.canonical_string?.trim() ?? "";
      if (!canonical) {
        resultados.push({
          documento_id: doc.id,
          numero_formatado: doc.numero_formatado,
          status_documento: doc.status,
          key_version: doc.key_version,
          algorithm: null,
          canonical_ok: false,
          signature_persisted: Boolean(doc.assinatura_base64),
          signature_ok: false,
          blocker: true,
          detalhe: "canonical_string ausente. Bloqueia verificacao externa da assinatura.",
        });
        continue;
      }

      const recomputedHash = computeHashControl(canonical);
      if (recomputedHash !== doc.hash_control) {
        resultados.push({
          documento_id: doc.id,
          numero_formatado: doc.numero_formatado,
          status_documento: doc.status,
          key_version: doc.key_version,
          algorithm: null,
          canonical_ok: false,
          signature_persisted: Boolean(doc.assinatura_base64),
          signature_ok: false,
          blocker: true,
          detalhe: "hash_control divergente do canonical_string. Verificacao de assinatura invalida.",
        });
        continue;
      }

      if (!doc.assinatura_base64 || doc.assinatura_base64.trim().length === 0) {
        resultados.push({
          documento_id: doc.id,
          numero_formatado: doc.numero_formatado,
          status_documento: doc.status,
          key_version: doc.key_version,
          algorithm: null,
          canonical_ok: true,
          signature_persisted: false,
          signature_ok: false,
          blocker: true,
          detalhe: "assinatura_base64 nao persistida. BLOQUEADOR para certificacao.",
        });
        continue;
      }

      const chave = await loadChavePublica(sql, {
        empresaId: doc.empresa_id,
        keyVersion: doc.key_version,
      });

      if (!chave) {
        resultados.push({
          documento_id: doc.id,
          numero_formatado: doc.numero_formatado,
          status_documento: doc.status,
          key_version: doc.key_version,
          algorithm: null,
          canonical_ok: true,
          signature_persisted: true,
          signature_ok: false,
          blocker: true,
          detalhe: `chave publica nao encontrada para key_version=${doc.key_version}.`,
        });
        continue;
      }

      const algorithm = (argv.algorithm?.trim() || chave.algorithm || "").toUpperCase();
      const signature = verifyWithAlgorithm({
        canonicalString: canonical,
        assinaturaBase64: doc.assinatura_base64,
        publicKeyPem: chave.public_key_pem,
        algorithm,
      });

      resultados.push({
        documento_id: doc.id,
        numero_formatado: doc.numero_formatado,
        status_documento: doc.status,
        key_version: doc.key_version,
        algorithm,
        canonical_ok: true,
        signature_persisted: true,
        signature_ok: signature.ok,
        blocker: !signature.ok,
        detalhe: signature.ok ? null : signature.detail,
      });
    }

    const total = resultados.length;
    const ok = resultados.filter((r) => r.signature_ok).length;
    const fail = total - ok;
    const blockers = resultados.filter((r) => r.blocker).length;
    const missingSignature = resultados.filter((r) => !r.signature_persisted).length;

    const summary = {
      tool: "verify-signature",
      total_documentos: total,
      assinatura_ok: ok,
      assinatura_fail: fail,
      blockers,
      signature_nao_persistida: missingSignature,
      status: fail === 0 ? "PASS" : "FAIL",
    };

    if (argv.json) {
      console.log(JSON.stringify({ summary, resultados }, null, 2));
      return;
    }

    console.log("# Fiscal Signature Verification");
    console.log(`status: ${summary.status}`);
    console.log(`documentos: ${total}`);
    console.log(`assinatura_ok: ${ok}`);
    console.log(`assinatura_fail: ${fail}`);
    console.log(`signature_nao_persistida: ${missingSignature}`);
    console.log(`blockers: ${blockers}`);
    console.log("");

    for (const r of resultados) {
      const flag = r.signature_ok ? "OK" : "FAIL";
      console.log(
        `${flag} | ${r.numero_formatado} | doc=${r.documento_id} | key_v=${r.key_version} | status=${r.status_documento}`
      );
      if (!r.signature_ok) {
        console.log(`  detalhe: ${r.detalhe ?? "falha desconhecida"}`);
      }
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`ERROR verify-signature: ${message}`);
  process.exitCode = 1;
});
