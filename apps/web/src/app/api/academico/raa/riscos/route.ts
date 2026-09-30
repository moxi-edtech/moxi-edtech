import { NextResponse } from "next/server"
import { z } from "zod"
import { requireRoleInSchool } from "@/lib/authz"
import { resolveAcademicYearContext } from "@/lib/academic-year/context"
import { resolveRegimeAcademico } from "@/lib/academico/regime-academico"
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser"
import { supabaseServerTyped } from "@/lib/supabaseServer"

export const dynamic = "force-dynamic"
export const revalidate = 0

const querySchema = z.object({
  turma_id: z.string().uuid(),
  disciplina_id: z.string().uuid(),
  ano_letivo_id: z.string().uuid().optional(),
})

const roles = ["admin", "admin_escola", "staff_admin", "diretor", "secretaria", "professor"] as const

function resolveRisk(status: string | null, isExam: boolean) {
  if (status === "pendente_formula") return { codigo: "exame_pendente", label: "Exame pendente", action: "Confirmar sessão e componentes do exame." }
  if (status === "reprovado") return { codigo: "resultado_negativo", label: "Resultado negativo", action: "Rever recurso ou reapreciação." }
  if (status === "reprovado_por_indisciplina") return { codigo: "indisciplina_grave", label: "Retido por indisciplina grave", action: "Consultar o evento e a decisão disciplinar." }
  if (status === "pendente_dados") return { codigo: "dados_pendentes", label: "Dados pendentes", action: "Completar notas e frequência." }
  if (isExam && status !== "aprovado") return { codigo: "exame_pendente", label: "Exame pendente", action: "Confirmar a fórmula e os componentes do exame." }
  return null
}

export async function GET(request: Request) {
  const supabase = await supabaseServerTyped<any>()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 })

  const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id)
  if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 400 })
  const authz = await requireRoleInSchool({ supabase, escolaId, roles: [...roles] })
  if (authz.error) return authz.error

  // O painel apresentado no portal do professor é limitado à atribuição
  // pedagógica do professor. A autorização da escola, por si só, não basta:
  // evita que um professor consulte outra turma alterando os IDs da URL.
  const { data: membership } = await supabase
    .from("escola_users")
    .select("papel")
    .eq("escola_id", escolaId)
    .eq("user_id", auth.user.id)
    .maybeSingle()

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()))
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Turma, disciplina ou ano letivo inválido." }, { status: 400 })

  const viewerScope = membership?.papel === "professor" ? "professor_context" : "school_management"

  if (membership?.papel === "professor") {
    const { data: professor } = await supabase
      .from("professores")
      .select("id")
      .eq("escola_id", escolaId)
      .eq("profile_id", auth.user.id)
      .maybeSingle()
    if (!professor?.id) return NextResponse.json({ ok: false, error: "Professor não encontrado nesta escola." }, { status: 403 })

    const [{ data: sharedAssignment }, { data: directAssignments }] = await Promise.all([
      supabase
        .from("turma_disciplinas_professores")
        .select("id")
        .eq("escola_id", escolaId)
        .eq("turma_id", parsed.data.turma_id)
        .eq("disciplina_id", parsed.data.disciplina_id)
        .eq("professor_id", professor.id)
        .limit(1),
      supabase
        .from("turma_disciplinas")
        .select("id, curso_matriz_id")
        .eq("escola_id", escolaId)
        .eq("turma_id", parsed.data.turma_id)
        .eq("professor_id", professor.id),
    ])

    const directMatrizIds = (directAssignments ?? []).map((item: any) => item.curso_matriz_id).filter(Boolean)
    const { data: directMatrizes } = directMatrizIds.length
      ? await supabase
        .from("curso_matriz")
        .select("id")
        .eq("escola_id", escolaId)
        .eq("disciplina_id", parsed.data.disciplina_id)
        .in("id", directMatrizIds)
      : { data: [] as Array<{ id: string }> }

    if (!(sharedAssignment?.length || directMatrizes?.length)) {
      return NextResponse.json({ ok: false, error: "Esta turma e disciplina não estão atribuídas ao professor." }, { status: 403 })
    }
  }

  const academicContext = await resolveAcademicYearContext(supabase, {
    userId: auth.user.id,
    requestedAcademicYearId: parsed.data.ano_letivo_id,
    operation: "READ",
  })

  const { data: turma } = await supabase
    .from("turmas")
    .select("id, curso_id, classe_id")
    .eq("id", parsed.data.turma_id)
    .eq("escola_id", escolaId)
    .maybeSingle()
  if (!turma) return NextResponse.json({ ok: false, error: "Contexto académico não encontrado." }, { status: 404 })

  const { data: turmaDisciplinas } = await supabase
    .from("turma_disciplinas")
    .select("id, curso_matriz_id, avaliacao_disciplina_id")
    .eq("turma_id", parsed.data.turma_id)
    .eq("escola_id", escolaId)

  const matrizIds = (turmaDisciplinas ?? []).map((item: any) => item.curso_matriz_id).filter(Boolean)
  const { data: matrizes } = matrizIds.length
    ? await supabase.from("curso_matriz").select("id, disciplina_id, avaliacao_disciplina_id, curso_id, classe_id, curso_curriculo_id").eq("escola_id", escolaId).in("id", matrizIds)
    : { data: [] as any[] }
  const matrizById = new Map((matrizes ?? []).map((item: any) => [item.id, item]))
  const matchingVinculos = (turmaDisciplinas ?? []).filter((item: any) => {
    const matriz = matrizById.get(item.curso_matriz_id)
    return item.avaliacao_disciplina_id === parsed.data.disciplina_id
      || matriz?.disciplina_id === parsed.data.disciplina_id
      || matriz?.avaliacao_disciplina_id === parsed.data.disciplina_id
  }) as any[]
  if (matchingVinculos.length === 0) {
    return NextResponse.json({ ok: false, error: "Contexto académico não encontrado." }, { status: 404 })
  }

  const curriculumIds = matchingVinculos
    .map((item: any) => matrizById.get(item.curso_matriz_id)?.curso_curriculo_id)
    .filter(Boolean)
  const { data: curriculos } = curriculumIds.length
    ? await supabase
      .from("curso_curriculos")
      .select("id, curso_id, classe_id, ano_letivo_id, version, status")
      .eq("escola_id", escolaId)
      .in("id", Array.from(new Set(curriculumIds)))
    : { data: [] as any[] }
  const curriculumById = new Map((curriculos ?? []).map((item: any) => [item.id, item]))
  const publishedVinculos = matchingVinculos.filter((item: any) => {
    const matriz = matrizById.get(item.curso_matriz_id)
    const curriculo = curriculumById.get(matriz?.curso_curriculo_id)
    return curriculo?.status === "published"
      && curriculo.curso_id === turma.curso_id
      && curriculo.classe_id === turma.classe_id
      && curriculo.ano_letivo_id === academicContext.anoLetivoId
  })
  const candidateVinculos = publishedVinculos.length > 0 ? publishedVinculos : matchingVinculos
  const candidateCurriculumIds = new Set(candidateVinculos.map((item: any) => matrizById.get(item.curso_matriz_id)?.curso_curriculo_id).filter(Boolean))
  if (candidateCurriculumIds.size > 1) {
    return NextResponse.json({
      ok: false,
      code: "CURRICULUM_CONTEXT_AMBIGUOUS",
      error: "Há mais de um currículo publicado para esta classe e ano letivo. A secretaria deve consolidar o currículo antes de consultar o RAA.",
      turma_id: parsed.data.turma_id,
      disciplina_id: parsed.data.disciplina_id,
      ano_letivo_id: academicContext.anoLetivoId,
      curriculum_ids: Array.from(candidateCurriculumIds),
    }, { status: 409 })
  }
  if (candidateVinculos.length > 1) {
    return NextResponse.json({
      ok: false,
      code: "TURMA_DISCIPLINA_DUPLICATE",
      error: "Há mais de um vínculo materializado para esta disciplina na turma. A secretaria deve reconciliar os vínculos antes de consultar o RAA.",
      turma_id: parsed.data.turma_id,
      disciplina_id: parsed.data.disciplina_id,
      ano_letivo_id: academicContext.anoLetivoId,
      curriculum_ids: Array.from(candidateCurriculumIds),
    }, { status: 409 })
  }
  const vinculo = candidateVinculos[0] as any
  const matriz = matrizById.get(vinculo.curso_matriz_id)
  const raaDisciplinaId = vinculo.avaliacao_disciplina_id
    ?? matriz?.avaliacao_disciplina_id
    ?? matriz?.disciplina_id
    ?? parsed.data.disciplina_id

  const regime = await resolveRegimeAcademico(supabase, parsed.data.turma_id)
  const { data: matriculas, error } = await supabase
    .from("matriculas")
    .select("id, aluno_id, alunos!inner(id, nome)")
    .eq("escola_id", escolaId)
    .eq("turma_id", parsed.data.turma_id)
    .eq("session_id", academicContext.anoLetivoId)
    .in("status", ["ativo", "ativa", "active"])
    .order("id", { ascending: true })
    .limit(100)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const items = await Promise.all((matriculas ?? []).map(async (matricula: any) => {
    const { data: canonical, error: canonicalError } = await supabase.rpc("resolve_estado_resultado", {
      p_matricula_id: matricula.id,
      p_disciplina_id: raaDisciplinaId,
    })
    if (canonicalError) throw canonicalError
    const status = typeof canonical?.status === "string" ? canonical.status : null
    const risk = resolveRisk(status, regime.eh_classe_exame)
    return {
      matricula_id: matricula.id,
      aluno_id: matricula.aluno_id,
      aluno_nome: Array.isArray(matricula.alunos) ? matricula.alunos[0]?.nome ?? "Sem nome" : matricula.alunos?.nome ?? "Sem nome",
      status,
      nota: canonical?.nota ?? null,
      corte: canonical?.corte ?? null,
      risco: risk,
    }
  }))

  const riscos = items.filter((item) => item.risco)
  return NextResponse.json({
    ok: true,
    viewer_scope: viewerScope,
    turma_id: parsed.data.turma_id,
    disciplina_id: parsed.data.disciplina_id,
    ano_letivo_id: academicContext.anoLetivoId,
    regime,
    total_alunos: items.length,
    total_riscos: riscos.length,
    items: riscos,
  })
}
