import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { recordAuditServer } from "@/lib/audit";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const payloadSchema = z.object({
  aluno_id: z.string().uuid(),
  mensalidade_id: z.string().uuid().nullable().optional(),
  valor: z.number().positive(),
  metodo: z.enum(["cash", "tpa", "transfer", "mcx", "kiwk", "kwik"]),
  reference: z.string().trim().min(1).nullable().optional(),
  evidence_url: z.string().trim().min(1).nullable().optional(),
  gateway_ref: z.string().trim().min(1).nullable().optional(),
  meta: z.record(z.any()).optional(),
});

export async function POST(request: Request) {
  try {
    const idempotencyKey =
      request.headers.get("Idempotency-Key") ?? request.headers.get("idempotency-key");
    if (!idempotencyKey) {
      return NextResponse.json(
        { ok: false, error: "Idempotency-Key header é obrigatório" },
        { status: 400 }
      );
    }

    const supabase = await supabaseServerTyped<any>();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues?.[0]?.message || "Payload inválido" },
        { status: 400 }
      );
    }

    const { data: existingPagamento } = await supabase
      .from("pagamentos")
      .select("id, status, meta")
      .eq("escola_id", escolaId)
      .contains("meta", { idempotency_key: idempotencyKey })
      .maybeSingle();
    if (existingPagamento) {
      return NextResponse.json({ ok: true, data: existingPagamento, idempotent: true });
    }

    const payload = parsed.data;
    const metodo = payload.metodo === "kwik" ? "kiwk" : payload.metodo;
    const { data, error } = await supabase.rpc("financeiro_registrar_pagamento_secretaria", {
      p_escola_id: escolaId,
      p_aluno_id: payload.aluno_id,
      p_mensalidade_id: payload.mensalidade_id ?? null,
      p_valor: payload.valor,
      p_metodo: metodo,
      p_reference: payload.reference ?? null,
      p_evidence_url: payload.evidence_url ?? null,
      p_gateway_ref: payload.gateway_ref ?? null,
      p_meta: { ...(payload.meta ?? {}), idempotency_key: idempotencyKey },
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    recordAuditServer({
      escolaId,
      portal: "secretaria",
      acao: "PAGAMENTO_REGISTRADO",
      entity: "pagamento",
      entityId: (data as any)?.id ?? null,
      details: { valor: payload.valor, metodo, status: (data as any)?.status ?? null },
    }).catch(() => null);

    const intentId = (payload.meta as any)?.pagamento_intent_id ?? null;
    if (intentId) {
      await confirmPagamentoIntent({
        intentId: String(intentId),
        escolaId,
        metodo,
        reference: payload.reference ?? null,
        terminalId: payload.gateway_ref ?? null,
        evidenceUrl: payload.evidence_url ?? null,
        meta: payload.meta ?? {},
      });
    }

    return NextResponse.json({ ok: true, data });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

async function confirmPagamentoIntent({
  intentId,
  escolaId,
  metodo,
  reference,
  terminalId,
  evidenceUrl,
  meta,
}: {
  intentId: string;
  escolaId: string;
  metodo: string;
  reference: string | null;
  terminalId: string | null;
  evidenceUrl: string | null;
  meta: Record<string, any>;
}) {
  const admin = getSupabaseServerClient();
  if (!admin) return;

  const { data: intent, error } = await admin
    .from("pagamento_intents")
    .select("id, escola_id, status, servico_pedido_id")
    .eq("id", intentId)
    .maybeSingle();

  if (error || !intent || intent.escola_id !== escolaId) {
    return;
  }

  if (intent.status === "settled" || intent.status === "canceled") {
    return;
  }

  const normalizedMetodo = metodo === "kwik" ? "kiwk" : metodo;
  const newStatus = normalizedMetodo === "cash" ? "settled" : "pending";

  await admin
    .from("pagamento_intents")
    .update({
      method: normalizedMetodo,
      status: newStatus,
      reference: reference ?? undefined,
      terminal_id: terminalId ?? undefined,
      evidence_url: evidenceUrl ?? undefined,
      meta: { ...(meta ?? {}), confirmed_via: "balcao_pagamentos" },
      settled_at: newStatus === "settled" ? new Date().toISOString() : null,
    })
    .eq("id", intentId);

  if (newStatus === "settled" && intent.servico_pedido_id) {
    await admin
      .from("servico_pedidos")
      .update({ status: "granted" })
      .eq("id", intent.servico_pedido_id)
      .eq("escola_id", escolaId)
      .eq("status", "pending_payment");
  }
}
