import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";

export async function GET(
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

    // Generate historical occupancy by month
    // We count active matriculas that existed at the end of each month
    const { data, error } = await (supabase as any).rpc("get_turma_occupancy_history", {
      p_turma_id: turmaId
    });

    if (error) throw error;

    return NextResponse.json({ ok: true, data: data || [] });
  } catch (err: any) {
    console.error("Occupancy history error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
