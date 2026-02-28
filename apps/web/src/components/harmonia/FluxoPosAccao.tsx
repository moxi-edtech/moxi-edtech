// apps/web/src/components/harmonia/FluxoPosAccao.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { PROXIMOS_PASSOS } from "./constants";
import { Passo, ContextoAcao } from "./types";

interface PassoCardProps {
  passo: Passo;
  onEscolher: (passo: Passo) => void;
  index: number;
}

function PassoCard({ passo, onEscolher, index }: PassoCardProps) {
  const [hover, setHover] = useState(false);

  return (
    <button
      onClick={() => onEscolher(passo)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onMouseDown={e => e.currentTarget.style.transform = "scale(0.97)"}
      onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
      style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "14px 16px",
        background: passo.destaque
          ? hover ? "#185830" : "#1f6b3b"
          : hover ? "#f8fafc" : "#fff",
        border: passo.destaque
          ? "none"
          : `1.5px solid ${hover ? "#1f6b3b" : "#e2e8f0"}`,
        borderRadius: 12,
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        transition: "all 0.15s",
        animation: "passIn 0.35s cubic-bezier(0.16,1,0.3,1) both",
        animationDelay: `${index * 60}ms`,
        fontFamily: "'DM Sans', system-ui, sans-serif",
        boxShadow: passo.destaque ? "0 4px 12px #1f6b3b33" : "none",
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: passo.destaque ? "#ffffff18" : "#f0fdf4",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 15,
        color: passo.destaque ? "#fff" : "#1f6b3b",
      }}>
        {passo.icone}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 700,
          color: passo.destaque ? "#fff" : "#1e293b",
          marginBottom: 2,
        }}>
          {passo.label}
        </div>
        <div style={{
          fontSize: 11,
          color: passo.destaque ? "#86efac" : "#94a3b8",
        }}>
          {passo.desc}
        </div>
      </div>

      <div style={{
        fontSize: 14,
        color: passo.destaque ? "#86efac" : "#cbd5e1",
        transition: "transform 0.15s",
        transform: hover ? "translateX(3px)" : "none",
      }}>→</div>
    </button>
  );
}

interface FluxoPosAccaoProps {
  acaoId: string;
  contexto: ContextoAcao;
  onEscolher: (passo: Passo, contexto: ContextoAcao) => void;
  onDismiss: () => void;
}

export default function FluxoPosAccao({ acaoId, contexto, onEscolher, onDismiss }: FluxoPosAccaoProps) {
  const [visivel, setVisivel] = useState(false);
  const config = PROXIMOS_PASSOS[acaoId];

  useEffect(() => {
    if (config) {
      const t = setTimeout(() => setVisivel(true), 80);
      return () => clearTimeout(t);
    }
  }, [config]);

  const handleDismiss = useCallback(() => {
    setVisivel(false);
    setTimeout(onDismiss, 300);
  }, [onDismiss]);

  const handleEscolher = useCallback((passo: Passo) => {
    setVisivel(false);
    setTimeout(() => onEscolher(passo, contexto), 200);
  }, [onEscolher, contexto]);

  if (!config) return null;

  return (
    <div style={{
      opacity: visivel ? 1 : 0,
      transform: visivel ? "translateY(0)" : "translateY(12px)",
      transition: "opacity 0.3s ease, transform 0.3s cubic-bezier(0.16,1,0.3,1)",
    }}>
      <div style={{
        background: "#fff",
        border: "1.5px solid #e2e8f0",
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 8px 32px #0000000f",
      }}>
        <div style={{
          padding: "16px 20px",
          background: "#f0fdf4",
          borderBottom: "1px solid #dcfce7",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "#1f6b3b",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, color: "#fff", fontWeight: 700,
              boxShadow: "0 2px 8px #1f6b3b44",
            }}>✓</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1f6b3b" }}>
                {config.titulo}
              </div>
              <div style={{ fontSize: 11, color: "#4ade80" }}>
                {config.subtitulo(contexto)}
              </div>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            style={{
              background: "none", border: "none",
              color: "#86efac", cursor: "pointer",
              fontSize: 18, padding: 4, lineHeight: 1,
            }}
          >×</button>
        </div>

        <div style={{ padding: "16px" }}>
          <div style={{
            fontSize: 10, color: "#94a3b8",
            textTransform: "uppercase", letterSpacing: "0.1em",
            fontWeight: 600, marginBottom: 12,
          }}>
            O que fazer a seguir?
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {config.passos.map((passo, i) => (
              <PassoCard
                key={passo.id}
                passo={passo}
                onEscolher={handleEscolher}
                index={i}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
