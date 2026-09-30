#!/usr/bin/env node
/**
 * Destructive staging-only fiscal readiness runner.
 *
 * Required env:
 *   FISCAL_READINESS_ALLOW_MUTATION=staging
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 *   FISCAL_READINESS_USER_ACCESS_TOKEN
 *   FISCAL_READINESS_RPC_FIXTURE_JSON
 *
 * The fixture JSON is the exact fiscal_emitir_documento RPC payload for an
 * isolated staging series with enough authorized numbers. It MUST use:
 *   p_origem_documento="integrado"
 *   p_metadata.origem_operacao="readiness"
 *
 * This runner intentionally never runs unless the explicit staging guard is set.
 */

import process from "node:process";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`READINESS_ENV_REQUIRED:${name}`);
  return value;
}

if (process.env.FISCAL_READINESS_ALLOW_MUTATION !== "staging") {
  throw new Error(
    "READINESS_REFUSED: set FISCAL_READINESS_ALLOW_MUTATION=staging on a disposable Supabase branch"
  );
}

const baseUrl = required("SUPABASE_URL").replace(/\/$/, "");
const anonKey = required("SUPABASE_ANON_KEY");
const accessToken = required("FISCAL_READINESS_USER_ACCESS_TOKEN");
const fixture = JSON.parse(required("FISCAL_READINESS_RPC_FIXTURE_JSON"));

async function rpc(payload) {
  const response = await fetch(`${baseUrl}/rest/v1/rpc/fiscal_emitir_documento`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`RPC_${response.status}:${JSON.stringify(json)}`);
  }
  return json;
}

function withOrigin(base, originId) {
  return {
    ...base,
    p_metadata: {
      ...(base.p_metadata ?? {}),
      origem_operacao: "readiness",
      origem_id: originId,
    },
  };
}

async function uniqueNumberBurst(count) {
  const prefix = `burst-${count}-${Date.now()}`;
  const results = await Promise.all(
    Array.from({ length: count }, (_, i) => rpc(withOrigin(fixture, `${prefix}-${i}`)))
  );

  const documentIds = new Set(results.map((row) => row.documento_id));
  const formatted = new Set(results.map((row) => row.numero_formatado));
  if (documentIds.size !== count || formatted.size !== count) {
    throw new Error(
      `CONCURRENCY_DUPLICATE: count=${count} ids=${documentIds.size} numbers=${formatted.size}`
    );
  }
  return { count, unique_ids: documentIds.size, unique_numbers: formatted.size };
}

async function sameOriginRace(count) {
  const originId = `same-origin-${count}-${Date.now()}`;
  const results = await Promise.all(
    Array.from({ length: count }, () => rpc(withOrigin(fixture, originId)))
  );
  const ids = new Set(results.map((row) => row.documento_id));
  if (ids.size !== 1) {
    throw new Error(`IDEMPOTENCY_RACE: expected 1 document, got ${ids.size}`);
  }
  return { count, unique_documents: ids.size, documento_id: results[0].documento_id };
}

const report = {
  generated_at: new Date().toISOString(),
  two_parallel_unique: await uniqueNumberBurst(2),
  hundred_parallel_unique: await uniqueNumberBurst(100),
  same_origin_two_parallel: await sameOriginRace(2),
  same_origin_hundred_parallel: await sameOriginRace(100),
};

process.stdout.write(JSON.stringify(report, null, 2) + "\n");
