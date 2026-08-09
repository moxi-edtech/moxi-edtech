import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { supabaseServerTyped } from "@/lib/supabaseServer";
import type { Database } from "~types/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const bodySchema = z.object({
  mensalidade_id: z.string().uuid(),
  problema: z.enum(["SEM_MATRICULA", "ANO_DIVERGENTE", "TURMA_DIVERGENTE", "SEM_DATA_VENCIMENTO", "SEM_CALENDARIO", "FORA_CALENDARIO"]),
  acao: z.enum(["corrigir_vinculo", "corrigir_ano", "corrigir_turma", "justificar"]),
  target_matricula_id: z.string().uuid().nullable().optional(),
  justificativa: z.string().trim().min(10).max(1000),
  confirmacao: z.literal(true),
});

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServerTyped<Database>();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Confirmação ou justificativa inválida", issues: parsed.error.issues }, { status: 400 });
    }
    const requestedEscolaId = new URL(req.url).searchParams.get("escolaId") || req.headers.get("x-escola-id");
    const escolaId = await resolveEscolaIdForUser(supabase, userRes.user.id, requestedEscolaId);
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });

    const { data, error } = await (supabase as any).rpc("resolve_financeiro_mensalidade_reconciliacao", {
      p_escola_id: escolaId,
      p_mensalidade_id: parsed.data.mensalidade_id,
      p_problema: parsed.data.problema,
      p_acao: parsed.data.acao,
      p_target_matricula_id: parsed.data.target_matricula_id ?? null,
      p_justificativa: parsed.data.justificativa,
      p_confirmacao: parsed.data.confirmacao,
    });
    if (error) {
      const status = /CONFIRMATION_REQUIRED|JUSTIFICATION_REQUIRED|ACTION_REQUIRED|CONFLICT|STALE_RECONCILIATION|DATA:/i.test(error.message) ? 409 : 500;
      return NextResponse.json({ ok: false, error: error.message }, { status });
    }
    return NextResponse.json({ ok: true, result: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
