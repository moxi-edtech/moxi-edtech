import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

import { removeAccents } from "@/lib/turma";
import { CURRICULUM_PRESETS, CURRICULUM_PRESETS_META, type CurriculumKey } from "@/lib/academico/curriculum-presets";
import { PRESET_TO_TYPE } from "@/lib/courseTypes";

// Helpers
const normalizeNome = (nome: string): string =>
  nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_");

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

const normalizeTurno = (turno: string): "M" | "T" | "N" | null => {
  const key = removeAccents(turno || "").toUpperCase();
  const SHIFT_MAP: Record<string, "M" | "T" | "N"> = {
    MANHA: "M", MATUTINO: "M", M: "M",
    TARDE: "T", VESPERTINO: "T", T: "T",
    NOITE: "N", NOTURNO: "N", N: "N",
  };
  return SHIFT_MAP[key] ?? null;
};

// Schema
const matrixSchema = z.object({
  sessionId: z.string(),
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
      // This allows the frontend to send custom course data, including which preset it's based on
      customData: z.object({
        associatedPreset: z.string()
      }).optional(),
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
    const anoLetivo = parseInt(sessionId, 10);
    if (isNaN(anoLetivo)) {
      return NextResponse.json({ ok: false, error: "Ano letivo (sessionId) inválido." }, { status: 400 });
    }

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
    const catalogCache = new Map<string, string>();
    for (const row of matrix) {
      if (!cursosMap.has(row.cursoKey)) cursosMap.set(row.cursoKey, []);
      cursosMap.get(row.cursoKey).push(row);
    }

    // Processamento
    for (const [cursoKey, rows] of cursosMap.entries()) {
      const firstRow = rows[0];
      const isCustom = Boolean(firstRow.customData);
      
      const basePresetKey = firstRow.customData?.associatedPreset ?? cursoKey;
      const baseMeta = CURRICULUM_PRESETS_META[basePresetKey as keyof typeof CURRICULUM_PRESETS_META];

      const desiredCourseCode = baseMeta?.course_code?.trim();
      if (!desiredCourseCode) {
        console.warn(`Skipping cursoKey ${cursoKey} due to missing course_code in preset meta.`);
        continue; // Pula para o próximo curso do mapa
      }

      const courseType = PRESET_TO_TYPE[basePresetKey as CurriculumKey] || 'geral';
      const courseName = firstRow.cursoNome || baseMeta.label;

      // 2. CURSO DA ESCOLA (Refatorado para usar SSOT course_code)
      let cursoId: string;
      const { data: existingCurso } = await admin
        .from('cursos')
        .select('id')
        .eq('escola_id', escolaId)
        .eq('course_code', desiredCourseCode)
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
            codigo: desiredCourseCode,       // ✅ SSOT
            course_code: desiredCourseCode,  // ✅ SSOT
            curriculum_key: basePresetKey,   // ✅ SSOT
            is_custom: isCustom,
            status_aprovacao: 'aprovado',
          })
          .select('id')
          .single();

        if (cursoError) {
             // Handle race condition: if it already exists now, another request created it.
             if (cursoError.code === '23505') { // unique_violation
                const retry = await admin.from('cursos').select('id').eq('escola_id', escolaId).eq('course_code', desiredCourseCode).single();
                if (retry.data) {
                    cursoId = retry.data.id;
                    summary.cursos.reused++;
                } else {
                    console.error(`Erro fatal (race condition) para curso ${courseName}:`, cursoError);
                    continue; // Próximo curso
                }
             } else {
                console.error(`Erro fatal ao criar curso ${courseName}:`, cursoError);
                continue; // Próximo curso
             }
        } else {
            summary.cursos.created++;
            cursoId = novo!.id;
        }
      }

      // 3. CLASSES & DISCIPLINAS & TURMAS
      const matrizPorClasse = new Map<string, string[]>();
      const turmasCriadas: Array<{ id: string; classe_id: string }> = [];
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

        // --- DISCIPLINAS (novo modelo: disciplinas_catalogo + curso_matriz) ---
        const blueprint = CURRICULUM_PRESETS[cursoKey as keyof typeof CURRICULUM_PRESETS];
        if (blueprint?.length) {
          const disciplinasDaClasse = blueprint.filter(d => d.classe === row.nome);
          if (disciplinasDaClasse.length) {
            const nomes = Array.from(new Set(disciplinasDaClasse.map(d => d.nome)));

            // Busca no cache/banco disciplinas do catálogo
            const paraResolver = nomes.filter((n) => !catalogCache.has(n));
            if (paraResolver.length) {
              const { data: existentes } = await admin
                .from('disciplinas_catalogo')
                .select('id, nome')
                .eq('escola_id', escolaId)
                .in('nome', paraResolver);
              for (const d of existentes || []) catalogCache.set(d.nome, d.id);

              const toInsert = paraResolver.filter((n) => !catalogCache.has(n)).map((nome) => ({ escola_id: escolaId, nome }));
              if (toInsert.length) {
                const { data: inserted } = await admin
                  .from('disciplinas_catalogo')
                  .insert(toInsert)
                  .select('id, nome');
                for (const d of inserted || []) catalogCache.set(d.nome, d.id);
              }
            }

            // Cria/atualiza curso_matriz
            const matrizRows = disciplinasDaClasse
              .map((d) => {
                const discId = catalogCache.get(d.nome);
                if (!discId) return null;
                return {
                  escola_id: escolaId,
                  curso_id: cursoId,
                  classe_id: classeId,
                  disciplina_id: discId,
                  obrigatoria: true,
                  ordem: (d as any)?.ordem ?? null,
                };
              })
              .filter(Boolean) as any[];

            if (matrizRows.length) {
              const { data: matrizData } = await admin
                .from('curso_matriz')
                .upsert(matrizRows as any, { onConflict: 'escola_id,curso_id,classe_id,disciplina_id' } as any)
                .select('id, classe_id');
              for (const mr of matrizData || []) {
                const list = matrizPorClasse.get(mr.classe_id) ?? [];
                list.push(mr.id);
                matrizPorClasse.set(mr.classe_id, list);
              }
              summary.disciplinas.created += matrizRows.length;
            }
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

          const turnoCode = normalizeTurno(turno.nome);
          if (!turnoCode) continue;

          // Descobre quantas JÁ existem para saber a próxima letra
          const { count } = await admin
            .from('turmas')
            .select('*', { count: 'exact', head: true })
            .eq('escola_id', escolaId)
            .eq('classe_id', classeId)
            .eq('turno', turnoCode)
            .eq('ano_letivo', anoLetivo); // Importante filtrar pelo ano!

          let nextIndex = count || 0;
          let criadasNesseLoop = 0;

          // Tenta criar a quantidade solicitada
          while (criadasNesseLoop < turno.qtd) {
            const letra = letras[nextIndex % letras.length];
            const suffix = Math.floor(nextIndex / letras.length);
            const nomeTurma = suffix > 0 ? `${letra}${suffix}` : letra;

            const { data: turmaInserida, error: insertTurmaError } = await admin.from('turmas').insert({
              escola_id: escolaId,
              ano_letivo: anoLetivo,
              classe_id: classeId,
              curso_id: cursoId,
              nome: nomeTurma,
              turno: turnoCode,
              capacidade_maxima: 35,
            }).select('id, classe_id').single();

            if (!insertTurmaError) {
              if (turmaInserida) turmasCriadas.push(turmaInserida as any);
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

      // Após criar turmas, vincular turma_disciplinas conforme matriz
      if (turmasCriadas.length && matrizPorClasse.size) {
        const tdRows: any[] = [];
        for (const turma of turmasCriadas) {
          const mids = matrizPorClasse.get(turma.classe_id) || [];
          for (const mid of mids) {
            tdRows.push({ escola_id: escolaId, turma_id: turma.id, curso_matriz_id: mid, professor_id: null });
          }
        }
        if (tdRows.length) {
          await admin.from('turma_disciplinas').upsert(tdRows as any, { onConflict: 'escola_id,turma_id,curso_matriz_id' } as any);
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
