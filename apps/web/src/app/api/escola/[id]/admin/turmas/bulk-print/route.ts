import { NextResponse } from "next/server"
import { z } from "zod"
import { supabaseServerTyped } from "@/lib/supabaseServer"
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser"
import { authorizeTurmasManage } from "@/lib/escola/disciplinas"
import { inngest } from "@/inngest/client"
import { MAX_TURMAS_POR_LOTE, MAX_LOTES_NOMINAIS_POR_HORA, uniqueTurmaIds, makeNominalBatchKey } from "@/lib/documentos/rosterBatchPolicy"

export const dynamic = "force-dynamic"
export const revalidate = 0

const Body = z.object({
  turma_ids: z.array(z.string().uuid()).min(1).max(MAX_TURMAS_POR_LOTE).refine(uniqueTurmaIds),
  order: z.enum(["nome_asc", "nome_desc"]).optional(),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: requestedEscolaId } = await params
    const supabase = await supabaseServerTyped<any>()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 })

    const parsed = Body.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados inválidos" }, { status: 400 })
    }

    const userEscolaId = await resolveEscolaIdForUser(supabase as any, user.id, requestedEscolaId)
    // Nunca usar a escola pedida como fallback quando o acesso falha.
    if (!userEscolaId) {
      return NextResponse.json({ ok: false, error: "Sem acesso à escola" }, { status: 403 })
    }
    const effectiveEscolaId = userEscolaId

    const authz = await authorizeTurmasManage(supabase as any, effectiveEscolaId, user.id)
    if (!authz.allowed) {
      return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 })
    }

    const { data: selectedTurmas, error: selectedError } = await supabase
      .from("turmas")
      .select("id,session_id")
      .eq("escola_id", effectiveEscolaId)
      .in("id", parsed.data.turma_ids)
    if (selectedError || selectedTurmas?.length !== parsed.data.turma_ids.length) {
      return NextResponse.json({ ok: false, error: "Turmas fora da escola" }, { status: 403 })
    }
    const sessions = new Set(selectedTurmas.map((row: { session_id?: string | null }) => row.session_id))
    if (sessions.size !== 1 || !selectedTurmas[0]?.session_id) {
      return NextResponse.json({ ok: false, error: "Seleccione uma sessão académica por lote" }, { status: 409 })
    }

    // Compatibilidade com clientes antigos. O UI novo usa a rota canónica.
    // In Fase 3, we orchestrate the bulk nominal list printing.
    // We'll use the same infra as pautas-lote but with tipo='lista_nominal'.
    
    const sortedTurmas = [...parsed.data.turma_ids].sort()
    const order = parsed.data.order ?? "nome_asc"
    // Mesmo contrato v3 e mesmas preferências da API canónica: reprocessamento seguro.
    const idempotencyKey = makeNominalBatchKey({
      actorId: user.id,
      academicYearId: selectedTurmas[0].session_id,
      mode: undefined,
      order,
      month: undefined,
      isAlbum: false,
      includeAllStatus: false,
    }, sortedTurmas)

    const { data: existingByKey } = await supabase
      .from("pautas_lote_jobs")
      .select("id,status")
      .eq("escola_id", effectiveEscolaId)
      .eq("documento_tipo", "lista_nominal")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle()

    if (existingByKey?.id && existingByKey.status !== 'FAILED') {
      return NextResponse.json({ ok: true, job_id: existingByKey.id, reused: true }, { status: 202 })
    }

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count, error: rateError } = await supabase
      .from("pautas_lote_jobs")
      .select("id", { count: "exact", head: true })
      .eq("escola_id", effectiveEscolaId)
      .eq("created_by", user.id)
      .eq("documento_tipo", "lista_nominal")
      .gte("created_at", since)
    if (rateError) return NextResponse.json({ ok: false, error: "Limite indisponível" }, { status: 503 })
    if ((count ?? 0) >= MAX_LOTES_NOMINAIS_POR_HORA) {
      return NextResponse.json({ ok: false, error: "Limite por hora atingido" }, { status: 429 })
    }

    const { data: job, error: jobError } = await supabase
      .from("pautas_lote_jobs")
      .insert({
        escola_id: effectiveEscolaId,
        created_by: user.id,
        tipo: "lista_nominal",
        documento_tipo: "lista_nominal",
        status: "PROCESSING",
        total_turmas: parsed.data.turma_ids.length,
        processed: 0,
        success_count: 0,
        failed_count: 0,
        idempotency_key: idempotencyKey,
      })
      .select("id")
      .maybeSingle()

    if (jobError || !job?.id) {
      return NextResponse.json({ ok: false, error: jobError?.message || "Falha ao criar lote" }, { status: 500 })
    }

    const itensPayload = parsed.data.turma_ids.map((turmaId) => ({
      job_id: job.id,
      turma_id: turmaId,
      status: "QUEUED",
    }))

    const { error: itensError } = await supabase
      .from("pautas_lote_itens")
      .insert(itensPayload)

    if (itensError) {
      return NextResponse.json({ ok: false, error: itensError.message }, { status: 500 })
    }

    await inngest.send({
      name: "docs/pautas-lote.requested",
      data: {
        job_id: job.id,
        escola_id: effectiveEscolaId,
        turma_ids: parsed.data.turma_ids,
        tipo: "lista_nominal",
        documento_tipo: "lista_nominal",
        mode: undefined,
        order,
      },
    })

    return NextResponse.json({ ok: true, job_id: job.id }, { status: 202 })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
