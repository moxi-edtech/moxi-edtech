import { NextResponse } from "next/server"
import { z } from "zod"
import { supabaseServerTyped } from "@/lib/supabaseServer"
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser"
import { authorizeTurmasManage } from "@/lib/escola/disciplinas"
import { buildPautaGeralPayload, renderPautaGeralBuffer } from "@/lib/pedagogico/pauta-geral"
import { AcademicYearContextError, assertAcademicYearEntity, resolveAcademicYearContext } from "@/lib/academic-year/context"
import { CanonicalPeriodReadError } from "@/lib/academico/verify-canonical-periods-read";
import { readVerifiedAcademicTrimesters, requireVerifiedTrimester } from "@/lib/academico/read-verified-academic-trimesters";


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

    if (!parsed.data.periodoNumero && !parsed.data.periodoLetivoId) {
      return NextResponse.json({ ok: false, error: "Período não informado" }, { status: 400 })
    }
    const academicContext = await resolveAcademicYearContext(supabase, {
      userId: user.id,
      requestedAcademicYearId: searchParams.get("ano_letivo_id"),
      operation: "READ",
    })
    await assertAcademicYearEntity(supabase, {
      table: "turmas", entityId: turmaId, escolaId,
      anoLetivoId: academicContext.anoLetivoId,
    })
    const officialPeriods = await readVerifiedAcademicTrimesters(supabase, {
      escolaId, anoLetivoId: academicContext.anoLetivoId,
      yearBase: Number(academicContext.anoLetivoLabel.split("/")[0]),
    })
    const chosen = requireVerifiedTrimester(officialPeriods, {
      id: parsed.data.periodoLetivoId, numero: parsed.data.periodoNumero,
    })
    if (parsed.data.periodoNumero && chosen.numero !== parsed.data.periodoNumero) {
      throw new CanonicalPeriodReadError("O número e o identificador do trimestre não correspondem.")
    }
    const numero = chosen.numero!

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
    if (e instanceof CanonicalPeriodReadError) {
      return NextResponse.json({ ok: false, code: e.code, error: e.message }, { status: e.status })
    }
    if (e instanceof AcademicYearContextError) {
      return NextResponse.json({ ok: false, code: e.code, error: e.message }, { status: e.status })
    }
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
