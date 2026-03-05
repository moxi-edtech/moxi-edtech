// src/components/aluno/tabs/TabNotas.tsx
'use client';

import { Award } from "lucide-react";
import type { Nota } from "../types";
import { AlunoCard } from "../shared/AlunoCard";
import { NotaBar } from "../shared/NotaBar";
import { mediaNotas, notaColor, notaBg } from "../utils";

interface TabNotasProps {
  notas:     Nota[];
  trimestre?: string;
}

export function TabNotas({ notas, trimestre = "2.º Trimestre" }: TabNotasProps) {
  const med = parseFloat(mediaNotas(notas));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Média geral */}
      <AlunoCard highlight style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontSize: 11, color: "#4b5563", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
              Média Geral · {trimestre}
            </p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{
                fontSize: 36, fontWeight: 900,
                color: notaColor(med),
                fontFamily: "'DM Mono', monospace",
                letterSpacing: "-0.03em",
              }}>
                {med}
              </span>
              <span style={{ fontSize: 16, color: "#374151", fontFamily: "'DM Mono', monospace" }}>
                /20
              </span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <Award size={32} color="#4ade80" style={{ opacity: 0.6 }} />
            <p style={{ fontSize: 10, color: "#4b5563", marginTop: 4 }}>
              {notas.length} disciplinas
            </p>
          </div>
        </div>
      </AlunoCard>

      {/* Lista de notas */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {notas.map((n, i) => (
          <AlunoCard
            key={n.disciplina}
            style={{ padding: "14px 16px", animationDelay: `${i * 40}ms` }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0", marginBottom: 2 }}>
                  {n.disciplina}
                </div>
                <div style={{ fontSize: 11, color: "#374151" }}>{n.professor}</div>
              </div>
              <div style={{
                fontFamily: "'DM Mono', monospace", fontWeight: 900,
                fontSize: 20, color: notaColor(n.nota),
                background: notaBg(n.nota),
                border: `1px solid ${notaColor(n.nota)}33`,
                borderRadius: 10, padding: "4px 12px",
                boxShadow: `0 0 12px ${notaColor(n.nota)}22`,
              }}>
                {n.nota}
              </div>
            </div>
            <NotaBar nota={n.nota} max={n.max} delay={i * 60} />
          </AlunoCard>
        ))}
      </div>
    </div>
  );
}
