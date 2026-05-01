import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabaseServer";
import { isSuperAdminRole } from "@/lib/auth/requireSuperAdminAccess";

export const dynamic = "force-dynamic";

type CommercialSettings = {
  banco: string;
  titular_conta: string;
  iban: string;
  numero_conta: string;
  kwik_chave: string;
  email_comercial: string;
  telefone_comercial: string;
  whatsapp_comercial: string;
  link_pagamento: string;
  lembrete_trial_template: string;
  lembrete_expirado_template: string;
  auto_reminders_enabled: boolean;
};

const defaults: CommercialSettings = {
  banco: "",
  titular_conta: "",
  iban: "",
  numero_conta: "",
  kwik_chave: "",
  email_comercial: "",
  telefone_comercial: "",
  whatsapp_comercial: "",
  link_pagamento: "",
  lembrete_trial_template:
    "Olá {{centro_nome}}, o período de teste do seu centro termina em {{dias_restantes}} dia(s). Para manter o acesso aos dados e à operação, regularize a subscrição. Dados de pagamento: {{dados_pagamento}}",
  lembrete_expirado_template:
    "Olá {{centro_nome}}, o período de teste terminou. Os dados estão preservados, mas o acesso operacional precisa de regularização. Dados de pagamento: {{dados_pagamento}}",
  auto_reminders_enabled: false,
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

function cleanText(value: unknown, maxLength = 1500) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalize(input: unknown): CommercialSettings {
  const raw = (input ?? {}) as Record<string, unknown>;
  return {
    banco: cleanText(raw.banco, 160),
    titular_conta: cleanText(raw.titular_conta, 180),
    iban: cleanText(raw.iban, 90).toUpperCase(),
    numero_conta: cleanText(raw.numero_conta, 90),
    kwik_chave: cleanText(raw.kwik_chave, 120),
    email_comercial: cleanText(raw.email_comercial, 180).toLowerCase(),
    telefone_comercial: cleanText(raw.telefone_comercial, 80),
    whatsapp_comercial: cleanText(raw.whatsapp_comercial, 80),
    link_pagamento: cleanText(raw.link_pagamento, 500),
    lembrete_trial_template: cleanText(raw.lembrete_trial_template, 1500) || defaults.lembrete_trial_template,
    lembrete_expirado_template: cleanText(raw.lembrete_expirado_template, 1500) || defaults.lembrete_expirado_template,
    auto_reminders_enabled: Boolean(raw.auto_reminders_enabled),
  };
}

export async function GET() {
  try {
    const s = (await supabaseServer()) as unknown as SupabaseClient;
    const auth = await assertSuperAdmin(s);
    if (!auth.ok) return auth.response;

    const { data, error } = await s
      .from("super_admin_commercial_settings")
      .select("*")
      .eq("id", true)
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({ ok: true, item: normalize(data ?? defaults) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro interno" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const s = (await supabaseServer()) as unknown as SupabaseClient;
    const auth = await assertSuperAdmin(s);
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => null);
    const item = normalize((body as { item?: unknown } | null)?.item ?? body);
    const { data, error } = await s
      .from("super_admin_commercial_settings")
      .upsert({ id: true, ...item, updated_by: auth.userId, updated_at: new Date().toISOString() })
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, item: normalize(data) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro interno" }, { status: 500 });
  }
}
