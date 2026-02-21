import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const querySchema = z.object({
  limit: z.string().optional(),
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
    });

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Parâmetros inválidos" }, { status: 400 });
    }

    const limit = Math.min(Math.max(Number(parsed.data.limit ?? 5), 1), 50);

    const { data, error } = await supabase
      .from("vw_financeiro_inadimplencia_top")
      .select("aluno_id, aluno_nome, valor_em_atraso, dias_em_atraso")
      .eq("escola_id", resolvedEscolaId)
      .order("valor_em_atraso", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
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
