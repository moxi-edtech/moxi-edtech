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

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()))
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Turma, disciplina ou ano letivo inválido." }, { status: 400 })

  const academicContext = await resolveAcademicYearContext(supabase, {
    userId: auth.user.id,
    requestedAcademicYearId: parsed.data.ano_letivo_id,
    operation: "READ",
  })

  const [{ data: turma }, { data: vinculo }] = await Promise.all([
    supabase.from("turmas").select("id").eq("id", parsed.data.turma_id).eq("escola_id", escolaId).maybeSingle(),
    supabase.from("turma_disciplinas").select("id").eq("turma_id", parsed.data.turma_id).eq("escola_id", escolaId).eq("avaliacao_disciplina_id", parsed.data.disciplina_id).maybeSingle(),
  ])
  if (!turma || !vinculo) return NextResponse.json({ ok: false, error: "Contexto académico não encontrado." }, { status: 404 })

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
      p_disciplina_id: parsed.data.disciplina_id,
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
    turma_id: parsed.data.turma_id,
    disciplina_id: parsed.data.disciplina_id,
    ano_letivo_id: academicContext.anoLetivoId,
    regime,
    total_alunos: items.length,
    total_riscos: riscos.length,
    items: riscos,
  })
}
