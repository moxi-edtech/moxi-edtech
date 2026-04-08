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
  municipio: string | null;
  provincia: string | null;
  email: string | null;
  telefone: string | null;
  capacidade_max: number | null;
  updated_at: string | null;
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
      .select("id, escola_id, nome, abrev, status, plano, municipio, provincia, email, telefone, capacidade_max, updated_at")
      .order("nome", { ascending: true })
      .order("id", { ascending: true })
      .limit(200);

    if (error) {
      throw error;
    }

    const items: CentroItem[] = (data ?? []).map((row) => {
      const normalized = row as Record<string, unknown>;
      return {
        id: String(normalized.id ?? ""),
        escola_id: String(normalized.escola_id ?? ""),
        nome: String(normalized.nome ?? ""),
        abrev: typeof normalized.abrev === "string" ? normalized.abrev : null,
        status: String(normalized.status ?? "onboarding"),
        plano: String(normalized.plano ?? "basic"),
        municipio: typeof normalized.municipio === "string" ? normalized.municipio : null,
        provincia: typeof normalized.provincia === "string" ? normalized.provincia : null,
        email: typeof normalized.email === "string" ? normalized.email : null,
        telefone: typeof normalized.telefone === "string" ? normalized.telefone : null,
        capacidade_max:
          typeof normalized.capacidade_max === "number" ? normalized.capacidade_max : null,
        updated_at: typeof normalized.updated_at === "string" ? normalized.updated_at : null,
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
