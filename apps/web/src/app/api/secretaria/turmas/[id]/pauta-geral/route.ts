import { NextResponse } from "next/server"
import { z } from "zod"
import { supabaseServerTyped } from "@/lib/supabaseServer"
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser"
import { authorizeTurmasManage } from "@/lib/escola/disciplinas"
import { buildPautaGeralPayload, renderPautaGeralBuffer } from "@/lib/pedagogico/pauta-geral"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"
export const runtime = "nodejs"

const Query = z.object({
  periodoNumero: z.coerce.number().int().min(1).max(3).optional(),
  periodoLetivoId: z.string().uuid().optional(),
})

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await supabaseServerTyped<any>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 })

    const { id: turmaId } = await ctx.params
    const { searchParams } = new URL(req.url)
    const periodoNumero = searchParams.get("periodoNumero") ?? searchParams.get("periodo") ?? undefined
    const periodoLetivoId =
      searchParams.get("periodoLetivoId") ?? searchParams.get("periodo_letivo_id") ?? undefined
    const parsed = Query.safeParse({ periodoNumero, periodoLetivoId })
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Parâmetros inválidos" }, { status: 400 })
    }

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id)
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 403 })

    const authz = await authorizeTurmasManage(supabase as any, escolaId, user.id)
    if (!authz.allowed) {
      return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 })
    }

    let numero = parsed.data.periodoNumero ?? null
    if (!numero && parsed.data.periodoLetivoId) {
      const { data: periodo } = await supabase
        .from("periodos_letivos")
        .select("numero")
        .eq("escola_id", escolaId)
        .eq("id", parsed.data.periodoLetivoId)
        .maybeSingle()
      numero = periodo?.numero ?? null
    }

    if (!numero) {
      return NextResponse.json({ ok: false, error: "Período não informado" }, { status: 400 })
    }

    const payload = await buildPautaGeralPayload({
      supabase,
      escolaId,
      turmaId,
      periodoNumero: numero,
    })

    const pdfBuffer = await renderPautaGeralBuffer(payload)
    const headers = new Headers({
      "Content-Type": "application/pdf",
      "X-Klasse-Pdf-Template": "PautaGeralV1",
      "X-Klasse-Pdf-Kind": "trimestral-geral",
      "Content-Disposition": `attachment; filename=Pauta_Geral_${payload.metadata.turma}_${numero}T.pdf`,
    })

    return new NextResponse(pdfBuffer as any, { status: 200, headers })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
