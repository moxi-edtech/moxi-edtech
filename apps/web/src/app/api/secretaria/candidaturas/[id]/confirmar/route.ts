import { NextResponse } from "next/server";
import { authorizeMatriculasManage } from "@/lib/escola/disciplinas";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const authz = await authorizeMatriculasManage(supabase as any, escolaId, user.id);
  if (!authz.allowed) {
    return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 });
  }

  const { id } = await params;
  return NextResponse.json(
    {
      ok: false,
      error: "Rota legada removida. Use /api/secretaria/admissoes/convert.",
      candidatura_id: id,
    },
    { status: 410 }
  );
}
