import { NextResponse } from "next/server"
import { supabaseServerTyped } from "@/lib/supabaseServer"
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser"
import { authorizeTurmasManage } from "@/lib/escola/disciplinas"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
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

    const { id: jobId } = await ctx.params
    const { data: job, error } = await supabase
      .from("pautas_lote_jobs")
      .select("zip_path, status")
      .eq("id", jobId)
      .eq("escola_id", escolaId)
      .maybeSingle()

    if (error || !job) {
      return NextResponse.json({ ok: false, error: error?.message || "Lote não encontrado" }, { status: 404 })
    }

    if (!job.zip_path || job.status !== "SUCCESS") {
      return NextResponse.json({ ok: false, error: "ZIP ainda não disponível" }, { status: 409 })
    }

    const { data: signed, error: signError } = await supabase.storage
      .from("pautas_zip")
      .createSignedUrl(job.zip_path, 60 * 60)

    if (signError || !signed?.signedUrl) {
      return NextResponse.json({ ok: false, error: signError?.message || "Falha ao gerar link" }, { status: 500 })
    }

    return NextResponse.redirect(signed.signedUrl, 307)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
