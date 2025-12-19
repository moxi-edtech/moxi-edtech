import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

import { CURRICULUM_PRESETS, CURRICULUM_PRESETS_META, type CurriculumKey } from "@/lib/onboarding";
import { PRESET_TO_TYPE } from "@/lib/courseTypes";

// Helpers
const normalizeNome = (nome: string): string =>
  nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_");

const makeGlobalHash = (nome: string, tipo: string): string => `${tipo}_${normalizeNome(nome)}`;
const makeCursoCodigo = (nome: string, escolaId: string): string => {
  const prefix = escolaId.replace(/-/g, "").slice(0, 8);
  return `${prefix}_${normalizeNome(nome)}`;
};

const mapCourseTypeToNivel = (tipo: string): string => {
  switch (tipo) {
    case "primario": return "base";
    case "ciclo1": return "secundario1";
    case "puniv": return "secundario2";
    case "tecnico":
    case "tecnico_ind":
    case "tecnico_serv":
      return "tecnico";
    case "geral":
    default: return "geral"; // fallback seguro
  }
};

// Schema
const matrixSchema = z.object({
  sessionId: z.string(), // CUIDADO: Isso deve ser compatível com 'ano_letivo' se for o que usamos na constraint
  matrix: z.array(
    z.object({
      id: z.string(),
      nome: z.string(),
      manha: z.number(),
      tarde: z.number(),
      noite: z.number(),
      cursoKey: z.string(),
      cursoTipo: z.string().optional(),
      cursoNome: z.string().optional(),
    })
  ),
});

export async function POST(
  req: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: escolaId } = await params;

  try {
    const json = await req.json();
    const parsed = matrixSchema.safeParse(json);
    
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
    }

    const { sessionId, matrix } = parsed.data;
    
    // Assumindo que sessionId é o Ano Letivo (ex: "2024"). 
    // Se sessionId for um UUID, você precisará buscar o ano correspondente no banco antes.
    const anoLetivo = sessionId; 

    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const summary = {
      cursos: { created: 0, reused: 0 },
      classes: { created: 0, reused: 0 },
      disciplinas: { created: 0, updated: 0 },
      turmas: { created: 0, skipped: 0 }, // Adicionei 'skipped'
    };

    // Agrupar por cursoKey
    const cursosMap = new Map();
    for (const row of matrix) {
      if (!cursosMap.has(row.cursoKey)) cursosMap.set(row.cursoKey, []);
      cursosMap.get(row.cursoKey).push(row);
    }

    // Processamento
    for (const [cursoKey, rows] of cursosMap.entries()) {
      const meta = CURRICULUM_PRESETS_META[cursoKey as keyof typeof CURRICULUM_PRESETS_META];
      if (!meta) continue;

      const courseType = PRESET_TO_TYPE[cursoKey as CurriculumKey] || 'geral';
      const courseName = meta.label;

      // 1. GLOBAL CURSO (Cache)
      const globalHash = makeGlobalHash(courseName, courseType);
      const { error: globalErr } = await admin.from('cursos_globais_cache').upsert({
         hash: globalHash,
         nome: courseName,
         tipo: courseType,
         created_by_escola: escolaId,
         last_used_at: new Date().toISOString(),
         // usage_count incrementa via trigger ou lógica separada, mas upsert simples garante existência
      }, { onConflict: 'hash' });

      // 2. CURSO DA ESCOLA
      let cursoId: string;
      const { data: existingCurso } = await admin
        .from('cursos')
        .select('id')
        .eq('escola_id', escolaId)
        .eq('curso_global_id', globalHash) // Simplificando a busca pela hash global que é única
        .maybeSingle();

      if (existingCurso) {
        cursoId = existingCurso.id;
        summary.cursos.reused++;
      } else {
        const { data: novo, error: cursoError } = await admin
          .from('cursos')
          .insert({
            escola_id: escolaId,
            nome: courseName,
            tipo: courseType,
            codigo: makeCursoCodigo(courseName, escolaId),
            curso_global_id: globalHash,
            is_custom: false,
          })
          .select('id')
          .single();

        // Se der erro de duplicidade aqui (race condition), tentamos buscar de novo
        if (cursoError) {
             const retry = await admin.from('cursos').select('id').eq('escola_id', escolaId).eq('curso_global_id', globalHash).maybeSingle();
             if (retry.data) {
                 cursoId = retry.data.id;
                 summary.cursos.reused++;
             } else {
                 console.error(`Erro fatal curso ${courseName}:`, cursoError);
                 continue;
             }
        } else {
            summary.cursos.created++;
            cursoId = novo!.id;
        }
      }

      // 3. CLASSES & DISCIPLINAS & TURMAS
      for (const row of rows) {
        // --- CLASSE ---
        let classeId: string;
        const { data: classeExist } = await admin
          .from('classes')
          .select('id')
          .eq('escola_id', escolaId)
          .eq('curso_id', cursoId)
          .eq('nome', row.nome)
          .maybeSingle();

        if (classeExist) {
          classeId = classeExist.id;
          summary.classes.reused++;
        } else {
          const { data: classeNew, error: clsErr } = await admin
            .from('classes')
            .insert({
              escola_id: escolaId,
              curso_id: cursoId,
              nome: row.nome,
              // ordem: ...
            })
            .select('id')
            .single();

          if (clsErr && clsErr.code === '23505') {
             // Race condition handle
             const retryCls = await admin.from('classes').select('id').eq('escola_id', escolaId).eq('curso_id', cursoId).eq('nome', row.nome).single();
             classeId = retryCls.data!.id;
             summary.classes.reused++;
          } else if (classeNew) {
             classeId = classeNew.id;
             summary.classes.created++;
          } else {
             continue; // Erro fatal na classe
          }
        }

        // --- DISCIPLINAS (Lógica mantida, pois já usa upsert/onConflict) ---
        const blueprint = CURRICULUM_PRESETS[cursoKey as keyof typeof CURRICULUM_PRESETS];
        if (blueprint?.length) {
          const disciplinasDaClasse = blueprint.filter(d => d.classe === row.nome);
          if (disciplinasDaClasse.length) {
             const nivel = mapCourseTypeToNivel(courseType);
             const discRows = disciplinasDaClasse.map(d => ({
               escola_id: escolaId,
               curso_escola_id: cursoId,
               nome: d.nome,
               classe_nome: row.nome,
               nivel_ensino: nivel,
               tipo: 'core'
             }));

             // Upsert é seguro aqui
             await admin.from('disciplinas').upsert(discRows as any, { 
                onConflict: 'curso_escola_id,classe_nome,nome',
                ignoreDuplicates: false 
             });
             summary.disciplinas.created += disciplinasDaClasse.length; // Simplificado para estatística
          }
        }

        // --- TURMAS (AQUI ESTÁ A MAIOR MUDANÇA) ---
        const turnos = [
          { nome: 'Manhã', qtd: row.manha },
          { nome: 'Tarde', qtd: row.tarde },
          { nome: 'Noite', qtd: row.noite },
        ];
        const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

        for (const turno of turnos) {
          if (turno.qtd <= 0) continue;

          // Descobre quantas JÁ existem para saber a próxima letra
          const { count } = await admin
            .from('turmas')
            .select('*', { count: 'exact', head: true })
            .eq('escola_id', escolaId)
            .eq('classe_id', classeId)
            .eq('turno', turno.nome)
            .eq('ano_letivo', anoLetivo); // Importante filtrar pelo ano!

          let nextIndex = count || 0;
          let criadasNesseLoop = 0;

          // Tenta criar a quantidade solicitada
          while (criadasNesseLoop < turno.qtd) {
            const letra = letras[nextIndex % letras.length];
            const suffix = Math.floor(nextIndex / letras.length);
            const nomeTurma = suffix > 0 ? `${letra}${suffix}` : letra;

            const { error: insertTurmaError } = await admin.from('turmas').insert({
              escola_id: escolaId,
              // session_id: sessionId, // Removi para usar ano_letivo, ou mantenha ambos se sua tabela tiver ambos
              ano_letivo: anoLetivo, // OBRIGATÓRIO para a constraint funcionar
              classe_id: classeId,
              curso_id: cursoId,
              nome: nomeTurma,
              turno: turno.nome,
              capacidade_maxima: 35,
            });

            if (!insertTurmaError) {
              summary.turmas.created++;
              criadasNesseLoop++;
              nextIndex++;
            } else if (insertTurmaError.code === '23505') {
              // DUPLICATA: A Turma "A" já existe.
              // Não falhamos! Apenas incrementamos o index para tentar a "B" na próxima iteração do while
              // Mas NÃO incrementamos 'criadasNesseLoop', pois o usuário pediu X turmas novas.
              // CUIDADO: Isso pode gerar loop infinito se o limite for atingido, vamos por segurança:
              nextIndex++;
              summary.turmas.skipped++;
              
              // Safety break para evitar loop infinito se algo estiver muito errado
              if (nextIndex > 50) break; 
            } else {
              console.error("Erro ao criar turma:", insertTurmaError);
              break; // Sai do loop dessa turma se for erro técnico
            }
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      summary,
      message: "Estrutura aplicada com sucesso."
    });

  } catch (e: any) {
    console.error("Fatal Error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
