import { NextResponse } from "next/server"
import { z } from "zod"
import { supabaseServerTyped } from "@/lib/supabaseServer"
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser"
import { authorizeTurmasManage } from "@/lib/escola/disciplinas"
import { inngest } from "@/inngest/client"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

const Body = z.object({
  turma_ids: z.array(z.string().uuid()).min(1),
  tipo: z.enum(["trimestral", "anual"]),
  periodo_letivo_id: z.string().uuid().optional(),
})

export async function GET() {
  try {
    const supabase = await supabaseServerTyped<any>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 })

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id)
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 403 })

    const authz = await authorizeTurmasManage(supabase as any, escolaId, user.id)
    if (!authz.allowed) {
      return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 })
    }

    const { data: jobs, error } = await supabase
      .from("pautas_lote_jobs")
      .select("id, tipo, periodo_letivo_id, status, total_turmas, processed, success_count, failed_count, zip_path, error_message, created_at")
      .eq("escola_id", escolaId)
      .order("created_at", { ascending: false })
      .limit(20)

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    const items = (jobs || []).map((job: any) => {
      const download_url =
        job.zip_path && job.status === "SUCCESS"
          ? `/api/secretaria/documentos-oficiais/lote/${job.id}/download`
          : null
      return { ...job, download_url }
    })

    return NextResponse.json({ ok: true, items })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServerTyped<any>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 })

    const parsed = Body.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados inválidos" }, { status: 400 })
    }

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id)
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 403 })

    const authz = await authorizeTurmasManage(supabase as any, escolaId, user.id)
    if (!authz.allowed) {
      return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 })
    }

    if (parsed.data.tipo === "trimestral" && !parsed.data.periodo_letivo_id) {
      return NextResponse.json({ ok: false, error: "Período letivo obrigatório" }, { status: 400 })
    }

    const { data: activeJob } = await supabase
      .from("pautas_lote_jobs")
      .select("id")
      .eq("escola_id", escolaId)
      .eq("status", "PROCESSING")
      .limit(1)
      .maybeSingle()

    if (activeJob?.id) {
      return NextResponse.json({ ok: false, error: "Já existe um lote em processamento" }, { status: 409 })
    }

    const { data: job, error: jobError } = await supabase
      .from("pautas_lote_jobs")
      .insert({
        escola_id: escolaId,
        created_by: user.id,
        tipo: parsed.data.tipo,
        periodo_letivo_id: parsed.data.periodo_letivo_id ?? null,
        status: "PROCESSING",
        total_turmas: parsed.data.turma_ids.length,
        processed: 0,
        success_count: 0,
        failed_count: 0,
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
        escola_id: escolaId,
        turma_ids: parsed.data.turma_ids,
        tipo: parsed.data.tipo,
        periodo_letivo_id: parsed.data.periodo_letivo_id ?? null,
      },
    })

    return NextResponse.json({ ok: true, job_id: job.id }, { status: 202 })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
