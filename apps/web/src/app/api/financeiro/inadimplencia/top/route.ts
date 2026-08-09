// @kf2 allow-scan
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveAcademicYearContext } from "@/lib/academic-year/context";

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

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      limit: searchParams.get("limit") || undefined,
      ano_letivo_id: searchParams.get("ano_letivo_id") || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Parâmetros inválidos" }, { status: 400 });
    }

    const context = await resolveAcademicYearContext(supabase as any, {
      userId: user.id,
      requestedAcademicYearId: parsed.data.ano_letivo_id ?? null,
      operation: "READ",
    });
    const escolaId = context.escolaId;
    const academicYear = Number(context.anoLetivoLabel.slice(0, 4));
    const { data: matriculas, error: matriculasError } = await supabase
      .from("matriculas")
      .select("id")
      .eq("escola_id", escolaId)
      .eq("session_id", context.anoLetivoId);
    if (matriculasError) throw matriculasError;
    const matriculaIds = (matriculas ?? []).map((row: any) => row.id);
    if (matriculaIds.length === 0) {
      return NextResponse.json({ ok: true, data: [] });
    }

    const limit = Math.min(Math.max(Number(parsed.data.limit ?? 5), 1), 20);

    const radarQuery = (supabase as any)
      .from("vw_radar_inadimplencia")
      .select("aluno_id, nome_aluno, valor_em_atraso, dias_em_atraso, mensalidade_id, data_vencimento")
      .eq("escola_id", escolaId)
      .in("mensalidade_id", (await supabase.from("mensalidades").select("id").eq("escola_id", escolaId).eq("ano_letivo", String(academicYear)).in("matricula_id", matriculaIds)).data?.map((row: any) => row.id) ?? [])
      .order("valor_em_atraso", { ascending: false });

    const { data: topRows, error: radarError } = await radarQuery;
    if (radarError) {
      return NextResponse.json({ ok: false, error: radarError.message }, { status: 500 });
    }

    const grouped = new Map<string, any>();
    for (const row of topRows ?? []) {
      const current = grouped.get(row.aluno_id) ?? {
        aluno_id: row.aluno_id,
        aluno_nome: row.nome_aluno || "Aluno",
        valor_em_atraso: 0,
        dias_em_atraso: 0,
      };
      current.valor_em_atraso += Number(row.valor_em_atraso ?? 0);
      current.dias_em_atraso = Math.max(current.dias_em_atraso, Number(row.dias_em_atraso ?? 0));
      grouped.set(row.aluno_id, current);
    }

    const data = Array.from(grouped.values())
      .sort((a, b) => b.valor_em_atraso - a.valor_em_atraso || b.dias_em_atraso - a.dias_em_atraso)
      .slice(0, limit);

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
