import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { ProxyPayClient } from "@/lib/server/payments/providers/proxypay";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const enabled = () => (process.env.PROXYPAY_ENABLED ?? "").toLowerCase() === "true";

export async function POST(request: Request) {
  if (!enabled()) return NextResponse.json({ ok: false, error: "ProxyPay indisponível" }, { status: 404 });
  try {
    const supabase = await createClient();
    const db = supabase as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const obligationId = typeof body?.obligationId === "string" ? body.obligationId : null;
    if (!obligationId) return NextResponse.json({ ok: false, error: "obligationId é obrigatório" }, { status: 400 });

    const [{ data: mensalidade }, { data: provider }] = await Promise.all([
      db.from("mensalidades").select("id, escola_id, valor, valor_previsto, valor_pago_total, status, data_vencimento").eq("id", obligationId).eq("escola_id", escolaId).maybeSingle(),
      db.from("school_payment_providers").select("id, school_id, status, environment, entity_code, config").eq("school_id", escolaId).eq("provider_type", "proxypay").eq("status", "active").maybeSingle(),
    ]);
    if (!mensalidade) return NextResponse.json({ ok: false, error: "Obrigação não encontrada" }, { status: 404 });
    if (!provider) return NextResponse.json({ ok: false, error: "ProxyPay não está activo para esta escola" }, { status: 409 });
    const amount = Number(mensalidade.valor_previsto ?? mensalidade.valor ?? 0) - Number(mensalidade.valor_pago_total ?? 0);
    if (!(amount > 0)) return NextResponse.json({ ok: false, error: "Obrigação sem saldo pendente" }, { status: 409 });

    const { data: existing } = await db.from("payment_references")
      .select("entity, reference, amount, currency, expires_at, status")
      .eq("school_id", escolaId).eq("obligation_id", obligationId)
      .in("status", ["pending", "active"]).maybeSingle();
    if (existing) return NextResponse.json({ ok: true, reference: existing });

    const config = (provider.config ?? {}) as { api_key?: string; apiKey?: string };
    const apiKey = process.env.PROXYPAY_API_KEY?.trim() || config.api_key?.trim() || config.apiKey?.trim();
    if (!apiKey) return NextResponse.json({ ok: false, error: "ProxyPay API key não configurada" }, { status: 503 });
    const expires = new Date(`${mensalidade.data_vencimento}T23:59:59+01:00`);
    const expiresAt = Number.isNaN(expires.getTime()) ? new Date(Date.now() + 7 * 86400000) : expires;
    const client = new ProxyPayClient({ apiKey, environment: provider.environment as "sandbox" | "production" });
    const callbackUrl = `${new URL(request.url).origin}/api/webhooks/proxypay?providerId=${encodeURIComponent(provider.id)}`;
    const created = await client.createReference({ amount, expiresAt: expiresAt.toISOString(), customFields: { obligation_id: obligationId, school_id: escolaId, callback_url: callbackUrl } });
    const { data: saved, error } = await db.from("payment_references").insert({
      school_id: escolaId, obligation_id: obligationId, provider_id: provider.id,
      provider_reference_id: created.id, entity: String(provider.entity_code ?? ""), reference: created.id,
      amount, currency: "AOA", status: "active", expires_at: expiresAt.toISOString(),
      provider_payload: { id: created.id, amount: created.amount, expires_at: expiresAt.toISOString() },
    }).select("entity, reference, amount, currency, expires_at, status").single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, reference: saved }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
