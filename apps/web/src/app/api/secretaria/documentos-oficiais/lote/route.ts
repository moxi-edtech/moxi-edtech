// @kf2 allow-scan
import { NextResponse } from "next/server"
import { z } from "zod"
import { supabaseServerTyped } from "@/lib/supabaseServer"
import { resolveEscolaIdForUser } from "@/lib/tenant/resolveEscolaIdForUser"
import { authorizeTurmasManage } from "@/lib/escola/disciplinas"
import { inngest } from "@/inngest/client"
import { requireFeature } from "@/lib/plan/requireFeature"
import { HttpError } from "@/lib/errors"
import type { Database } from "~types/supabase"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

const Body = z.object({
  turma_ids: z.array(z.string().uuid()).min(1),
  tipo: z.enum(["trimestral", "anual", "boletim_trimestral", "certificado"]),
  periodo_letivo_id: z.string().uuid().optional(),
})

type PautasLoteJobRow = Database["public"]["Tables"]["pautas_lote_jobs"]["Row"]

export async function GET() {
  try {
    const supabase = await supabaseServerTyped<Database>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 })

    const escolaId = await resolveEscolaIdForUser(supabase, user.id)
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 403 })

    const authz = await authorizeTurmasManage(supabase, escolaId, user.id)
    if (!authz.allowed) {
      return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 })
    }

    const { data: jobs, error } = await supabase
      .from("pautas_lote_jobs")
      .select("id, tipo, documento_tipo, periodo_letivo_id, status, total_turmas, processed, success_count, failed_count, zip_path, manifest_path, zip_checksum_sha256, signed_url_expires_at, error_message, created_at")
      .eq("escola_id", escolaId)
      .order("created_at", { ascending: false })
      .limit(20)

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    const items = ((jobs || []) as PautasLoteJobRow[]).map((job) => {
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
    const supabase = await supabaseServerTyped<Database>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 })

    const parsed = Body.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados inválidos" }, { status: 400 })
    }

    if (parsed.data.tipo === "certificado") {
      await requireFeature("doc_qr_code")
    }

    const escolaId = await resolveEscolaIdForUser(supabase, user.id)
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 403 })

    const authz = await authorizeTurmasManage(supabase, escolaId, user.id)
    if (!authz.allowed) {
      return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 })
    }

    if (parsed.data.tipo === "trimestral" && !parsed.data.periodo_letivo_id) {
      return NextResponse.json({ ok: false, error: "Período letivo obrigatório" }, { status: 400 })
    }

    let effectivePeriodoLetivoId = parsed.data.periodo_letivo_id ?? null
    if (parsed.data.tipo === "anual" && !effectivePeriodoLetivoId) {
      const { data: turmaRef, error: turmaRefError } = await supabase
        .from("turmas")
        .select("session_id")
        .eq("escola_id", escolaId)
        .in("id", parsed.data.turma_ids)
        .not("session_id", "is", null)
        .limit(1)
        .maybeSingle()

      if (turmaRefError) {
        return NextResponse.json({ ok: false, error: turmaRefError.message }, { status: 500 })
      }
      if (!turmaRef?.session_id) {
        return NextResponse.json({ ok: false, error: "Turmas sem ano letivo associado para pauta anual" }, { status: 409 })
      }

      const { data: periodoFinal, error: periodoFinalError } = await supabase
        .from("periodos_letivos")
        .select("id")
        .eq("escola_id", escolaId)
        .eq("ano_letivo_id", turmaRef.session_id)
        .order("data_fim", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (periodoFinalError) {
        return NextResponse.json({ ok: false, error: periodoFinalError.message }, { status: 500 })
      }
      if (!periodoFinal?.id) {
        return NextResponse.json({ ok: false, error: "Ano letivo sem período final para pauta anual" }, { status: 409 })
      }

      effectivePeriodoLetivoId = periodoFinal.id
    }


    const sortedTurmas = [...parsed.data.turma_ids].sort()
    const documentoTipo =
      parsed.data.tipo === "trimestral"
        ? "pauta_trimestral"
        : parsed.data.tipo === "anual"
          ? "pauta_anual"
          : parsed.data.tipo
    const idempotencyKey = `${documentoTipo}:${effectivePeriodoLetivoId ?? "none"}:${sortedTurmas.join(",")}`

    const { data: existingByKey } = await supabase
      .from("pautas_lote_jobs")
      .select("id,status")
      .eq("escola_id", escolaId)
      .eq("documento_tipo", documentoTipo)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle()

    if (existingByKey?.id) {
      return NextResponse.json({ ok: true, job_id: existingByKey.id, reused: true }, { status: 202 })
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
        documento_tipo: documentoTipo,
        periodo_letivo_id: effectivePeriodoLetivoId,
        status: "PROCESSING",
        total_turmas: parsed.data.turma_ids.length,
        processed: 0,
        success_count: 0,
        failed_count: 0,
        idempotency_key: idempotencyKey,
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
        documento_tipo: documentoTipo,
        periodo_letivo_id: effectivePeriodoLetivoId,
      },
    })

    return NextResponse.json({ ok: true, job_id: job.id }, { status: 202 })
  } catch (e) {
    if (e instanceof HttpError) {
      return NextResponse.json(
        {
          ok: false,
          error: e.message,
          error_code: e.code,
          upgrade_required: e.status === 403 && e.code === "PLAN_FEATURE_REQUIRED",
        },
        { status: e.status }
      )
    }
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
