import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";
import { resolveAuthorizedStudentIds, resolveSelectedStudentId } from "@/lib/portalAlunoAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function monthLabel(ano: number | null, mes: number | null) {
  if (!ano || !mes) return null;
  return `${String(mes).padStart(2, "0")}/${ano}`;
}

export async function GET(request: Request) {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx?.escolaId || !ctx.userId) {
      return NextResponse.json({ ok: true, alert: null });
    }

    const { data: userRes } = await supabase.auth.getUser();
    const authorizedIds = await resolveAuthorizedStudentIds({
      supabase,
      userId: ctx.userId,
      escolaId: ctx.escolaId,
      userEmail: userRes?.user?.email,
    });

    const selectedId = new URL(request.url).searchParams.get("studentId");
    const alunoId = resolveSelectedStudentId({ selectedId, authorizedIds, fallbackId: ctx.alunoId });
    if (!alunoId) return NextResponse.json({ ok: true, alert: null });

    const hoje = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("mensalidades")
      .select("id, valor_previsto, data_vencimento, ano_referencia, mes_referencia, status")
      .eq("aluno_id", alunoId)
      .eq("escola_id", ctx.escolaId)
      .lt("data_vencimento", hoje)
      .order("data_vencimento", { ascending: true })
      .limit(1);

    const row = data?.[0];
    if (!row || row.status === "pago") return NextResponse.json({ ok: true, alert: null });

    return NextResponse.json({ ok: true, alert: { id: row.id, valor: Number(row.valor_previsto ?? 0), mes: monthLabel(row.ano_referencia ?? null, row.mes_referencia ?? null) } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
