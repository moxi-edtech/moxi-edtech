import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: requestedEscolaId } = await params;
    const supabase = await supabaseServerTyped<Database>();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id, requestedEscolaId);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Acesso negado a esta escola." }, { status: 403 });
    }

    const { data: escolaInfo } = await supabase
      .from("escolas")
      .select("slug")
      .eq("id", escolaId)
      .maybeSingle();
    const escolaParam = escolaInfo?.slug ? String(escolaInfo.slug) : escolaId;

    const { data: assinatura, error } = await supabase
      .from("assinaturas")
      .select("id, escola_id, metodo_pagamento, stripe_customer_id")
      .eq("escola_id", escolaId)
      .maybeSingle();

    if (error) throw error;

    if (!assinatura) {
      return NextResponse.json({ ok: false, error: "Assinatura não encontrada." }, { status: 404 });
    }

    if (assinatura.metodo_pagamento !== "stripe" && assinatura.metodo_pagamento !== "cartao") {
      return NextResponse.json(
        { ok: false, error: "Portal Stripe disponível apenas para assinaturas com cartão/Stripe." },
        { status: 409 }
      );
    }

    const basePortalUrl = process.env.STRIPE_CUSTOMER_PORTAL_URL?.trim();
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").trim();

    if (!basePortalUrl) {
      return NextResponse.json(
        { ok: false, error: "Stripe portal não configurado. Defina STRIPE_CUSTOMER_PORTAL_URL." },
        { status: 503 }
      );
    }

    const portalUrl = assinatura.stripe_customer_id
      ? `${basePortalUrl}?prefilled_email=&customer=${encodeURIComponent(assinatura.stripe_customer_id)}&return_url=${encodeURIComponent(`${appUrl}/escola/${escolaParam}/admin/configuracoes/assinatura`)}`
      : `${basePortalUrl}?return_url=${encodeURIComponent(`${appUrl}/escola/${escolaParam}/admin/configuracoes/assinatura`)}`;

    return NextResponse.json({
      ok: true,
      url: portalUrl,
      message: "A redirecionar para o portal Stripe.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao iniciar Stripe portal.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
