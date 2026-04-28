import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { runOracleValidationAndPersist } from "@/lib/fiscal/oracleValidation";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const taxSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("NORMAL_14"), ratePct: z.literal("14.0000") }),
  z.object({ kind: z.literal("REDUZIDA_5"), ratePct: z.literal("5.0000") }),
  z.object({
    kind: z.literal("ISENTO"),
    ratePct: z.literal("0.0000"),
    exemptionCode: z.string().min(1),
    exemptionReason: z.string().min(1),
  }),
]);

const lineSchema = z.object({
  lineNo: z.coerce.number().int().positive(),
  productCode: z.string().min(1),
  description: z.string().min(1),
  quantity: z.string().regex(/^\d+(\.\d{1,4})?$/),
  unitPrice: z.string().regex(/^\d+(\.\d{1,4})?$/),
  lineDiscountPct: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
  tax: taxSchema,
});

const bodySchema = z.object({
  idempotencyKey: z.string().min(12),
  scenarioCode: z.string().min(3).max(120),
  empresaId: z.string().uuid(),
  moeda: z.string().length(3),
  exchangeRateToAoa: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
  globalDiscountPct: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
  lines: z.array(lineSchema).min(1).max(500),
});

export async function POST(req: Request) {
  const supabase = await supabaseRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHENTICATED", message: "Sessão inválida." } }, { status: 401 });
  }

  const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
  if (!escolaId) {
    return NextResponse.json(
      { ok: false, error: { code: "SCHOOL_CONTEXT_REQUIRED", message: "Sem escola ativa." } },
      { status: 403 }
    );
  }

  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_PAYLOAD", message: parsed.error.issues[0]?.message ?? "Payload inválido" } },
      { status: 400 }
    );
  }

  try {
    const result = await runOracleValidationAndPersist({
      supabase,
      escolaId: escolaId,
      empresaId: parsed.data.empresaId,
      userId: user.id,
      idempotencyKey: parsed.data.idempotencyKey,
      scenarioCode: parsed.data.scenarioCode,
      scenario: {
        escolaId: escolaId,
        tenantEmpresaId: parsed.data.empresaId,
        moeda: parsed.data.moeda,
        exchangeRateToAoa: parsed.data.exchangeRateToAoa,
        globalDiscountPct: parsed.data.globalDiscountPct,
        lines: parsed.data.lines,
      },
    });

    return NextResponse.json({ ok: true, data: result }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    const status = message.startsWith("FISCAL_DIVERGENCE:") ? 422 : 500;
    return NextResponse.json(
      { ok: false, error: { code: status === 422 ? "FISCAL_DIVERGENCE" : "FISCAL_VALIDATION_FAILED", message } },
      { status }
    );
  }
}
