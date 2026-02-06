import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const querySchema = z.object({
  limit: z.string().optional(),
  ano_letivo_id: z.string().uuid().optional(),
});

export async function GET(request: Request) {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
    }

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não identificada" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      limit: searchParams.get("limit") || undefined,
      ano_letivo_id: searchParams.get("ano_letivo_id") || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Parâmetros inválidos" }, { status: 400 });
    }

    const limit = Math.min(Math.max(Number(parsed.data.limit ?? 5), 1), 20);

    const radarQuery = supabase
      .from("vw_financeiro_inadimplencia_top")
      .select("aluno_id, aluno_nome, valor_em_atraso, dias_em_atraso")
      .eq("escola_id", escolaId)
      .order("valor_em_atraso", { ascending: false })
      .limit(limit);

    const { data: topRows, error: radarError } = await radarQuery;
    if (radarError) {
      return NextResponse.json({ ok: false, error: radarError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      data: (topRows ?? []).map((row: any) => ({
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
