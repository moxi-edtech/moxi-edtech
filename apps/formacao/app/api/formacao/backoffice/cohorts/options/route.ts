import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";
import type { FormacaoSupabaseClient } from "@/lib/db-types";

export const dynamic = "force-dynamic";

const allowedRoles = [
  "formacao_admin",
  "formacao_secretaria",
  "super_admin",
  "global_admin",
];

type ProfileRow = {
  user_id: string;
  nome: string;
  email: string | null;
};

async function getProfilesByIds(client: FormacaoSupabaseClient, userIds: string[]) {
  if (userIds.length === 0) return [] as ProfileRow[];

  const { data, error } = await client.rpc("tenant_profiles_by_ids", {
    p_user_ids: userIds,
  });

  if (error || !Array.isArray(data)) return [] as ProfileRow[];

  return data
    .map((row) => {
      const parsed = row as { user_id?: string; nome?: string; email?: string | null };
      if (!parsed.user_id || !parsed.nome) return null;
      return {
        user_id: String(parsed.user_id),
        nome: String(parsed.nome),
        email: parsed.email ? String(parsed.email) : null,
      };
    })
    .filter((row): row is ProfileRow => Boolean(row));
}

export async function GET() {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const s = auth.supabase as FormacaoSupabaseClient;

  const { data: escolaUsers } = await s
    .from("escola_users")
    .select("user_id, papel")
    .eq("escola_id", auth.escolaId)
    .or("papel.eq.formador,papel.eq.formacao_formador,papel.eq.formacao_admin");

  const userIds = Array.from(
    new Set(
      (escolaUsers ?? [])
        .map((row) => String((row as { user_id: string | null }).user_id ?? ""))
        .filter(Boolean)
    )
  );

  const profiles = await getProfilesByIds(s, userIds);

  return NextResponse.json({
    ok: true,
    formadores: profiles
      .map((profile) => ({
        user_id: profile.user_id,
        nome: profile.nome,
        email: profile.email,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
  });
}
