import { NextResponse } from "next/server";
import { recordAuditServer } from "@/lib/audit";
import { authorizeEscolaAction } from "@/lib/escola/disciplinas";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ importacaoId: string }> },
) {
  const supabase = await supabaseServerTyped<any>();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

  const escolaId = await resolveEscolaIdForUser(supabase, user.id);
  if (!escolaId) return NextResponse.json({ ok: false, error: "Escola inválida" }, { status: 403 });

  const authz = await authorizeEscolaAction(supabase, escolaId, user.id, ["configurar_escola"]);
  if (!authz.allowed) {
    return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 });
  }

  const { importacaoId } = await params;
  const { data, error } = await supabase.rpc("aplicar_virada_importacao", {
    p_importacao_id: importacaoId,
  });

  if (error) {
    const status = error.message.includes("AUTH:") ? 403 : 400;
    return NextResponse.json({ ok: false, error: error.message.replace(/^(AUTH|DATA):\s*/, "") }, { status });
  }

  recordAuditServer({
    escolaId,
    portal: "secretaria",
    acao: "VIRADA_NOTAS_APLICAR",
    entity: "virada_importacoes",
    entityId: importacaoId,
    details: data,
  }).catch(() => null);

  return NextResponse.json({ ok: true, result: data });
}
