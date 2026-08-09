// @kf2 allow-scan
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveAnoLetivoScope } from "@/lib/financeiro/resolveAnoLetivoScope";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const querySchema = z.object({
  limit: z.string().optional(),
  ano_letivo_id: z.string().uuid().optional(),
});

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: escolaId } = await context.params;
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const metaEscolaId = (user.app_metadata as { escola_id?: string | null } | null)?.escola_id ?? null;
    const resolvedEscolaId = await resolveEscolaIdForUser(
      supabase as any,
      user.id,
      escolaId,
      metaEscolaId ? String(metaEscolaId) : null
    );

    if (!resolvedEscolaId) {
      return NextResponse.json({ ok: false, error: "Sem permissão" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      limit: searchParams.get("limit") || undefined,
      ano_letivo_id: searchParams.get("ano_letivo_id") || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Parâmetros inválidos" }, { status: 400 });
    }

    const limit = Math.min(Math.max(Number(parsed.data.limit ?? 5), 1), 50);
    const anoScope = await resolveAnoLetivoScope(supabase as any, resolvedEscolaId, {
      anoLetivoId: parsed.data.ano_letivo_id ?? null,
    });
    if (!anoScope?.id) {
      return NextResponse.json({ ok: false, error: "Ano letivo não encontrado" }, { status: 400 });
    }

    const { data, error } = await (supabase as any)
      .from("vw_financeiro_inadimplencia_top_ano")
      .select("aluno_id, aluno_nome, valor_em_atraso, dias_em_atraso")
      .eq("escola_id", resolvedEscolaId)
      .eq("ano_letivo_id", anoScope.id)
      .order("valor_em_atraso", { ascending: false })
      .order("aluno_id", { ascending: true })
      .limit(limit);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      anoLetivoId: anoScope.id,
      anoLetivo: anoScope.ano,
      data: (data ?? []).map((row: any) => ({
        aluno_id: row.aluno_id,
        aluno_nome: row.aluno_nome || "Aluno",
        valor_em_atraso: Number(row.valor_em_atraso ?? 0),
        dias_em_atraso: Number(row.dias_em_atraso ?? 0),
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
