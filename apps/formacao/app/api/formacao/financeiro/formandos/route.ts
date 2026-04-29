import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";
import type { FormacaoSupabaseClient } from "@/lib/db-types";

export const dynamic = "force-dynamic";

const allowedRoles = [
  "formacao_financeiro",
  "formacao_admin",
  "super_admin",
  "global_admin",
];

export async function GET(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const s = auth.supabase as FormacaoSupabaseClient;
  const url = new URL(request.url);
  const q = String(url.searchParams.get("q") ?? "").trim();
  const limitRaw = Number(url.searchParams.get("limit") ?? "20");
  const limit = Math.max(1, Math.min(Number.isFinite(limitRaw) ? limitRaw : 20, 50));

  let query = s
    .from("alunos")
    .select("id, usuario_auth_id, profile_id, nome, email, bi_numero")
    .eq("escola_id", auth.escolaId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (q) {
    const escaped = q.replace(/[%_]/g, "");
    query = query.or(`nome.ilike.%${escaped}%,email.ilike.%${escaped}%,bi_numero.ilike.%${escaped}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  const items = (data ?? []).map((row) => {
    const typed = row as {
      id: string;
      usuario_auth_id: string | null;
      profile_id: string | null;
      nome: string | null;
      email: string | null;
      bi_numero: string | null;
    };

    const userId = String(typed.usuario_auth_id ?? typed.profile_id ?? "").trim();
    return {
      aluno_id: typed.id,
      user_id: userId,
      nome: typed.nome,
      email: typed.email,
      bi_numero: typed.bi_numero,
      label: [typed.nome ?? "Sem nome", typed.email ?? "", typed.bi_numero ?? ""].filter(Boolean).join(" · "),
    };
  }).filter((item) => item.user_id);

  return NextResponse.json({ ok: true, items });
}
