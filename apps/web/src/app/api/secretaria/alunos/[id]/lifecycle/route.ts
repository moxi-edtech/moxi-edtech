import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleInSchool } from "@/lib/authz";
import { K12_SECRETARIA_OPERACIONAL_ROLE_GROUP } from "@/lib/roles";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { carregarCicloVidaAluno } from "@/lib/matriculas/load-student-lifecycle";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** SSOT de leitura da Secretaria; nunca altera estados nem resultados. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: alunoId } = await params;
  if (!z.string().uuid().safeParse(alunoId).success) {
    return NextResponse.json({ ok: false, error: "Aluno inválido." }, { status: 400 });
  }
  const db = await supabaseServerTyped<any>();
  const { data: { user }, error: sessionError } = await db.auth.getUser();
  if (sessionError || !user) return NextResponse.json({ ok: false, error: "Sessão expirada." }, { status: 401 });
  const escolaId = await resolveEscolaIdForUser(db, user.id);
  if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não identificada." }, { status: 403 });
  const authorization = await requireRoleInSchool({
    supabase: db,
    escolaId,
    roles: [...K12_SECRETARIA_OPERACIONAL_ROLE_GROUP],
  });
  if (authorization.error) return authorization.error;
  const { data: aluno, error: checkError } = await db.from("alunos").select("id")
    .eq("escola_id", escolaId).eq("id", alunoId).maybeSingle();
  if (checkError) return NextResponse.json({ ok: false, error: "Falha ao validar o aluno." }, { status: 500 });
  if (!aluno) return NextResponse.json({ ok: false, error: "Aluno não encontrado nesta escola." }, { status: 404 });
  try {
    const cicloVida = await carregarCicloVidaAluno(db, escolaId, alunoId);
    return NextResponse.json({ ok: true, cicloVida }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Não foi possível consultar os estados do aluno." }, { status: 503 });
  }
}
