import { NextResponse } from "next/server"
import { z } from "zod"
import { randomUUID } from "crypto"
import { supabaseServerTyped } from "@/lib/supabaseServer"
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser"
import { authorizeTurmasManage } from "@/lib/escola/disciplinas"
import type { Database } from "~types/supabase"
import { buildPautaGeralPayload, renderPautaGeralBuffer } from "@/lib/pedagogico/pauta-geral"
import { requireFeature } from "@/lib/plan/requireFeature"
import { HttpError } from "@/lib/errors"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

const Query = z.object({
  periodoLetivoId: z.string().uuid(),
})

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await supabaseServerTyped<any>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 })

    const { id: turmaId } = await ctx.params
    const { searchParams } = new URL(req.url)
    const periodoLetivoId = searchParams.get("periodoLetivoId") ?? searchParams.get("periodo_letivo_id")
    const parsed = Query.safeParse({ periodoLetivoId })
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

    const mode = searchParams.get("mode") ?? ""

    const handleSuccess = async (pdfPath: string) => {
      const { data: signed, error } = await supabase.storage
        .from("pautas_oficiais_fechadas")
        .createSignedUrl(pdfPath, 60 * 60)

      if (error || !signed?.signedUrl) {
        return NextResponse.json({ ok: false, error: error?.message || "Falha ao gerar URL" }, { status: 500 })
      }

      if (mode === "json") {
        return NextResponse.json({ ok: true, status: "SUCCESS", download_url: signed.signedUrl })
      }
      return NextResponse.redirect(signed.signedUrl)
    }

    const { data: existing } = await supabase
      .from("pautas_oficiais")
      .select("id, status, pdf_path")
      .eq("escola_id", escolaId)
      .eq("turma_id", turmaId)
      .eq("periodo_letivo_id", parsed.data.periodoLetivoId)
      .eq("tipo", "trimestral")
      .maybeSingle()

    if (existing?.status === "PROCESSING") {
      return NextResponse.json({ ok: false, status: "PROCESSING", error: "Pauta em processamento" }, { status: 409 })
    }

    if (existing?.status === "SUCCESS" && existing.pdf_path) {
      return handleSuccess(existing.pdf_path)
    }

    let pautaId = existing?.id as string | undefined
    if (!pautaId) {
      const { data: inserted } = await supabase
        .from("pautas_oficiais")
        .insert({
          escola_id: escolaId,
          turma_id: turmaId,
          periodo_letivo_id: parsed.data.periodoLetivoId,
          tipo: "trimestral",
          status: "PROCESSING",
          hash: randomUUID(),
          pdf_path: "",
        })
        .select("id")
        .maybeSingle()
      pautaId = inserted?.id as string | undefined
    } else {
      await supabase
        .from("pautas_oficiais")
        .update({ status: "PROCESSING", error_message: null })
        .eq("id", pautaId)
    }

    if (!pautaId) {
      return NextResponse.json({ ok: false, error: "Falha ao iniciar geração" }, { status: 500 })
    }

    try {
      const { data: periodo } = await supabase
        .from("periodos_letivos")
        .select("numero")
        .eq("escola_id", escolaId)
        .eq("id", parsed.data.periodoLetivoId)
        .maybeSingle()

      const periodoNumero = periodo?.numero ?? null
      if (!periodoNumero) {
        throw new Error("Período letivo inválido")
      }

      const payload = await buildPautaGeralPayload({
        supabase,
        escolaId,
        turmaId,
        periodoNumero,
      })
      const pdfBuffer = await renderPautaGeralBuffer(payload)
      if (pdfBuffer.length < 800) {
        throw new Error("PDF inválido gerado")
      }
      const pdfPath = `${escolaId}/${turmaId}/${parsed.data.periodoLetivoId}/pauta_geral.pdf`
      const pdfBody = Buffer.from(pdfBuffer)
      const { error: uploadError } = await supabase.storage
        .from("pautas_oficiais_fechadas")
        .upload(pdfPath, pdfBody, {
          upsert: true,
          contentType: "application/pdf",
        })

      if (uploadError) {
        throw new Error(uploadError.message)
      }

      await supabase
        .from("pautas_oficiais")
        .update({ status: "SUCCESS", pdf_path: pdfPath, error_message: null })
        .eq("id", pautaId)

      return handleSuccess(pdfPath)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await supabase
        .from("pautas_oficiais")
        .update({ status: "FAILED", error_message: message })
        .eq("id", pautaId)
      return NextResponse.json({ ok: false, status: "FAILED", error: message }, { status: 500 })
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
