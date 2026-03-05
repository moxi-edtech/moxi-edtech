// src/components/aluno/tabs/TabHome.tsx
'use client';

import { AlertCircle, ChevronRight } from "lucide-react";
import type { Educando, Nota, Pagamento, Presenca, TabId } from "../types";
import { AlunoCard } from "../shared/AlunoCard";
import { AlunoAvatar } from "../shared/AlunoAvatar";
import { NotaBar } from "../shared/NotaBar";
import { Pill } from "../shared/Pill";
import { SectionTitle } from "../shared/SectionTitle";
import { fmtKz, mediaNotas, notaColor, notaBg, presencaCor } from "../utils";

interface TabHomeProps {
  aluno:     Educando;
  notas:     Nota[];
  pagamentos: Pagamento[];
  presencas:  Presenca[];
  onNav:     (tab: TabId) => void;
}

export function TabHome({ aluno, notas, pagamentos, presencas, onNav }: TabHomeProps) {
  const med         = parseFloat(mediaNotas(notas));
  const pendentes   = pagamentos.filter(p => p.status === "pendente");
  const presencaAtual = presencas[0];
  const presencaPct = presencaAtual
    ? Math.round((presencaAtual.presentes / presencaAtual.total) * 100)
    : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Hero card */}
      <AlunoCard highlight style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ fontSize: 11, color: "#4b5563", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
              Ano Lectivo 2025–2026
            </p>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#f0fdf4", letterSpacing: "-0.02em", marginBottom: 8 }}>
              {aluno.nome.split(" ")[0]}
            </h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Pill label={aluno.classe} />
              <Pill label={`Turma ${aluno.turma}`} cor="#60a5fa" bg="#0a1020" />
            </div>
          </div>
          <AlunoAvatar initials={aluno.avatar} cor={aluno.cor} size={52} fontSize={16} />
        </div>

        {/* Mini stats */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12,
          marginTop: 20, paddingTop: 16,
          borderTop: "1px solid #1f4028",
        }}>
          {[
            { label: "Média",     valor: `${med}/20`,      cor: notaColor(med)                                          },
            { label: "Presença",  valor: `${presencaPct}%`, cor: presencaCor(presencaPct)                                },
            { label: "Pendentes", valor: pendentes.length,  cor: pendentes.length > 0 ? "#f87171" : "#4ade80" },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{
                fontSize: 20, fontWeight: 800,
                color: s.cor,
                fontFamily: "'DM Mono', monospace",
                letterSpacing: "-0.02em",
              }}>
                {s.valor}
              </div>
              <div style={{ fontSize: 10, color: "#4b5563", fontWeight: 700, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </AlunoCard>

      {/* Alerta de propina pendente */}
      {pendentes.length > 0 && (
        <div
          onClick={() => onNav("financeiro")}
          style={{
            display: "flex", alignItems: "center", gap: 12,
            background: "#1c0a0a",
            border: "1px solid #dc262633",
            borderLeft: "3px solid #f87171",
            borderRadius: 12, padding: "12px 14px",
            cursor: "pointer",
          }}
        >
          <AlertCircle size={18} color="#f87171" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fca5a5" }}>Propina pendente</div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>
              {pendentes[0].descricao} · {fmtKz(pendentes[0].valor)}
            </div>
          </div>
          <ChevronRight size={14} color="#4b5563" />
        </div>
      )}

      {/* Últimas 3 notas */}
      <div>
        <SectionTitle action="Ver todas" onAction={() => onNav("notas")}>
          Notas recentes
        </SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {notas.slice(0, 3).map(n => (
            <AlunoCard key={n.disciplina} style={{ padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{n.disciplina}</span>
                <div style={{
                  fontFamily: "'DM Mono', monospace", fontWeight: 800,
                  fontSize: 16, color: notaColor(n.nota),
                  background: notaBg(n.nota),
                  border: `1px solid ${notaColor(n.nota)}33`,
                  borderRadius: 8, padding: "2px 10px",
                }}>
                  {n.nota}
                </div>
              </div>
              <NotaBar nota={n.nota} max={n.max} />
            </AlunoCard>
          ))}
        </div>
      </div>

      {/* Presença do mês */}
      {presencaAtual && (
        <div>
          <SectionTitle>Presenças — {presencaAtual.mes}</SectionTitle>
          <AlunoCard style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <span style={{ fontSize: 28, fontWeight: 800, color: "#4ade80", fontFamily: "'DM Mono', monospace" }}>
                  {presencaAtual.presentes}
                </span>
                <span style={{ fontSize: 16, color: "#374151", fontFamily: "'DM Mono', monospace" }}>
                  /{presencaAtual.total}
                </span>
              </div>
              <Pill
                label={`${presencaAtual.faltas} falta${presencaAtual.faltas !== 1 ? "s" : ""}`}
                cor="#fbbf24" bg="#1a1500"
              />
            </div>
            <NotaBar nota={presencaAtual.presentes} max={presencaAtual.total} />
            <p style={{ fontSize: 11, color: "#374151", marginTop: 6 }}>
              {presencaPct}% de presença em {presencaAtual.mes}
            </p>
          </AlunoCard>
        </div>
      )}
    </div>
  );
}
