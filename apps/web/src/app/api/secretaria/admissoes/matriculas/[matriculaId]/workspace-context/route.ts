import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleInSchool } from "@/lib/authz";
import { K12_SECRETARIA_OPERACIONAL_ROLE_GROUP } from "@/lib/roles";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ matriculaId: string }> },
) {
  const { matriculaId } = await params;
  if (!z.string().uuid().safeParse(matriculaId).success) {
    return NextResponse.json({ ok: false, error: "Matrícula inválida." }, { status: 400 });
  }
  const supabase = await supabaseServer();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (!user || error) return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
  const escolaId = await resolveEscolaIdForUser(supabase, user.id);
  if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não identificada." }, { status: 403 });
  const authorization = await requireRoleInSchool({
    supabase, escolaId, roles: [...K12_SECRETARIA_OPERACIONAL_ROLE_GROUP],
  });
  if (authorization.error) return authorization.error;

  const { error: classPermissionError } = await requireRoleInSchool({
    supabase, escolaId, roles: ["admin", "admin_escola"],
  });
  const { data, error: queryError } = await supabase.from("matriculas")
    .select("id, turma_id, ano_letivo, session_id")
    .eq("id", matriculaId).eq("escola_id", escolaId).maybeSingle();
  if (queryError) return NextResponse.json({ ok: false, error: "Falha ao carregar matrícula." }, { status: 500 });
  if (!data || !data.turma_id || !data.ano_letivo) {
    return NextResponse.json({ ok: false, error: "Matrícula sem turma ou ano letivo válido." }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    matricula: { id: data.id, turmaId: data.turma_id, ano: data.ano_letivo, sessionId: data.session_id, canRectifyClass: !classPermissionError },
  }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
