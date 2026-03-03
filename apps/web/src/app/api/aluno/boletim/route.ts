import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";
import { applyKf2ListInvariants } from "@/lib/kf2";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type BoletimRow = { disciplina_id: string | null; disciplina_nome: string | null; trimestre: number | null; nota_final: number | null; status: string | null; missing_count: number | null };

type FrequenciaRow = { faltas: number | null; aulas_previstas: number | null; frequencia_min_percent: number | null };

export async function GET(request: Request) {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx?.escolaId || !ctx.userId) return NextResponse.json({ ok: true, disciplinas: [], nome_aluno: null, trimestre_atual: null });

    const { data: userRes } = await supabase.auth.getUser();
    const authorizedIds = await resolveAuthorizedStudentIds({ supabase, userId: ctx.userId, escolaId: ctx.escolaId, userEmail: userRes?.user?.email });
    const selectedId = new URL(request.url).searchParams.get("studentId");
    const alunoId = resolveSelectedStudentId({ selectedId, authorizedIds, fallbackId: ctx.alunoId });
    if (!alunoId) return NextResponse.json({ ok: true, disciplinas: [], nome_aluno: null, trimestre_atual: null });

    const { data: aluno } = await supabase.from("alunos").select("nome").eq("id", alunoId).eq("escola_id", ctx.escolaId).maybeSingle();

    const { data: matricula } = await supabase
      .from("matriculas")
      .select("ano_letivo")
      .eq("id", ctx.matriculaId)
      .maybeSingle();

    const anoLetivo = matricula?.ano_letivo ?? null;
    if (!anoLetivo) {
      return NextResponse.json({ ok: true, disciplinas: [], nome_aluno: aluno?.nome ?? null, trimestre_atual: null });
    }

    let anoLetivoQuery = supabase
      .from("anos_letivos")
      .select("id")
      .eq("escola_id", ctx.escolaId)
      .eq("ano", anoLetivo)

    anoLetivoQuery = applyKf2ListInvariants(anoLetivoQuery, {
      defaultLimit: 1,
      order: [{ column: 'created_at', ascending: false }],
    })

    const { data: anoLetivoRow } = await anoLetivoQuery.maybeSingle();
      .select("id, ano_letivo")
      .eq("aluno_id", alunoId)
      .eq("escola_id", ctx.escolaId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!matricula?.id || !matricula.ano_letivo) {
      return NextResponse.json({ ok: true, disciplinas: [], nome_aluno: aluno?.nome ?? null, trimestre_atual: null });
    }

    let periodosQuery = supabase
      .from("periodos_letivos")
      .select("id, numero, data_inicio, data_fim")
      .eq("escola_id", ctx.escolaId)
      .eq("ano_letivo_id", anoLetivoId)
      .eq("tipo", "TRIMESTRE")

    periodosQuery = applyKf2ListInvariants(periodosQuery, {
      defaultLimit: 50,
      order: [{ column: 'numero', ascending: true }],
    })

    const { data: periodos } = await periodosQuery;

    const periodMap = new Map<string, PeriodoRow>();
    (periodos || []).forEach((p) => {
      if (p?.id) periodMap.set(p.id, p as PeriodoRow);
    });
      .eq("tipo", "TRIMESTRE");
    periodosQuery = applyKf2ListInvariants(periodosQuery, { defaultLimit: 50, order: [{ column: "numero", ascending: true }] });
    const { data: periodos } = await periodosQuery;

    let frequenciasQuery = supabase
      .from("frequencia_status_periodo")
      .select("faltas, aulas_previstas, frequencia_min_percent")
      .eq("escola_id", ctx.escolaId)
      .eq("matricula_id", ctx.matriculaId)

    frequenciasQuery = applyKf2ListInvariants(frequenciasQuery, {
      defaultLimit: 50,
      order: [{ column: 'periodo_letivo_id', ascending: true }],
      tieBreakerColumn: 'periodo_letivo_id',
    })

      .eq("matricula_id", matricula.id);
    frequenciasQuery = applyKf2ListInvariants(frequenciasQuery, { defaultLimit: 50, order: [{ column: "created_at", ascending: false }] });
    const { data: frequencias } = await frequenciasQuery;

    let totalFaltas = 0;
    let totalMax = 0;
    (frequencias as FrequenciaRow[] | null)?.forEach((row) => {
      const faltas = Number(row.faltas ?? 0);
      const aulas = Number(row.aulas_previstas ?? 0);
      const minPercent = Number(row.frequencia_min_percent ?? 75);
      totalFaltas += faltas;
      totalMax += Math.max(0, Math.floor(aulas * (1 - minPercent / 100)));
    });

    let boletimQuery = supabase
      .from("vw_boletim_por_matricula")
      .select("disciplina_id, disciplina_nome, trimestre, nota_final, status, missing_count")
      .eq("matricula_id", ctx.matriculaId)

    boletimQuery = applyKf2ListInvariants(boletimQuery, {
      defaultLimit: 50,
      order: [{ column: 'disciplina_nome', ascending: true }],
      tieBreakerColumn: 'disciplina_id',
    })

    const { data: boletimRows, error: boletimError } = await boletimQuery;

    if (boletimError) {
      return NextResponse.json({ ok: false, error: boletimError.message }, { status: 500 });
    }

    const byDisciplina = new Map<string, {
      id: string;
      nome: string;
      nota_t1: number | null;
      nota_t2: number | null;
      nota_t3: number | null;
      nota_final: number | null;
      status: "lancada" | "pendente" | "bloqueada";
    }>();
      .eq("matricula_id", matricula.id);
    boletimQuery = applyKf2ListInvariants(boletimQuery, { defaultLimit: 50, order: [{ column: "disciplina_nome", ascending: true }], tieBreakerColumn: "disciplina_id" });
    const { data: boletimRows, error: boletimError } = await boletimQuery;
    if (boletimError) return NextResponse.json({ ok: false, error: boletimError.message }, { status: 500 });

    const byDisciplina = new Map<string, any>();
    (boletimRows as BoletimRow[] | null)?.forEach((row) => {
      const id = row.disciplina_id ?? "";
      if (!id) return;
      const status = row.status === "PENDENTE_CONFIG" ? "bloqueada" : (row.missing_count ?? 0) > 0 ? "pendente" : "lancada";
      const entry = byDisciplina.get(id) ?? { id, nome: row.disciplina_nome ?? "Disciplina", nota_t1: null, nota_t2: null, nota_t3: null, nota_final: null, status };
      if (row.trimestre === 1) entry.nota_t1 = row.nota_final ?? null;
      if (row.trimestre === 2) entry.nota_t2 = row.nota_final ?? null;
      if (row.trimestre === 3) entry.nota_t3 = row.nota_final ?? null;
      entry.nota_final = entry.nota_final ?? row.nota_final ?? null;
      entry.status = status;
      byDisciplina.set(id, entry);
    });

    const disciplinas = Array.from(byDisciplina.values()).map((entry) => ({ ...entry, faltas: totalFaltas, faltas_max: totalMax }));

    const hoje = new Date();
    const trimestreAtual = (periodos || []).find((p) => {
      if (!p?.data_inicio || !p?.data_fim) return false;
      const inicio = new Date(p.data_inicio);
      const fim = new Date(p.data_fim);
      return inicio <= hoje && hoje <= fim;
    })?.numero ?? null;

    return NextResponse.json({ ok: true, nome_aluno: aluno?.nome ?? null, trimestre_atual: trimestreAtual, disciplinas });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
