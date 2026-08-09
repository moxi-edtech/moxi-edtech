import { NextResponse } from "next/server";
import { resolveAnoLetivoScope } from "@/lib/financeiro/resolveAnoLetivoScope";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const supabase = await supabaseServerTyped<Database>();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });

    const scope = await resolveAnoLetivoScope(supabase, escolaId, {
      anoLetivoId: searchParams.get("ano_letivo_id"),
      ano: searchParams.get("ano") ? Number(searchParams.get("ano")) : null,
    });
    if (!scope) return NextResponse.json({ ok: false, error: "Ano letivo não encontrado" }, { status: 404 });

    const { data, error } = await (supabase as any).rpc("audit_mensalidades_integrity", {
      p_escola_id: escolaId,
      p_ano_letivo: scope.ano,
    });
    if (error) throw error;

    const checks = (data ?? []).map((item: any) => ({
      check: item.check_name,
      severity: item.severity,
      total: Number(item.total ?? 0),
      details: item.details ?? {},
    }));

    return NextResponse.json({
      ok: true,
      escola_id: escolaId,
      ano_letivo_id: scope.id,
      ano_letivo: scope.ano,
      checks,
      can_merge: checks.every((check: any) => check.severity === "PASS" || check.total === 0),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Não foi possível gerar o relatório" },
      { status: 500 },
    );
  }
}
