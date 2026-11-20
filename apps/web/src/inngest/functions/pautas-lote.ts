import { createClient } from "@supabase/supabase-js"
import { createHash, randomUUID } from "crypto"
import archiver from "archiver"
import fs from "fs"
import path from "path"
import { tmpdir } from "os"
import { finished } from "stream/promises"
import type { Database } from "~types/supabase"
import { inngest } from "@/inngest/client"
import { buildPautaGeralPayload, renderPautaGeralBuffer } from "@/lib/pedagogico/pauta-geral"
import { buildPautaAnualPayload, renderPautaAnualBuffer } from "@/lib/pedagogico/pauta-anual"
import { renderBoletimPdfBuffer, renderCertificadoPdfBuffer } from "@/lib/documentos/oficiaisBatchServer"
import { renderListaNominalPdfBuffer } from "@/lib/documentos/listaNominalPdf"
import { progressoLote, statusFinalLote, parcialLote } from "@/lib/documentos/rosterBatchPolicy"
import { nominalExportFilename, type NominalOrder } from "@/lib/documentos/nominalExportOptions"

type PautaLoteTipo = "trimestral" | "anual" | "boletim_trimestral" | "certificado" | "lista_nominal" | "attendance"

type PautasLoteEventData = {
  job_id: string
  escola_id: string
  turma_ids: string[]
  tipo: PautaLoteTipo
  documento_tipo?: string | null
  periodo_letivo_id?: string | null
  month?: string | null
  year?: string | null
  is_album?: boolean
  include_all_status?: boolean
  mode?: "ano_letivo" | "operacional"
  order?: NominalOrder
}

const getSupabaseAdmin = () => {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim()
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim()
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente")
  }
  return createClient<Database>(url, key)
}

export const pautasLote = inngest.createFunction(
  { id: "pautas-lote", triggers: [{ event: "docs/pautas-lote.requested" }] },
  async ({ event, step }) => {
    const supabase = getSupabaseAdmin()
    const { job_id, escola_id, turma_ids, tipo, periodo_letivo_id } = event.data as PautasLoteEventData

    const documentoTipo = resolveDocumentoTipoForLote(tipo)

    try {
      const { data: currentJob } = await supabase
        .from("pautas_lote_jobs")
        .select("id, status, cancel_requested_at, escola_id, tipo, created_by")
        .eq("id", job_id)
        .maybeSingle()

      if (!currentJob?.id) throw new Error("Job não encontrado")
      if (currentJob.escola_id !== escola_id || currentJob.tipo !== tipo) {
        throw new Error("Lote fora do âmbito autorizado")
      }
      // Mesmo usando service_role, confirmar os itens autorizados na escola do job.
      // Consultas agrupadas, não uma consulta extra por turma.
      const { data: registered, error: registeredError } = await supabase
        .from("pautas_lote_itens").select("turma_id").eq("job_id", job_id)
      const permitted = new Set((registered ?? []).map(item => item.turma_id))
      if (registeredError || turma_ids.some(id => !permitted.has(id))) {
        throw new Error("Turmas não autorizadas neste lote")
      }
      const { data: schoolTurmas, error: scopeError } = await supabase
        .from("turmas").select("id,nome,ano_letivo").eq("escola_id", escola_id).in("id", turma_ids)
      if (scopeError || schoolTurmas?.length !== new Set(turma_ids).size) {
        throw new Error("Turmas fora da escola do lote")
      }
      if (currentJob.cancel_requested_at) {
        await supabase.from("pautas_lote_jobs").update({ status: "FAILED", error_message: "Cancelado pelo usuário" }).eq("id", job_id)
        return { ok: false }
      }

      if (currentJob.status !== "PROCESSING") {
        await supabase.from("pautas_lote_jobs").update({ status: "PROCESSING", error_message: null }).eq("id", job_id)
      }

      const periodoContext = await step.run("resolve-periodo", async () => {
        if (tipo === "trimestral") {
          if (!periodo_letivo_id) throw new Error("Período letivo é obrigatório")
          const { data: periodo } = await supabase
            .from("periodos_letivos")
            .select("id,numero")
            .eq("escola_id", escola_id)
            .eq("id", periodo_letivo_id)
            .maybeSingle()
          if (!periodo?.id) throw new Error("Período letivo inválido")
          return { id: periodo.id, numero: periodo.numero ?? null }
        }

        if (tipo === "anual") {
          if (periodo_letivo_id) return { id: periodo_letivo_id, numero: null }

          const { data: turmaRef } = await supabase
            .from("turmas")
            .select("session_id")
            .eq("escola_id", escola_id)
            .in("id", turma_ids)
            .not("session_id", "is", null)
            .limit(1)
            .maybeSingle()

          if (!turmaRef?.session_id) {
            throw new Error("Não foi possível resolver o ano letivo das turmas para pauta anual")
          }

          const { data: periodo } = await supabase
            .from("periodos_letivos")
            .select("id")
            .eq("escola_id", escola_id)
            .eq("ano_letivo_id", turmaRef.session_id)
            .order("data_fim", { ascending: false })
            .limit(1)
            .maybeSingle()

          if (!periodo?.id) {
            throw new Error("Ano letivo sem período final para pauta anual")
          }

          return { id: periodo.id, numero: null }
        }

        return { id: periodo_letivo_id ?? null, numero: null }
      })

      if ((tipo === "trimestral" || tipo === "anual") && periodoContext.id && periodoContext.id !== periodo_letivo_id) {
        await step.run("sync-job-periodo", async () => {
          await supabase
            .from("pautas_lote_jobs")
            .update({ periodo_letivo_id: periodoContext.id })
            .eq("id", job_id)
        })
      }

      const periodoNumero = periodoContext.numero
      const pautaPeriodoLetivoId = periodoContext.id

      const results = await Promise.all(
        turma_ids.map((turmaId) =>
          step.run(`turma-${turmaId}`, async () => {
            let pdfPath = ""
            let currentRetryCount = 0
            try {
              const { data: item } = await supabase
                .from("pautas_lote_itens")
                .upsert({ job_id, turma_id: turmaId, status: "PROCESSING" }, { onConflict: "job_id,turma_id" })
                .select("id,retry_count")
                .maybeSingle()
              if (!item?.id) throw new Error("Falha ao iniciar item")
              currentRetryCount = item.retry_count ?? 0

              let pdfBuffer: Buffer
              let filePrefix = "pauta"
               let nominalRows: number | null = null
              if (tipo === "trimestral") {
                if (!periodoNumero) throw new Error("Período inválido")
                const payload = await buildPautaGeralPayload({ supabase, escolaId: escola_id, turmaId, periodoNumero })
                pdfBuffer = await renderPautaGeralBuffer(payload)
                filePrefix = "pauta_geral"
              } else if (tipo === "anual") {
                const payload = await buildPautaAnualPayload({ supabase, escolaId: escola_id, turmaId })
                pdfBuffer = await renderPautaAnualBuffer(payload)
                filePrefix = "pauta_anual"
              } else if (tipo === "lista_nominal" || tipo === "attendance") {
                pdfBuffer = await renderListaNominalPdfBuffer({
                  supabase,
                  escolaId: escola_id,
                  turmaId,
                  month: event.data.month,
                  year: event.data.year,
                  isAlbum: event.data.is_album,
                  includeAllStatus: event.data.include_all_status,
                  mode: event.data.mode,
                  order: event.data.order,
                   onRowsCount: (count) => { nominalRows = count },
                })
                filePrefix = tipo
              } else if (tipo === "boletim_trimestral") {
                pdfBuffer = await renderBoletimPdfBuffer({ supabase, escolaId: escola_id, turmaId })
                filePrefix = "boletim"
              } else {
                pdfBuffer = await renderCertificadoPdfBuffer({ supabase, escolaId: escola_id, turmaId })
                filePrefix = "certificado"
              }

              if (pdfBuffer.length < 800) throw new Error(`PDF inválido (tamanho ${pdfBuffer.length})`)

              pdfPath = `${escola_id}/${job_id}/${turmaId}/${filePrefix}.pdf`
              const checksum = createHash("sha256").update(pdfBuffer).digest("hex")
              const { error: uploadError } = await supabase.storage
                .from("pautas_oficiais_fechadas")
                .upload(pdfPath, pdfBuffer, { upsert: true, contentType: "application/pdf" })
              if (uploadError) throw new Error(uploadError.message)

              if (tipo === "trimestral") {
                if (!pautaPeriodoLetivoId) throw new Error("Período letivo obrigatório para pauta trimestral")
                await supabase.from("pautas_oficiais").upsert({
                  escola_id,
                  turma_id: turmaId,
                  periodo_letivo_id: pautaPeriodoLetivoId,
                  tipo,
                  status: "SUCCESS",
                  pdf_path: pdfPath,
                  hash: randomUUID(),
                  generated_at: new Date().toISOString(),
                }, { onConflict: "escola_id,turma_id,periodo_letivo_id,tipo" })
              } else if (tipo === "anual") {
                if (!pautaPeriodoLetivoId) throw new Error("Período final obrigatório para pauta anual")
                const annualPayload = {
                  escola_id,
                  turma_id: turmaId,
                  periodo_letivo_id: pautaPeriodoLetivoId,
                  tipo,
                  status: "SUCCESS",
                  pdf_path: pdfPath,
                  hash: randomUUID(),
                  generated_at: new Date().toISOString(),
                }

                const { data: existingAnnual } = await supabase
                  .from("pautas_oficiais")
                  .select("id")
                  .eq("escola_id", escola_id)
                  .eq("turma_id", turmaId)
                  .eq("tipo", "anual")
                  .eq("periodo_letivo_id", pautaPeriodoLetivoId)
                  .maybeSingle()

                if (existingAnnual?.id) {
                  await supabase
                    .from("pautas_oficiais")
                    .update({
                      status: annualPayload.status,
                      pdf_path: annualPayload.pdf_path,
                      hash: annualPayload.hash,
                      generated_at: annualPayload.generated_at,
                    })
                    .eq("id", existingAnnual.id)
                } else {
                  await supabase.from("pautas_oficiais").insert(annualPayload)
                }
              }

              await supabase.from("pautas_lote_itens").update({
                status: "SUCCESS",
                pdf_path: pdfPath,
                checksum_sha256: checksum,
                artifact_expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
                error_message: null,
              }).eq("job_id", job_id).eq("turma_id", turmaId)

              await supabase.rpc("increment_pautas_lote_job", { p_job_id: job_id, p_success: true, p_failed: false })
              return { turmaId, ok: true, pdfPath, checksum, nominalRows }
            } catch (err) {
              const message = "Falha ao gerar o documento desta turma"
              await supabase.from("pautas_lote_itens").update({
                status: "FAILED",
                error_message: message,
                retry_count: currentRetryCount + 1,
              }).eq("job_id", job_id).eq("turma_id", turmaId)
              await supabase.rpc("increment_pautas_lote_job", { p_job_id: job_id, p_success: false, p_failed: true })
              return { turmaId, ok: false, error: message }
            }
          })
        )
      )

      // Uma inserção auditável para todas as turmas desta execução.
      // Nunca guardar conteúdo, notas, nomes, BI ou erros não sanitizados.
      if (tipo === "lista_nominal") {
        const newlyProduced = results.filter(item => item.ok && "nominalRows" in item);
        if (newlyProduced.length) {
          const { error: auditError } = await supabase
            .from("audit_logs")
            .insert(newlyProduced.map(item => ({
              escola_id,
              portal: "secretaria",
              acao: "LISTA_NOMINAL_LOTE_EXPORTADA",
              tabela: "turmas",
              entity: "turmas",
              entity_id: item.turmaId,
              details: {
                job_id,
                turma_id: item.turmaId,
                emissor_id: currentJob.created_by ?? null,
                ano: event.data.year ?? "sessao_da_turma",
                modo: event.data.mode ?? "conforme_sessao",
                ordem: event.data.order ?? "chamada",
                linhas: "nominalRows" in item && typeof item.nominalRows === "number" ? item.nominalRows : 0,
                campos_sensiveis: false,
              },
            })))
          if (auditError) {
            await supabase.from("pautas_lote_itens").update({
              status: "FAILED",
              error_message: "Auditoria indisponível",
              pdf_path: null,
              checksum_sha256: null,
            }).eq("job_id", job_id).in("turma_id", newlyProduced.map(item => item.turmaId))
            throw new Error("Auditoria do lote indisponível")
          }
        }
      }

      // Depois do reprocessamento das falhas, reconstruir o ZIP com TODOS
      // os itens bem-sucedidos do job, inclusive os de execuções anteriores.
      const { data: allItems, error: stateError } = await supabase
        .from("pautas_lote_itens")
        .select("turma_id,status,pdf_path,checksum_sha256")
        .eq("job_id", job_id)
      if (stateError || !allItems) throw new Error("Falha ao reconciliar o lote")
      const metrics = progressoLote(allItems)
      const successItems = allItems.filter(
        item => item.status === "SUCCESS" && Boolean(item.pdf_path) && Boolean(item.checksum_sha256)
      ).map(item => ({
        turmaId: item.turma_id, ok: true as const,
        pdfPath: String(item.pdf_path), checksum: String(item.checksum_sha256),
      }))
      const failedItems = allItems.filter(item => item.status === "FAILED")

      if (successItems.length === 0) {
        await supabase.from("pautas_lote_jobs").update({
          status: "FAILED",
          error_message: "Nenhum ficheiro válido gerado",
          processed: metrics.processed,
          success_count: 0,
          failed_count: failedItems.length,
        }).eq("id", job_id)
        return { ok: false }
      }

      const manifest = {
        job_id,
        escola_id,
        documento_tipo: documentoTipo,
        periodo_letivo_id: periodoContext.id,
        generated_at: new Date().toISOString(),
        total: allItems.length,
        success_count: successItems.length,
        failed_count: failedItems.length,
        files: successItems.map(item => ({
          turma_id: item.turmaId,
          pdf_path: item.pdfPath,
          checksum_sha256: item.checksum,
        })),
      }

      const archive = archiver("zip", { zlib: { level: 9 } })
      const tmpPath = path.join(tmpdir(), `pautas_${job_id}_${Date.now()}.zip`)
      const output = fs.createWriteStream(tmpPath)
      archive.on("warning", (err) => { if (err.code !== "ENOENT") throw err })
      archive.on("error", (err) => { throw err })
      archive.pipe(output)

      const turmaMap = new Map((schoolTurmas ?? []).map(turma => [turma.id, turma]))
      for (const [index, item] of successItems.entries()) {
        const { data, error } = await supabase.storage.from("pautas_oficiais_fechadas").download(item.pdfPath)
        if (error) throw new Error(error.message)
        const buffer = Buffer.from(await data.arrayBuffer())
        const turma = turmaMap.get(item.turmaId)
        const ano = turma?.ano_letivo
        const filename = tipo === "lista_nominal"
          ? `${String(index + 1).padStart(2, "0")} - ${nominalExportFilename({ scope: "turma", turma: turma?.nome ?? "Turma", ano: ano ? `${ano}-${ano + 1}` : undefined, extension: "pdf" })}`
          : item.pdfPath.split("/").slice(-2).join("_")
        archive.append(buffer, { name: filename })
      }

      archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" })
      await archive.finalize()
      await finished(output)

      const zipBuffer = await fs.promises.readFile(tmpPath)
      await fs.promises.unlink(tmpPath).catch(() => null)
      if (zipBuffer.length < 4 || zipBuffer.slice(0, 2).toString("ascii") !== "PK") {
        throw new Error("ZIP inválido gerado")
      }

      const zipChecksum = createHash("sha256").update(zipBuffer).digest("hex")
      const zipPath = `${escola_id}/${job_id}/documentos_oficiais_${tipo}.zip`
      const manifestPath = `${escola_id}/${job_id}/manifest.json`

      const { error: zipUploadError } = await supabase.storage.from("pautas_zip").upload(zipPath, zipBuffer, {
        upsert: true,
        contentType: "application/zip",
      })
      if (zipUploadError) throw new Error(zipUploadError.message)

      const { error: manifestUploadError } = await supabase.storage.from("pautas_zip").upload(manifestPath, JSON.stringify(manifest), {
        upsert: true,
        contentType: "application/json",
      })
      if (manifestUploadError) throw new Error(manifestUploadError.message)

      await supabase.from("pautas_lote_jobs").update({
        status: statusFinalLote(successItems.length),
        error_message: parcialLote(successItems.length, failedItems.length) ? "Lote parcial: consulte as turmas que falharam" : null,
        zip_path: zipPath,
        manifest_path: manifestPath,
        zip_checksum_sha256: zipChecksum,
        processed: metrics.processed,
        success_count: successItems.length,
        failed_count: failedItems.length,
      }).eq("id", job_id)

      return { ok: true, parcial: failedItems.length > 0 }
    } catch {
      await supabase.from("pautas_lote_jobs").update({
        status: "FAILED", error_message: "Não foi possível concluir o lote",
      }).eq("id", job_id)
      throw new Error("Não foi possível concluir o lote")
    }
  }
)

export function resolveDocumentoTipoForLote(tipo: PautaLoteTipo) {
  if (tipo === "trimestral") return "pauta_trimestral"
  if (tipo === "anual") return "pauta_anual"
  if (tipo === "boletim_trimestral") return "boletim_trimestral"
  if (tipo === "lista_nominal") return "lista_nominal"
  if (tipo === "attendance") return "mapa_frequencia"
  return "certificado"
}
