import { NextResponse } from "next/server";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { authorizeEscolaAction } from "@/lib/escola/disciplinas";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export async function GET(req: Request) {
  try {
    const s = await supabaseServerTyped<Database>();
    const { data: userRes } = await s.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const url = new URL(req.url);
    const escolaIdParam = url.searchParams.get("escolaId") || null;
    const escolaId = await resolveEscolaIdForUser(s as any, user.id, escolaIdParam);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 400 });

    const authz = await authorizeEscolaAction(s as any, escolaId, user.id, []);
    if (!authz.allowed) return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 });

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Server misconfigured" }, { status: 500 });
    }

    const admin = createClient<any>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await (admin as any).rpc('get_metricas_acesso_alunos', { p_escola_id: escolaId });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    const metrics = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ ok: true, data: metrics });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
