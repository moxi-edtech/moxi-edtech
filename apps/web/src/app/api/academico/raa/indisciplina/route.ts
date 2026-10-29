import { NextResponse } from "next/server"
import { z } from "zod"
import { requireRoleInSchool } from "@/lib/authz"
import { resolveAcademicYearContext } from "@/lib/academic-year/context"
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser"
import { supabaseServerTyped } from "@/lib/supabaseServer"
import { recordAuditServer } from "@/lib/audit"

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


// Revisão contextual do RAA: apenas a direção pode decidir sobre eventos graves.
// Nem a secretaria nem o Balcão ganham permissão para alterar um resultado legal.
const reviewRoles = ["admin", "admin_escola", "diretor"] as const
const reviewSchema = z.object({
  id: z.string().uuid(),
  estado: z.enum(["em_analise", "resolvido", "cancelado"]),
  motivo: z.string().trim().min(15).max(2000),
  confirmar_decisao: z.boolean().optional(),
})

export async function PATCH(request: Request) {
  const context = await resolveContext()
  if (context.error || !context.auth || !context.escolaId) return context.error
  const authz = await requireRoleInSchool({ supabase: context.supabase, escolaId: context.escolaId, roles: [...reviewRoles] })
  if (authz.error) return authz.error
  const parsed = reviewSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Decisão inválida." }, { status: 400 })
  if (parsed.data.estado !== "em_analise" && parsed.data.confirmar_decisao !== true) {
    return NextResponse.json({ ok: false, error: "Confirme expressamente a decisão disciplinar." }, { status: 422 })
  }
  const { data: existing, error: readError } = await context.supabase.from("raa_indisciplina_eventos")
    .select("id,estado,matricula_id,ano_letivo_id,impacta_resultado")
    .eq("id", parsed.data.id).eq("escola_id", context.escolaId).maybeSingle()
  if (readError) return NextResponse.json({ ok: false, error: "Não foi possível confirmar o evento." }, { status: 503 })
  if (!existing) return NextResponse.json({ ok: false, error: "Evento não encontrado nesta escola." }, { status: 404 })
  if (!["registado", "em_analise"].includes(existing.estado)) {
    return NextResponse.json({ ok: false, error: "Esta decisão já foi encerrada.", code: "RAA_INDISCIPLINA_FINAL" }, { status: 409 })
  }
  const { data: matricula } = await context.supabase.from("matriculas")
    .select("id,status").eq("id", existing.matricula_id).eq("escola_id", context.escolaId).maybeSingle()
  if (!matricula || matricula.status === "concluido") {
    return NextResponse.json({ ok: false, error: "A matrícula tem fecho legal ou não existe. Exige reabertura académica formal.", code: "RAA_LEGAL_LOCK" }, { status: 409 })
  }
  // Mantém o evento e o fundamento auditáveis; não altera a nota, matrícula ou histórico.
  const now = new Date().toISOString()
  const { data: decided, error: updateError } = await context.supabase.from("raa_indisciplina_eventos")
    .update({
      estado: parsed.data.estado,
      decisao_motivo: parsed.data.motivo,
      resolvido_por: parsed.data.estado === "em_analise" ? null : context.auth.user.id,
      resolvido_em: parsed.data.estado === "em_analise" ? null : now,
      updated_at: now,
    })
    .eq("id", existing.id).eq("escola_id", context.escolaId)
    .eq("estado", existing.estado)
    .select("id,estado").maybeSingle()
  if (updateError) return NextResponse.json({ ok: false, error: "Não foi possível guardar a revisão." }, { status: 503 })
  if (!decided) return NextResponse.json({ ok: false, error: "O evento foi alterado por outra pessoa. Atualize a análise.", code: "RAA_INDISCIPLINA_CONFLICT" }, { status: 409 })
  await recordAuditServer({
    escolaId: context.escolaId, portal: "secretaria", acao: "RAA_INDISCIPLINA_REVISAO",
    entity: "raa_indisciplina_eventos", entityId: existing.id,
    details: { matricula_id: existing.matricula_id, estado_anterior: existing.estado, estado_novo: decided.estado, motivo: parsed.data.motivo, impactava_resultado: existing.impacta_resultado },
  })
  return NextResponse.json({ ok: true, item: decided, message: "Revisão registada. Revalide a decisão oficial do RAA antes de continuar." })
}
