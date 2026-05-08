import { NextResponse } from "next/server"
import { z } from "zod"
import { supabaseServerTyped } from "@/lib/supabaseServer"
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser"
import { authorizeTurmasManage } from "@/lib/escola/disciplinas"
import { inngest } from "@/inngest/client"

export const dynamic = "force-dynamic"
export const revalidate = 0

const Body = z.object({
  turma_ids: z.array(z.string().uuid()).min(1),
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
    const effectiveEscolaId = userEscolaId ?? requestedEscolaId

    const authz = await authorizeTurmasManage(supabase as any, effectiveEscolaId, user.id)
    if (!authz.allowed) {
      return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 })
    }

    // In Fase 3, we orchestrate the bulk nominal list printing.
    // We'll use the same infra as pautas-lote but with tipo='lista_nominal'.
    
    const sortedTurmas = [...parsed.data.turma_ids].sort()
    const idempotencyKey = `lista_nominal:${effectiveEscolaId}:${sortedTurmas.join(",")}`

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
      },
    })

    return NextResponse.json({ ok: true, job_id: job.id }, { status: 202 })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
