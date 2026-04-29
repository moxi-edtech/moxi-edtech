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

export async function GET(request: Request) {
  const auth = await requireFormacaoRoles(allowedRoles);
  if (!auth.ok) return auth.response;

  const s = auth.supabase as FormacaoSupabaseClient;
  const url = new URL(request.url);
  const q = String(url.searchParams.get("q") ?? "").trim();
  const escaped = q.replace(/[%_]/g, "");

  let formandoQuery = s
    .from("alunos")
    .select("id, usuario_auth_id, profile_id, nome, email, bi_numero")
    .eq("escola_id", auth.escolaId)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (escaped) {
    formandoQuery = formandoQuery.or(`nome.ilike.%${escaped}%,email.ilike.%${escaped}%,bi_numero.ilike.%${escaped}%`);
  }

  const [formandosResult, cohortsResult] = await Promise.all([
    formandoQuery,
    s
      .from("formacao_cohorts")
      .select("id, codigo, nome, curso_nome, status")
      .eq("escola_id", auth.escolaId)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (formandosResult.error) {
    return NextResponse.json({ ok: false, error: formandosResult.error.message }, { status: 400 });
  }

  if (cohortsResult.error) {
    return NextResponse.json({ ok: false, error: cohortsResult.error.message }, { status: 400 });
  }

  const formandos = (formandosResult.data ?? [])
    .map((row) => {
      const typed = row as {
        id: string;
        usuario_auth_id: string | null;
        profile_id: string | null;
        nome: string | null;
        email: string | null;
        bi_numero: string | null;
      };

      const userId = String(typed.usuario_auth_id ?? typed.profile_id ?? "").trim();
      if (!userId) return null;

      return {
        user_id: userId,
        nome: typed.nome ?? "Sem nome",
        email: typed.email,
        bi_numero: typed.bi_numero,
        label: [typed.nome ?? "Sem nome", typed.email ?? "", typed.bi_numero ?? ""].filter(Boolean).join(" · "),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const cohorts = (cohortsResult.data ?? []).map((row) => {
    const typed = row as {
      id: string;
      codigo: string | null;
      nome: string | null;
      curso_nome: string | null;
      status: string | null;
    };

    return {
      id: typed.id,
      nome: typed.nome ?? "Turma",
      codigo: typed.codigo,
      curso_nome: typed.curso_nome,
      status: typed.status,
      label: [typed.codigo ?? "", typed.nome ?? "Turma", typed.curso_nome ?? ""].filter(Boolean).join(" · "),
    };
  });

  return NextResponse.json({ ok: true, formandos, cohorts });
}
