import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseRouteClient } from "@/lib/supabaseServer";
import { isSuperAdminRole } from "@/lib/auth/requireSuperAdminAccess";
import { buildAffiliateCredentialsEmail, sendMail } from "@/lib/mailer";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";

const CreateInfluencerSchema = z.object({
  nome: z.string().trim().min(1, "Nome obrigatório"),
  codigo: z.string().trim().min(1, "Código obrigatório"),
  email: z.string().trim().email("Email inválido"),
  pin: z.string().trim().min(4, "PIN inválido"),
});

const ToggleInfluencerSchema = z.object({
  id: z.string().uuid("ID inválido"),
  ativo: z.boolean(),
});

type InfluencerAdminListItem = Database["public"]["Functions"]["list_afiliados_admin"]["Returns"][number];
type InfluencerAdminCreateItem = Database["public"]["Functions"]["create_afiliado_admin"]["Returns"][number];
type InfluencerAdminToggleItem = Database["public"]["Functions"]["toggle_afiliado_admin"]["Returns"][number];

async function requireSuperAdmin() {
  const supabase = await supabaseRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 }) };
  }

  let role = user.app_metadata?.role ?? user.user_metadata?.role ?? null;
  if (!role) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", user.id).maybeSingle();
    role = profile?.role ?? null;
  }

  if (!isSuperAdminRole(typeof role === "string" ? role : null)) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 }) };
  }

  return { ok: true as const, supabase };
}

export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const { data, error } = await (auth.supabase.rpc as any)("list_influencers_admin");
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, items: (data ?? []) as InfluencerAdminListItem[] });
}

export async function POST(request: Request) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const parsed = CreateInfluencerSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Payload inválido" }, { status: 400 });
  }

  const payload = parsed.data;
  const { data, error } = await (auth.supabase.rpc as any)("create_influencer_admin", {
    p_nome: payload.nome,
    p_codigo: payload.codigo,
    p_email: payload.email,
    p_pin: payload.pin,
  });

  if (error) {
    const status = error.code === "23505" ? 409 : 400;
    return NextResponse.json({ ok: false, error: error.message }, { status });
  }

  const influencer = (Array.isArray(data) ? data[0] : null) as InfluencerAdminCreateItem | null;
  const portalUrl = "https://app.klasse.ao/parceiros";
  const mail = buildAffiliateCredentialsEmail({
    nome: payload.nome,
    email: payload.email.toLowerCase(),
    codigo: String(influencer?.codigo ?? payload.codigo).toUpperCase(),
    pin: payload.pin,
    portalUrl,
  });
  const emailStatus = await sendMail({
    to: payload.email.toLowerCase(),
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });

  return NextResponse.json({
    ok: true,
    influencer,
    emailStatus,
  });
}

export async function PATCH(request: Request) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const parsed = ToggleInfluencerSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Payload inválido" }, { status: 400 });
  }

  const { data, error } = await (auth.supabase.rpc as any)("toggle_influencer_admin", {
    p_id: parsed.data.id,
    p_ativo: parsed.data.ativo,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    influencer: (Array.isArray(data) ? data[0] : null) as InfluencerAdminToggleItem | null,
  });
}
