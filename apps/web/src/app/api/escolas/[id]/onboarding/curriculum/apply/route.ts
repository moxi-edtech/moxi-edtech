import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";
import { gerarNomeTurma } from "@/lib/turmaNaming";

const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await ctx.params;
  const payload = await req.json();
  
  const { 
    classes: classesNomes, 
    turnos, 
    turmasPorCombinacao, 
    padraoNomenclatura,
    subjects: allSubjectNames
  } = payload.advancedConfig;

  let cursoCriadoId: string | null = null;

  try {
    const { data: curso, error: erroCurso } = await supabaseAdmin
      .from('cursos')
      .insert({
        nome: payload.customData?.label || payload.presetKey,
        tipo: 'tecnico', // Placeholder
        escola_id: escolaId,
        codigo: payload.presetKey,
        curriculum_key: payload.presetKey,
        course_code: payload.presetKey,
      })
      .select('id, nome')
      .single();

    if (erroCurso) throw erroCurso;
    cursoCriadoId = curso.id;

    const classesPayload = classesNomes.map((nome: string, index: number) => ({
      nome,
      ordem: index + 1,
      curso_id: curso.id,
      escola_id: escolaId
    }));

    const { data: classesCriadas, error: erroClasses } = await supabaseAdmin
      .from('classes')
      .insert(classesPayload)
      .select('id, nome');

    if (erroClasses) throw erroClasses;

    const mapClasseId = new Map(classesCriadas.map(c => [c.nome, c.id]));
    
    // Simplified find-or-create for disciplines
    const { data: existingDisciplinas } = await supabaseAdmin.from('disciplinas').select('id, nome').in('nome', allSubjectNames);
    const existingNomes = new Set(existingDisciplinas.map(d => d.nome));
    const novasDisciplinasPayload = allSubjectNames.filter(nome => !existingNomes.has(nome)).map(nome => ({ nome, escola_id: escolaId }));
    
    const { data: novasDisciplinas, error: erroNovasDisc } = await supabaseAdmin.from('disciplinas').insert(novasDisciplinasPayload).select('id, nome');
    if (erroNovasDisc) throw erroNovasDisc;

    const allDisciplinas = [...existingDisciplinas, ...novasDisciplinas];
    const mapDisciplinaId = new Map(allDisciplinas.map(d => [d.nome, d.id]));

    // Assuming disciplinasPorClasse is part of the payload
    const disciplinasPorClasse = payload.advancedConfig.disciplinasPorClasse || {};
    const mapDisciplinasDaClasse: Record<string, string[]> = {};
    for (const className in disciplinasPorClasse) {
        const classId = mapClasseId.get(className);
        if (classId) {
            mapDisciplinasDaClasse[classId] = disciplinasPorClasse[className].map(discName => mapDisciplinaId.get(discName)).filter(id => id);
        }
    }

    const turmasParaInserir = [];
    for (const classe of classesCriadas) {
      for (const turno of ['manha', 'tarde', 'noite']) {
        if (!turnos[turno]) continue;
        const qtd = turmasPorCombinacao?.[classe.nome]?.[turno] || 1;
        for (let i = 1; i <= qtd; i++) {
          const nomeTurma = gerarNomeTurma(
            curso.nome,
            classe.nome,
            turno,
            i,
            padraoNomenclatura || 'descritivo_completo'
          );
          turmasParaInserir.push({
            nome: nomeTurma,
            curso_id: curso.id,
            classe_id: classe.id,
            turno: turno,
            ano_letivo: new Date().getFullYear().toString(),
            capacidade: 30,
            escola_id: escolaId
          });
        }
      }
    }

    const { data: turmasCriadas, error: erroTurmas } = await supabaseAdmin
      .from('turmas')
      .insert(turmasParaInserir)
      .select('id, classe_id');

    if (erroTurmas) throw erroTurmas;

    const ofertasParaInserir = [];
    for (const turma of turmasCriadas) {
      const idsDisciplinas = mapDisciplinasDaClasse[turma.classe_id] || [];
      for (const disciplinaId of idsDisciplinas) {
        ofertasParaInserir.push({
          turma_id: turma.id,
          disciplina_id: disciplinaId,
          carga_horaria: 40,
          professor_id: null
        });
      }
    }

    if (ofertasParaInserir.length > 0) {
      const { error: erroOfertas } = await supabaseAdmin
        .from('ofertas')
        .insert(ofertasParaInserir);
      if (erroOfertas) throw erroOfertas;
    }

    return NextResponse.json({ success: true, cursoId: curso.id });

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
