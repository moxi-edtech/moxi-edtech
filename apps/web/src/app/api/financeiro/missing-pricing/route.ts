import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { normalizeAnoLetivo } from "@/lib/financeiro/tabela-preco";
import { findClassesSemPreco } from "@/lib/financeiro/missing-pricing";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServer();
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const url = new URL(req.url);
    const escolaParam = url.searchParams.get("escola_id") || url.searchParams.get("escolaId");
    const anoParam = url.searchParams.get("ano_letivo") || url.searchParams.get("ano");

    const metaEscolaId =
      (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null;
    const escolaId = await resolveEscolaIdForUser(
      supabase as any,
      user.id,
      escolaParam,
      metaEscolaId ? String(metaEscolaId) : null
    );
    if (!escolaId) return NextResponse.json({ ok: true, items: [], escolaId: null });

    let anoLetivo = normalizeAnoLetivo(anoParam);
    let items: any[] = [];

    try {
      const rpcQuery = (supabase as any).rpc("get_classes_sem_preco", {
        p_escola_id: escolaId,
        p_ano_letivo: anoLetivo,
      });

      const { data, error } = await rpcQuery;

      if (error) throw error;

      items = (data as any[]) || [];
    } catch (rpcError: any) {
      console.warn("⚠️ RPC get_classes_sem_preco falhou, usando fallback:", rpcError?.message || rpcError);

      try {
        const fallback = await findClassesSemPreco(supabase as any, escolaId, anoLetivo);
        anoLetivo = fallback.anoLetivo;
        items = fallback.items;
      } catch (fallbackError: any) {
        const message = fallbackError?.message || String(fallbackError);
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
      }
    }

    return NextResponse.json({
      ok: true,
      escolaId,
      anoLetivo,
      items,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
