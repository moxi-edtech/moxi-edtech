import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";
import { hasPermission } from "@/lib/permissions";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "~types/supabase";

// Importa os teus presets
import {
  CURRICULUM_PRESETS,
  type CurriculumKey,
} from "@/lib/onboarding";

// --- 1. VALIDAÇÃO DOS DADOS DE ENTRADA (ZOD) ---
const bodySchema = z.object({
  presetKey: z.string().trim(),
  sessionId: z.string().optional(),
  matrix: z.array(
    z.object({
      classe: z.string(),
      cursoKey: z.string().optional(),
      qtyManha: z.number().optional(),
      qtyTarde: z.number().optional(),
      qtyNoite: z.number().optional(),
      tipo: z.string().optional(), // Adicionado para incluir o tipo de curso
    })
  ).optional(),
  data: z.object({
    tipo: z.enum(['ciclo_base', 'curso_tecnico', 'curso_puniv']),
    nome: z.string().optional(), // Nome do curso, se aplicável
    estrutura: z.array(
      z.object({
        nome: z.string(), // Ex: "10ª Classe"
        turnos: z.array(z.string()), // Ex: ["manha", "tarde"]
        disciplinas: z.array(z.string()), // Ex: ["Português", "Matemática"]
      })
    ),
  }).optional(),
});

// Helper para criar códigos de curso
function makeCursoCodigo(nome: string): string {
  return nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40);
}

// Auth Helper Simplificado
async function authorize(escolaId: string) {
  const s = await supabaseServer();
  const { data: { user } } = await s.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "Unauthorized" };
  return { ok: true };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = await params;

  try {
    // 1. AUTH
    const authz = await authorize(escolaId);
    if (!authz.ok) return NextResponse.json({ ok: false, error: authz.error }, { status: authz.status as number });

    // 2. PARSE BODY
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
    }

    const { presetKey, sessionId, matrix, data } = parsed.data;
    
    // CLIENTE ADMIN
    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const summary = {
      cursos: { created: 0 },
      classes: { created: 0 },
      disciplinas: { created: 0 },
      turmas: { created: 0 },
    };

    // =================================================================================
    // LÓGICA PRINCIPAL
    // =================================================================================
    
    if (presetKey === 'custom_matrix' && matrix && matrix.length > 0) {
        
        for (const row of matrix) {
            
            // A. IDENTIFICAR O CURSO
            // Resolvemos o erro de tipagem aqui convertendo para string genérica ou key válida
            const cursoKeyRaw = row.cursoKey || 'primario'; // Fallback seguro se vier vazio
            
            // Verifica se a chave existe nos presets
            const isValidKey = Object.keys(CURRICULUM_PRESETS).includes(cursoKeyRaw);
            
            if (!isValidKey) {
                console.warn(`Curso key inválida ignorada: ${cursoKeyRaw}`);
                continue;
            }

            const cursoKey = cursoKeyRaw as CurriculumKey;
            
            // Usamos 'any' aqui para evitar o erro de "type not comparable"
            // pois sabemos que o formato agora é { label: string, subjects: [] }
            const presetData: any = CURRICULUM_PRESETS[cursoKey];
            
            // Extração segura dos dados
            let disciplinasDoCurso: string[] = [];
            let labelCurso = "Curso Geral";

            if (presetData && typeof presetData === 'object') {
                if (Array.isArray(presetData.subjects)) {
                    disciplinasDoCurso = presetData.subjects;
                }
                if (presetData.label) {
                    labelCurso = presetData.label;
                }
            } else if (Array.isArray(presetData)) {
                // Suporte legado caso algum preset ainda seja array direto
                disciplinasDoCurso = presetData;
            }

            // Extrair o curso_tipo do presetData
            // Assume que o primeiro item do blueprint define o tipo para o curso geral
            const tipoCurso = presetData[0]?.curso_tipo || 'geral'; 

            // B. CRIAR/BUSCAR O CURSO NO BANCO
            let cursoId: string | null = null;
            
            // Correção do Erro 2: Convertemos para string antes de comparar com 'geral'
            // para evitar o erro de "no overlap"
            const isGenericCourse = (cursoKey as string) === 'geral' || (cursoKey as string) === 'primario_base';

            if (!isGenericCourse) {
                const { data: cursoExistente } = await admin
                    .from('cursos')
                    .select('id')
                    .eq('escola_id', escolaId)
                    .eq('nome', labelCurso)
                    .maybeSingle();

                if (cursoExistente) {
                    cursoId = cursoExistente.id;
                } else {
                    const { data: novoCurso } = await admin
                        .from('cursos')
                        .insert({
                            escola_id: escolaId,
                            nome: labelCurso,
                            codigo: makeCursoCodigo(labelCurso),
                            tipo: tipoCurso // <--- Adicionado o tipo aqui
                        })
                        .select('id')
                        .single();
                    cursoId = novoCurso?.id ?? null;
                    summary.cursos.created++;
                }
            }

            // C. CRIAR/BUSCAR A CLASSE
            let classeId: string | null = null;
            
            const { data: classeExistente } = await admin
                .from('classes')
                .select('id')
                .eq('escola_id', escolaId)
                .eq('nome', row.classe)
                .maybeSingle();

            if (classeExistente) {
                classeId = classeExistente.id;
                summary.classes.created++;
            } else {
                const { data: novaClasse } = await admin
                    .from('classes')
                    .insert({
                        escola_id: escolaId,
                        nome: row.classe,
                        ordem: parseInt(row.classe.replace(/\D/g, '')) || 0
                    })
                    .select('id')
                    .single();
                classeId = novaClasse?.id ?? null;
                summary.classes.created++;
            }

            // D. CRIAR DISCIPLINAS
            if (disciplinasDoCurso.length > 0 && classeId) {
                const discToInsert = disciplinasDoCurso.map(nomeDisc => ({
                    escola_id: escolaId,
                    nome: nomeDisc,
                    classe_id: classeId,
                    curso_id: cursoId
                }));

                const { error: errDisc } = await (admin as any).from('disciplinas')
                    .upsert(discToInsert, { onConflict: 'escola_id, classe_id, curso_id, nome' } as any);
                
                if (!errDisc) summary.disciplinas.created += disciplinasDoCurso.length;
            }

            // E. CRIAR TURMAS
            if (sessionId && classeId) {
                const turnos = { 'Manhã': row.qtyManha, 'Tarde': row.qtyTarde, 'Noite': row.qtyNoite };
                const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

                for (const [turnoNome, qtd] of Object.entries(turnos)) {
                    const quantidade = Number(qtd) || 0;
                    if (quantidade <= 0) continue;

                    const { count } = await admin
                        .from('turmas')
                        .select('*', { count: 'exact', head: true })
                        .eq('escola_id', escolaId)
                        .eq('session_id', sessionId)
                        .eq('classe_id', classeId);

                    let nextIndex = count || 0;

                    for (let i = 0; i < quantidade; i++) {
                        const letra = letras[nextIndex % letras.length];
                        const suffix = Math.floor(nextIndex / letras.length);
                        const nomeTurma = suffix > 0 ? `${letra}${suffix}` : letra;

                        await admin.from('turmas').insert({
                            escola_id: escolaId,
                            session_id: sessionId,
                            classe_id: classeId,
                            curso_id: cursoId,
                            nome: nomeTurma,
                            turno: turnoNome,
                            capacidade_maxima: 35
                        });
                        
                        summary.turmas.created++;
                        nextIndex++;
                    }
                }
            }
        }
    }

    // =================================================================================
    // MODO D: ADVANCED BUILDER (Hierárquico)
    // =================================================================================
    if (presetKey === 'advanced_builder' && data) {
        
        // 1. Criar o Curso (se aplicável)
        let cursoId: string | null = null;
        
        if (data.tipo !== 'ciclo_base') {
            const { data: novoCurso, error: errCurso } = await admin
                .from('cursos')
                .insert({
                    escola_id: escolaId,
                    nome: data.nome,
                    codigo: makeCursoCodigo(data.nome), // Função helper existente
                    tipo: data.tipo // 'curso_tecnico' ou 'curso_puniv'
                })
                .select('id')
                .single();
            
            if (errCurso) throw errCurso;
            cursoId = novoCurso.id;
            summary.cursos.created++;
        }

        // 2. Iterar sobre a Estrutura (Classes)
        for (const nivel of data.estrutura) {
            // nivel = { nome: "10ª Classe", turnos: ["manha"], disciplinas: ["Português"...] }
            
            // A. Criar/Buscar Classe
            const { data: classe, error: errClasse } = await admin
                .from('classes')
                .insert({
                    escola_id: escolaId,
                    nome: nivel.nome,
                    curso_id: cursoId, // Vincula ao curso específico
                    ordem: parseInt(nivel.nome.replace(/\D/g, '')) || 0
                })
                .select('id')
                .single();
             
            if (errClasse) { console.error(errClasse); continue; }
            const classeId = classe.id;
            summary.classes.created++;

            // B. Criar Disciplinas
            if (nivel.disciplinas.length > 0) {
                const discs = nivel.disciplinas.map((d: string) => ({
                    escola_id: escolaId,
                    nome: d,
                    classe_id: classeId,
                    curso_id: cursoId
                }));
                await admin.from('disciplinas').insert(discs);
                summary.disciplinas.created += discs.length;
            }

            // C. Criar Turmas (Opcional - 1 por turno selecionado)
            if (sessionId && classeId) { // Certifica-te que passas o sessionId no payload ou buscas o ativo
                const turnosMap = {
                    "manha": "Manhã",
                    "tarde": "Tarde",
                    "noite": "Noite"
                };
                const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

                for (const turnoKey of nivel.turnos) {
                    const turnoNome = turnosMap[turnoKey as keyof typeof turnosMap] || turnoKey; // Fallback para o próprio key se não mapeado

                    const { count } = await admin
                        .from('turmas')
                        .select('*', { count: 'exact', head: true })
                        .eq('escola_id', escolaId)
                        .eq('session_id', sessionId)
                        .eq('classe_id', classeId)
                        .eq('turno', turnoNome); // Considerar turmas do mesmo turno

                    let nextIndex = count || 0;

                    const letra = letras[nextIndex % letras.length];
                    const suffix = Math.floor(nextIndex / letras.length);
                    const nomeTurma = suffix > 0 ? `${letra}${suffix}` : letra;

                    await admin.from('turmas').insert({
                        escola_id: escolaId,
                        session_id: sessionId,
                        classe_id: classeId,
                        curso_id: cursoId,
                        nome: nomeTurma,
                        turno: turnoNome,
                        capacidade_maxima: 35
                    });
                    
                    summary.turmas.created++;
                }
            }
        }

        return NextResponse.json({ ok: true, summary });
    }



    return NextResponse.json({ ok: true, summary });

  } catch (e: any) {
    console.error("Fatal Error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}