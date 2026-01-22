import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { applyKf2ListInvariants } from "@/lib/kf2";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const s = await supabaseServer();
    const { data: userRes } = await s.auth.getUser();
    const escolaId = userRes?.user ? await resolveEscolaIdForUser(s, userRes.user.id) : null;
    if (!escolaId) return NextResponse.json({ ok: false, items: [] }, { status: 401 });

    const url = new URL(req.url);
    const q = url.searchParams.get("q") || "";
    const days = url.searchParams.get("days") || "30";

    const since = (() => {
      const d = parseInt(days || "30", 10);
      if (!Number.isFinite(d) || d <= 0) return "1970-01-01";
      const dt = new Date();
      dt.setDate(dt.getDate() - d);
      return dt.toISOString();
    })();

    let query = s
      .from("pagamentos")
      .select("id, status, valor_pago, metodo, referencia, created_at")
      .eq("escola_id", escolaId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50);

    query = applyKf2ListInvariants(query, { defaultLimit: 50 });

    if (q) {
      const uuidRe = /^[0-9a-fA-F-]{36}$/;
      const numRe = /^\d+(?:[\.,]\d+)?$/;
      if (uuidRe.test(q)) {
        query = query.eq("id", q);
      } else if (numRe.test(q)) {
        query = query.or(`status.ilike.%${q}%,metodo.ilike.%${q}%,referencia.ilike.%${q}%`);
      } else {
        query = query.or(`status.ilike.%${q}%,metodo.ilike.%${q}%,referencia.ilike.%${q}%`);
      }
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, items: data ?? [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
