import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const s = await supabaseServerTyped();
    const { data: { user } } = await s.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(s as any, user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const alunoId = searchParams.get("aluno_id");
    if (!alunoId) return NextResponse.json({ ok: false, error: "aluno_id obrigatório" }, { status: 400 });

    const sAny = s as any;
    const { data: caseRow, error: caseError } = await sAny
      .from("financeiro_cobranca_cases")
      .select("id, aluno_id, status_operacional, owner_user_id, last_contact_at, next_action_at, sla_at, updated_at")
      .eq("escola_id", escolaId)
      .eq("aluno_id", alunoId)
      .maybeSingle();
    if (caseError) return NextResponse.json({ ok: false, error: caseError.message }, { status: 500 });
    if (!caseRow) return NextResponse.json({ ok: true, case: null, events: [] });

    const { data: events, error: eventsError } = await sAny
      .from("financeiro_cobranca_events")
      .select("id, event_type, payload, created_by, created_at")
      .eq("escola_id", escolaId)
      .eq("case_id", caseRow.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (eventsError) return NextResponse.json({ ok: false, error: eventsError.message }, { status: 500 });

    return NextResponse.json({ ok: true, case: caseRow, events: events ?? [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
