import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendMail } from "@/lib/mailer";
import { recordAuditServer } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function resolveJobToken(req: Request) {
  return req.headers.get("x-job-token") || req.headers.get("authorization")?.replace("Bearer ", "");
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

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
  auto_reminders_enabled?: boolean;
};

type ReminderResult = {
  escola_id: string;
  status: "sent" | "failed" | "error" | "skipped";
  reason?: string;
  error?: string;
};

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

async function runReminderJob(req: Request) {
  const token = resolveJobToken(req);
  const expected = process.env.CRON_SECRET;
  if (!expected || token !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 500 });
  }

  // 1. Carregar configurações
  const { data: settingsRaw, error: settingsError } = await admin
    .from("super_admin_commercial_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();

  if (settingsError) throw settingsError;
  const settings = (settingsRaw ?? {}) as Settings;

  if (!settings.auto_reminders_enabled) {
    return NextResponse.json({ ok: true, message: "Automação desativada nas configurações" });
  }
  // 2. Buscar centros em trial ou expirados que precisam de lembrete
  const { data: centros, error: centrosError } = await admin
    .from("centros_formacao")
    .select(`
      escola_id, nome, email, subscription_status, trial_ends_at, last_automated_reminder_at,
      escolas:escola_id (
        assinaturas (
          status,
          pagamentos_saas (status, created_at)
        )
      )
    `)
    .in("subscription_status", ["trial", "expired"])
    .not("email", "is", null);

  if (centrosError) throw centrosError;

  const results: ReminderResult[] = [];
  const today = new Date().toISOString().split("T")[0];

  for (const centro of centros || []) {
    try {
      const normalizedCentro = centro as any;

    // 3. Verificar se já existe pagamento confirmado para evitar lembretes indevidos
    const assinaturas = (normalizedCentro.escolas?.assinaturas ?? []) as any[];
    const hasActiveSub = assinaturas.some(a => a.status === 'activa');
    const hasPendingPayment = assinaturas.some(a => 
      (a.pagamentos_saas ?? []).some((p: any) => p.status === 'pendente')
    );

    // Se já está ativa ou tem pagamento pendente de validação, não incomodamos o cliente.
    if (hasActiveSub || hasPendingPayment) {
      results.push({ escola_id: String(centro.escola_id), status: "skipped", reason: "active_sub_or_pending_payment" });
      continue;
    }

      const trialEndsAt = centro.trial_ends_at ? new Date(centro.trial_ends_at) : null;
      if (!trialEndsAt && centro.subscription_status === "trial") continue;

      const diffMs = trialEndsAt ? trialEndsAt.getTime() - Date.now() : -1;
      const daysLeft = Math.ceil(diffMs / 86_400_000);
      const isExpired = centro.subscription_status === "expired" || (trialEndsAt && diffMs < 0);
      
      const lastReminderDate = centro.last_automated_reminder_at 
        ? new Date(centro.last_automated_reminder_at).toISOString().split("T")[0] 
        : null;

      // Evitar duplicados no mesmo dia
      if (lastReminderDate === today) continue;

      // Regras de disparo: 7, 3, 1 dias ou Primeiro dia de expirado
      const shouldSend = 
        (!isExpired && [7, 3, 1].includes(daysLeft)) || 
        (isExpired && !lastReminderDate); // Envia uma vez se expirado (ou poderíamos enviar periodicamente se expirado)

      if (!shouldSend) continue;

      const template = isExpired
        ? settings.lembrete_expirado_template || "Olá {{centro_nome}}, o período de teste terminou. Dados de pagamento: {{dados_pagamento}}"
        : settings.lembrete_trial_template || "Olá {{centro_nome}}, o trial termina em {{dias_restantes}} dia(s). Dados de pagamento: {{dados_pagamento}}";

      const message = renderTemplate(template, {
        centro_nome: String(centro.nome ?? "Centro"),
        dias_restantes: String(Math.max(0, daysLeft)),
        dados_pagamento: paymentSummary(settings) || "dados de pagamento ainda não configurados",
        email_comercial: settings.email_comercial || "",
        telefone_comercial: settings.telefone_comercial || "",
        whatsapp_comercial: settings.whatsapp_comercial || "",
        link_pagamento: settings.link_pagamento || "",
      });

      const subject = isExpired
        ? `KLASSE Formação · Trial expirado · ${centro.nome}`
        : `KLASSE Formação · Trial termina em ${daysLeft} dia(s) · ${centro.nome}`;

      const html = `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
          <p>${message.replace(/\n/g, "<br />")}</p>
          ${settings.email_comercial ? `<p>Contacto comercial: ${settings.email_comercial}</p>` : ""}
          ${settings.whatsapp_comercial ? `<p>WhatsApp: ${settings.whatsapp_comercial}</p>` : ""}
        </div>
      `;

      const to = String(centro.email).trim().toLowerCase();
      const sent = await sendMail({ to, subject, html, text: message });
      
      if (sent.ok) {
        await admin
          .from("centros_formacao")
          .update({
            last_automated_reminder_at: new Date().toISOString(),
            last_commercial_contact_at: new Date().toISOString(),
          })
          .eq("escola_id", centro.escola_id);

        await recordAuditServer({
          escolaId: centro.escola_id,
          portal: "super_admin",
          acao: "FORMACAO_AUTO_TRIAL_REMINDER_SENT",
          entity: "centros_formacao",
          entityId: centro.escola_id,
          details: { channel: "email", to, days_left: daysLeft, is_expired: isExpired },
        });

        results.push({ escola_id: String(centro.escola_id), status: "sent" });
      } else {
        results.push({ escola_id: String(centro.escola_id), status: "failed", error: sent.error });
      }
    } catch (err: any) {
      results.push({ escola_id: String(centro.escola_id), status: "error", error: err.message });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}

export async function GET(req: Request) {
  return runReminderJob(req);
}

export async function POST(req: Request) {
  return runReminderJob(req);
}
