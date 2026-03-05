// src/components/aluno/tabs/TabFinanceiro.tsx
'use client';

import { CheckCircle, Clock } from "lucide-react";
import type { Pagamento } from "../types";
import { AlunoCard } from "../shared/AlunoCard";
import { Pill } from "../shared/Pill";
import { SectionTitle } from "../shared/SectionTitle";
import { fmtKz } from "../utils";

interface TabFinanceiroProps {
  pagamentos: Pagamento[];
}

export function TabFinanceiro({ pagamentos }: TabFinanceiroProps) {
  const pagos     = pagamentos.filter(p => p.status === "pago");
  const pendentes = pagamentos.filter(p => p.status === "pendente");
  const totalPago = pagos.reduce((s, p) => s + p.valor, 0);
  const totalPendente = pendentes.reduce((s, p) => s + p.valor, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Resumo */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <AlunoCard style={{ padding: 14 }}>
          <p style={{ fontSize: 10, color: "#4b5563", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Pago 2026
          </p>
          <p style={{ fontSize: 18, fontWeight: 800, color: "#4ade80", fontFamily: "'DM Mono', monospace" }}>
            {fmtKz(totalPago)}
          </p>
        </AlunoCard>

        <AlunoCard
          danger={pendentes.length > 0}
          style={{ padding: 14 }}
        >
          <p style={{ fontSize: 10, color: "#4b5563", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Pendente
          </p>
          <p style={{ fontSize: 18, fontWeight: 800, fontFamily: "'DM Mono', monospace", color: pendentes.length > 0 ? "#f87171" : "#4ade80" }}>
            {pendentes.length > 0 ? fmtKz(totalPendente) : "Kz 0"}
          </p>
        </AlunoCard>
      </div>

      {/* Lista de pagamentos */}
      <SectionTitle>Histórico de pagamentos</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {pagamentos.map((pg, i) => (
          <AlunoCard
            key={pg.id}
            style={{ padding: "14px 16px", animationDelay: `${i * 40}ms` }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>

              {/* Ícone + descrição */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: pg.status === "pago" ? "#0a1f12" : "#1c0a0a",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {pg.status === "pago"
                    ? <CheckCircle size={16} color="#4ade80" />
                    : <Clock size={16} color="#f87171" />
                  }
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>
                    {pg.descricao}
                  </div>
                  <div style={{ fontSize: 11, color: "#374151", marginTop: 2 }}>
                    {pg.data}
                  </div>
                </div>
              </div>

              {/* Valor + badge */}
              <div style={{ textAlign: "right" }}>
                <div style={{
                  fontSize: 13, fontWeight: 800,
                  fontFamily: "'DM Mono', monospace",
                  color: pg.status === "pago" ? "#4ade80" : "#f87171",
                  marginBottom: 4,
                }}>
                  {fmtKz(pg.valor)}
                </div>
                <Pill
                  label={pg.status === "pago" ? "Pago" : "Pendente"}
                  cor={pg.status === "pago" ? "#4ade80" : "#f87171"}
                  bg={pg.status === "pago" ? "#0a1f12" : "#1c0a0a"}
                />
              </div>
            </div>
          </AlunoCard>
        ))}
      </div>
    </div>
  );
}
