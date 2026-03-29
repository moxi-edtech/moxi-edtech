import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import {
  computeHashControl,
  createSqlClient,
  loadChavePublica,
  resolveDbUrl,
  verifyWithAlgorithm,
  type FiscalDocumentoRow,
} from "./_common";

type EventoRow = {
  documento_id: string;
  tipo_evento: string;
  payload: Record<string, unknown> | null;
  created_at: string;
};

type SerieIssue = {
  serie_id: string;
  numero_formatado: string;
  documento_id: string;
  code:
    | "HASH_DIVERGENTE"
    | "CHAIN_DIVERGENTE"
    | "ASSINATURA_INVALIDA"
    | "ASSINATURA_AUSENTE"
    | "CHAVE_NAO_ENCONTRADA"
    | "EMITIDO_EVENTO_AUSENTE"
    | "EMITIDO_EVENTO_HASH_DIVERGENTE";
  detail: string;
  blocker: boolean;
};

const argv = yargs(hideBin(process.argv))
  .option("db-url", { type: "string", describe: "Connection string Postgres" })
  .option("empresa-id", { type: "string", demandOption: true, describe: "UUID da empresa fiscal" })
  .option("serie-id", { type: "string", describe: "UUID da serie fiscal (opcional)" })
  .option("date-from", { type: "string", describe: "YYYY-MM-DD (opcional)" })
  .option("date-to", { type: "string", describe: "YYYY-MM-DD (opcional)" })
  .option("limit", { type: "number", default: 5000, describe: "Maximo de documentos" })
  .option("algorithm", { type: "string", describe: "Override de algoritmo de assinatura" })
  .option("json", { type: "boolean", default: false, describe: "Saida JSON" })
  .strict()
  .help()
  .parseSync();

async function loadDocs(sql: ReturnType<typeof createSqlClient>) {
  const limit = Math.max(1, Math.trunc(argv.limit));
  const empresaId = argv.empresaId;
  const serieId = argv.serieId?.trim();
  const dateFrom = argv.dateFrom?.trim();
  const dateTo = argv.dateTo?.trim();

  if (serieId && dateFrom && dateTo) {
    return sql<FiscalDocumentoRow[]>`
      select
        id, empresa_id, serie_id, numero, numero_formatado, status,
        hash_control, hash_anterior, assinatura_base64, canonical_string,
        key_version, created_at, system_entry
      from public.fiscal_documentos
      where empresa_id = ${empresaId}
        and serie_id = ${serieId}
        and invoice_date between ${dateFrom} and ${dateTo}
      order by serie_id asc, numero asc
      limit ${limit}
    `;
  }

  if (serieId) {
    return sql<FiscalDocumentoRow[]>`
      select
        id, empresa_id, serie_id, numero, numero_formatado, status,
        hash_control, hash_anterior, assinatura_base64, canonical_string,
        key_version, created_at, system_entry
      from public.fiscal_documentos
      where empresa_id = ${empresaId}
        and serie_id = ${serieId}
      order by serie_id asc, numero asc
      limit ${limit}
    `;
  }

  if (dateFrom && dateTo) {
    return sql<FiscalDocumentoRow[]>`
      select
        id, empresa_id, serie_id, numero, numero_formatado, status,
        hash_control, hash_anterior, assinatura_base64, canonical_string,
        key_version, created_at, system_entry
      from public.fiscal_documentos
      where empresa_id = ${empresaId}
        and invoice_date between ${dateFrom} and ${dateTo}
      order by serie_id asc, numero asc
      limit ${limit}
    `;
  }

  return sql<FiscalDocumentoRow[]>`
    select
      id, empresa_id, serie_id, numero, numero_formatado, status,
      hash_control, hash_anterior, assinatura_base64, canonical_string,
      key_version, created_at, system_entry
    from public.fiscal_documentos
    where empresa_id = ${empresaId}
    order by serie_id asc, numero asc
    limit ${limit}
  `;
}

async function loadEventosEmitido(sql: ReturnType<typeof createSqlClient>, documentoIds: string[]) {
  if (documentoIds.length === 0) return [] as EventoRow[];

  return sql<EventoRow[]>`
    select documento_id, tipo_evento, payload, created_at
    from public.fiscal_documentos_eventos
    where documento_id = any(${documentoIds}::uuid[])
      and tipo_evento = 'EMITIDO'
    order by created_at asc
  `;
}

async function main() {
  const dbUrl = resolveDbUrl(argv.dbUrl);
  const sql = createSqlClient(dbUrl);

  try {
    const docs = await loadDocs(sql);
    const eventos = await loadEventosEmitido(sql, docs.map((d) => d.id));
    const eventosPorDocumento = new Map<string, EventoRow[]>();
    for (const e of eventos) {
      const current = eventosPorDocumento.get(e.documento_id) ?? [];
      current.push(e);
      eventosPorDocumento.set(e.documento_id, current);
    }

    const issues: SerieIssue[] = [];
    const chavesCache = new Map<string, { algorithm: string; public_key_pem: string } | null>();
    const lastHashBySerie = new Map<string, string | null>();

    for (const doc of docs) {
      const canonical = doc.canonical_string?.trim() ?? "";
      if (!canonical) {
        issues.push({
          serie_id: doc.serie_id,
          numero_formatado: doc.numero_formatado,
          documento_id: doc.id,
          code: "HASH_DIVERGENTE",
          detail: "canonical_string ausente.",
          blocker: true,
        });
      } else {
        const recalculated = computeHashControl(canonical);
        if (recalculated !== doc.hash_control) {
          issues.push({
            serie_id: doc.serie_id,
            numero_formatado: doc.numero_formatado,
            documento_id: doc.id,
            code: "HASH_DIVERGENTE",
            detail: "hash_control divergente do SHA-256(canonical_string).",
            blocker: true,
          });
        }
      }

      const lastHash = lastHashBySerie.get(doc.serie_id) ?? null;
      if (lastHash !== doc.hash_anterior) {
        issues.push({
          serie_id: doc.serie_id,
          numero_formatado: doc.numero_formatado,
          documento_id: doc.id,
          code: "CHAIN_DIVERGENTE",
          detail: `hash_anterior=${doc.hash_anterior ?? "null"} esperado=${lastHash ?? "null"}`,
          blocker: true,
        });
      }
      lastHashBySerie.set(doc.serie_id, doc.hash_control);

      if (!doc.assinatura_base64 || doc.assinatura_base64.trim().length === 0) {
        issues.push({
          serie_id: doc.serie_id,
          numero_formatado: doc.numero_formatado,
          documento_id: doc.id,
          code: "ASSINATURA_AUSENTE",
          detail: "assinatura_base64 nao persistida.",
          blocker: true,
        });
      } else if (canonical) {
        const cacheKey = `${doc.empresa_id}:${doc.key_version}`;
        let chave = chavesCache.get(cacheKey);
        if (chave === undefined) {
          const fromDb = await loadChavePublica(sql, {
            empresaId: doc.empresa_id,
            keyVersion: doc.key_version,
          });
          chave = fromDb ? { algorithm: fromDb.algorithm, public_key_pem: fromDb.public_key_pem } : null;
          chavesCache.set(cacheKey, chave);
        }

        if (!chave) {
          issues.push({
            serie_id: doc.serie_id,
            numero_formatado: doc.numero_formatado,
            documento_id: doc.id,
            code: "CHAVE_NAO_ENCONTRADA",
            detail: `chave publica nao encontrada para key_version=${doc.key_version}`,
            blocker: true,
          });
        } else {
          const algorithm = (argv.algorithm?.trim() || chave.algorithm || "").toUpperCase();
          const result = verifyWithAlgorithm({
            canonicalString: canonical,
            assinaturaBase64: doc.assinatura_base64,
            publicKeyPem: chave.public_key_pem,
            algorithm,
          });
          if (!result.ok) {
            issues.push({
              serie_id: doc.serie_id,
              numero_formatado: doc.numero_formatado,
              documento_id: doc.id,
              code: "ASSINATURA_INVALIDA",
              detail: result.detail,
              blocker: true,
            });
          }
        }
      }

      const emitidos = eventosPorDocumento.get(doc.id) ?? [];
      if (emitidos.length === 0) {
        issues.push({
          serie_id: doc.serie_id,
          numero_formatado: doc.numero_formatado,
          documento_id: doc.id,
          code: "EMITIDO_EVENTO_AUSENTE",
          detail: "evento EMITIDO nao encontrado em fiscal_documentos_eventos.",
          blocker: false,
        });
      } else {
        const payload = emitidos[emitidos.length - 1]?.payload ?? null;
        const payloadHash =
          payload && typeof payload === "object" && typeof payload.hash_control === "string"
            ? payload.hash_control
            : null;
        if (payloadHash !== doc.hash_control) {
          issues.push({
            serie_id: doc.serie_id,
            numero_formatado: doc.numero_formatado,
            documento_id: doc.id,
            code: "EMITIDO_EVENTO_HASH_DIVERGENTE",
            detail: `payload.hash_control=${payloadHash ?? "null"} difere de fiscal_documentos.hash_control`,
            blocker: false,
          });
        }
      }
    }

    const blockers = issues.filter((i) => i.blocker);
    const summary = {
      tool: "replay-audit",
      empresa_id: argv.empresaId,
      serie_id: argv.serieId ?? null,
      total_documentos: docs.length,
      total_issues: issues.length,
      total_blockers: blockers.length,
      status: blockers.length === 0 ? "PASS" : "FAIL",
    };

    if (argv.json) {
      console.log(JSON.stringify({ summary, issues }, null, 2));
      return;
    }

    console.log("# Fiscal Replay Audit");
    console.log(`status: ${summary.status}`);
    console.log(`empresa_id: ${summary.empresa_id}`);
    console.log(`serie_id: ${summary.serie_id ?? "todas"}`);
    console.log(`documentos: ${summary.total_documentos}`);
    console.log(`issues: ${summary.total_issues}`);
    console.log(`blockers: ${summary.total_blockers}`);
    console.log("");

    for (const issue of issues) {
      const sev = issue.blocker ? "BLOCKER" : "WARN";
      console.log(
        `${sev} | ${issue.code} | serie=${issue.serie_id} | ${issue.numero_formatado} | doc=${issue.documento_id}`
      );
      console.log(`  detalhe: ${issue.detail}`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`ERROR replay-audit: ${message}`);
  process.exitCode = 1;
});
