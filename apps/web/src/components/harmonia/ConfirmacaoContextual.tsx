// apps/web/src/components/harmonia/ConfirmacaoContextual.tsx
"use client";

import React, { useState, useEffect } from "react";
import { PROXIMOS_PASSOS } from "./constants";
import { ContextoAcao } from "./types";

interface ConfirmacaoContextualProps {
  acaoId: string;
  contexto: ContextoAcao;
  onClose: () => void;
}

export default function ConfirmacaoContextual({ acaoId, contexto, onClose }: ConfirmacaoContextualProps) {
  const config = PROXIMOS_PASSOS[acaoId];
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setSaindo(true);
      setTimeout(onClose, 300);
    }, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  if (!config) return null;

  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24,
      background: "#1f6b3b",
      borderRadius: 14,
      padding: "14px 18px",
      display: "flex", alignItems: "center", gap: 12,
      boxShadow: "0 8px 24px #1f6b3b44",
      zIndex: 999,
      maxWidth: 340,
      opacity: saindo ? 0 : 1,
      transform: saindo ? "translateY(8px)" : "translateY(0)",
      transition: "opacity 0.3s ease, transform 0.3s ease",
      animation: "toastIn 0.3s cubic-bezier(0.16,1,0.3,1)",
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        background: "#ffffff18",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, color: "#fff", flexShrink: 0,
      }}>✓</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 }}>
          {config.titulo}
        </div>
        <div style={{
          fontSize: 11, color: "#86efac",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {config.subtitulo(contexto)}
        </div>
      </div>
      <button onClick={() => { setSaindo(true); setTimeout(onClose, 300); }} style={{
        background: "none", border: "none",
        color: "#86efac", cursor: "pointer",
        fontSize: 16, padding: 4, flexShrink: 0,
      }}>×</button>
    </div>
  );
}
