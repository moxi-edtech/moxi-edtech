import { NextResponse } from "next/server"
import { z } from "zod"
import { requireRoleInSchool } from "@/lib/authz"
import { resolveAcademicYearContext } from "@/lib/academic-year/context"
import { calculateReapreciacaoDeadline } from "@/lib/academico/raa-eligibility"
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser"
import { supabaseServerTyped } from "@/lib/supabaseServer"

export const dynamic = "force-dynamic"
export const revalidate = 0

const postSchema = z.object({
  matricula_id: z.string().uuid(),
  disciplina_id: z.string().uuid(),
  motivo: z.string().trim().min(10).max(2000),
  idempotency_key: z.string().trim().min(8).max(120),
  ano_letivo_id: z.string().uuid().optional(),
})

const roles = ["admin", "admin_escola", "staff_admin", "diretor", "secretaria", "professor"] as const

async function resolveContext(request: Request) {
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
  const context = await resolveContext(request)
  if (context.error || !context.auth || !context.escolaId) return context.error
  const parsed = postSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 })
  const body = parsed.data
  const academicContext = await resolveAcademicYearContext(context.supabase, { userId: context.auth.user.id, requestedAcademicYearId: body.ano_letivo_id, operation: "READ" })

  const { data: matricula } = await context.supabase
    .from("matriculas")
    .select("id, escola_id, aluno_id, turma_id, session_id")
    .eq("id", body.matricula_id)
    .eq("escola_id", context.escolaId)
    .eq("session_id", academicContext.anoLetivoId)
    .maybeSingle()
  if (!matricula) return NextResponse.json({ ok: false, error: "Matrícula não encontrada no ano letivo ativo." }, { status: 404 })

  const { data: turmaDisciplina } = await context.supabase
    .from("turma_disciplinas")
    .select("id, turma_id, avaliacao_disciplina_id")
    .eq("turma_id", matricula.turma_id)
    .eq("escola_id", context.escolaId)
    .eq("avaliacao_disciplina_id", body.disciplina_id)
    .maybeSingle()
  if (!turmaDisciplina) return NextResponse.json({ ok: false, error: "A disciplina não pertence à turma da matrícula." }, { status: 409 })

  const { data: canonical, error: canonicalError } = await context.supabase.rpc("resolve_estado_resultado", { p_matricula_id: matricula.id, p_disciplina_id: body.disciplina_id })
  if (canonicalError) return NextResponse.json({ ok: false, error: "O resolvedor de resultado está indisponível.", code: "ACADEMIC_RESULT_RESOLVER_UNAVAILABLE" }, { status: 503 })
  if (canonical?.status !== "reprovado") {
    return NextResponse.json({ ok: false, error: "A reapreciação só pode ser solicitada para um resultado negativo resolvido.", code: "RAA_REAPRECIACAO_NOT_ELIGIBLE", canonical_result: canonical }, { status: 409 })
  }

  const { data: periodosPublicados } = await context.supabase
    .from("periodos_letivos")
    .select("id")
    .eq("escola_id", context.escolaId)
    .eq("ano_letivo_id", academicContext.anoLetivoId)
    .eq("tipo", "TRIMESTRE")
    .limit(3)
  const periodoIds = (periodosPublicados ?? []).map((row: any) => row.id).filter(Boolean)
  const { data: pautaPublicada } = periodoIds.length > 0
    ? await context.supabase
        .from("pautas_oficiais")
        .select("id, periodo_letivo_id, generated_at")
        .eq("escola_id", context.escolaId)
        .eq("turma_id", matricula.turma_id)
        .in("periodo_letivo_id", periodoIds)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null }
  if (!pautaPublicada?.generated_at) {
    return NextResponse.json({ ok: false, error: "O resultado ainda não tem pauta oficial publicada; o prazo de 48 horas ainda não começou.", code: "RAA_RESULT_NOT_PUBLISHED" }, { status: 409 })
  }

  const { data: existing } = await context.supabase
    .from("reapreciacao_pedidos")
    .select("*")
    .eq("escola_id", context.escolaId)
    .eq("idempotency_key", body.idempotency_key)
    .maybeSingle()
  if (existing) return NextResponse.json({ ok: true, duplicate: true, item: existing })

  const { data: active } = await context.supabase
    .from("reapreciacao_pedidos")
    .select("*")
    .eq("escola_id", context.escolaId)
    .eq("matricula_id", matricula.id)
    .eq("turma_disciplina_id", turmaDisciplina.id)
    .in("estado", ["pendente", "em_analise"])
    .maybeSingle()
  if (active) return NextResponse.json({ ok: true, duplicate: true, item: active })

  const publishedAt = new Date(pautaPublicada.generated_at)
  const prazo = calculateReapreciacaoDeadline(publishedAt)
  const { data: item, error } = await context.supabase
    .from("reapreciacao_pedidos")
    .insert({
      escola_id: context.escolaId,
      ano_letivo_id: academicContext.anoLetivoId,
      turma_id: matricula.turma_id,
      matricula_id: matricula.id,
      aluno_id: matricula.aluno_id,
      turma_disciplina_id: turmaDisciplina.id,
      disciplina_id: body.disciplina_id,
      nota_referencia: canonical.nota ?? null,
      motivo: body.motivo,
      prazo_em: prazo.toISOString(),
      idempotency_key: body.idempotency_key,
      solicitado_por: context.auth.user.id,
      resultado_publicado_em: publishedAt.toISOString(),
    })
    .select("*")
    .single()
  if (error) return NextResponse.json({ ok: false, error: error.code === "23505" ? "Já existe uma solicitação ativa para este contexto." : error.message }, { status: error.code === "23505" ? 409 : 500 })
  return NextResponse.json({ ok: true, item }, { status: 201 })
}

export async function GET(request: Request) {
  const context = await resolveContext(request)
  if (context.error || !context.auth || !context.escolaId) return context.error
  const params = new URL(request.url).searchParams
  const query = z.object({ matricula_id: z.string().uuid().optional(), disciplina_id: z.string().uuid().optional() }).safeParse(Object.fromEntries(params.entries()))
  if (!query.success) return NextResponse.json({ ok: false, error: "Filtros inválidos" }, { status: 400 })
  let builder = context.supabase.from("reapreciacao_pedidos").select("*").eq("escola_id", context.escolaId).order("created_at", { ascending: false }).limit(50)
  if (query.data.matricula_id) builder = builder.eq("matricula_id", query.data.matricula_id)
  if (query.data.disciplina_id) builder = builder.eq("disciplina_id", query.data.disciplina_id)
  const { data, error } = await builder
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, items: data ?? [] })
}
