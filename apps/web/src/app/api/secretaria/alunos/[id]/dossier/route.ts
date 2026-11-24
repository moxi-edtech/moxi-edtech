import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRoleInSchool } from "@/lib/authz";
import { K12_SECRETARIA_OPERACIONAL_ROLE_GROUP } from "@/lib/roles";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { loadAlunoDossierData } from "@/lib/aluno/load-dossier-data";
import { canCorrigirNomeAluno } from "@/lib/aluno/nome-permissions";
import { canManageBolsa } from "@/lib/aluno/bolsa-permissions";
import { carregarCicloVidaAluno } from "@/lib/matriculas/load-student-lifecycle";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(
  request: Request,
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
  const requestedEscolaId = new URL(request.url).searchParams.get("escola_id");
  if (requestedEscolaId && !z.string().uuid().safeParse(requestedEscolaId).success) {
    return NextResponse.json({ ok: false, error: "Escola inválida." }, { status: 400 });
  }
  const escolaId = await resolveEscolaIdForUser(supabase, user.id, requestedEscolaId);
  if (!escolaId) {
    return NextResponse.json({ ok: false, error: "Escola não identificada." }, { status: 403 });
  }

  const authorization = await requireRoleInSchool({
    supabase,
    escolaId,
    roles: [...K12_SECRETARIA_OPERACIONAL_ROLE_GROUP, 'diretor', 'admin_secretaria', 'admin_secretario'],
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
    const { data: member, error: memberError } = await supabase
      .from("escola_users")
      .select("papel")
      .eq("escola_id", escolaId)
      .eq("user_id", user.id)
      .maybeSingle();
    const canEditNome = !memberError && Boolean(aluno) && canCorrigirNomeAluno(member?.papel);
    // O comando da bolsa só aparece quando o aluno é da escola do utilizador.
    // Sem vínculo verificado, não anunciar uma ação que a RPC vai rejeitar.
    const canManageBolsaForStudent = !memberError && Boolean(aluno)
      && result.aluno.perfil.escola_id === escolaId
      && canManageBolsa(member?.papel);
    const cicloVida = await carregarCicloVidaAluno(supabase, escolaId, alunoId).catch(() => null);
    return NextResponse.json(
      { ok: true, ...result, canEditNome, canManageBolsa: canManageBolsaForStudent, cicloVida, cicloVidaIndisponivel: cicloVida === null },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Não foi possível carregar a ficha integral. Tente novamente." },
      { status: 500 },
    );
  }
}
