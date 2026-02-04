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

    let radarQuery = supabase
      .from("vw_radar_inadimplencia")
      .select("aluno_id, nome_aluno, valor_em_atraso, dias_em_atraso")
      .eq("escola_id", escolaId)
      .order("valor_em_atraso", { ascending: false })
      .limit(200);

    const { data: radarRows, error: radarError } = await radarQuery;
    if (radarError) {
      return NextResponse.json({ ok: false, error: radarError.message }, { status: 500 });
    }

    const totals = new Map<string, { valor: number; dias: number; nome: string }>();
    (radarRows ?? []).forEach((row: any) => {
      if (!row.aluno_id) return;
      const existing = totals.get(row.aluno_id);
      if (existing) {
        existing.valor += Number(row.valor_em_atraso ?? 0);
        existing.dias = Math.max(existing.dias, Number(row.dias_em_atraso ?? 0));
      } else {
        totals.set(row.aluno_id, {
          valor: Number(row.valor_em_atraso ?? 0),
          dias: Number(row.dias_em_atraso ?? 0),
          nome: row.nome_aluno || "Aluno",
        });
      }
    });

    const top = Array.from(totals.entries())
      .sort((a, b) => b[1].valor - a[1].valor)
      .slice(0, limit);

    return NextResponse.json({
      ok: true,
      data: top.map(([aluno_id, entry]) => ({
        aluno_id,
        aluno_nome: entry.nome,
        valor_em_atraso: entry.valor,
        dias_em_atraso: entry.dias,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
