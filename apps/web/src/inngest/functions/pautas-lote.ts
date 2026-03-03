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

const getSupabaseAdmin = () => {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim()
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim()
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente")
  }
  return createClient<Database>(url, key)
}

export const pautasLote = inngest.createFunction(
  { id: "pautas-lote" },
  { event: "docs/pautas-lote.requested" },
  async ({ event, step }) => {
    const supabase = getSupabaseAdmin()
    const { job_id, escola_id, turma_ids, tipo, periodo_letivo_id } = event.data

    const documentoTipo =
      tipo === "trimestral"
        ? "pauta_trimestral"
        : tipo === "anual"
          ? "pauta_anual"
          : tipo === "boletim_trimestral"
            ? "boletim_trimestral"
            : "certificado"

    try {
      const { data: currentJob } = await supabase
        .from("pautas_lote_jobs")
        .select("id, status, cancel_requested_at")
        .eq("id", job_id)
        .maybeSingle()

      if (!currentJob?.id) throw new Error("Job não encontrado")
      if (currentJob.cancel_requested_at) {
        await supabase.from("pautas_lote_jobs").update({ status: "FAILED", error_message: "Cancelado pelo usuário" }).eq("id", job_id)
        return { ok: false }
      }

      if (currentJob.status !== "PROCESSING") {
        await supabase.from("pautas_lote_jobs").update({ status: "PROCESSING", error_message: null }).eq("id", job_id)
      }

      const periodoNumero = await step.run("resolve-periodo", async () => {
        if (tipo !== "trimestral") return null
        if (!periodo_letivo_id) throw new Error("Período letivo é obrigatório")
        const { data: periodo } = await supabase
          .from("periodos_letivos")
          .select("numero")
          .eq("escola_id", escola_id)
          .eq("id", periodo_letivo_id)
          .maybeSingle()
        return periodo?.numero ?? null
      })

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
              if (tipo === "trimestral") {
                if (!periodoNumero) throw new Error("Período inválido")
                const payload = await buildPautaGeralPayload({ supabase, escolaId: escola_id, turmaId, periodoNumero })
                pdfBuffer = await renderPautaGeralBuffer(payload)
                filePrefix = "pauta_geral"
              } else if (tipo === "anual") {
                const payload = await buildPautaAnualPayload({ supabase, escolaId: escola_id, turmaId })
                pdfBuffer = await renderPautaAnualBuffer(payload)
                filePrefix = "pauta_anual"
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

              if (tipo === "trimestral" || tipo === "anual") {
                await supabase.from("pautas_oficiais").upsert({
                  escola_id,
                  turma_id: turmaId,
                  periodo_letivo_id: tipo === "trimestral" ? periodo_letivo_id : null,
                  tipo,
                  status: "SUCCESS",
                  pdf_path: pdfPath,
                  hash: randomUUID(),
                  generated_at: new Date().toISOString(),
                }, { onConflict: "escola_id,turma_id,periodo_letivo_id,tipo" })
              }

              await supabase.from("pautas_lote_itens").update({
                status: "SUCCESS",
                pdf_path: pdfPath,
                checksum_sha256: checksum,
                artifact_expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
                error_message: null,
              }).eq("job_id", job_id).eq("turma_id", turmaId)

              await supabase.rpc("increment_pautas_lote_job", { p_job_id: job_id, p_success: true, p_failed: false })
              return { turmaId, ok: true, pdfPath, checksum }
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err)
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

      const successItems = results.filter((r) => r.ok) as Array<{ turmaId: string; ok: true; pdfPath: string; checksum: string }>
      const failedItems = results.filter((r) => !r.ok)

      if (successItems.length === 0) {
        await supabase.from("pautas_lote_jobs").update({
          status: "FAILED",
          error_message: "Nenhum artefato gerado",
          processed: results.length,
          success_count: 0,
          failed_count: failedItems.length,
        }).eq("id", job_id)
        return { ok: false }
      }

      const manifest = {
        job_id,
        escola_id,
        documento_tipo: documentoTipo,
        periodo_letivo_id: periodo_letivo_id ?? null,
        generated_at: new Date().toISOString(),
        files: successItems.map((item) => ({ turma_id: item.turmaId, pdf_path: item.pdfPath, checksum_sha256: item.checksum })),
      }

      const archive = archiver("zip", { zlib: { level: 9 } })
      const tmpPath = path.join(tmpdir(), `pautas_${job_id}_${Date.now()}.zip`)
      const output = fs.createWriteStream(tmpPath)
      archive.on("warning", (err) => { if (err.code !== "ENOENT") throw err })
      archive.on("error", (err) => { throw err })
      archive.pipe(output)

      for (const item of successItems) {
        const { data, error } = await supabase.storage.from("pautas_oficiais_fechadas").download(item.pdfPath)
        if (error) throw new Error(error.message)
        const buffer = Buffer.from(await data.arrayBuffer())
        const filename = item.pdfPath.split("/").slice(-2).join("_")
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
        status: failedItems.length > 0 ? "FAILED" : "SUCCESS",
        zip_path: zipPath,
        manifest_path: manifestPath,
        zip_checksum_sha256: zipChecksum,
        processed: results.length,
        success_count: successItems.length,
        failed_count: failedItems.length,
      }).eq("id", job_id)

      return { ok: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await supabase.from("pautas_lote_jobs").update({ status: "FAILED", error_message: message }).eq("id", job_id)
      throw err
    }
  }
)
