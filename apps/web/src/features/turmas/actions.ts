"use server";

import { hydrateCourseCurriculum } from "@/features/curriculum/actions";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { parseTurmaCode } from "@/utils/turmaParser";

// Tipos do Payload que vem do Formulário
interface ValidateTurmaPayload {
  id?: string; // ID da turma rascunho
  escola_id: string;
  curso_id: string; // ID do Curso (Selecionado ou Auto-preenchido)
  curso_codigo?: string | null;
  curso_nome?: string | null;
  curriculum_key?: string | null;
  classe_id?: string; // ID da Classe (Se já existir)
  classe_nome?: string; // Nome da Classe (Caso precisemos criar. Ex: "10ª Classe")
  classe_num?: number | null;
  
  nome_turma: string; // "10ª Classe A - Técnico de Gestão"
  letra: string;      // "A"
  turno: string;      // "M", "T", "N"
  sala?: string;
  capacidade: number;
  ano_letivo: string;

  turma_codigo: string; // "TEC_GEST-10-M-A"

  migracao_financeira?: {
    skip_matricula: boolean;
    mes_inicio: number;
  };
}

const normalizeNome = (nome: string): string =>
  nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

const makeCursoCodigo = (nome: string, escolaId: string): string => {
  const prefix = escolaId.replace(/-/g, "").slice(0, 8) || "escola";
  const slug = normalizeNome(nome || "curso");
  return `${prefix}_${slug || "curso"}`;
};

const deriveTipoFromCurriculum = (curriculumKey?: string | null): string | null => {
  if (!curriculumKey) return null;
  if (curriculumKey.includes("tecnico") || curriculumKey.includes("saude")) return "tecnico";
  return "core";
};

export async function saveAndValidateTurma(payload: ValidateTurmaPayload) {
  const supabase = await createClient();
  let finalClasseId = payload.classe_id;
  let finalCursoId = payload.curso_id;
  let finalTurmaId = payload.id;
  const parsed = parseTurmaCode(payload.turma_codigo || "");

  const cursoCodigoHint = (payload.curso_codigo || parsed.siglaCurso || payload.turma_codigo.split("-")[0] || "").trim();
  const cursoNomeHint = payload.curso_nome || parsed.cursoSugeridoNome || null;
  const curriculumKeyHint = payload.curriculum_key || parsed.curriculumKey || null;

  const classeNomeNormalizada =
    payload.classe_nome ||
    (payload.classe_num ? `${payload.classe_num}ª Classe` : undefined) ||
    (parsed.classeNum ? `${parsed.classeNum}ª Classe` : undefined);

  const classeNumeroNormalizado =
    payload.classe_num ??
    (parsed.classeNum ? Number(parsed.classeNum) || null : null) ??
    (classeNomeNormalizada ? Number(String(classeNomeNormalizada).replace(/\D/g, "")) || null : null);
  const letraNormalizada = (payload.letra || "A").toString().trim() || "A";

  try {
    if (!finalCursoId && !cursoCodigoHint && !cursoNomeHint) {
      throw new Error("Informe ou sugira um curso para a turma (curso_id é obrigatório).");
    }

    // 0. Resolver Curso (ou criar sob demanda)
    if (!finalCursoId) {
      const { data: cursosExistentes } = await supabase
        .from("cursos")
        .select("id, nome, codigo, course_code, curriculum_key")
        .eq("escola_id", payload.escola_id);

      const normaliza = (str: string | null | undefined) => (str || "").trim().toLowerCase();
      const alvoCode = normaliza(cursoCodigoHint);
      const alvoNome = normaliza(cursoNomeHint);
      const alvoCurriculum = normaliza(curriculumKeyHint);

      const match = (cursosExistentes || []).find((c) => {
        const codeA = normaliza((c as any).course_code);
        const codeB = normaliza((c as any).codigo);
        const nome = normaliza((c as any).nome);
        const curriculumDb = normaliza((c as any).curriculum_key);

        const matchCurriculum = alvoCurriculum && (curriculumDb === alvoCurriculum || codeB === alvoCurriculum || codeA === alvoCurriculum);
        const matchCode = alvoCode && (codeA === alvoCode || codeB === alvoCode);
        const matchNome = alvoNome && nome && nome.includes(alvoNome);

        return matchCurriculum || matchCode || matchNome;
      });

      if (match) {
        finalCursoId = (match as any).id as string;
      } else {
        const nomeCurso = cursoNomeHint || cursoCodigoHint || "Curso Auto";
        const baseCodigo = cursoCodigoHint || nomeCurso || payload.turma_codigo;
        let codigoGerado = makeCursoCodigo(baseCodigo, payload.escola_id);

        const cursoPayload: any = {
          escola_id: payload.escola_id,
          nome: nomeCurso,
          codigo: codigoGerado,
          course_code: cursoCodigoHint || null,
          curriculum_key: curriculumKeyHint || null,
        };

        const tipoInferido = deriveTipoFromCurriculum(curriculumKeyHint);
        if (tipoInferido) cursoPayload.tipo = tipoInferido;

        const { data: created, error: createCourseError } = await supabase
          .from("cursos")
          .insert(cursoPayload)
          .select("id")
          .single();

        if (createCourseError) {
          if (createCourseError.code === "23505") {
            // Tenta uma vez com sufixo aleatório
            codigoGerado = `${codigoGerado}_${Math.floor(Math.random() * 90 + 10)}`;
            const retry = await supabase
              .from("cursos")
              .insert({ ...cursoPayload, codigo: codigoGerado })
              .select("id")
              .single();
            if (retry.error) throw new Error(`Erro ao criar curso: ${retry.error.message}`);
            finalCursoId = retry.data?.id as string;
          } else {
            throw new Error(`Erro ao criar curso: ${createCourseError.message}`);
          }
        } else {
          finalCursoId = created?.id as string;
        }
      }
    }

    if (!finalCursoId) {
      throw new Error("Não foi possível identificar ou criar o Curso para esta turma (curso_id obrigatório).");
    }

    // 1. SCAFFOLDING AUTOMÁTICO (A Mágica)
    // Se o Admin selecionou um curso, mas a "Classe" (grade) ainda não existe no banco,
    // nós criamos ela AGORA. Não vamos travar o Admin por isso.
    
    if (!finalClasseId && (classeNomeNormalizada || classeNumeroNormalizado)) {
       // Verifica se existe pelo nome (Ex: busca "10" dentro do nome no banco para esse curso)
       // Isso evita duplicar "10ª Classe" se ela já existir mas o frontend não pegou o ID
       const targetNumber = classeNumeroNormalizado;

       const { data: classesExistentes } = await supabase
         .from("classes")
         .select("id, nome, numero")
         .eq("escola_id", payload.escola_id)
         .eq("curso_id", finalCursoId);

       const matchClasse = (classesExistentes || []).find((cls) => {
         const numero = ((cls as any).numero ?? Number(String((cls as any).nome).replace(/\D/g, ""))) || null;
         const nomeNorm = String((cls as any).nome || "").replace(/\s+/g, "").toLowerCase();
         const alvoNome = (classeNomeNormalizada || "").replace(/\s+/g, "").toLowerCase();
         return (targetNumber && numero === targetNumber) || (alvoNome && nomeNorm.includes(alvoNome));
       });

       if (matchClasse) {
         finalClasseId = (matchClasse as any).id;
       } else {
         // CRIA A CLASSE NA HORA
         const { data: newClass, error: createClassError } = await supabase
           .from("classes")
           .insert({
             escola_id: payload.escola_id,
             curso_id: finalCursoId,
             nome: classeNomeNormalizada || (targetNumber ? `${targetNumber}ª Classe` : null), // Ex: "10ª Classe"
             numero: targetNumber,
             ordem: targetNumber || null,
           })
           .select("id")
           .single();

         if (createClassError) throw new Error(`Erro ao criar classe automática: ${createClassError.message}`);
         finalClasseId = newClass.id;
       }
    }

    if (!finalClasseId) {
      throw new Error("Impossível identificar ou criar a Classe (Ano) para esta turma.");
    }

    // 2. PREPARAR DADOS DA TURMA
  const turmaData = {
    escola_id: payload.escola_id,
    curso_id: finalCursoId,
    classe_id: finalClasseId,
    nome: payload.nome_turma,
    letra: letraNormalizada,
    classe_num: classeNumeroNormalizado,
    turno: payload.turno, // Já deve vir M, T ou N
    sala: payload.sala || null,
    capacidade_maxima: payload.capacidade,
    ano_letivo: Number(payload.ano_letivo),
    turma_codigo: payload.turma_codigo,
    status_validacao: 'ativo', // APROVAÇÃO!
    updated_at: new Date().toISOString()
  };

    // 3. UPDATE (Se for validação de rascunho) ou INSERT (Se for nova)
    let result;
    if (payload.id) {
      // Update na turma rascunho existente
      result = await supabase
        .from("turmas")
        .update(turmaData)
        .eq("id", payload.id)
        .select()
        .single();
    } else {
      // Insert nova turma
      result = await supabase
        .from("turmas")
        .insert(turmaData)
        .select()
        .single();
    }

    if (result.error) throw result.error;
    finalTurmaId = (result.data as any)?.id || finalTurmaId;

    // [NOVO] Passo Final: Garantir que o curso tenha disciplinas
    // Dispara a hidratação baseada no nome do curso
    if (payload.curso_id) {
      try {
        await hydrateCourseCurriculum(payload.escola_id, payload.curso_id);
      } catch (hydrationError) {
        console.warn("Aviso: Falha na hidratação automática do currículo:", hydrationError);
        // Não lançamos erro aqui para não travar a validação da turma,
        // apenas logamos. O Admin pode corrigir manualmente depois.
      }
    }

    // 3b. Notificar financeiro apenas quando a turma estiver ativa
    if (payload.escola_id && finalCursoId && turmaData.status_validacao === 'ativo') {
      try {
        const { data: curso } = await supabase
          .from("cursos")
          .select("nome")
          .eq("id", finalCursoId)
          .maybeSingle();

        const titulo = `Novo curso ativo: ${curso?.nome || "Curso"}`;
        const mensagem = `A turma ${payload.nome_turma} foi aprovada. Verifique preços ou configure isenções.`;

        await supabase.from("notifications").insert({
          escola_id: payload.escola_id,
          target_role: "financeiro",
          tipo: "setup_pendente",
          titulo,
          mensagem,
          link_acao: "/financeiro/configuracoes/precos",
        });
      } catch (notifyError) {
        console.error("Erro ao notificar financeiro:", notifyError);
      }
    }

    if (
      payload.migracao_financeira &&
      turmaData.status_validacao === 'ativo' &&
      finalTurmaId
    ) {
      try {
        await aplicarContextoFinanceiroAprovacao({
          supabase,
          escolaId: payload.escola_id,
          turmaId: finalTurmaId,
          anoLetivo: turmaData.ano_letivo,
          skipMatricula: payload.migracao_financeira.skip_matricula,
          startMonth: payload.migracao_financeira.mes_inicio,
        });
      } catch (financeError) {
        console.error("Erro ao aplicar contexto financeiro na aprovação:", financeError);
      }
    }

    // 4. Revalidar Cache (Para a lista atualizar imediatamente)
    revalidatePath("/dashboard/turmas");
    
    return { success: true, data: result.data };

  } catch (error: any) {
    console.error("Erro ao validar turma:", error);
    throw new Error(error.message || "Erro ao processar a turma.");
  }
}

async function aplicarContextoFinanceiroAprovacao(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  escolaId: string;
  turmaId: string;
  anoLetivo: number | string;
  skipMatricula: boolean;
  startMonth: number;
}) {
  const { supabase, escolaId, turmaId, anoLetivo, skipMatricula, startMonth } = params;

  const { data: matriculas } = await supabase
    .from("matriculas")
    .select("id, aluno_id")
    .eq("escola_id", escolaId)
    .eq("turma_id", turmaId);

  if (!matriculas || matriculas.length === 0) return;

  const alunoIds = matriculas.map((m: any) => m.aluno_id).filter(Boolean);
  const matriculaIds = matriculas.map((m: any) => m.id).filter(Boolean);
  const clampedMonth = Math.min(Math.max(startMonth || 1, 1), 12);
  const anoLetivoNum = Number(anoLetivo) || new Date().getFullYear();

  if (skipMatricula && matriculaIds.length > 0) {
    await supabase
      .from("financeiro_lancamentos")
      .update({
        status: "pago" as any,
        valor_original: 0,
        valor_multa: 0,
        valor_desconto: 0,
        data_pagamento: new Date().toISOString(),
      })
      .eq("escola_id", escolaId)
      .eq("origem", "matricula")
      .in("matricula_id", matriculaIds);
  }

  if (clampedMonth > 1 && alunoIds.length > 0) {
    await supabase
      .from("mensalidades")
      .update({
        status: "isento" as any,
        valor_previsto: 0,
        valor: 0,
        valor_pago_total: 0,
      })
      .eq("escola_id", escolaId)
      .eq("ano_referencia", anoLetivoNum)
      .lt("mes_referencia", clampedMonth)
      .in("aluno_id", alunoIds);

    await supabase
      .from("financeiro_lancamentos")
      .update({
        status: "pago" as any,
        valor_original: 0,
        valor_multa: 0,
        valor_desconto: 0,
        data_pagamento: new Date().toISOString(),
      })
      .eq("escola_id", escolaId)
      .eq("origem", "mensalidade")
      .eq("ano_referencia", anoLetivoNum)
      .lt("mes_referencia", clampedMonth)
      .in("aluno_id", alunoIds);
  }
}
