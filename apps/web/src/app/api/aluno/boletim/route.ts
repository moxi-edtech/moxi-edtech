import { NextResponse } from "next/server";
import { getAlunoContext } from "@/lib/alunoContext";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type BoletimRow = {
  disciplina_id: string | null;
  disciplina_nome: string | null;
  trimestre: number | null;
  nota_final: number | null;
  status: string | null;
  missing_count: number | null;
};

type FrequenciaRow = {
  periodo_letivo_id: string | null;
  faltas: number | null;
  aulas_previstas: number | null;
  frequencia_min_percent: number | null;
};

type PeriodoRow = {
  id: string;
  numero: number | null;
  data_inicio: string | null;
  data_fim: string | null;
};

export async function GET() {
  try {
    const { supabase, ctx } = await getAlunoContext();
    if (!ctx?.matriculaId || !ctx.escolaId || !ctx.alunoId) {
      return NextResponse.json({ ok: true, disciplinas: [], nome_aluno: null, trimestre_atual: null });
    }

    const { data: aluno } = await supabase
      .from("alunos")
      .select("nome")
      .eq("id", ctx.alunoId)
      .maybeSingle();

    const { data: matricula } = await supabase
      .from("matriculas")
      .select("ano_letivo")
      .eq("id", ctx.matriculaId)
      .maybeSingle();

    const anoLetivo = matricula?.ano_letivo ?? null;
    if (!anoLetivo) {
      return NextResponse.json({ ok: true, disciplinas: [], nome_aluno: aluno?.nome ?? null, trimestre_atual: null });
    }

    const { data: anoLetivoRow } = await supabase
      .from("anos_letivos")
      .select("id")
      .eq("escola_id", ctx.escolaId)
      .eq("ano", anoLetivo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const anoLetivoId = anoLetivoRow?.id ?? null;
    if (!anoLetivoId) {
      return NextResponse.json({ ok: true, disciplinas: [], nome_aluno: aluno?.nome ?? null, trimestre_atual: null });
    }

    const { data: periodos } = await supabase
      .from("periodos_letivos")
      .select("id, numero, data_inicio, data_fim")
      .eq("escola_id", ctx.escolaId)
      .eq("ano_letivo_id", anoLetivoId)
      .eq("tipo", "TRIMESTRE")
      .order("numero", { ascending: true });

    const periodMap = new Map<string, PeriodoRow>();
    (periodos || []).forEach((p) => {
      if (p?.id) periodMap.set(p.id, p as PeriodoRow);
    });

    const { data: frequencias } = await supabase
      .from("frequencia_status_periodo")
      .select("periodo_letivo_id, faltas, aulas_previstas, frequencia_min_percent")
      .eq("escola_id", ctx.escolaId)
      .eq("matricula_id", ctx.matriculaId);

    let totalFaltas = 0;
    let totalMax = 0;
    (frequencias as FrequenciaRow[] | null)?.forEach((row) => {
      const faltas = Number(row.faltas ?? 0);
      const aulas = Number(row.aulas_previstas ?? 0);
      const minPercent = Number(row.frequencia_min_percent ?? 75);
      const maxFaltas = Math.max(0, Math.floor(aulas * (1 - minPercent / 100)));
      totalFaltas += faltas;
      totalMax += maxFaltas;
    });

    const { data: boletimRows, error: boletimError } = await supabase
      .from("vw_boletim_por_matricula")
      .select("disciplina_id, disciplina_nome, trimestre, nota_final, status, missing_count")
      .eq("matricula_id", ctx.matriculaId)
      .order("disciplina_nome", { ascending: true });

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

    (boletimRows as BoletimRow[] | null)?.forEach((row) => {
      const disciplinaId = row.disciplina_id ?? "";
      if (!disciplinaId) return;
      const nome = row.disciplina_nome ?? "Disciplina";
      const status =
        row.status === "PENDENTE_CONFIG"
          ? "bloqueada"
          : (row.missing_count ?? 0) > 0
            ? "pendente"
            : "lancada";
      const entry = byDisciplina.get(disciplinaId) ?? {
        id: disciplinaId,
        nome,
        nota_t1: null,
        nota_t2: null,
        nota_t3: null,
        nota_final: null,
        status,
      };

      const trimestre = row.trimestre ?? null;
      if (trimestre === 1) entry.nota_t1 = row.nota_final ?? null;
      if (trimestre === 2) entry.nota_t2 = row.nota_final ?? null;
      if (trimestre === 3) entry.nota_t3 = row.nota_final ?? null;
      entry.nota_final = entry.nota_final ?? row.nota_final ?? null;
      entry.status = status;
      byDisciplina.set(disciplinaId, entry);
    });

    const disciplinas = Array.from(byDisciplina.values()).map((entry) => ({
      ...entry,
      faltas: totalFaltas,
      faltas_max: totalMax,
    }));

    const hoje = new Date();
    const trimestreAtual = (periodos || []).find((p) => {
      if (!p?.data_inicio || !p?.data_fim) return false;
      const inicio = new Date(p.data_inicio);
      const fim = new Date(p.data_fim);
      return inicio <= hoje && hoje <= fim;
    })?.numero ?? null;

    return NextResponse.json({
      ok: true,
      nome_aluno: aluno?.nome ?? null,
      trimestre_atual: trimestreAtual,
      disciplinas,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
