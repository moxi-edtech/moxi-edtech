import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { canManageEscolaResources } from "../../permissions";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await context.params;

  try {
    const s = await supabaseServer();
    const { data: auth } = await s.auth.getUser();
    const user = auth?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Configuração Supabase ausente." }, { status: 500 });
    }

    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const allowed = await canManageEscolaResources(admin, escolaId, user.id);
    if (!allowed) return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });

    const url = new URL(req.url);
    const classeId = url.searchParams.get("classe_id");
    const turno = url.searchParams.get("turno");
    let anoLetivo = url.searchParams.get("ano_letivo") || undefined;
    const sessionId = url.searchParams.get("session_id");

    if (!classeId || !turno) {
      return NextResponse.json({ ok: false, error: "classe_id e turno são obrigatórios" }, { status: 400 });
    }

    if (!anoLetivo && sessionId) {
      const { data: sess } = await admin
        .from("school_sessions")
        .select("nome")
        .eq("id", sessionId)
        .maybeSingle();
      anoLetivo = (sess as any)?.nome || undefined;
    }

    let query = admin
      .from("turmas")
      .select("nome")
      .eq("escola_id", escolaId)
      .eq("turno", turno)
      .eq("classe_id", classeId);

    if (anoLetivo) query = query.eq("ano_letivo", anoLetivo);
    if (sessionId) query = query.eq("session_id", sessionId);

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
