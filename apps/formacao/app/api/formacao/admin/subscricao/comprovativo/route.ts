import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireFormacaoRoles } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

const allowedRoles = ["formacao_admin", "formacao_financeiro", "super_admin", "global_admin"];
const bucket = "billing-proofs";

type FormacaoPlan = "basic" | "pro" | "enterprise";

function getAdminClient() {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "").trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !key) throw new Error("Supabase admin não configurado.");
  return createClient(url, key, { auth: { persistSession: false } });
}

function mapFormacaoPlanToBillingPlan(plan: FormacaoPlan | string | null | undefined) {
  if (plan === "enterprise") return "premium";
  if (plan === "pro") return "profissional";
  return "essencial";
}

function resolveEffectivePrice(row: Record<string, unknown> | null) {
  const base = Number(row?.price_mensal_kz ?? 0);
  if (!Number.isFinite(base) || base <= 0) return 0;

  const promoEndsAt = typeof row?.promo_ends_at === "string" ? new Date(row.promo_ends_at) : null;
  const promoActive = !promoEndsAt || promoEndsAt.getTime() >= Date.now();
  const discount = promoActive ? Number(row?.discount_percent ?? 0) : 0;
  if (!Number.isFinite(discount) || discount <= 0) return Math.round(base);

  return Math.max(0, Math.round(base * (1 - Math.min(100, discount) / 100)));
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthEnd(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const referencia = String(formData.get("referencia") ?? "").trim().slice(0, 120);

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Envie um ficheiro de comprovativo." }, { status: 400 });
    }

    if (file.size <= 0 || file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "O comprovativo deve ter até 8MB." }, { status: 400 });
    }

    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ ok: false, error: "Formato inválido. Use PDF, JPG, PNG ou WEBP." }, { status: 400 });
    }

    const admin = getAdminClient();

    const { data: centro, error: centroError } = await admin
      .from("centros_formacao")
      .select("escola_id,nome,plano,trial_ends_at,subscription_status")
      .eq("escola_id", auth.escolaId)
      .maybeSingle();

    if (centroError) throw centroError;
    if (!centro) return NextResponse.json({ ok: false, error: "Centro não encontrado." }, { status: 404 });

    const { data: planSettings } = await admin
      .from("formacao_plan_settings")
      .select("price_mensal_kz,trial_days,discount_percent,promo_ends_at")
      .eq("plan", centro.plano)
      .maybeSingle();

    const valorKz = resolveEffectivePrice((planSettings as Record<string, unknown> | null) ?? null);
    if (valorKz <= 0) {
      return NextResponse.json(
        { ok: false, error: "O plano deste centro ainda não tem preço geral configurado." },
        { status: 400 },
      );
    }

    const { data: existingAssinatura, error: assError } = await admin
      .from("assinaturas")
      .select("id,valor_kz,data_renovacao,metodo_pagamento,status")
      .eq("escola_id", auth.escolaId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (assError) throw assError;

    if (existingAssinatura) {
      const { data: pendingPayment, error: pendingError } = await admin
        .from("pagamentos_saas")
        .select("id")
        .eq("assinatura_id", existingAssinatura.id)
        .eq("status", "pendente")
        .limit(1)
        .maybeSingle();

      if (pendingError) throw pendingError;
      if (pendingPayment?.id) {
        return NextResponse.json(
          { ok: false, error: "Já existe um comprovativo pendente de validação para esta assinatura." },
          { status: 409 },
        );
      }
    }

    const today = new Date();
    const periodoFim = existingAssinatura?.data_renovacao
      ? new Date(existingAssinatura.data_renovacao)
      : addMonths(today, 1);

    let assinatura = existingAssinatura;
    if (!assinatura) {
      const { data: inserted, error: insertAssError } = await admin
        .from("assinaturas")
        .insert({
          escola_id: auth.escolaId,
          plano: mapFormacaoPlanToBillingPlan(centro.plano),
          ciclo: "mensal",
          status: "pendente",
          metodo_pagamento: "transferencia",
          data_inicio: today.toISOString(),
          data_renovacao: periodoFim.toISOString(),
          valor_kz: valorKz,
          origem_registo: "formacao_center_upload",
          motivo_origem: "Criada automaticamente no envio de comprovativo pelo centro de formação.",
        })
        .select("id,valor_kz,data_renovacao,metodo_pagamento,status")
        .single();

      if (insertAssError) throw insertAssError;
      assinatura = inserted;
    }

    const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
    const path = `${auth.escolaId}/${assinatura.id}_${Date.now()}.${ext}`;
    const { error: uploadError } = await admin.storage
      .from(bucket)
      .upload(path, file, { contentType: file.type, upsert: false });

    if (uploadError) throw uploadError;

    const { data: publicData } = admin.storage.from(bucket).getPublicUrl(path);
    const publicUrl = publicData.publicUrl;
    const dueBase = existingAssinatura?.data_renovacao
      ? new Date(existingAssinatura.data_renovacao)
      : today;
    const safeDueBase = Number.isNaN(dueBase.getTime()) ? today : dueBase;
    const paymentPeriodStart = safeDueBase.getTime() <= today.getTime() ? monthStart(safeDueBase) : today;
    const paymentPeriodEnd = safeDueBase.getTime() <= today.getTime() ? monthEnd(safeDueBase) : periodoFim;

    const { data: pagamento, error: pgError } = await admin
      .from("pagamentos_saas")
      .insert({
        assinatura_id: assinatura.id,
        escola_id: auth.escolaId,
        valor_kz: assinatura.valor_kz || valorKz,
        metodo: assinatura.metodo_pagamento || "transferencia",
        status: "pendente",
        referencia_ext: referencia || null,
        comprovativo_url: publicUrl,
        periodo_inicio: isoDate(paymentPeriodStart),
        periodo_fim: isoDate(paymentPeriodEnd),
      })
      .select("id,status,valor_kz,comprovativo_url,created_at")
      .single();

    if (pgError) throw pgError;

    await admin
      .from("assinaturas")
      .update({ status: "pendente" })
      .eq("id", assinatura.id);

    await admin
      .from("centros_formacao")
      .update({
        subscription_status: "past_due",
        subscription_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("escola_id", auth.escolaId)
      .neq("subscription_status", "active");

    return NextResponse.json({ ok: true, item: pagamento });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
