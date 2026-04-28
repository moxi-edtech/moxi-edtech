import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assertZeroDivergence,
  calcularDocumentoDeterministico,
  type FiscalEngineInput,
} from "@/lib/fiscal/engineDeterministico";
import { buildFiscalProviderFromEnv } from "@/lib/fiscal/fiscalProviderConfig";

type OracleValidationArgs = {
  supabase: SupabaseClient<any>;
  escolaId: string;
  empresaId: string;
  userId?: string;
  idempotencyKey: string;
  scenarioCode: string;
  scenario: FiscalEngineInput;
};

function stableHash(payload: unknown) {
  const text = JSON.stringify(payload, Object.keys(payload as Record<string, unknown>).sort());
  return createHash("sha256").update(text).digest("hex");
}

export async function runOracleValidationAndPersist(args: OracleValidationArgs) {
  const klasse = calcularDocumentoDeterministico(args.scenario);
  const provider = buildFiscalProviderFromEnv();

  const providerResult = await provider.emitirDocumento({
    idempotencyKey: args.idempotencyKey,
    escolaId: args.escolaId,
    payload: {
      scenario_code: args.scenarioCode,
      escola_id: args.escolaId,
      empresa_id: args.empresaId,
      documento: klasse,
    },
  });

  assertZeroDivergence(klasse.grandTotal, providerResult.grandTotal);
  assertZeroDivergence(klasse.taxTotal, providerResult.taxTotal);

  const payload = {
    escola_id: args.escolaId,
    empresa_id: args.empresaId,
    idempotency_key: args.idempotencyKey,
    scenario_code: args.scenarioCode,
    klasse_result: klasse,
    provider_result: providerResult,
    divergence_total: "0.0000",
    payload_hash: stableHash({ klasse, provider: providerResult }),
    created_by: args.userId ?? null,
  };

  const { data, error } = await args.supabase
    .from("fiscal_validation_snapshots")
    .insert(payload)
    .select("id, created_at, payload_hash")
    .single();

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      const { data: existing, error: existingError } = await args.supabase
        .from("fiscal_validation_snapshots")
        .select("id, created_at, payload_hash")
        .eq("escola_id", args.escolaId)
        .eq("idempotency_key", args.idempotencyKey)
        .maybeSingle();

      if (!existingError && existing) {
        return {
          ok: true,
          idempotent: true,
          snapshot: existing,
          klasse,
          provider: providerResult,
        };
      }
    }

    throw new Error(`FISCAL_VALIDATION_SNAPSHOT_INSERT_FAILED:${error.message}`);
  }

  return {
    ok: true,
    idempotent: false,
    snapshot: data,
    klasse,
    provider: providerResult,
  };
}
