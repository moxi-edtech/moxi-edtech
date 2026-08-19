import { NextResponse } from "next/server"
import { z } from "zod"
import { requireRoleInSchool } from "@/lib/authz"
import { resolveAcademicYearContext } from "@/lib/academic-year/context"
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser"
import { supabaseServerTyped } from "@/lib/supabaseServer"

export const dynamic = "force-dynamic"
export const revalidate = 0

const roles = ["admin", "admin_escola", "staff_admin", "admin_financeiro", "diretor", "secretaria", "professor"] as const
const createSchema = z.object({
  matricula_id: z.string().uuid(),
  gravidade: z.enum(["grave", "muito_grave"]),
  categoria: z.string().trim().min(3).max(120),
  descricao: z.string().trim().min(10).max(4000),
  medida_aplicada: z.string().trim().max(2000).optional().nullable(),
  impacta_resultado: z.boolean().optional(),
  ano_letivo_id: z.string().uuid().optional(),
})

async function resolveContext() {
  const supabase = await supabaseServerTyped<any>()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return { supabase, auth: null, escolaId: null, error: NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 }) }
  const escolaId = await resolveEscolaIdForUser(supabase, auth.user.id)
  if (!escolaId) return { supabase, auth, escolaId: null, error: NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 400 }) }
  const authz = await requireRoleInSchool({ supabase, escolaId, roles: [...roles] })
  if (authz.error) return { supabase, auth, escolaId, error: authz.error }
  return { supabase, auth, escolaId, error: null }
}

export async function POST(request: Request) {
  const context = await resolveContext()
  if (context.error || !context.auth || !context.escolaId) return context.error
  const parsed = createSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 })

  const academicContext = await resolveAcademicYearContext(context.supabase, {
    userId: context.auth.user.id,
    requestedAcademicYearId: parsed.data.ano_letivo_id,
    operation: "READ",
  })
  const { data: matricula } = await context.supabase
    .from("matriculas")
    .select("id, escola_id, aluno_id, turma_id, session_id")
    .eq("id", parsed.data.matricula_id)
    .eq("escola_id", context.escolaId)
    .eq("session_id", academicContext.anoLetivoId)
    .maybeSingle()
  if (!matricula) return NextResponse.json({ ok: false, error: "Matrícula não encontrada no ano letivo ativo." }, { status: 404 })

  const { data: item, error } = await context.supabase
    .from("raa_indisciplina_eventos")
    .insert({
      escola_id: context.escolaId,
      ano_letivo_id: academicContext.anoLetivoId,
      turma_id: matricula.turma_id,
      matricula_id: matricula.id,
      aluno_id: matricula.aluno_id,
      gravidade: parsed.data.gravidade,
      categoria: parsed.data.categoria,
      descricao: parsed.data.descricao,
      medida_aplicada: parsed.data.medida_aplicada || null,
      impacta_resultado: parsed.data.impacta_resultado ?? true,
      registado_por: context.auth.user.id,
    })
    .select("*")
    .single()
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, item }, { status: 201 })
}

export async function GET(request: Request) {
  const context = await resolveContext()
  if (context.error || !context.auth || !context.escolaId) return context.error
  const params = new URL(request.url).searchParams
  const query = z.object({ matricula_id: z.string().uuid().optional(), turma_id: z.string().uuid().optional(), estado: z.enum(["registado", "em_analise", "resolvido", "cancelado"]).optional() }).safeParse(Object.fromEntries(params.entries()))
  if (!query.success) return NextResponse.json({ ok: false, error: "Filtros inválidos" }, { status: 400 })

  let builder = context.supabase.from("raa_indisciplina_eventos").select("*").eq("escola_id", context.escolaId).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(50)
  if (query.data.matricula_id) builder = builder.eq("matricula_id", query.data.matricula_id)
  if (query.data.turma_id) builder = builder.eq("turma_id", query.data.turma_id)
  if (query.data.estado) builder = builder.eq("estado", query.data.estado)
  const { data, error } = await builder
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, items: data ?? [] })
}
