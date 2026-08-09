// @kf2 allow-scan
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { resolveAcademicYearContext } from "@/lib/academic-year/context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const querySchema = z.object({
  limit: z.string().optional(),
  day_key: z.string().optional(),
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
      day_key: searchParams.get("day_key") || undefined,
      ano_letivo_id: searchParams.get("ano_letivo_id") || undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Parâmetros inválidos" }, { status: 400 });
    }

    const limit = Math.min(Math.max(Number(parsed.data.limit ?? 20), 1), 50);
    const dayKey = parsed.data.day_key ?? new Date().toISOString().slice(0, 10);

    const academicContext = await resolveAcademicYearContext(supabase, {
      userId: user.id,
      requestedAcademicYearId: parsed.data.ano_letivo_id,
      operation: "READ",
    });
    const academicYear = academicContext ? Number(academicContext.anoLetivoLabel.slice(0, 4)) : null;
    let mensalidadesQuery = supabase
      .from("mensalidades")
      .select("id")
      .eq("escola_id", escolaId);
    if (academicYear) mensalidadesQuery = mensalidadesQuery.eq("ano_letivo", String(academicYear));
    const { data: mensalidades, error: mensalidadesError } = await mensalidadesQuery;
    if (mensalidadesError) {
      return NextResponse.json({ ok: false, error: mensalidadesError.message }, { status: 500 });
    }
    const mensalidadeIds = (mensalidades ?? []).map((row) => row.id);

    const { data, error } = await supabase
      .from("pagamentos")
      .select("id, aluno_id, valor_pago, metodo, status, created_at")
      .eq("escola_id", escolaId)
      .eq("day_key", dayKey)
      .in("mensalidade_id", mensalidadeIds.length ? mensalidadeIds : ["00000000-0000-0000-0000-000000000000"])
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: data ?? [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
