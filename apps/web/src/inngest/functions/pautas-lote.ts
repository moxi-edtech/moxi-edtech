import { createClient } from "@supabase/supabase-js"
import { randomUUID } from "crypto"
import archiver from "archiver"
import fs from "fs"
import path from "path"
import { tmpdir } from "os"
import { finished } from "stream/promises"
import type { Database } from "~types/supabase"
import { inngest } from "@/inngest/client"
import { buildPautaGeralPayload, renderPautaGeralBuffer } from "@/lib/pedagogico/pauta-geral"
import { buildPautaAnualPayload, renderPautaAnualBuffer } from "@/lib/pedagogico/pauta-anual"

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

    try {
      await step.run("load-job", async () => {
        const { data, error } = await supabase
          .from("pautas_lote_jobs")
          .select("id, status")
          .eq("id", job_id)
          .maybeSingle()

        if (error || !data) {
          throw new Error(error?.message || "Job não encontrado")
        }

        if (data.status !== "PROCESSING") {
          const { error: updateError } = await supabase
            .from("pautas_lote_jobs")
            .update({ status: "PROCESSING", error_message: null })
            .eq("id", job_id)
          if (updateError) throw new Error(updateError.message)
        }
      })

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
            try {
              const { data: item } = await supabase
                .from("pautas_lote_itens")
                .upsert({
                  job_id,
                  turma_id: turmaId,
                  status: "PROCESSING",
                }, { onConflict: "job_id,turma_id" })
                .select("id")
                .maybeSingle()

              if (!item?.id) {
                throw new Error("Falha ao iniciar item")
              }

              if (tipo === "trimestral") {
                if (!periodoNumero) throw new Error("Período inválido")
                const payload = await buildPautaGeralPayload({
                  supabase,
                  escolaId: escola_id,
                  turmaId,
                  periodoNumero,
                })
                const pdfBuffer = await renderPautaGeralBuffer(payload)
                if (pdfBuffer.length < 800) {
                  throw new Error(`PDF inválido (tamanho ${pdfBuffer.length})`)
                }
                pdfPath = `${escola_id}/${turmaId}/${periodo_letivo_id}/pauta_geral.pdf`
                const pdfArrayBuffer = new Uint8Array(pdfBuffer).buffer
                const pdfBlob = new Blob([pdfArrayBuffer], { type: "application/pdf" })
                const { error: uploadError } = await supabase.storage
                  .from("pautas_oficiais_fechadas")
                  .upload(pdfPath, pdfBlob, {
                    upsert: true,
                    contentType: "application/pdf",
                  })
                if (uploadError) throw new Error(uploadError.message)
                await supabase
                  .from("pautas_oficiais")
                  .upsert({
                    escola_id,
                    turma_id: turmaId,
                    periodo_letivo_id,
                    tipo: "trimestral",
                    status: "SUCCESS",
                    pdf_path: pdfPath,
                    hash: randomUUID(),
                    generated_at: new Date().toISOString(),
                  }, { onConflict: "escola_id,turma_id,periodo_letivo_id,tipo" })
              } else {
                const payload = await buildPautaAnualPayload({
                  supabase,
                  escolaId: escola_id,
                  turmaId,
                })
                const pdfBuffer = await renderPautaAnualBuffer(payload)
                if (pdfBuffer.length < 800) {
                  throw new Error(`PDF inválido (tamanho ${pdfBuffer.length})`)
                }
                pdfPath = `${escola_id}/${turmaId}/${periodo_letivo_id ?? "anual"}/pauta_anual.pdf`
                const pdfArrayBuffer = new Uint8Array(pdfBuffer).buffer
                const pdfBlob = new Blob([pdfArrayBuffer], { type: "application/pdf" })
                const { error: uploadError } = await supabase.storage
                  .from("pautas_oficiais_fechadas")
                  .upload(pdfPath, pdfBlob, {
                    upsert: true,
                    contentType: "application/pdf",
                  })
                if (uploadError) throw new Error(uploadError.message)
                await supabase
                  .from("pautas_oficiais")
                  .upsert({
                    escola_id,
                    turma_id: turmaId,
                    periodo_letivo_id: periodo_letivo_id ?? null,
                    tipo: "anual",
                    status: "SUCCESS",
                    pdf_path: pdfPath,
                    hash: randomUUID(),
                    generated_at: new Date().toISOString(),
                  }, { onConflict: "escola_id,turma_id,periodo_letivo_id,tipo" })
              }

              await supabase
                .from("pautas_lote_itens")
                .update({ status: "SUCCESS", pdf_path: pdfPath, error_message: null })
                .eq("job_id", job_id)
                .eq("turma_id", turmaId)

              await supabase.rpc("increment_pautas_lote_job", {
                p_job_id: job_id,
                p_success: true,
                p_failed: false,
              })

              return { turmaId, ok: true, pdfPath }
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err)
              await supabase
                .from("pautas_lote_itens")
                .update({ status: "FAILED", error_message: message })
                .eq("job_id", job_id)
                .eq("turma_id", turmaId)

              await supabase.rpc("increment_pautas_lote_job", {
                p_job_id: job_id,
                p_success: false,
                p_failed: true,
              })
              return { turmaId, ok: false, error: message }
            }
          })
        )
      )

      const successItems = results.filter((r) => r.ok) as Array<{ turmaId: string; ok: true; pdfPath: string }>
      const failedItems = results.filter((r) => !r.ok)

      if (successItems.length === 0) {
        await supabase
          .from("pautas_lote_jobs")
          .update({
            status: "FAILED",
            error_message: "Nenhuma pauta gerada",
            processed: results.length,
            success_count: 0,
            failed_count: failedItems.length,
          })
          .eq("id", job_id)
        return { ok: false }
      }

      const archive = archiver("zip", { zlib: { level: 9 } })
      const tmpPath = path.join(tmpdir(), `pautas_${job_id}_${Date.now()}.zip`)
      const output = fs.createWriteStream(tmpPath)
      archive.on("warning", (err) => {
        if (err.code !== "ENOENT") throw err
      })
      archive.on("error", (err) => {
        throw err
      })
      archive.pipe(output)

      for (const item of successItems) {
        const { data, error } = await supabase.storage
          .from("pautas_oficiais_fechadas")
          .download(item.pdfPath)
        if (error) throw new Error(error.message)
        const buffer = Buffer.from(await data.arrayBuffer())
        const filename = item.pdfPath.split("/").pop() ?? `${item.turmaId}.pdf`
        archive.append(buffer, { name: filename })
      }

      await archive.finalize()
      await finished(output)
      const zipBuffer = await fs.promises.readFile(tmpPath)
      await fs.promises.unlink(tmpPath).catch(() => null)
      if (zipBuffer.length < 4 || zipBuffer.slice(0, 2).toString("ascii") !== "PK") {
        throw new Error("ZIP inválido gerado")
      }

      const zipPath = `${escola_id}/${job_id}/pautas_${tipo}.zip`
      const zipArrayBuffer = zipBuffer.buffer.slice(
        zipBuffer.byteOffset,
        zipBuffer.byteOffset + zipBuffer.byteLength
      )
      const { error: zipUploadError } = await supabase.storage
        .from("pautas_zip")
        .upload(zipPath, zipArrayBuffer, {
          upsert: true,
          contentType: "application/zip",
        })

      if (zipUploadError) {
        await supabase
          .from("pautas_lote_jobs")
          .update({
            status: "FAILED",
            error_message: zipUploadError.message,
            processed: results.length,
            success_count: successItems.length,
            failed_count: failedItems.length,
          })
          .eq("id", job_id)
        return { ok: false }
      }

      await supabase
        .from("pautas_lote_jobs")
        .update({
          status: failedItems.length > 0 ? "FAILED" : "SUCCESS",
          zip_path: zipPath,
          processed: results.length,
          success_count: successItems.length,
          failed_count: failedItems.length,
        })
        .eq("id", job_id)

      return { ok: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await supabase
        .from("pautas_lote_jobs")
        .update({
          status: "FAILED",
          error_message: message,
        })
        .eq("id", job_id)
      throw err
    }
  }
)
