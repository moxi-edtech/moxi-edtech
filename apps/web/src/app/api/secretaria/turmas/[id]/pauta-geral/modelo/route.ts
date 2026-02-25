import { NextResponse } from "next/server"
import { z } from "zod"
import { supabaseServerTyped } from "@/lib/supabaseServer"
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser"
import { authorizeTurmasManage } from "@/lib/escola/disciplinas"
import { buildPautaGeralModeloPayload, renderPautaGeralBuffer } from "@/lib/pedagogico/pauta-geral"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"
export const runtime = "nodejs"

const Query = z.object({
  periodoNumero: z.coerce.number().int().min(1).max(3).optional(),
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
    const periodoNumero = searchParams.get("periodoNumero") ?? searchParams.get("periodo") ?? undefined
    const linhas = searchParams.get("linhas") ?? undefined
    const parsed = Query.safeParse({ periodoNumero, linhas })
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Parâmetros inválidos" }, { status: 400 })
    }

    const escolaId = await resolveEscolaIdForUser(supabase as any, user.id)
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 403 })

    const authz = await authorizeTurmasManage(supabase as any, escolaId, user.id)
    if (!authz.allowed) {
      return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 })
    }

    const payload = await buildPautaGeralModeloPayload({
      supabase,
      escolaId,
      turmaId,
      periodoNumero: parsed.data.periodoNumero ?? 1,
      linhas: parsed.data.linhas ?? 20,
    })

    const pdfBuffer = await renderPautaGeralBuffer(payload)
    const headers = new Headers({
      "Content-Type": "application/pdf",
      "X-Klasse-Pdf-Template": "PautaGeralV1",
      "X-Klasse-Pdf-Kind": "trimestral-modelo",
      "Content-Disposition": `attachment; filename=Modelo_Pauta_Geral_${payload.metadata.turma}.pdf`,
    })

    return new NextResponse(pdfBuffer as any, { status: 200, headers })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
