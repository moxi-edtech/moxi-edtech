import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRoleInSchool } from "@/lib/authz";
import { K12_SECRETARIA_OPERACIONAL_ROLE_GROUP } from "@/lib/roles";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { loadAlunoDossierData } from "@/lib/aluno/load-dossier-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: alunoId } = await params;
  if (!z.string().uuid().safeParse(alunoId).success) {
    return NextResponse.json({ ok: false, error: "Aluno inválido." }, { status: 400 });
  }

  const supabase = await supabaseServer();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) {
    return NextResponse.json({ ok: false, error: "Sessão expirada." }, { status: 401 });
  }

  // The operator's school comes from their authenticated membership, not
  // from an arbitrary client query parameter.
  const escolaId = await resolveEscolaIdForUser(supabase, user.id);
  if (!escolaId) {
    return NextResponse.json({ ok: false, error: "Escola não identificada." }, { status: 403 });
  }

  const authorization = await requireRoleInSchool({
    supabase,
    escolaId,
    roles: [...K12_SECRETARIA_OPERACIONAL_ROLE_GROUP],
  });
  if (authorization.error) return authorization.error;

  // Student must belong to this school or have an enrolled record here;
  // this also supports legitimate transfers without exposing other tenants.
  const { data: aluno, error: alunoError } = await supabase
    .from("alunos")
    .select("id")
    .eq("id", alunoId)
    .eq("escola_id", escolaId)
    .maybeSingle();
  if (alunoError) {
    return NextResponse.json({ ok: false, error: "Não foi possível validar o aluno." }, { status: 500 });
  }
  if (!aluno) {
    const { data: enrollment, error: enrollmentError } = await supabase
      .from("matriculas")
      .select("id")
      .eq("aluno_id", alunoId)
      .eq("escola_id", escolaId)
      .limit(1)
      .maybeSingle();
    if (enrollmentError) {
      return NextResponse.json({ ok: false, error: "Não foi possível validar a matrícula." }, { status: 500 });
    }
    if (!enrollment) {
      return NextResponse.json({ ok: false, error: "Aluno não encontrado nesta escola." }, { status: 404 });
    }
  }

  try {
    const result = await loadAlunoDossierData({ supabase, escolaId, alunoId });
    if (!result) {
      return NextResponse.json({ ok: false, error: "Ficha integral indisponível." }, { status: 404 });
    }
    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Não foi possível carregar a ficha integral. Tente novamente." },
      { status: 500 },
    );
  }
}
