import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; turmaId: string }> }
) {
  const { id: escolaId, turmaId } = await params;
  try {
    const supabase = await createRouteClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, escolaId);
    if (!userEscolaId) {
      return NextResponse.json({ ok: false, error: "Permissão negada" }, { status: 403 });
    }

    const body = await req.json();
    const { slot_id, professor_id, motivo, data } = body;

    if (!slot_id || !professor_id) {
      return NextResponse.json({ ok: false, error: "Campos obrigatórios ausentes" }, { status: 400 });
    }

    const { error } = await (supabase as any)
      .from("substituicoes_professores")
      .upsert({
        escola_id: userEscolaId,
        turma_id: turmaId,
        slot_id,
        professor_id,
        motivo,
        data: data || new Date().toISOString().split('T')[0]
      }, {
        onConflict: "turma_id, slot_id, data"
      });

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Substitution error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
