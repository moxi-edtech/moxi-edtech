import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabaseServer";
import { isSuperAdminRole } from "@/lib/auth/requireSuperAdminAccess";
import { sendMail } from "@/lib/mailer";
import { recordAuditServer } from "@/lib/audit";

export const dynamic = "force-dynamic";

type Settings = {
  banco?: string | null;
  titular_conta?: string | null;
  iban?: string | null;
  numero_conta?: string | null;
  kwik_chave?: string | null;
  email_comercial?: string | null;
  telefone_comercial?: string | null;
  whatsapp_comercial?: string | null;
  link_pagamento?: string | null;
  lembrete_trial_template?: string | null;
  lembrete_expirado_template?: string | null;
};

async function assertSuperAdmin(s: SupabaseClient) {
  const { data: sess } = await s.auth.getUser();
  const user = sess?.user;
  if (!user) return { ok: false as const, response: NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 }), userId: null };

  const { data: roles } = await s
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const role = (roles?.[0] as { role?: string } | undefined)?.role;
  if (!isSuperAdminRole(role)) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "Somente Super Admin" }, { status: 403 }), userId: user.id };
  }

  return { ok: true as const, userId: user.id };
}

function paymentSummary(settings: Settings) {
  return [
    settings.banco ? `Banco: ${settings.banco}` : "",
    settings.titular_conta ? `Titular: ${settings.titular_conta}` : "",
    settings.iban ? `IBAN: ${settings.iban}` : "",
    settings.numero_conta ? `Conta: ${settings.numero_conta}` : "",
    settings.kwik_chave ? `Kwik: ${settings.kwik_chave}` : "",
    settings.link_pagamento ? `Link: ${settings.link_pagamento}` : "",
  ].filter(Boolean).join(" | ");
}

function renderTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce((text, [key, value]) => text.split(`{{${key}}}`).join(value), template);
}

function whatsappUrl(phone: string | null | undefined, message: string) {
  const normalized = String(phone ?? "").replace(/\D/g, "");
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export async function POST(request: Request, context: { params: Promise<{ escolaId: string }> }) {
  try {
    const { escolaId } = await context.params;
    const normalizedEscolaId = String(escolaId || "").trim();
    if (!normalizedEscolaId) return NextResponse.json({ ok: false, error: "escolaId ausente" }, { status: 400 });

    const body = (await request.json().catch(() => null)) as { channel?: unknown } | null;
    const channel = String(body?.channel ?? "email").trim().toLowerCase();
    const s = (await supabaseServer()) as unknown as SupabaseClient;
    const auth = await assertSuperAdmin(s);
    if (!auth.ok) return auth.response;

    const [{ data: centro, error: centroError }, { data: settingsRaw, error: settingsError }] = await Promise.all([
      s
        .from("centros_formacao")
        .select("escola_id,nome,email,telefone,subscription_status,trial_ends_at")
        .eq("escola_id", normalizedEscolaId)
        .maybeSingle(),
      s
        .from("super_admin_commercial_settings")
        .select("*")
        .eq("id", true)
        .maybeSingle(),
    ]);

    if (centroError) throw centroError;
    if (settingsError) throw settingsError;
    if (!centro) return NextResponse.json({ ok: false, error: "Centro não encontrado" }, { status: 404 });

    const typedCentro = centro as Record<string, unknown>;
    const settings = (settingsRaw ?? {}) as Settings;
    const trialEndsAt = typeof typedCentro.trial_ends_at === "string" ? new Date(typedCentro.trial_ends_at) : null;
    const daysLeft = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86_400_000)) : 0;
    const isExpired = String(typedCentro.subscription_status ?? "trial") === "expired" || (trialEndsAt ? trialEndsAt.getTime() < Date.now() : false);
    const template = isExpired
      ? settings.lembrete_expirado_template || "Olá {{centro_nome}}, o período de teste terminou. Dados de pagamento: {{dados_pagamento}}"
      : settings.lembrete_trial_template || "Olá {{centro_nome}}, o trial termina em {{dias_restantes}} dia(s). Dados de pagamento: {{dados_pagamento}}";
    const message = renderTemplate(template, {
      centro_nome: String(typedCentro.nome ?? "Centro"),
      dias_restantes: String(daysLeft),
      dados_pagamento: paymentSummary(settings) || "dados de pagamento ainda não configurados",
      email_comercial: settings.email_comercial || "",
      telefone_comercial: settings.telefone_comercial || "",
      whatsapp_comercial: settings.whatsapp_comercial || "",
      link_pagamento: settings.link_pagamento || "",
    });

    if (channel === "whatsapp") {
      const url = whatsappUrl(String(typedCentro.telefone ?? settings.whatsapp_comercial ?? ""), message);
      await s
        .from("centros_formacao")
        .update({
          last_commercial_contact_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("escola_id", normalizedEscolaId);
      return NextResponse.json({ ok: true, channel: "whatsapp", url, message });
    }

    const to = String(typedCentro.email ?? "").trim().toLowerCase();
    if (!to) return NextResponse.json({ ok: false, error: "Centro sem e-mail comercial configurado" }, { status: 400 });

    const subject = isExpired
      ? `KLASSE Formação · Trial expirado · ${typedCentro.nome}`
      : `KLASSE Formação · Trial termina em ${daysLeft} dia(s) · ${typedCentro.nome}`;
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
        <p>${message.replace(/\n/g, "<br />")}</p>
        ${settings.email_comercial ? `<p>Contacto comercial: ${settings.email_comercial}</p>` : ""}
        ${settings.whatsapp_comercial ? `<p>WhatsApp: ${settings.whatsapp_comercial}</p>` : ""}
      </div>
    `;
    const sent = await sendMail({ to, subject, html, text: message });
    if (!sent.ok) return NextResponse.json({ ok: false, error: sent.error }, { status: 400 });

    await s
      .from("centros_formacao")
      .update({
        last_manual_reminder_at: new Date().toISOString(),
        last_commercial_contact_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("escola_id", normalizedEscolaId);

    await recordAuditServer({
      escolaId: normalizedEscolaId,
      portal: "super_admin",
      acao: "FORMACAO_TRIAL_REMINDER_SENT",
      entity: "centros_formacao",
      entityId: normalizedEscolaId,
      details: { channel: "email", to, actor_id: auth.userId, days_left: daysLeft },
    });

    return NextResponse.json({ ok: true, channel: "email", to });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro interno" }, { status: 500 });
  }
}
