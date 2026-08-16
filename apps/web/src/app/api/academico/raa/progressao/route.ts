import { NextResponse } from "next/server"
import { z } from "zod"
import { requireRoleInSchool } from "@/lib/authz"
import { resolveAcademicYearContext } from "@/lib/academic-year/context"
import { resolveRaaProgressionForMatricula, RaaProgressionUnavailableError } from "@/lib/academico/raa-progression-server"
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser"
import { supabaseServerTyped } from "@/lib/supabaseServer"

export const dynamic = "force-dynamic"
export const revalidate = 0

const querySchema = z.object({
  matricula_id: z.string().uuid(),
  ano_letivo_id: z.string().uuid().optional(),
})

const roles = ["admin", "admin_escola", "staff_admin", "diretor", "secretaria", "admin_financeiro", "professor"] as const

export async function GET(request: Request) {
  const supabase = await supabaseServerTyped<any>()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 })

  const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id)
  if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 400 })
  const authz = await requireRoleInSchool({ supabase, escolaId, roles: [...roles] })
  if (authz.error) return authz.error

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()))
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Matrícula ou ano letivo inválido." }, { status: 400 })

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

  try {
    const result = await resolveRaaProgressionForMatricula(supabase, escolaId, matricula)
    return NextResponse.json({
      ok: true,
      matricula_id: matricula.id,
      aluno_id: matricula.aluno_id,
      turma_id: matricula.turma_id,
      ano_letivo_id: academicContext.anoLetivoId,
      ...result,
    })
  } catch (error) {
    if (error instanceof RaaProgressionUnavailableError) {
      return NextResponse.json({
        ok: false,
        error: error.message,
        code: error.code,
        proximo_passo: error.code === "RAA_PROGRESSION_POLICY_NOT_CONFIGURED"
          ? "Configurar a política de progressão no painel de avaliação antes de analisar a matrícula."
          : "Rever os dados académicos e executar novamente a análise.",
        acoes: error.code === "RAA_PROGRESSION_POLICY_NOT_CONFIGURED"
          ? [{ id: "configurar_politica", label: "Configurar política de progressão", href: "/admin/configuracoes/avaliacao", prioridade: "principal" }]
          : [{ id: "rever_dados", label: "Rever dados académicos", href: "/secretaria/fechamento-academico", prioridade: "principal" }],
      }, { status: 503 })
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Não foi possível resolver a progressão." }, { status: 500 })
  }
}
