import { NextResponse } from "next/server";
import { authorizeEscolaAction } from "@/lib/escola/disciplinas";
import { supabaseServer } from "@/lib/supabaseServer";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { AcademicYearContextError, assertAcademicYearEntity, resolveAcademicYearContext } from "@/lib/academic-year/context";
import { CanonicalPeriodReadError } from "@/lib/academico/verify-canonical-periods-read";
import { readVerifiedAcademicTrimesters, requireVerifiedTrimester } from "@/lib/academico/read-verified-academic-trimesters";


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

    const url = new URL(req.url);
    const requestedEscolaId = url.searchParams.get("escola_id") || url.searchParams.get("escolaId");
    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id, requestedEscolaId);
    if (!escolaId) {
      return NextResponse.json({ ok: false, error: "Escola não encontrada para o utilizador." }, { status: 400 });
    }
    const academicContext = await resolveAcademicYearContext(supabase, {
      userId: user.id,
      requestedAcademicYearId: url.searchParams.get("ano_letivo_id"),
      operation: "READ",
    });
    const authz = await authorizeEscolaAction(supabase as any, escolaId, user.id, ["configurar_escola"]);
    if (!authz.allowed) {
      return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 });
    }

    const turmaId = url.searchParams.get("turma_id");
    const periodoId = url.searchParams.get("periodo_letivo_id");

    const [turmasRes, periodos] = await Promise.all([
      supabase
        .from("turmas")
        .select("id, nome, turma_codigo, turno")
        .eq("escola_id", escolaId)
        .eq("session_id", academicContext.anoLetivoId)
        .order("nome", { ascending: true })
        .limit(200),
      readVerifiedAcademicTrimesters(supabase, {
        escolaId, anoLetivoId: academicContext.anoLetivoId,
        yearBase: Number(academicContext.anoLetivoLabel.split("/")[0]),
      }),
    ]);

    if (turmasRes.error) {
      return NextResponse.json({ ok: false, error: turmasRes.error.message }, { status: 500 });
    }


    const turmas: TurmaOption[] = (turmasRes.data ?? []).map((t: any) => ({
      id: String(t.id),
      nome: String(t.nome ?? "Sem nome"),
      codigo: t.turma_codigo ? String(t.turma_codigo) : null,
      turno: t.turno ? String(t.turno) : null,
    }));

    const periodoOptions: PeriodoOption[] = periodos.map((p) => ({
      id: String(p.id),
      numero: typeof p.numero === "number" ? p.numero : null,
      tipo: p.tipo ? String(p.tipo) : null,
    }));

    if (periodoId) {
      requireVerifiedTrimester(periodos, { id: periodoId });
    }

    if (!turmaId) {
      return NextResponse.json({ ok: true, context: academicContext, filtros: { turmas, periodos: periodoOptions }, report: null });
    }

    await assertAcademicYearEntity(supabase, {
      table: "turmas",
      entityId: turmaId,
      escolaId,
      anoLetivoId: academicContext.anoLetivoId,
    });

    const { data: report, error: rpcError } = await (supabase as any).rpc("gerar_mapa_aproveitamento_turma", {
      p_escola_id: escolaId,
      p_turma_id: turmaId,
      p_periodo_letivo_id: periodoId || null,
    });

    if (rpcError) {
      return NextResponse.json({ ok: false, error: rpcError.message, filtros: { turmas, periodos: periodoOptions } }, { status: 500 });
    }

    return NextResponse.json({ ok: true, context: academicContext, filtros: { turmas, periodos: periodoOptions }, report: report ?? { colunas: [], linhas: [] } });
  } catch (error) {
    if (error instanceof CanonicalPeriodReadError) {
      return NextResponse.json({ ok: false, code: error.code, error: error.message }, { status: error.status });
    }
    if (error instanceof AcademicYearContextError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
