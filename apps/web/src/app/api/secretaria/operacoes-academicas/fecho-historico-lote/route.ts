import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser";
import { supabaseServerTyped } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CURTUME = "3744879f-2e19-4671-8995-78604302d8c5";
const ROLES = new Set(["admin", "admin_escola", "diretor"]);
const BatchSchema = z.object({
  acao: z.literal("concluir_2025_2026"),
  confirmacao: z.literal("CONFIRMO_PAUTAS_2025"),
  lote_id: z.string().uuid(),
  cursor: z.string().uuid().nullable(),
}).strict();

const PhysicalPautaSchema = z.object({
  acao: z.literal("transcrever_pauta_2025"),
  matricula_id: z.string().uuid(),
  aluno_id: z.string().uuid(),
  referencia: z.string().trim().min(8).max(180),
  folha: z.string().trim().min(2).max(80),
  notas: z.array(z.object({
    disciplina_id: z.string().uuid(),
    valor: z.number().min(0).max(20).refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7),
  }).strict()).min(1).max(30),
  todas_disciplinas: z.literal(true),
  confirmacao: z.literal("CONFIRMO_PAUTA_2025"),
}).strict();

const GradeReconciliationSchema = z.object({
  acao: z.literal("conferir_notas_2025"),
  matricula_id: z.string().uuid(),
  aluno_id: z.string().uuid(),
  referencia: z.string().trim().min(8).max(180),
  motivo: z.string().trim().min(12).max(500),
  confirmacao: z.literal("CONFIRMO_PAUTA_2025"),
}).strict();

async function context() {
  const db = await supabaseServerTyped<any>();
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (authError || !user)
    return { db, allowed: false, response: NextResponse.json({ ok: false, error: "Sessão inválida." }, { status: 401 }) };
  const escola = await resolveEscolaIdForUser(db, user.id);
  if (escola !== CURTUME)
    return { db, allowed: false, response: NextResponse.json({ ok: false, error: "Esta operação está limitada à CURTUME." }, { status: 403 }) };
  // Exact membership — never infer privileged roles from expanded aliases.
  const { data: membership, error } = await db.from("escola_users")
    .select("papel").eq("escola_id", CURTUME).eq("user_id", user.id).maybeSingle();
  if (error || !ROLES.has(String(membership?.papel ?? "")))
    return { db, allowed: false, response: NextResponse.json({ ok: false, error: "A confirmação em lote exige acesso da Direção." }, { status: 403 }) };
  return { db, allowed: true, response: null };
}

/** Read-only preview or a single, strictly school-scoped exception dossier. */
export async function GET(request: Request) {
  try {
    const ctx = await context();
    if (!ctx.allowed) return ctx.response!;

    const { searchParams } = new URL(request.url);
    const matriculaId = searchParams.get("matricula_id");
    const alunoId = searchParams.get("aluno_id");
    if (matriculaId !== null || alunoId !== null) {
      if (!matriculaId || !alunoId ||
          !z.string().uuid().safeParse(matriculaId).success ||
          !z.string().uuid().safeParse(alunoId).success)
        return NextResponse.json({ ok: false, error: "Aluno ou matrícula inválidos." }, { status: 400 });
      const { data: history, error: historyError } = await ctx.db.from("historico_anos")
        .select("id,matricula_id,aluno_id,turma_id,ano_letivo_id,resultado_final,snapshot_status")
        .eq("escola_id", CURTUME).eq("ano_letivo", 2025)
        .eq("matricula_id", matriculaId).eq("aluno_id", alunoId)
        .eq("snapshot_status", "aberto").maybeSingle();
      if (historyError) throw historyError;
      if (!history) return NextResponse.json({ ok: false,
        error: "Não existe histórico aberto de 2025/2026 para esta matrícula." }, { status: 404 });

      const [{ data: origin, error: originError }, historicalResponse, notesResponse] = await Promise.all([
        ctx.db.from("matriculas")
          .select("id,aluno_id,ano_letivo,session_id,status,ativo,status_fecho_origem,turma_id")
          .eq("escola_id", CURTUME).eq("id", matriculaId).eq("aluno_id", alunoId).maybeSingle(),
        ctx.db.from("historico_disciplinas")
          .select("disciplina_id,disciplina_nome,nota_final,notas_detalhe")
          .eq("historico_ano_id", history.id)
          .order("disciplina_nome", { ascending: true }).limit(151),
        ctx.db.from("notas")
          .select("id,avaliacao_id,valor,is_isento")
          .eq("escola_id", CURTUME).eq("matricula_id", matriculaId)
          .order("created_at", { ascending: true }).limit(151),
      ]);
      if (originError || historicalResponse.error || notesResponse.error) {
        throw originError ?? historicalResponse.error ?? notesResponse.error;
      }
      if (!origin || origin.ano_letivo !== 2025)
        return NextResponse.json({ ok: false, error: "Matrícula de origem incompatível." }, { status: 409 });

      const historicas = (historicalResponse.data ?? []) as Array<{
        disciplina_id: string; disciplina_nome: string | null;
        nota_final: number | null; notas_detalhe: Record<string, unknown> | null;
      }>;
      const operacionais = (notesResponse.data ?? []) as Array<{
        id: string; avaliacao_id: string; valor: number; is_isento: boolean | null;
      }>;
      if (historicas.length > 150 || operacionais.length > 150)
        return NextResponse.json({ ok: false, error: "Há dados a mais para uma conferência individual segura." }, { status: 422 });

      const evaluationIds = [...new Set(operacionais.map((n) => n.avaliacao_id))];
      const evaluations = evaluationIds.length
        ? await ctx.db.from("avaliacoes")
            .select("id,nome,trimestre,ano_letivo,turma_disciplina_id")
            .eq("escola_id", CURTUME).eq("ano_letivo", 2025).in("id", evaluationIds)
        : { data: [], error: null };
      if (evaluations.error) throw evaluations.error;
      const evals = (evaluations.data ?? []) as Array<{
        id: string; nome: string; trimestre: number; ano_letivo: number; turma_disciplina_id: string;
      }>;
      const tdIds = [...new Set(evals.map((ev) => ev.turma_disciplina_id))];
      const memberships = tdIds.length
        ? await ctx.db.from("turma_disciplinas")
            .select("id,curso_matriz_id").eq("escola_id", CURTUME).in("id", tdIds)
        : { data: [], error: null };
      if (memberships.error) throw memberships.error;
      const memberById = new Map(((memberships.data ?? []) as Array<{
        id: string; curso_matriz_id: string;
      }>).map((item) => [item.id, item]));
      const cmIds = [...new Set([...memberById.values()].map((item) => item.curso_matriz_id))];
      const matrices = cmIds.length
        ? await ctx.db.from("curso_matriz").select("id,disciplina_id")
            .eq("escola_id", CURTUME).in("id", cmIds)
        : { data: [], error: null };
      if (matrices.error) throw matrices.error;
      const matrixById = new Map(((matrices.data ?? []) as Array<{
        id: string; disciplina_id: string;
      }>).map((item) => [item.id, item]));
      const disciplineIds = [...new Set([...matrixById.values()].map((item) => item.disciplina_id))];
      const catalog = disciplineIds.length
        ? await ctx.db.from("disciplinas_catalogo").select("id,nome")
            .eq("escola_id", CURTUME).in("id", disciplineIds)
        : { data: [], error: null };
      if (catalog.error) throw catalog.error;
      const disciplineById = new Map(((catalog.data ?? []) as Array<{
        id: string; nome: string;
      }>).map((item) => [item.id, item.nome]));
      const evalById = new Map(evals.map((ev) => [ev.id, ev]));
      // Any grade with an unknown evaluation remains visible, never silently
      // omitted as if it were reconciled or absent.
      const operationalGrades = operacionais.map((note) => {
        const evaluation = evalById.get(note.avaliacao_id);
        const membership = evaluation ? memberById.get(evaluation.turma_disciplina_id) : null;
        const matrix = membership ? matrixById.get(membership.curso_matriz_id) : null;
        return {
          id: note.id,
          disciplina: matrix ? disciplineById.get(matrix.disciplina_id) ?? "Disciplina não identificada" :
            "Avaliação sem vínculo identificável",
          avaliacao: evaluation?.nome ?? "Avaliação não identificada",
          trimestre: evaluation?.trimestre ?? null,
          valor: note.valor,
          is_isento: note.is_isento === true,
          originVerified: Boolean(evaluation && matrix && matrix.disciplina_id),
        };
      });

      const sourceComplete = origin.status === "concluido" &&
        origin.ativo === false && origin.status_fecho_origem === "override_admin" &&
        origin.session_id != null && origin.session_id === history.ano_letivo_id;
      const signedStatus = operacionais.length > 0
        ? await ctx.db.rpc("curtume_2025_status_conferencia", {
            p_escola_id: CURTUME, p_matricula_id: matriculaId,
          })
        : { data: false, error: null };
      if (signedStatus.error) throw signedStatus.error;

      const availableSubjects: Array<{ id: string; nome: string }> = [];
      let escalaMaxima: number | null = null;
      if (historicas.length === 0 && operacionais.length === 0 && sourceComplete) {
        // Only source-year published curriculum options for this student's
        // actual 2025 turma. This is not the 2026/2027 curriculum.
        const { data: sourceTurma, error: turmaError } = await ctx.db.from("turmas")
          .select("classe_id").eq("escola_id", CURTUME).eq("id", history.turma_id)
          .eq("ano_letivo", 2025).maybeSingle();
        if (turmaError) throw turmaError;
        const { data: sourceClass, error: classError } = sourceTurma
          ? await ctx.db.from("classes").select("numero").eq("escola_id", CURTUME)
              .eq("id", sourceTurma.classe_id).maybeSingle()
          : { data: null, error: null };
        if (classError) throw classError;
        const classeNum = Number(sourceClass?.numero);
        if (sourceTurma && Number.isInteger(classeNum) && classeNum >= 1 && classeNum <= 12) {
          escalaMaxima = classeNum <= 6 ? 10 : 20;
          const { data: curriculum, error: curriculumError } = await ctx.db.from("curso_curriculos")
            .select("id").eq("escola_id", CURTUME).eq("classe_id", sourceTurma.classe_id)
            .eq("ano_letivo_id", history.ano_letivo_id).eq("status", "published").maybeSingle();
          if (curriculumError) throw curriculumError;
          if (curriculum) {
            const { data: matrixRows, error: matrixError } = await ctx.db.from("curso_matriz")
              .select("disciplina_id").eq("escola_id", CURTUME)
              .eq("curso_curriculo_id", curriculum.id).eq("classe_id", sourceTurma.classe_id)
              .eq("ativo", true).limit(40);
            if (matrixError) throw matrixError;
            const subjectIds = [...new Set(((matrixRows ?? []) as Array<{ disciplina_id: string }>)
              .map((row) => row.disciplina_id))];
            if (subjectIds.length) {
              const { data: subjects, error: subjectError } = await ctx.db.from("disciplinas_catalogo")
                .select("id,nome").eq("escola_id", CURTUME).in("id", subjectIds);
              if (subjectError) throw subjectError;
              availableSubjects.push(...((subjects ?? []) as Array<{ id: string; nome: string }>)
                .sort((left, right) => left.nome.localeCompare(right.nome, "pt")));
            }
          }
        }
      }

      const issueCode = !sourceComplete ? "ORIGEM_HISTORICA_INCOMPATIVEL" :
        operacionais.length > 0 ? "NOTAS_OPERACIONAIS_EXIGEM_RECONCILIACAO" :
        historicas.length === 0 ? "SEM_NOTAS_HISTORICAS" :
        historicas.some((h) => h.nota_final == null || !h.disciplina_id) ?
          "PAUTA_HISTORICA_INCONSISTENTE" : "RAA_RESULTADO_NAO_RECONHECIDO";
      return NextResponse.json({
        ok: true, matricula_id: matriculaId, aluno_id: alunoId,
        ano_letivo: "2025/2026", motivo: issueCode,
        resultado_final: history.resultado_final,
        disciplinas_pauta: historicas.map((h) => ({
          id: h.disciplina_id,
          nome: h.disciplina_nome,
          nota_final: h.nota_final,
          referencia: typeof h.notas_detalhe?.arquivo === "string" ? h.notas_detalhe.arquivo : null,
        })),
        notas_operacionais: operationalGrades,
        conferencia_validada: signedStatus.data === true,
        disciplinas_disponiveis_2025: availableSubjects,
        escala_maxima: escalaMaxima,
        sourceComplete,
      }, { headers: { "Cache-Control": "no-store" } });
    }

    const { count, error } = await ctx.db.from("historico_anos")
      .select("id", { count: "exact", head: true })
      .eq("escola_id", CURTUME).eq("ano_letivo", 2025)
      .eq("snapshot_status", "aberto");
    if (error) throw error;
    return NextResponse.json({ ok: true, ano_letivo: "2025/2026", abertos: count ?? 0 },
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[curtume-historic-batch] preview failed", error);
    return NextResponse.json({ ok: false, error: "Não foi possível consultar os históricos." }, { status: 500 });
  }
}

type HistoricIssue = {
  matricula_id: string;
  codigo: string;
  detalhe?: string;
};

type HistoricIssueWithStudent = HistoricIssue & {
  aluno_id: string | null;
  aluno_nome: string | null;
  numero_processo: string | null;
  turma_nome: string | null;
};

/** Enrich only actual RPC failures; do not fetch or expose the successful pupils. */
async function enrichBlockingIssues(db: any, input: HistoricIssue[]): Promise<HistoricIssueWithStudent[]> {
  const fallback = input.map((issue) => ({
    ...issue,
    aluno_id: null,
    aluno_nome: null,
    numero_processo: null,
    turma_nome: null,
  }));
  if (!input.length) return fallback;

  const ids = Array.from(new Set(input.map((issue) => issue.matricula_id)))
    .filter((id) => z.string().uuid().safeParse(id).success)
    .slice(0, 25);
  if (!ids.length) return fallback;

  try {
    const { data: records, error: recordError } = await db.from("historico_anos")
      .select("matricula_id,aluno_id,turma_id")
      .eq("escola_id", CURTUME)
      .eq("ano_letivo", 2025)
      .eq("snapshot_status", "aberto")
      .in("matricula_id", ids);
    if (recordError) throw recordError;
    const histories = (records ?? []) as Array<{
      matricula_id: string;
      aluno_id: string;
      turma_id: string | null;
    }>;

    const studentIds = Array.from(new Set(histories.map((item) => item.aluno_id)));
    const turmaIds = Array.from(new Set(histories.map((item) => item.turma_id).filter(
      (id): id is string => typeof id === "string"
    )));
    const [studentsResponse, turmasResponse] = await Promise.all([
      studentIds.length
        ? db.from("alunos").select("id,nome_completo,nome,numero_processo")
            .eq("escola_id", CURTUME).in("id", studentIds)
        : Promise.resolve({ data: [], error: null }),
      turmaIds.length
        ? db.from("turmas").select("id,nome").eq("escola_id", CURTUME)
            .eq("ano_letivo", 2025).in("id", turmaIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (studentsResponse.error || turmasResponse.error) {
      throw studentsResponse.error ?? turmasResponse.error;
    }

    const byMatricula = new Map(histories.map((item) => [item.matricula_id, item]));
    const byStudent = new Map(((studentsResponse.data ?? []) as Array<{
      id: string; nome_completo: string | null; nome: string | null; numero_processo: string | null;
    }>).map((item) => [item.id, item]));
    const byTurma = new Map(((turmasResponse.data ?? []) as Array<{
      id: string; nome: string;
    }>).map((item) => [item.id, item]));

    return input.map((issue) => {
      const history = byMatricula.get(issue.matricula_id);
      const student = history ? byStudent.get(history.aluno_id) : null;
      const turma = history?.turma_id ? byTurma.get(history.turma_id) : null;
      return {
        ...issue,
        aluno_id: student?.id ?? null,
        aluno_nome: student?.nome_completo || student?.nome || null,
        numero_processo: student?.numero_processo ?? null,
        turma_nome: turma?.nome ?? null,
      };
    });
  } catch (cause) {
    // A failed name lookup must never undo an already committed legal close.
    console.error("[curtume-historic-batch] exception enrichment failed", cause);
    return fallback;
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await context();
    if (!ctx.allowed) return ctx.response!;
    const payload = await request.json().catch(() => null);
    if (payload && typeof payload === "object" &&
        !Array.isArray(payload) && payload.acao === "transcrever_pauta_2025") {
      const verified = PhysicalPautaSchema.safeParse(payload);
      if (!verified.success)
        return NextResponse.json({ ok: false, error: "Preencha as notas, a referência e a folha da pauta." },
          { status: 400 });
      const { matricula_id, aluno_id, referencia, folha, notas, todas_disciplinas } = verified.data;
      if (new Set(notas.map((item) => item.disciplina_id)).size !== notas.length)
        return NextResponse.json({ ok: false, error: "A pauta contém disciplinas repetidas." },
          { status: 400 });
      const { data: history, error: lookupError } = await ctx.db.from("historico_anos")
        .select("id").eq("escola_id", CURTUME).eq("ano_letivo", 2025)
        .eq("aluno_id", aluno_id).eq("matricula_id", matricula_id)
        .eq("snapshot_status", "aberto").maybeSingle();
      if (lookupError) throw lookupError;
      if (!history) return NextResponse.json({ ok: false,
        error: "Matrícula de 2025/2026 não encontrada." }, { status: 404 });
      const { data, error: writeError } = await ctx.db.rpc("curtume_2025_transcrever_pauta_fisica", {
        p_escola_id: CURTUME, p_matricula_id: matricula_id, p_aluno_id: aluno_id,
        p_referencia: referencia, p_folha: folha,
        p_notas: notas, p_todas_disciplinas: todas_disciplinas,
      });
      if (writeError) {
        console.error("[curtume-historic-batch] transcription blocked", {
          code: writeError.code, message: writeError.message,
        });
        return NextResponse.json({ ok: false, error: writeError.code === "42501"
          ? "Só a Direção pode confirmar a pauta." :
          writeError.code === "23514"
            ? "A pauta, a matrícula ou a turma mudou. Confira os dados e tente novamente."
            : "Não foi possível registar a pauta." }, { status:
              writeError.code === "42501" ? 403 : writeError.code === "23514" ? 409 : 500 });
      }
      if (data?.ok !== true || data?.disciplinas_registadas !== notas.length)
        return NextResponse.json({ ok: false, error: "A confirmação não pôde ser validada." },
          { status: 502 });
      return NextResponse.json({ ok: true, matricula_id,
        disciplinas_registadas: data.disciplinas_registadas, ano_letivo: "2025/2026" },
        { headers: { "Cache-Control": "no-store" } });
    }
    if (payload && typeof payload === "object" &&
        !Array.isArray(payload) && payload.acao === "conferir_notas_2025") {
      const verified = GradeReconciliationSchema.safeParse(payload);
      if (!verified.success)
        return NextResponse.json({ ok: false, error: "Referência, motivo e confirmação são obrigatórios." },
          { status: 400 });
      const { matricula_id, aluno_id, referencia, motivo } = verified.data;
      const { data: history, error: lookupError } = await ctx.db.from("historico_anos")
        .select("id").eq("escola_id", CURTUME).eq("ano_letivo", 2025)
        .eq("aluno_id", aluno_id).eq("matricula_id", matricula_id)
        .eq("snapshot_status", "aberto").maybeSingle();
      if (lookupError) throw lookupError;
      if (!history) return NextResponse.json({ ok: false,
        error: "Histórico de 2025/2026 não encontrado para este aluno." }, { status: 404 });
      const { data, error: signingError } = await ctx.db.rpc(
        "curtume_2025_conferir_notas_documentais", {
          p_escola_id: CURTUME,
          p_matricula_id: matricula_id,
          p_referencia: referencia,
          p_motivo: motivo,
        });
      if (signingError) {
        console.error("[curtume-historic-batch] director confirmation failed", {
          code: signingError.code, message: signingError.message,
        });
        const status = signingError.code === "42501" ? 403 :
          signingError.code === "23514" ? 409 : 500;
        return NextResponse.json({ ok: false,
          error: status === 403 ? "A conferência exige sessão autorizada da Direção." :
            status === 409 ? "A pauta ou a matrícula mudou. Atualize e confira novamente." :
              "Não foi possível registar a conferência." }, { status });
      }
      if (data?.ok !== true || data.matricula_id !== matricula_id)
        return NextResponse.json({ ok: false, error: "Resposta de conferência inválida." },
          { status: 502 });
      return NextResponse.json({
        ok: true, matricula_id, conferencia_validada: true,
        notas_operacionais_preservadas: data.notas_operacionais_preservadas ?? null,
      }, { headers: { "Cache-Control": "no-store" } });
    }
    const parsed = BatchSchema.safeParse(payload);
    if (!parsed.success)
      return NextResponse.json({ ok: false, error: "Confirmação do lote inválida." }, { status: 400 });

    // One confirmed click in the UI, paginated internally to avoid long-running
    // PostgREST calls. Atomicity and student-level audit live in PostgreSQL.
    const { data, error } = await ctx.db.rpc("curtume_fechar_pautas_2025_lote", {
      p_escola_id: CURTUME,
      p_lote_id: parsed.data.lote_id,
      p_depois: parsed.data.cursor,
      p_limite: 25,
    });
    if (error) {
      console.error("[curtume-historic-batch] RPC failed", { code: error.code, message: error.message });
      const status = error.code === "42501" ? 403 : error.code === "55P03" ? 409 : 500;
      return NextResponse.json({ ok: false,
        error: status === 409 ? "Outro fecho académico está em execução. Volte a tentar." :
               status === 403 ? "Não autorizado para este lote." : "Não foi possível executar o fecho académico." },
        { status });
    }
    if (data?.ok !== true || !Number.isSafeInteger(Number(data?.processados)))
      return NextResponse.json({ ok: false, error: "Resposta inesperada da operação académica." }, { status: 502 });

    const rawIssues = data?.pendencias;
    if (!Array.isArray(rawIssues) ||
        rawIssues.length > 25 ||
        rawIssues.length !== Number(data.bloqueados) ||
        rawIssues.some((issue: unknown) => !issue || typeof issue !== "object" ||
          typeof (issue as HistoricIssue).matricula_id !== "string" ||
          typeof (issue as HistoricIssue).codigo !== "string")) {
      return NextResponse.json({ ok: false, error: "Contagem de pendências inconsistente." }, { status: 502 });
    }
    const pendencias = await enrichBlockingIssues(ctx.db, rawIssues as HistoricIssue[]);
    return NextResponse.json({ ...data, pendencias }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[curtume-historic-batch] request failed", error);
    return NextResponse.json({ ok: false, error: "Falha no processamento do lote." }, { status: 500 });
  }
}
