import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-client";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { canManageEscolaResources } from "../../permissions";
import { applyKf2ListInvariants } from "@/lib/kf2";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params;

  try {
    const supabase = await createRouteClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, escolaId);
    if (!userEscolaId || userEscolaId !== escolaId) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    const allowed = await canManageEscolaResources(supabase as any, escolaId, user.id);
    if (!allowed) return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });

    const url = new URL(req.url);
    const classeId = url.searchParams.get("classe_id");
    const turno = url.searchParams.get("turno");
    const anoLetivoParam = url.searchParams.get("ano_letivo");
    const parsedAnoLetivo = anoLetivoParam ? Number(anoLetivoParam) : undefined;
    let anoLetivo = Number.isFinite(parsedAnoLetivo) ? parsedAnoLetivo : undefined;
    const sessionId = url.searchParams.get("session_id");

    if (!classeId || !turno) {
      return NextResponse.json({ ok: false, error: "classe_id e turno são obrigatórios" }, { status: 400 });
    }

    if (!anoLetivo && sessionId) {
      // Sem tabela de sessions neste schema; usamos apenas o filtro por session_id.
      anoLetivo = undefined;
    }

    let query = supabase
      .from("turmas")
      .select("nome")
      .eq("escola_id", escolaId)
      .eq("turno", turno)
      .eq("classe_id", classeId);

    if (anoLetivo) query = query.eq("ano_letivo", anoLetivo);
    if (sessionId) query = query.eq("session_id", sessionId);

    query = applyKf2ListInvariants(query, { defaultLimit: 50 });

    const { data: existing, error } = await query;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    const used = new Set<string>();
    (existing || []).forEach((t: any) => {
      const raw = (t?.nome || "").toString().trim().toUpperCase();
      if (!raw) return;
      const letterMatch = raw.match(/[A-Z]$/);
      const letter = letterMatch ? letterMatch[0] : raw.charAt(0);
      if (letter) used.add(letter);
    });

    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    const suggestion = alphabet.find((l) => !used.has(l)) || "Z";

    return NextResponse.json({ ok: true, suggested: suggestion, existing: Array.from(used) });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
