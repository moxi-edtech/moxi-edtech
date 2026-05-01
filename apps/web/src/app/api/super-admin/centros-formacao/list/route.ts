import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabaseServer";
import { isSuperAdminRole } from "@/lib/auth/requireSuperAdminAccess";

type CentroItem = {
  id: string;
  escola_id: string;
  nome: string;
  abrev: string | null;
  status: string;
  plano: string;
  subscription_status: string;
  trial_ends_at: string | null;
  municipio: string | null;
  provincia: string | null;
  email: string | null;
  telefone: string | null;
  capacidade_max: number | null;
  updated_at: string | null;
  last_automated_reminder_at: string | null;
  last_manual_reminder_at: string | null;
  last_commercial_contact_at: string | null;
  commercial_notes: string | null;
  billing?: {
    id: string;
    status: string;
    data_renovacao: string;
    valor_kz: number;
    last_payment_status: string | null;
    last_payment_id: string | null;
    comprovativo_url: string | null;
  } | null;
};

export async function GET() {
  try {
    const s = (await supabaseServer()) as unknown as SupabaseClient;
    const { data: sess } = await s.auth.getUser();
    const user = sess?.user;

    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const { data: roles } = await s
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    const role = (roles?.[0] as { role?: string } | undefined)?.role;
    if (!isSuperAdminRole(role)) {
      return NextResponse.json({ ok: false, error: "Somente Super Admin" }, { status: 403 });
    }

    const { data, error } = await s
      .from("centros_formacao")
      .select(`
        id, escola_id, nome, abrev, status, plano, subscription_status, trial_ends_at, municipio, provincia, email, telefone, capacidade_max, updated_at, last_automated_reminder_at, last_manual_reminder_at, last_commercial_contact_at, commercial_notes,
        escolas:escola_id (
          assinaturas (
            id, status, plano, data_renovacao, valor_kz, created_at,
            pagamentos_saas (id, status, comprovativo_url, created_at)
          )
        )
      `)
      .order("nome", { ascending: true })
      .order("id", { ascending: true })
      .limit(200);

    if (error) {
      throw error;
    }

    const items: CentroItem[] = (data ?? []).map((row) => {
      const normalized = row as Record<string, any>;

      // Extrair info de billing se existir
      const assinaturas = (normalized.escolas?.assinaturas ?? []) as any[];
      const latestAss = assinaturas.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];

      let billing: CentroItem["billing"] = null;
      if (latestAss) {
        const pagamentos = (latestAss.pagamentos_saas ?? []) as any[];
        const latestPag = pagamentos.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];

        billing = {
          id: latestAss.id,
          status: latestAss.status,
          data_renovacao: latestAss.data_renovacao,
          valor_kz: latestAss.valor_kz,
          last_payment_status: latestPag?.status ?? null,
          last_payment_id: latestPag?.id ?? null,
          comprovativo_url: latestPag?.comprovativo_url ?? null,
        };
      }

      return {
        id: String(normalized.id ?? ""),
        escola_id: String(normalized.escola_id ?? ""),
        nome: String(normalized.nome ?? ""),
        abrev: typeof normalized.abrev === "string" ? normalized.abrev : null,
        status: String(normalized.status ?? "onboarding"),
        plano: String(normalized.plano ?? "basic"),
        subscription_status: String(normalized.subscription_status ?? "trial"),
        trial_ends_at: typeof normalized.trial_ends_at === "string" ? normalized.trial_ends_at : null,
        municipio: typeof normalized.municipio === "string" ? normalized.municipio : null,
        provincia: typeof normalized.provincia === "string" ? normalized.provincia : null,
        email: typeof normalized.email === "string" ? normalized.email : null,
        telefone: typeof normalized.telefone === "string" ? normalized.telefone : null,
        capacidade_max:
          typeof normalized.capacidade_max === "number" ? normalized.capacidade_max : null,
        updated_at: typeof normalized.updated_at === "string" ? normalized.updated_at : null,
        last_automated_reminder_at:
          typeof normalized.last_automated_reminder_at === "string"
            ? normalized.last_automated_reminder_at
            : null,
        last_manual_reminder_at:
          typeof normalized.last_manual_reminder_at === "string" ? normalized.last_manual_reminder_at : null,
        last_commercial_contact_at:
          typeof normalized.last_commercial_contact_at === "string" ? normalized.last_commercial_contact_at : null,
        commercial_notes: typeof normalized.commercial_notes === "string" ? normalized.commercial_notes : null,
        billing,
      };
    });

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Erro interno",
      },
      { status: 500 }
    );
  }
}
