// @kf2 allow-scan
import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";
import { resolveAuthorizedStudentIds, resolveSelectedStudentId } from "@/lib/portalAlunoAuth";

type MensalidadeRow = {
  id: string;
  ano_referencia: number | null;
  mes_referencia: number | null;
  valor_previsto: number | null;
  data_vencimento: string | null;
  status: string | null;
  data_pagamento_efetiva: string | null;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx || !ctx.escolaId || !ctx.userId) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const { data: userRes } = await supabase.auth.getUser();
    const authorizedIds = await resolveAuthorizedStudentIds({
      supabase,
      userId: ctx.userId,
      escolaId: ctx.escolaId,
      userEmail: userRes?.user?.email,
    });

    const selectedId = new URL(request.url).searchParams.get("studentId");
    const alunoId = resolveSelectedStudentId({ selectedId, authorizedIds, fallbackId: ctx.alunoId });
    if (!alunoId) return NextResponse.json({ ok: true, mensalidades: [] });

    const query = supabase
      .from("mensalidades")
      .select("id, ano_referencia, ano_letivo, mes_referencia, valor_previsto, data_vencimento, status, data_pagamento_efetiva, matricula_id")
      .eq("aluno_id", alunoId)
      .eq("escola_id", ctx.escolaId);

    const { data, error } = await query.order("ano_referencia", { ascending: true }).order("mes_referencia", { ascending: true }).limit(50);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    const hoje = new Date().toISOString().slice(0, 10);
    const rows = (data || []).map((m: MensalidadeRow) => {
      const competencia = `${m.ano_referencia}-${String(m.mes_referencia).padStart(2, "0")}`;
      const vencimento = m.data_vencimento ?? "";
      const pago_em = m.data_pagamento_efetiva ?? null;
      let status: "pago" | "pendente" | "atrasado" | "em_verificacao" = "pendente";
      if ((m.status as string) === "pago") status = "pago";
      else if ((m.status as string) === "em_verificacao") status = "em_verificacao";
      else if (vencimento && vencimento < hoje) status = "atrasado";
      return { id: m.id, competencia, valor: Number(m.valor_previsto ?? 0), vencimento, status, pago_em };
    });

    return NextResponse.json({ ok: true, mensalidades: rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
