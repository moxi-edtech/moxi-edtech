import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { supabaseServerRole } from "@/lib/supabaseServerRole";
import { normalizePlanFeatureFlags, parsePlanTier } from "@/config/plans";
import type { DBWithRPC } from "@/types/supabase-augment";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const payloadSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  status: z.enum(["disabled", "pending_qr", "connected", "disconnected", "error"]),
  fallbackPhone: z.string().trim().max(40).optional().nullable(),
});

const withNoStore = (response: NextResponse, start?: number) => {
  response.headers.set("Cache-Control", "no-store");
  if (start !== undefined) {
    response.headers.set("Server-Timing", `app;dur=${Date.now() - start}`);
  }
  return response;
};

async function authorize(
  requestedEscolaId: string,
  supabase: Awaited<ReturnType<typeof supabaseServerTyped<DBWithRPC>>>
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Não autenticado", status: 401, user: null, escolaId: null } as const;
  }

  const userEscolaId = await resolveEscolaIdForUser(supabase, user.id, requestedEscolaId);
  if (!userEscolaId) {
    return { error: "Acesso negado a esta escola.", status: 403, user, escolaId: null } as const;
  }

  const { data: hasRole, error: rolesError } = await supabase.rpc("user_has_role_in_school", {
    p_escola_id: userEscolaId,
    p_roles: ["admin_escola", "admin", "staff_admin"],
  });

  if (rolesError) {
    return { error: "Erro ao verificar permissões.", status: 500, user, escolaId: null } as const;
  }

  if (!hasRole) {
    return { error: "Você não tem permissão para gerir a comunicação desta escola.", status: 403, user, escolaId: null } as const;
  }

  return { error: null, status: 200, user, escolaId: userEscolaId } as const;
}

async function loadPlanFlags(admin: ReturnType<typeof supabaseServerRole<DBWithRPC>>, escolaId: string) {
  const { data: escola } = await admin
    .from("escolas")
    .select("plano_atual")
    .eq("id", escolaId)
    .maybeSingle();

  const plan = (escola as { plano_atual?: string | null } | null)?.plano_atual ?? null;
  if (!plan) return null;

  const { data: rawFlags } = await admin
    .from("app_plan_limits")
    .select("plan, price_mensal_kz, max_alunos, max_admin_users, max_storage_gb, professores_ilimitados, api_enabled, multi_campus, fin_recibo_pdf, sec_upload_docs, sec_matricula_online, doc_qr_code, app_whatsapp_auto, suporte_prioritario")
    .eq("plan", parsePlanTier(plan))
    .maybeSingle();

  return rawFlags ? normalizePlanFeatureFlags(rawFlags) : null;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const start = Date.now();
  try {
    const { id: requestedEscolaId } = await params;
    const supabase = await supabaseServerTyped<DBWithRPC>();
    const auth = await authorize(requestedEscolaId, supabase);
    if (auth.error || !auth.escolaId) {
      return withNoStore(NextResponse.json({ ok: false, error: auth.error }, { status: auth.status }), start);
    }

    const admin = supabaseServerRole<DBWithRPC>();
    const [providerRes, planFlags] = await Promise.all([
      admin
        .from("school_notification_providers")
        .select("id, school_id, provider_type, display_name, status, daily_limit, monthly_limit, session_name, config, created_at, updated_at")
        .eq("school_id", auth.escolaId)
        .eq("provider_type", "whatsapp_waha")
        .maybeSingle(),
      loadPlanFlags(admin, auth.escolaId),
    ]);

    if (providerRes.error) {
      return withNoStore(
        NextResponse.json({ ok: false, error: providerRes.error.message || "Falha ao carregar provedor WAHA." }, { status: 500 }),
        start
      );
    }

    const provider = providerRes.data
      ? {
          ...providerRes.data,
          config:
            providerRes.data.config && typeof providerRes.data.config === "object"
              ? providerRes.data.config
              : {},
        }
      : null;

    return withNoStore(
      NextResponse.json({
        ok: true,
        data: {
          provider,
          planAllowsWhatsappAuto: Boolean(planFlags?.app_whatsapp_auto),
          experimentalEnabled: process.env.WAHA_EXPERIMENTAL_ENABLED === "true",
        },
      }),
      start
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return withNoStore(NextResponse.json({ ok: false, error: message }, { status: 500 }), start);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const start = Date.now();
  try {
    const { id: requestedEscolaId } = await params;
    const supabase = await supabaseServerTyped<DBWithRPC>();
    const auth = await authorize(requestedEscolaId, supabase);
    if (auth.error || !auth.escolaId) {
      return withNoStore(NextResponse.json({ ok: false, error: auth.error }, { status: auth.status }), start);
    }

    const parsed = payloadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return withNoStore(NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 }), start);
    }

    const admin = supabaseServerRole<DBWithRPC>();
    const planFlags = await loadPlanFlags(admin, auth.escolaId);
    if (!planFlags?.app_whatsapp_auto) {
      return withNoStore(
        NextResponse.json({ ok: false, error: "O plano atual não libera WhatsApp automático." }, { status: 403 }),
        start
      );
    }

    const { displayName, status, fallbackPhone } = parsed.data;
    const { data: existing, error: existingError } = await admin
      .from("school_notification_providers")
      .select("id, daily_limit, monthly_limit, session_name, config")
      .eq("school_id", auth.escolaId)
      .eq("provider_type", "whatsapp_waha")
      .maybeSingle();

    if (existingError) {
      return withNoStore(
        NextResponse.json({ ok: false, error: existingError.message || "Falha ao carregar configuração actual." }, { status: 500 }),
        start
      );
    }

    const config =
      existing?.config && typeof existing.config === "object"
        ? { ...(existing.config as Record<string, unknown>), fallback_phone: fallbackPhone || null }
        : { fallback_phone: fallbackPhone || null };

    const payload = {
      school_id: auth.escolaId,
      provider_type: "whatsapp_waha" as const,
      display_name: displayName,
      status,
      daily_limit: existing?.daily_limit ?? 50,
      monthly_limit: existing?.monthly_limit ?? 500,
      session_name:
        existing?.session_name ||
        `klasse_school_${auth.escolaId.replace(/-/g, "").toLowerCase()}`,
      config,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await admin
      .from("school_notification_providers")
      .upsert(payload, { onConflict: "school_id,provider_type" })
      .select("id, school_id, provider_type, display_name, status, daily_limit, monthly_limit, session_name, config, created_at, updated_at")
      .single();

    if (error) {
      return withNoStore(
        NextResponse.json({ ok: false, error: error.message || "Falha ao guardar configuração WAHA." }, { status: 500 }),
        start
      );
    }

    return withNoStore(NextResponse.json({ ok: true, data }), start);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return withNoStore(NextResponse.json({ ok: false, error: message }, { status: 500 }), start);
  }
}
