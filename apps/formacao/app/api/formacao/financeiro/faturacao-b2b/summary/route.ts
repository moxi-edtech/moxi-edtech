import { NextResponse } from "next/server";
import { requireFormacaoRoles } from "@/lib/route-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireFormacaoRoles([
    "formacao_financeiro",
    "formacao_admin",
    "super_admin",
    "global_admin",
  ]);

  if (!auth.ok) return auth.response;

  const s = auth.supabase as any;
  const escolaId = auth.escolaId;

  const { data, error } = await s
    .from("formacao_faturas_lote")
    .select("id, status, total_liquido")
    .eq("escola_id", escolaId)
    .limit(500);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  const rows = (data ?? []) as Array<{ status?: string; total_liquido?: number }>;
  const total = rows.reduce((sum, row) => sum + Number(row.total_liquido ?? 0), 0);
  const abertas = rows.filter((row) => row.status === "emitida" || row.status === "parcial").length;

  return NextResponse.json({
    ok: true,
    summary: {
      totalFaturas: rows.length,
      totalLiquido: total,
      emAberto: abertas,
    },
  });
}
