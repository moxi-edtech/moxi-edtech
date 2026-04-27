import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";
import type { FormacaoSupabaseClient } from "@/lib/db-types";
import { parseCandidatesQuery } from "@/lib/talent-pool/routes-contract";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireFormacaoRoles([
    "formacao_admin",
    "formacao_secretaria",
    "formacao_financeiro",
    "super_admin",
    "global_admin",
  ]);
  if (!auth.ok) return auth.response;

  const { limit, search } = parseCandidatesQuery(request.url);

  const s = auth.supabase as FormacaoSupabaseClient;
  const viewName: string = "vw_talentos_publicos";

  const { data, error } = await s
    .from(viewName)
    .select("aluno_id, escola_id, provincia, municipio, preferencia_trabalho, career_headline, skills_tags, anonymous_slug")
    .eq("escola_id", auth.escolaId)
    .limit(limit);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  const rows = ((data ?? []) as Array<Record<string, unknown>>).filter((row) => {
    if (!search) return true;
    const headline = String(row.career_headline ?? "").toLowerCase();
    const provincia = String(row.provincia ?? "").toLowerCase();
    const municipio = String(row.municipio ?? "").toLowerCase();
    const preferencia = String(row.preferencia_trabalho ?? "").toLowerCase();
    const slug = String(row.anonymous_slug ?? "").toLowerCase();
    return [headline, provincia, municipio, preferencia, slug].some((v) => v.includes(search));
  });

  return NextResponse.json({ ok: true, items: rows });
}
