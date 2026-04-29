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
  papel: string;
};

type RpcClient = {
  rpc(
    fn: string,
    args: Record<string, unknown>
  ): Promise<{ data: unknown; error: { message: string } | null }>;
};

async function getFormadoresByCentro(client: FormacaoSupabaseClient, escolaId: string) {
  const { data, error } = await (client as unknown as RpcClient).rpc("formacao_formadores_por_centro", {
    p_escola_id: escolaId,
  });

  if (error || !Array.isArray(data)) return [] as ProfileRow[];

  return data
    .map((row) => {
      const parsed = row as { user_id?: string; nome?: string; email?: string | null; papel?: string };
      if (!parsed.user_id || !parsed.nome) return null;
      return {
        user_id: String(parsed.user_id),
        nome: String(parsed.nome),
        email: parsed.email ? String(parsed.email) : null,
        papel: String(parsed.papel ?? "formador"),
      };
    })
    .filter((row): row is ProfileRow => Boolean(row));
}

export async function GET() {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const s = auth.supabase as FormacaoSupabaseClient;
  const profiles = await getFormadoresByCentro(s, auth.escolaId as string);

  return NextResponse.json({
    ok: true,
    formadores: profiles
      .map((profile) => ({
        user_id: profile.user_id,
        nome: profile.nome,
        email: profile.email,
        papel: profile.papel,
      }))
  });
}
