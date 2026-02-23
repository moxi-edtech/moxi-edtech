import { serve } from "inngest/next"
import { inngest } from "@/inngest/client"
import { pautasLote } from "@/inngest/functions/pautas-lote"

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [pautasLote],
})
