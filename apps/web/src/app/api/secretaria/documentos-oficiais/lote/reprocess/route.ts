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
  job_id: z.string().uuid(),
})

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

    const { data: job, error: jobError } = await supabase
      .from("pautas_lote_jobs")
      .select("id, tipo, periodo_letivo_id")
      .eq("id", parsed.data.job_id)
      .eq("escola_id", escolaId)
      .maybeSingle()

    if (jobError || !job) {
      return NextResponse.json({ ok: false, error: jobError?.message || "Lote não encontrado" }, { status: 404 })
    }

    const { data: itens, error: itensError } = await supabase
      .from("pautas_lote_itens")
      .select("turma_id")
      .eq("job_id", job.id)

    if (itensError) {
      return NextResponse.json({ ok: false, error: itensError.message }, { status: 500 })
    }

    const turmaIds = (itens || []).map((item: any) => item.turma_id)
    if (turmaIds.length === 0) {
      return NextResponse.json({ ok: false, error: "Nenhuma turma encontrada" }, { status: 400 })
    }

    const { data: canStart, error: startError } = await supabase
      .rpc("try_start_pautas_lote_job", { p_job_id: job.id, p_escola_id: escolaId })

    if (startError) {
      return NextResponse.json({ ok: false, error: startError.message }, { status: 500 })
    }

    if (!canStart) {
      return NextResponse.json({ ok: false, error: "Já existe um lote em processamento" }, { status: 409 })
    }

    await supabase
      .from("pautas_lote_itens")
      .update({ status: "QUEUED", error_message: null, pdf_path: null })
      .eq("job_id", job.id)

    await inngest.send({
      name: "docs/pautas-lote.requested",
      data: {
        job_id: job.id,
        escola_id: escolaId,
        turma_ids: turmaIds,
        tipo: job.tipo,
        periodo_letivo_id: job.periodo_letivo_id ?? null,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
