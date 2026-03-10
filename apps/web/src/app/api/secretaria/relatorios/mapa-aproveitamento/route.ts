import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";

export const dynamic = "force-dynamic";

type TurmaOption = { id: string; nome: string; codigo: string | null; turno: string | null };
type PeriodoOption = { id: string; numero: number | null; tipo: string | null };

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServer();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;

    if (!user) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não encontrada para o utilizador." }, { status: 400 });
    }

    const url = new URL(req.url);
    const turmaId = url.searchParams.get("turma_id");
    const periodoId = url.searchParams.get("periodo_letivo_id");

    const [turmasRes, periodosRes] = await Promise.all([
      supabase
        .from("turmas")
        .select("id, nome, turma_codigo, turno")
        .eq("escola_id", escolaId)
        .order("nome", { ascending: true })
        .limit(200),
      supabase
        .from("periodos_letivos")
        .select("id, numero, tipo")
        .eq("escola_id", escolaId)
        .order("numero", { ascending: true }),
    ]);

    if (turmasRes.error) {
      return NextResponse.json({ ok: false, error: turmasRes.error.message }, { status: 500 });
    }

    if (periodosRes.error) {
      return NextResponse.json({ ok: false, error: periodosRes.error.message }, { status: 500 });
    }

    const turmas: TurmaOption[] = (turmasRes.data ?? []).map((t: any) => ({
      id: String(t.id),
      nome: String(t.nome ?? "Sem nome"),
      codigo: t.turma_codigo ? String(t.turma_codigo) : null,
      turno: t.turno ? String(t.turno) : null,
    }));

    const periodos: PeriodoOption[] = (periodosRes.data ?? []).map((p: any) => ({
      id: String(p.id),
      numero: typeof p.numero === "number" ? p.numero : null,
      tipo: p.tipo ? String(p.tipo) : null,
    }));

    if (!turmaId) {
      return NextResponse.json({ ok: true, filtros: { turmas, periodos }, report: null });
    }

    const { data: report, error: rpcError } = await supabase.rpc("gerar_mapa_aproveitamento_turma", {
      p_escola_id: escolaId,
      p_turma_id: turmaId,
      p_periodo_letivo_id: periodoId || null,
    });

    if (rpcError) {
      return NextResponse.json({ ok: false, error: rpcError.message, filtros: { turmas, periodos } }, { status: 500 });
    }

    return NextResponse.json({ ok: true, filtros: { turmas, periodos }, report: report ?? { colunas: [], linhas: [] } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
