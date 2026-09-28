import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

const PayloadSchema = z.object({
  mensalidadeId: z.string().uuid(),
  motivo: z.string().trim().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const idempotencyKey =
      req.headers.get("Idempotency-Key") ?? req.headers.get("idempotency-key");
    if (!idempotencyKey) {
      return NextResponse.json(
        { ok: false, error: "Idempotency-Key header é obrigatório" },
        { status: 400 }
      );
    }

    const supabase = await supabaseServerTyped<any>();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const parsed = PayloadSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues?.[0]?.message || "Payload inválido" },
        { status: 400 }
      );
    }

    const { mensalidadeId, motivo } = parsed.data;

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });
    }

    const { data: mensalidade } = await supabase
      .from("mensalidades")
      .select("id, escola_id, status")
      .eq("id", mensalidadeId)
      .eq("escola_id", escolaId)
      .maybeSingle();
    if (!mensalidade) {
      return NextResponse.json({ ok: false, error: "Mensalidade não encontrada" }, { status: 404 });
    }

    const { data: existingReversal, error: existingReversalError } = await supabase
      .from("financeiro_pagamento_reversoes")
      .select("id, pagamento_id, created_at")
      .eq("escola_id", escolaId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existingReversalError) {
      return NextResponse.json(
        { ok: false, error: existingReversalError.message },
        { status: 500 }
      );
    }

    if (existingReversal) {
      return NextResponse.json({
        ok: true,
        data: {
          ok: true,
          idempotent: true,
          reversao_id: existingReversal.id,
          pagamento_id: existingReversal.pagamento_id,
          status: "voided",
        },
      });
    }

    if (mensalidade.status !== "pago" && mensalidade.status !== "pago_parcial") {
      return NextResponse.json(
        { ok: false, error: "A mensalidade não possui pagamento activo para reversão." },
        { status: 409 }
      );
    }

    const { data: applications, error: applicationsError } = await supabase
      .from("financeiro_pagamento_alocacoes")
      .select("id, pagamento_id, mensalidade_id, created_at")
      .eq("escola_id", escolaId)
      .eq("mensalidade_id", mensalidadeId)
      .eq("natureza", "aplicacao")
      .order("created_at", { ascending: false });

    if (applicationsError) {
      return NextResponse.json(
        { ok: false, error: applicationsError.message },
        { status: 500 }
      );
    }

    const applicationIds = (applications ?? []).map((row: any) => row.id);
    let reversedOriginIds = new Set<string>();

    if (applicationIds.length > 0) {
      const { data: reversals, error: reversalsError } = await supabase
        .from("financeiro_pagamento_alocacoes")
        .select("alocacao_origem_id")
        .eq("escola_id", escolaId)
        .eq("natureza", "reversao")
        .in("alocacao_origem_id", applicationIds);

      if (reversalsError) {
        return NextResponse.json(
          { ok: false, error: reversalsError.message },
          { status: 500 }
        );
      }

      reversedOriginIds = new Set(
        (reversals ?? [])
          .map((row: any) => row.alocacao_origem_id)
          .filter((value: unknown): value is string => typeof value === "string")
      );
    }

    const activeApplications = (applications ?? []).filter(
      (row: any) => !reversedOriginIds.has(row.id)
    );
    const paymentIds = Array.from(
      new Set(
        activeApplications
          .map((row: any) => row.pagamento_id)
          .filter((value: unknown): value is string => typeof value === "string")
      )
    );

    if (paymentIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Nenhum pagamento activo encontrado para esta mensalidade." },
        { status: 409 }
      );
    }

    if (paymentIds.length > 1) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "A mensalidade possui múltiplos pagamentos activos. Reverta cada pagamento explicitamente para preservar o ledger.",
        },
        { status: 409 }
      );
    }

    const paymentId = paymentIds[0];

    const { data: paymentApplications, error: paymentApplicationsError } = await supabase
      .from("financeiro_pagamento_alocacoes")
      .select("id, mensalidade_id")
      .eq("escola_id", escolaId)
      .eq("pagamento_id", paymentId)
      .eq("natureza", "aplicacao");

    if (paymentApplicationsError) {
      return NextResponse.json(
        { ok: false, error: paymentApplicationsError.message },
        { status: 500 }
      );
    }

    const paymentApplicationIds = (paymentApplications ?? []).map((row: any) => row.id);
    let paymentReversedIds = new Set<string>();

    if (paymentApplicationIds.length > 0) {
      const { data: paymentReversals, error: paymentReversalsError } = await supabase
        .from("financeiro_pagamento_alocacoes")
        .select("alocacao_origem_id")
        .eq("escola_id", escolaId)
        .eq("natureza", "reversao")
        .in("alocacao_origem_id", paymentApplicationIds);

      if (paymentReversalsError) {
        return NextResponse.json(
          { ok: false, error: paymentReversalsError.message },
          { status: 500 }
        );
      }

      paymentReversedIds = new Set(
        (paymentReversals ?? [])
          .map((row: any) => row.alocacao_origem_id)
          .filter((value: unknown): value is string => typeof value === "string")
      );
    }

    const activePaymentApplications = (paymentApplications ?? []).filter(
      (row: any) => !paymentReversedIds.has(row.id)
    );

    if (
      activePaymentApplications.some(
        (row: any) => row.mensalidade_id && row.mensalidade_id !== mensalidadeId
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "O pagamento também liquida outras mensalidades. Reverta o pagamento completo pelo fluxo explícito de pagamentos.",
        },
        { status: 409 }
      );
    }

    const { data, error } = await supabase.rpc("reverter_pagamento_realizado", {
      p_pagamento_id: paymentId,
      p_motivo: motivo?.trim() || "Estorno de mensalidade",
      p_idempotency_key: idempotencyKey,
    });

    if (error) {
      const status = error.message?.startsWith("STATE:") ? 409 : 400;
      return NextResponse.json({ ok: false, error: error.message }, { status });
    }

    if (!data || (data as any)?.ok === false) {
      return NextResponse.json(
        { ok: false, error: (data as any)?.erro || "Falha ao reverter pagamento" },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
