import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { SHIFT_MAP, gerarNomeTurma, removeAccents } from "@/lib/turma";

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const normalizeTurno = (turno: string): "M" | "T" | "N" | null => {
  const key = removeAccents(turno || "").toUpperCase();
  return (SHIFT_MAP as Record<string, "M" | "T" | "N">)[key] ?? null;
};

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await ctx.params;
  const payload = await req.json();

  const advancedConfig = payload?.advancedConfig ?? {};
  const classesNomes =
    advancedConfig.classes ??
    advancedConfig.classesNomes ??
    advancedConfig.classes_nomes ??
    [];
  const turnos = advancedConfig.turnos ?? {};
  const turmasPorCombinacao = advancedConfig.turmasPorCombinacao ?? {};
  const padraoNomenclatura = advancedConfig.padraoNomenclatura ?? "descritivo_completo";
  const allSubjectNames = advancedConfig.subjects ?? [];

  if (!Array.isArray(classesNomes) || classesNomes.length === 0) {
    return NextResponse.json(
      { error: "Nenhuma classe informada para criar o currículo." },
      { status: 400 }
    );
  }

  const anoLetivo = String(payload.anoLetivo ?? advancedConfig.anoLetivo ?? new Date().getFullYear());

  let cursoCriadoId: string | null = null;

  try {
    // 1) Curso (reutiliza se já existir com o mesmo código)
    const { data: cursoExistente } = await supabaseAdmin
      .from('cursos')
      .select('id, nome')
      .eq('escola_id', escolaId)
      .eq('codigo', payload.presetKey)
      .maybeSingle();

    let cursoId: string;
    let cursoNome: string;

    if (cursoExistente?.id) {
      cursoId = cursoExistente.id;
      cursoNome = cursoExistente.nome;
    } else {
      const { data: curso, error: erroCurso } = await supabaseAdmin
        .from('cursos')
        .insert({
          nome: payload.customData?.label || payload.presetKey,
          tipo: 'tecnico', // placeholder
          escola_id: escolaId,
          codigo: payload.presetKey,
          curriculum_key: payload.presetKey,
          course_code: payload.presetKey,
        })
        .select('id, nome')
        .single();

      if (erroCurso) throw erroCurso;
      cursoId = curso.id;
      cursoNome = curso.nome;
      cursoCriadoId = curso.id;
    }

    // 2) Classes (upsert para evitar duplicatas por escola/curso/nome)
    const classesPayload = classesNomes.map((nome: string, index: number) => ({
      nome,
      ordem: index + 1,
      curso_id: cursoId,
      escola_id: escolaId,
    }));

    const { data: classesCriadas, error: erroClasses } = await supabaseAdmin
      .from('classes')
      .upsert(classesPayload as any, { onConflict: 'escola_id,curso_id,nome' } as any)
      .select('id, nome');

    if (erroClasses) throw erroClasses;

    const mapClasseId = new Map(classesCriadas.map((c: any) => [c.nome, c.id]));

    // 3) Disciplinas no catálogo
    const nomesUnicos = Array.from(new Set(allSubjectNames || [])).filter(Boolean);
    const { data: disciplinasExist } = await supabaseAdmin
      .from('disciplinas_catalogo')
      .select('id, nome')
      .eq('escola_id', escolaId)
      .in('nome', nomesUnicos.length ? nomesUnicos : ['___placeholder___']);

    const existentesMap = new Map((disciplinasExist || []).map((d: any) => [d.nome, d.id]));
    const novas = nomesUnicos
      .filter((nome) => !existentesMap.has(nome))
      .map((nome) => ({ escola_id: escolaId, nome }));

    const { data: disciplinasNovas, error: erroNovas } = novas.length
      ? await supabaseAdmin
          .from('disciplinas_catalogo')
          .insert(novas)
          .select('id, nome')
      : { data: [] as any[], error: null } as any;

    if (erroNovas) throw erroNovas;

    const catalogo = new Map(
      [...(disciplinasExist || []), ...(disciplinasNovas || [])].map((d: any) => [d.nome, d.id])
    );

    // 4) Monta curso_matriz (classe x disciplina)
    const disciplinasPorClasse = advancedConfig.disciplinasPorClasse || {};
    const matrizRows: any[] = [];

    for (const className in disciplinasPorClasse) {
      const classId = mapClasseId.get(className);
      if (!classId) continue;
      for (const discName of disciplinasPorClasse[className] || []) {
        const discId = catalogo.get(discName);
        if (!discId) continue;
        matrizRows.push({
          escola_id: escolaId,
          curso_id: cursoId,
          classe_id: classId,
          disciplina_id: discId,
          obrigatoria: true,
        });
      }
    }

    let cursoMatrizRows: any[] = [];
    if (matrizRows.length) {
      const { data: matrizData, error: matrizErr } = await supabaseAdmin
        .from('curso_matriz')
        .upsert(matrizRows as any, { onConflict: 'escola_id,curso_id,classe_id,disciplina_id' } as any)
        .select('id, classe_id');
      if (matrizErr) throw matrizErr;
      cursoMatrizRows = matrizData || [];
    }

    // 5) Turmas por combinação (usa ano letivo atual ou informado)
    const turmasParaInserir: any[] = [];
    for (const classe of classesCriadas as any[]) {
      for (const turno of ['manha', 'tarde', 'noite'] as const) {
        if (!turnos[turno]) continue;
        const turnoCode = normalizeTurno(turno);
        if (!turnoCode) continue;

        const qtd = turmasPorCombinacao?.[classe.nome]?.[turno] ?? 0;
        if (qtd <= 0) continue;
        for (let i = 1; i <= qtd; i++) {
          const nomeTurma = gerarNomeTurma(
            cursoNome,
            classe.nome,
            turnoCode,
            i,
            padraoNomenclatura || 'descritivo_completo',
            anoLetivo
          );
          const row: any = {
            nome: nomeTurma,
            curso_id: cursoId,
            classe_id: classe.id,
            turno: turnoCode,
            ano_letivo: anoLetivo,
            capacidade_maxima: 30,
            escola_id: escolaId,
          };
          turmasParaInserir.push(row);
        }
      }
    }

    const { data: turmasCriadas, error: erroTurmas } = turmasParaInserir.length
      ? await supabaseAdmin
          .from('turmas')
          .insert(turmasParaInserir)
          .select('id, classe_id')
      : { data: [] as any[], error: null } as any;
    if (erroTurmas) throw erroTurmas;

    // 6) Atribui turma_disciplinas com base na matriz
    const matrizPorClasse = new Map<string, string[]>();
    for (const row of cursoMatrizRows) {
      const list = matrizPorClasse.get(row.classe_id) ?? [];
      list.push(row.id);
      matrizPorClasse.set(row.classe_id, list);
    }

    const tdRows: any[] = [];
    for (const turma of turmasCriadas as any[]) {
      const mids = matrizPorClasse.get(turma.classe_id) || [];
      for (const mid of mids) {
        tdRows.push({ escola_id: escolaId, turma_id: turma.id, curso_matriz_id: mid, professor_id: null });
      }
    }

    if (tdRows.length) {
      const { error: tdErr } = await supabaseAdmin
        .from('turma_disciplinas')
        .upsert(tdRows as any, { onConflict: 'escola_id,turma_id,curso_matriz_id' } as any);
      if (tdErr) throw tdErr;
    }

    return NextResponse.json({ success: true, cursoId: cursoId });

  } catch (error) {
    console.error("Erro no processo de onboarding:", error);
    if (cursoCriadoId) {
      await supabaseAdmin.from('cursos').delete().eq('id', cursoCriadoId);
    }
    return NextResponse.json(
      { error: 'Falha ao aplicar currículo. Alterações foram revertidas.' },
      { status: 500 }
    );
  }
}
