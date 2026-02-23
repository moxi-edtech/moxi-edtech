import { NextResponse } from "next/server"
import { supabaseServerTyped } from "@/lib/supabaseServer"
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser"
import { authorizeTurmasManage } from "@/lib/escola/disciplinas"
import { buildPautaAnualPayload, renderPautaAnualBuffer } from "@/lib/pedagogico/pauta-anual"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"
export const runtime = "nodejs"

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await supabaseServerTyped<any>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 })

    const { id: turmaId } = await ctx.params
    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id)
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 403 })

    const authz = await authorizeTurmasManage(supabase as any, escolaId, user.id)
    if (!authz.allowed) {
      return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 })
    }

    const payload = await buildPautaAnualPayload({ supabase, escolaId, turmaId })
    const pdfBuffer = await renderPautaAnualBuffer(payload)
    const headers = new Headers({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=Pauta_Anual_${payload.metadata.turma}.pdf`,
    })

    return new NextResponse(pdfBuffer as any, { status: 200, headers })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
