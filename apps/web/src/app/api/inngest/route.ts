import { serve } from "inngest/next"
import { inngest } from "@/inngest/client"
import { pautasLote } from "@/inngest/functions/pautas-lote"
import { fechamentoAcademicoRun } from "@/inngest/functions/fechamento-academico-run"
import { fiscalSaftExport } from "@/inngest/functions/fiscal-saft-export"

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [pautasLote, fechamentoAcademicoRun, fiscalSaftExport],
})
