import type { ChartsData } from "@/lib/charts"

type Props = { data: ChartsData }

const STATUS_COR_STATIC: Record<string, { dot: string; text: string; bar: string }> = {
  pago:        { dot: "#4ade80", text: "#4ade80", bar: "#4ade80" },
  pendente:    { dot: "#fbbf24", text: "#fbbf24", bar: "#fbbf24" },
  em_atraso:   { dot: "#f87171", text: "#f87171", bar: "#f87171" },
  cancelado:   { dot: "#64748b", text: "#94a3b8", bar: "#475569" },
  desconhecido:{ dot: "#64748b", text: "#94a3b8", bar: "#475569" },
}

function getCor(label: string) {
  return STATUS_COR_STATIC[label] ?? STATUS_COR_STATIC["desconhecido"]
}

export default function ChartsStaticSection({ data }: Props) {
  const pagamentosList = data.pagamentos.map((p) => ({
    label: p.status ?? 'desconhecido',
    value: Number(p.total ?? 0),
  }))

  const total = pagamentosList.reduce((a, b) => a + b.value, 0)

  return (
    <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

      {/* Pagamentos */}
      <div style={{
        background: "#0f172a", borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.06)",
        padding: "20px 20px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9", margin: 0 }}>
            Pagamentos por estado
          </h2>
          {total > 0 && (
            <span style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace" }}>
              {total} total
            </span>
          )}
        </div>

        {pagamentosList.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {pagamentosList.map((p) => {
              const pct = total > 0 ? Math.round((p.value / total) * 100) : 0
              const cor = getCor(p.label)
              return (
                <div key={p.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: cor.dot, display: "inline-block" }} />
                      <span style={{ fontSize: 12, color: "#cbd5e1", textTransform: "capitalize" }}>{p.label}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 700, color: cor.text }}>{p.value}</span>
                      <span style={{ fontSize: 11, color: "#475569" }}>{pct}%</span>
                    </div>
                  </div>
                  <div style={{ height: 4, background: "#1e293b", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 2, background: cor.bar, width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ padding: "24px 0", textAlign: "center" }}>
            <p style={{ fontSize: 12, color: "#475569" }}>Sem dados de pagamentos</p>
          </div>
        )}
      </div>

      {/* Resumo financeiro — placeholder consistente com o ChartsSection client */}
      <div style={{
        background: "#0f172a", borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.06)",
        padding: "20px 20px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9", margin: 0 }}>
            Resumo Financeiro
          </h2>
          <span style={{
            fontSize: 10, color: "#475569",
            background: "#1e293b", border: "1px solid #334155",
            padding: "2px 10px", borderRadius: 20,
          }}>
            Em construção
          </span>
        </div>
        <div style={{ padding: "24px 0", textAlign: "center" }}>
          <div style={{ fontSize: 24, color: "#1e293b", marginBottom: 8 }}>◉</div>
          <p style={{ fontSize: 12, color: "#475569", marginBottom: 4 }}>
            MRR, receita acumulada e previsão
          </p>
          <p style={{ fontSize: 11, color: "#334155" }}>
            Disponível quando houver dados suficientes
          </p>
        </div>
      </div>

    </section>
  )
}
