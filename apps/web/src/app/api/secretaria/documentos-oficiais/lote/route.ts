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

import { AcademicYearContextError, resolveAcademicYearContext } from "@/lib/academic-year/context"
import { readVerifiedAcademicTrimesters, requireVerifiedTrimester } from "@/lib/academico/read-verified-academic-trimesters"
import { CanonicalPeriodReadError } from "@/lib/academico/verify-canonical-periods-read"
import { recordAuditServer } from "@/lib/audit"
import { MAX_TURMAS_POR_LOTE, MAX_LOTES_NOMINAIS_POR_HORA, uniqueTurmaIds, makeNominalBatchKey } from "@/lib/documentos/rosterBatchPolicy"
import { canExportSensitiveRosterFields } from "@/lib/documentos/rosterSensitivePermission"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

const Body = z.object({
  escola_id: z.string().uuid().optional(),
  turma_ids: z.array(z.string().uuid()).min(1).refine(uniqueTurmaIds, "Turmas duplicadas não são permitidas"),
  tipo: z.enum(["trimestral", "anual", "boletim_trimestral", "certificado", "lista_nominal", "attendance"]),
  periodo_letivo_id: z.string().uuid().optional(),
  ano_letivo_id: z.string().uuid().optional(),
  month: z.string().regex(/^(?:0[1-9]|1[0-2])$/).optional(),
  year: z.string().optional(),
  is_album: z.boolean().optional(),
  include_all_status: z.boolean().optional(),
  mode: z.enum(["ano_letivo", "operacional"]).optional(),
  order: z.enum(["nome_asc", "nome_desc"]).optional(),
})

type PautasLoteJobRow = Database["public"]["Tables"]["pautas_lote_jobs"]["Row"]

function resolveDocumentoTipo(tipo: z.infer<typeof Body>["tipo"]) {
  if (tipo === "trimestral") return "pauta_trimestral"
  if (tipo === "anual") return "pauta_anual"
  if (tipo === "boletim_trimestral") return "boletim_trimestral"
  if (tipo === "lista_nominal") return "lista_nominal"
  if (tipo === "attendance") return "mapa_frequencia"
  return "certificado"
}

export async function GET(req: Request) {
  try {
    const supabase = await supabaseServerTyped<Database>()
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes?.user
    if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 })

    const escolaId = await resolveEscolaIdForUser(supabase, user.id, new URL(req.url).searchParams.get("escola_id"))
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 403 })

    const authz = await authorizeTurmasManage(supabase, escolaId, user.id)
    if (!authz.allowed) {
      return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 })
    }

    const { data: jobs, error } = await supabase
      .from("pautas_lote_jobs")
      .select("id, tipo, documento_tipo, periodo_letivo_id, status, total_turmas, processed, success_count, failed_count, zip_path, manifest_path, zip_checksum_sha256, signed_url_expires_at, error_message, created_at, pautas_lote_itens(turma_id,status)")
      .eq("escola_id", escolaId)
      .order("created_at", { ascending: false })
      .limit(20)

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    type LoteComItens = PautasLoteJobRow & {
      pautas_lote_itens?: Array<{ turma_id: string; status: string }> | null
    };
    const items = ((jobs || []) as unknown as LoteComItens[]).map((job) => {
      const download_url =
        job.zip_path && job.status === "SUCCESS"
          ? `/api/secretaria/documentos-oficiais/lote/${job.id}/download`
          : null
      const { pautas_lote_itens, ...metadata } = job;
      return { ...metadata, download_url, itens: (pautas_lote_itens ?? []).map(({ turma_id, status }) => ({
        turma_id, status,
      })) }
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

    const rawBody: unknown = await req.json().catch(() => ({}))
    const query = new URL(req.url).searchParams
    if (query.has("poloId") || query.has("polo_id") ||
        (rawBody !== null && typeof rawBody === "object" &&
          ("poloId" in rawBody || "polo_id" in rawBody))) {
      return NextResponse.json({ ok: false, error: "Exportação por polo indisponível sem escopo canónico" }, { status: 403 })
    }
    const parsed = Body.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados inválidos" }, { status: 400 })
    }

    // Não regressar a emissão de pautas, certificados e documentos legados.
    // O novo limite é deliberadamente exclusivo à lista nominal.
    if (parsed.data.tipo === "lista_nominal" && parsed.data.turma_ids.length > MAX_TURMAS_POR_LOTE) {
      return NextResponse.json({ ok: false, error: "Máximo 10 turmas por lista nominal" }, { status: 413 })
    }

    if (parsed.data.tipo === "certificado") {
      await requireFeature("doc_qr_code")
    }

    const escolaId = await resolveEscolaIdForUser(supabase, user.id, parsed.data.escola_id ?? null)
    if (!escolaId) return NextResponse.json({ ok: false, error: "Escola não encontrada" }, { status: 403 })

    const authz = await authorizeTurmasManage(supabase, escolaId, user.id)
    if (!authz.allowed) {
      return NextResponse.json({ ok: false, error: authz.reason || "Sem permissão" }, { status: 403 })
    }
    if (parsed.data.is_album && parsed.data.tipo !== "lista_nominal") {
      return NextResponse.json({ ok: false, error: "Álbum disponível apenas para listas nominais" }, { status: 400 })
    }
    if (parsed.data.is_album) {
      await requireFeature("doc_qr_code", { requestedEscolaId: escolaId })
      const authorised = await canExportSensitiveRosterFields(supabase, escolaId, user.id)
      if (!authorised) {
        return NextResponse.json({ ok: false, error: "Álbum reservado a perfis autorizados" }, { status: 403 })
      }
    }

    // Certificados podem ser emitidos a partir de anos já fechados.
    // Documentos pedagógicos operacionais continuam sujeitos ao ano ativo.
    let academicContext;
    try {
      academicContext = await resolveAcademicYearContext(supabase as any, {
        userId: user.id,
        requestedAcademicYearId: parsed.data.ano_letivo_id,
        requestedEscolaId: escolaId,
        operation: ["lista_nominal", "certificado"].includes(parsed.data.tipo) ? "READ" : "WRITE",
      });
    } catch (err: any) {
      if (err instanceof AcademicYearContextError) {
        return NextResponse.json({ ok: false, error: err.message, code: err.code }, { status: err.status });
      }
      return NextResponse.json({ ok: false, error: "Erro ao validar contexto académico" }, { status: 500 });
    }

    const { data: turmaRows, error: turmaRowsError } = await supabase
      .from("turmas")
      .select("id, session_id")
      .eq("escola_id", escolaId)
      .in("id", parsed.data.turma_ids);
    if (turmaRowsError) {
      return NextResponse.json({ ok: false, error: turmaRowsError.message }, { status: 500 });
    }
    if ((turmaRows ?? []).length !== new Set(parsed.data.turma_ids).size) {
      return NextResponse.json({ ok: false, error: "Uma ou mais turmas não foram encontradas.", code: "ACADEMIC_ENTITY_NOT_FOUND" }, { status: 404 });
    }
    if ((turmaRows ?? []).some((turma) => turma.session_id !== academicContext.anoLetivoId)) {
      return NextResponse.json({ ok: false, error: "As turmas não pertencem ao ano académico selecionado.", code: "CROSS_YEAR_ENTITY_MISMATCH" }, { status: 409 });
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
        .eq("ano_letivo_id", academicContext.anoLetivoId)
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

    // Um UUID válido não prova que o trimestre pertence à escola, ao ano
    // ou ao calendário oficial da turma. Validar antes de criar o job.
    if (effectivePeriodoLetivoId) {
      if (parsed.data.tipo === "trimestral" || parsed.data.tipo === "boletim_trimestral") {
        const verified = await readVerifiedAcademicTrimesters(supabase, {
          escolaId,
          anoLetivoId: academicContext.anoLetivoId,
          yearBase: Number(academicContext.anoLetivoLabel.split("/")[0]),
        });
        requireVerifiedTrimester(verified, { id: effectivePeriodoLetivoId });
      } else {
        const { data: origin, error: periodError } = await supabase
          .from("periodos_letivos")
          .select("id")
          .eq("id", effectivePeriodoLetivoId)
          .eq("escola_id", escolaId)
          .eq("ano_letivo_id", academicContext.anoLetivoId)
          .maybeSingle();
        if (periodError) {
          return NextResponse.json({ ok: false, error: "Falha ao validar o período do documento." }, { status: 500 });
        }
        if (!origin) {
          return NextResponse.json({ ok: false, code: "CROSS_YEAR_PERIOD_MISMATCH", error: "O período não pertence ao ano letivo selecionado." }, { status: 409 });
        }
      }
    }

    const sortedTurmas = [...parsed.data.turma_ids].sort()
    const documentoTipo = resolveDocumentoTipo(parsed.data.tipo)
    const idempotencyKey = parsed.data.tipo === "lista_nominal"
      ? makeNominalBatchKey({
          actorId: user.id,
          academicYearId: academicContext.anoLetivoId,
          mode: parsed.data.mode,
          order: parsed.data.tipo === "lista_nominal" ? (parsed.data.order ?? "nome_asc") : undefined,
          month: parsed.data.month,
          isAlbum: parsed.data.is_album ?? false,
          includeAllStatus: parsed.data.include_all_status ?? false,
        }, sortedTurmas)
      : `${user.id}:${documentoTipo}:${effectivePeriodoLetivoId ?? "none"}:${parsed.data.month ?? "any"}:${parsed.data.is_album ? "album" : "standard"}:${parsed.data.mode ?? "auto"}:${parsed.data.include_all_status ? "todos" : "padrao"}:${academicContext.anoLetivoId}:${sortedTurmas.join(",")}`

    const { data: existingByKey } = await supabase
      .from("pautas_lote_jobs")
      .select("id,status")
      .eq("escola_id", escolaId)
      .eq("documento_tipo", documentoTipo)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle()

    if (existingByKey?.id) {
      if (existingByKey.status === "FAILED") {
        return NextResponse.json({
          ok: false, error: "O pedido anterior falhou. Reprocesse as turmas com erro.",
          job_id: existingByKey.id, code: "REPROCESS_REQUIRED",
        }, { status: 409 });
      }
      return NextResponse.json({ ok: true, job_id: existingByKey.id, reused: true }, { status: 202 })
    }

    // Uma consulta por pedido (não por hora/poll): protege o plano gratuito.
    if (parsed.data.tipo === "lista_nominal") {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count, error: rateError } = await supabase
        .from("pautas_lote_jobs")
        .select("id", { count: "exact", head: true })
        .eq("escola_id", escolaId)
        .eq("created_by", user.id)
        .eq("documento_tipo", "lista_nominal")
        .gte("created_at", since);
      if (rateError) {
        return NextResponse.json({ ok: false, error: "Não foi possível validar o limite de emissão." }, { status: 503 });
      }
      if ((count ?? 0) >= MAX_LOTES_NOMINAIS_POR_HORA) {
        return NextResponse.json({ ok: false, error: "Limite de lotes por hora atingido." }, {
          status: 429, headers: { "Retry-After": "3600" },
        });
      }
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

    if (jobError?.code === "23505") {
      // Dois pedidos concorrentes com a mesma chave: reusar o job vencedor.
      const { data: winner } = await supabase.from("pautas_lote_jobs")
        .select("id").eq("escola_id", escolaId)
        .eq("documento_tipo", documentoTipo)
        .eq("idempotency_key", idempotencyKey).maybeSingle()
      if (winner?.id) return NextResponse.json({ ok: true, job_id: winner.id, reused: true }, { status: 202 })
    }
    if (jobError || !job?.id) {
      return NextResponse.json({ ok: false, error: "Falha ao criar lote" }, { status: 500 })
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
        month: parsed.data.month,
        year: parsed.data.year,
        is_album: parsed.data.is_album,
        include_all_status: parsed.data.include_all_status,
        mode: parsed.data.mode,
        order: parsed.data.tipo === "lista_nominal" ? (parsed.data.order ?? "nome_asc") : undefined,
      },
    })

    recordAuditServer({
      escolaId,
      portal: "secretaria",
      acao: "DOCUMENTOS_OFICIAIS_LOTE_INICIADO",
      entity: "pautas_lote_jobs",
      entityId: job.id,
      details: {
        ano_letivo_id: academicContext.anoLetivoId,
        documento_tipo: documentoTipo,
        turma_ids: parsed.data.turma_ids,
        modo: parsed.data.mode ?? "automatico",
        ordem: parsed.data.order ?? "nome_asc",
        quantidade_turmas: parsed.data.turma_ids.length,
        inclui_campos_sensiveis: false,
      },
    }).catch(() => null)

    return NextResponse.json({ ok: true, job_id: job.id }, { status: 202 })
  } catch (e) {
    if (e instanceof CanonicalPeriodReadError) {
      return NextResponse.json({ ok: false, code: e.code, error: e.message }, { status: e.status });
    }
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
