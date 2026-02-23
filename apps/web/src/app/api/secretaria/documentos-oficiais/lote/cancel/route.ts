import { NextResponse } from "next/server"
import { z } from "zod"
import { supabaseServerTyped } from "@/lib/supabaseServer"
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser"
import { authorizeTurmasManage } from "@/lib/escola/disciplinas"

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
      .select("id, status")
      .eq("id", parsed.data.job_id)
      .eq("escola_id", escolaId)
      .maybeSingle()

    if (jobError || !job) {
      return NextResponse.json({ ok: false, error: jobError?.message || "Lote não encontrado" }, { status: 404 })
    }

    if (job.status !== "PROCESSING") {
      return NextResponse.json({ ok: false, error: "Lote não está em processamento" }, { status: 409 })
    }

    await supabase
      .from("pautas_lote_jobs")
      .update({ status: "FAILED", error_message: "Cancelado pelo usuário" })
      .eq("id", job.id)

    await supabase
      .from("pautas_lote_itens")
      .update({ status: "FAILED", error_message: "Cancelado pelo usuário" })
      .eq("job_id", job.id)

    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
