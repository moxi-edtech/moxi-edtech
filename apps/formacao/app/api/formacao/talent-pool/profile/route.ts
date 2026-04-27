import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";
import type { FormacaoSupabaseClient } from "@/lib/db-types";

export const dynamic = "force-dynamic";

type ProfilePayload = {
  is_open_to_work?: boolean;
  career_headline?: string | null;
  provincia?: string | null;
  municipio?: string | null;
  preferencia_trabalho?: string | null;
};

function parseMedia(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== "object") return null;
  const bag = metadata as Record<string, unknown>;
  const mediaFinal = Number(bag.media_final ?? bag.nota_final ?? NaN);
  return Number.isFinite(mediaFinal) ? mediaFinal : null;
}

export async function GET() {
  const auth = await requireFormacaoRoles(["formando", "formacao_admin", "super_admin", "global_admin"]);
  if (!auth.ok) return auth.response;

  const s = auth.supabase as FormacaoSupabaseClient;
  const alunosTable: string = "alunos";
  const inscricoesTable: string = "formacao_inscricoes";
  const matchesTable: string = "talent_pool_matches";

  let alunoQuery = s
    .from(alunosTable)
    .select(
      "id, is_open_to_work, career_headline, provincia, municipio, preferencia_trabalho, anonymous_slug, skills_tags"
    )
    .eq("escola_id", auth.escolaId)
    .limit(1);

  if (auth.role === "formando") {
    alunoQuery = alunoQuery.or(`usuario_auth_id.eq.${auth.userId},profile_id.eq.${auth.userId}`);
  }

  const { data: alunoRows, error: alunoError } = await alunoQuery;
  if (alunoError) {
    return NextResponse.json({ ok: false, error: alunoError.message }, { status: 400 });
  }

  const aluno = (alunoRows ?? [])[0] as
    | {
        id: string;
        is_open_to_work: boolean | null;
        career_headline: string | null;
        provincia: string | null;
        municipio: string | null;
        preferencia_trabalho: string | null;
        anonymous_slug: string | null;
        skills_tags: unknown;
      }
    | undefined;

  if (!aluno) {
    return NextResponse.json({ ok: false, error: "Perfil de aluno nao encontrado" }, { status: 404 });
  }

  const { data: inscricoes, error: inscricoesError } = await s
    .from(inscricoesTable)
    .select("id, estado, metadata, updated_at")
    .eq("escola_id", auth.escolaId)
    .eq("formando_user_id", auth.userId)
    .eq("estado", "concluido")
    .order("updated_at", { ascending: false })
    .limit(20);

  if (inscricoesError) {
    return NextResponse.json({ ok: false, error: inscricoesError.message }, { status: 400 });
  }

  const maxMedia = (inscricoes ?? []).reduce((acc: number, row: unknown) => {
    const parsed = parseMedia((row as { metadata?: unknown }).metadata);
    return parsed !== null ? Math.max(acc, parsed) : acc;
  }, 0);

  const eligibleForOptIn = maxMedia > 16;

  const { count: pendingMatchesCount, error: pendingError } = await s
    .from(matchesTable)
    .select("id", { count: "exact", head: true })
    .eq("aluno_id", aluno.id)
    .eq("status", "pending");

  if (pendingError) {
    return NextResponse.json({ ok: false, error: pendingError.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    profile: {
      id: aluno.id,
      is_open_to_work: Boolean(aluno.is_open_to_work),
      career_headline: aluno.career_headline,
      provincia: aluno.provincia,
      municipio: aluno.municipio,
      preferencia_trabalho: aluno.preferencia_trabalho,
      anonymous_slug: aluno.anonymous_slug,
      skills_tags: Array.isArray(aluno.skills_tags) ? aluno.skills_tags : [],
      eligible_for_opt_in: eligibleForOptIn,
      highest_media: maxMedia > 0 ? maxMedia : null,
      pending_matches_count: pendingMatchesCount ?? 0,
    },
  });
}

export async function PATCH(request: Request) {
  const auth = await requireFormacaoRoles(["formando", "formacao_admin", "super_admin", "global_admin"]);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as ProfilePayload | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "Payload invalido" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body.is_open_to_work !== undefined) patch.is_open_to_work = Boolean(body.is_open_to_work);
  if (body.career_headline !== undefined) patch.career_headline = body.career_headline;
  if (body.provincia !== undefined) patch.provincia = body.provincia;
  if (body.municipio !== undefined) patch.municipio = body.municipio;
  if (body.preferencia_trabalho !== undefined) patch.preferencia_trabalho = body.preferencia_trabalho;

  if (Object.keys(patch).length <= 1) {
    return NextResponse.json({ ok: false, error: "Nenhum campo para atualizar" }, { status: 400 });
  }

  const s = auth.supabase as FormacaoSupabaseClient;
  const alunosTable: string = "alunos";

  let query = s
    .from(alunosTable)
    .update(patch)
    .eq("escola_id", auth.escolaId)
    .select(
      "id, is_open_to_work, career_headline, provincia, municipio, preferencia_trabalho, anonymous_slug, skills_tags"
    )
    .limit(1);

  if (auth.role === "formando") {
    query = query.or(`usuario_auth_id.eq.${auth.userId},profile_id.eq.${auth.userId}`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  const row = (data ?? [])[0];
  if (!row) {
    return NextResponse.json({ ok: false, error: "Perfil de aluno nao encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, profile: row });
}
