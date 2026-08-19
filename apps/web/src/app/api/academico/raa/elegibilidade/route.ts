import { NextResponse } from "next/server"
import { z } from "zod"
import { requireRoleInSchool } from "@/lib/authz"
import { resolveAcademicYearContext } from "@/lib/academic-year/context"
import { resolveRegimeAcademico } from "@/lib/academico/regime-academico"
import { resolveDecretoDecision } from "@/lib/academico/raa-progression-server"
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser"
import { supabaseServerTyped } from "@/lib/supabaseServer"

export const dynamic = "force-dynamic"
export const revalidate = 0

const querySchema = z.object({ matricula_id: z.string().uuid(), disciplina_id: z.string().uuid().optional(), ano_letivo_id: z.string().uuid().optional() })
const roles = ["admin", "admin_escola", "staff_admin", "diretor", "secretaria", "professor"] as const

export async function GET(request: Request) {
  const supabase = await supabaseServerTyped<any>()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 })

  const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id)
  if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 400 })
  const authz = await requireRoleInSchool({ supabase, escolaId, roles: [...roles] })
  if (authz.error) return authz.error

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()))
  if (!parsed.success) return NextResponse.json({ ok: false, error: "matricula_id inválido" }, { status: 400 })

  const academicContext = await resolveAcademicYearContext(supabase, {
    userId: auth.user.id,
    requestedAcademicYearId: parsed.data.ano_letivo_id,
    operation: "READ",
  })
  const { data: matricula } = await supabase
    .from("matriculas")
    .select("id, aluno_id, turma_id, session_id")
    .eq("id", parsed.data.matricula_id)
    .eq("escola_id", escolaId)
    .eq("session_id", academicContext.anoLetivoId)
    .maybeSingle()
  if (!matricula) return NextResponse.json({ ok: false, error: "Matrícula não encontrada no ano letivo ativo." }, { status: 404 })
  const regime = await resolveRegimeAcademico(supabase, matricula.turma_id)
  const canonicalResult = parsed.data.disciplina_id
    ? await supabase.rpc("resolve_estado_resultado", { p_matricula_id: matricula.id, p_disciplina_id: parsed.data.disciplina_id })
    : { data: null, error: null }
  if (canonicalResult.error) return NextResponse.json({ ok: false, error: "O resolvedor de resultado está indisponível.", code: "ACADEMIC_RESULT_RESOLVER_UNAVAILABLE" }, { status: 503 })

  const [{ data: config }, { data: boletim, error: boletimError }, { data: frequencias, error: frequenciasError }] = await Promise.all([
    supabase.from("configuracoes_pedagogicas").select("negativas_para_reprovar, media_minima_aprovacao, permitir_recurso").eq("escola_id", escolaId).maybeSingle(),
    supabase.from("vw_boletim_por_matricula").select("disciplina_id, nota_final, missing_count").eq("escola_id", escolaId).eq("matricula_id", matricula.id).limit(50),
    supabase.from("frequencia_status_periodo").select("faltas, aulas_previstas, frequencia_min_percent").eq("escola_id", escolaId).eq("matricula_id", matricula.id).limit(50),
  ])
  if (boletimError || frequenciasError) return NextResponse.json({ ok: false, error: boletimError?.message ?? frequenciasError?.message ?? "Não foi possível carregar a elegibilidade." }, { status: 500 })

  const boletimRows = (boletim ?? []) as Array<{ disciplina_id: string | null; nota_final: number | null; missing_count: number | null }>
  const dadosCompletos = boletimRows.length > 0 && boletimRows.every((row) => row.missing_count === 0 && row.nota_final != null)
  const mediaMinima = Number(config?.media_minima_aprovacao ?? 10)
  const notasPorDisciplina = new Map<string, number>()
  for (const row of boletimRows) {
    if (!row.disciplina_id || row.nota_final == null) continue
    const current = notasPorDisciplina.get(row.disciplina_id)
    notasPorDisciplina.set(row.disciplina_id, current == null ? Number(row.nota_final) : Math.max(current, Number(row.nota_final)))
  }
  const notasFinais = Array.from(notasPorDisciplina.values())
  const disciplinaIds = Array.from(new Set(boletimRows.map((row) => row.disciplina_id).filter((id): id is string => Boolean(id))))
  const quantidadeNegativas = notasFinais.filter((nota) => nota < mediaMinima).length
  const mediaGeral = notasFinais.length > 0 ? Number((notasFinais.reduce((sum, nota) => sum + nota, 0) / notasFinais.length).toFixed(1)) : null
  const frequenciaRows = (frequencias ?? []) as Array<{ faltas: number | null; aulas_previstas: number | null; frequencia_min_percent: number | null }>
  const aulas = frequenciaRows.reduce((sum, row) => sum + Math.max(0, Number(row.aulas_previstas ?? 0)), 0)
  const faltas = frequenciaRows.reduce((sum, row) => sum + Math.max(0, Number(row.faltas ?? 0)), 0)
  const percentualPresenca = aulas > 0 ? Number((((aulas - faltas) / aulas) * 100).toFixed(2)) : null
  const frequenciaMinima = Number(frequenciaRows.find((row) => row.frequencia_min_percent != null)?.frequencia_min_percent ?? 75)
  const decreto = await resolveDecretoDecision(
    supabase,
    escolaId,
    matricula.id,
    matricula.turma_id,
    regime,
    disciplinaIds,
  )
  const eligibility = decreto
    ? {
        status: decreto.decision,
        elegivel_recurso: decreto.elegivelRecurso,
        exame_extraordinario: decreto.exameExtraordinario,
        efetivacao_matricula_bloqueada: decreto.efetivacaoMatriculaBloqueada,
        disciplinas_negativas: decreto.disciplinasNegativas,
        disciplinas_pendentes: decreto.disciplinasPendentes,
        motivo: decreto.motivo,
        base_legal: decreto.baseLegal,
      }
    : {
        status: "pendente_dados",
        elegivel_recurso: false,
        exame_extraordinario: false,
        efetivacao_matricula_bloqueada: true,
        disciplinas_negativas: [],
        disciplinas_pendentes: disciplinaIds,
        motivo: "dados_pendentes",
        base_legal: "Decreto Executivo 04/2026: factos jurídicos incompletos.",
      }

  const nextAction = eligibility.status === "recurso" ? "Abrir uma sessão de recurso ou solicitar inscrição condicional." : eligibility.status === "pendente_dados" ? "Completar lançamentos de notas e frequência antes de decidir." : eligibility.status === "reprovado_por_faltas" ? "Revisar faltas injustificadas por disciplina com a secretaria." : "Nenhuma ação RAA pendente."
  return NextResponse.json({ ok: true, matricula_id: matricula.id, disciplina_id: parsed.data.disciplina_id ?? null, ano_letivo_id: academicContext.anoLetivoId, regime, canonical_result: canonicalResult.data, facts: { quantidade_negativas: quantidadeNegativas, media_geral: mediaGeral, percentual_presenca: percentualPresenca, dados_completos: dadosCompletos }, policy: { negativas_para_reprovar: Number(config?.negativas_para_reprovar ?? 3), media_minima_aprovacao: mediaMinima, frequencia_min_percent: frequenciaMinima }, eligibility, next_action: nextAction })
}
