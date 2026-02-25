import { NextResponse } from "next/server"
import { z } from "zod"
import { supabaseServerTyped } from "@/lib/supabaseServer"
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser"
import { authorizeTurmasManage } from "@/lib/escola/disciplinas"
import { buildPautaAnualModeloPayload, renderPautaAnualBuffer } from "@/lib/pedagogico/pauta-anual"
import { requireFeature } from "@/lib/plan/requireFeature"
import { HttpError } from "@/lib/errors"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"
export const runtime = "nodejs"

const Query = z.object({
  linhas: z.coerce.number().int().min(5).max(60).optional(),
})

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await supabaseServerTyped<any>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 })

    const { id: turmaId } = await ctx.params
    const { searchParams } = new URL(req.url)
    const linhas = searchParams.get("linhas") ?? undefined
    const parsed = Query.safeParse({ linhas })
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Parâmetros inválidos" }, { status: 400 })
    }

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id)
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 403 })

    const authz = await authorizeTurmasManage(supabase as any, escolaId, user.id)
    if (!authz.allowed) {
      return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 })
    }

    try {
      await requireFeature("doc_qr_code")
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ ok: false, error: err.message, code: err.code }, { status: err.status })
      }
      throw err
    }

    const payload = await buildPautaAnualModeloPayload({
      supabase,
      escolaId,
      turmaId,
      linhas: parsed.data.linhas ?? 20,
    })

    const pdfBuffer = await renderPautaAnualBuffer(payload)
    const headers = new Headers({
      "Content-Type": "application/pdf",
      "X-Klasse-Pdf-Template": "PautaAnualV1",
      "X-Klasse-Pdf-Kind": "anual-modelo",
      "Content-Disposition": `attachment; filename=Modelo_Pauta_Anual_${payload.metadata.turma}.pdf`,
    })

    return new NextResponse(pdfBuffer as any, { status: 200, headers })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
