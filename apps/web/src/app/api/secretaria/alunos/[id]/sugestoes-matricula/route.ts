import { NextResponse } from "next/server";
import { requireRoleInSchool } from "@/lib/authz";
import { getSugestoesMatricula } from "@/lib/secretaria/sugestoes";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { K12_SECRETARIA_OPERACIONAL_ROLE_GROUP } from "@/lib/roles";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const alunoId = id;
    const supabase = await supabaseServerTyped<any>();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }
    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });
    }
    const authz = await requireRoleInSchool({
      supabase: supabase as any,
      escolaId,
      roles: [...K12_SECRETARIA_OPERACIONAL_ROLE_GROUP],
    });
    if (authz.error) return authz.error;

    const r = await getSugestoesMatricula(alunoId);
    if (!r.ok) return NextResponse.json({ ok: false, error: 'Sem vínculo ou dados' }, { status: 400 });
    if (r.escolaId && String(r.escolaId) !== String(escolaId)) {
      return NextResponse.json({ ok: false, error: "Aluno fora da escola ativa" }, { status: 403 });
    }
    return NextResponse.json({ ok: true, defaults: r.defaults, source: r.source });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
