import { serve } from "inngest/next"
import { inngest } from "@/inngest/client"
import { pautasLote } from "@/inngest/functions/pautas-lote"
import { fechamentoAcademicoRun } from "@/inngest/functions/fechamento-academico-run"
import { fiscalSaftExport } from "@/inngest/functions/fiscal-saft-export"
import { fiscalFinanceiroReprocess } from "@/inngest/functions/fiscal-financeiro-reprocess"

if (process.env.NODE_ENV !== "production" && !process.env.INNGEST_SIGNING_KEY) {
  process.env.INNGEST_DEV = "1"
}

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const functions = [pautasLote, fechamentoAcademicoRun, fiscalSaftExport, fiscalFinanceiroReprocess]

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
})
