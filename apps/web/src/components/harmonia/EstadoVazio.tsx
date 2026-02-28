// apps/web/src/components/harmonia/EstadoVazio.tsx
"use client";

import React from "react";
import { ESTADOS_VAZIOS } from "./constants";
import * as LucideIcons from "lucide-react";

interface EstadoVazioProps {
  tipo: string;
  onAcao?: (acaoId: string) => void;
}

export default function EstadoVazio({ tipo, onAcao }: EstadoVazioProps) {
  const config = ESTADOS_VAZIOS[tipo];
  if (!config) return null;

  // Resolve o ícone dinamicamente a partir do Lucide
  const IconComponent = (LucideIcons as any)[config.icone] || LucideIcons.HelpCircle;

  return (
    <div style={{
      padding: "48px 24px",
      textAlign: "center",
      animation: "fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
    }}>
      {/* Container do Ícone Premium */}
      <div style={{
        width: 64,
        height: 64,
        borderRadius: "50%",
        background: "#f8fafc", // Slate 50 (fundo quase branco)
        border: "1px solid #f1f5f9", // Slate 100
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 20,
        color: "#94a3b8", // Slate 400 para o ícone
        boxShadow: "inset 0 2px 4px rgba(0,0,0,0.02)"
      }}>
        <IconComponent size={28} strokeWidth={1.5} />
      </div>
      
      <div style={{ 
        fontSize: 15, 
        fontWeight: 700, 
        color: "#334155", // Slate 800 para o título
        marginBottom: 6,
        letterSpacing: "-0.01em"
      }}>
        {config.titulo}
      </div>
      
      <div style={{ 
        fontSize: 13, 
        color: "#64748b", // Slate 500 para a descrição
        marginBottom: config.acao ? 24 : 0,
        maxWidth: "260px",
        lineHeight: "1.6",
        fontWeight: 450
      }}>
        {config.desc}
      </div>

      {config.acao && (
        <button
          onClick={() => onAcao?.(config.acao!.id)}
          style={{
            padding: "10px 28px",
            background: "#1F6B3B", // Klasse Green
            border: "none", 
            borderRadius: 14,
            color: "#fff", 
            fontSize: 12, 
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "'DM Sans', system-ui, sans-serif",
            boxShadow: "0 10px 20px rgba(31, 107, 59, 0.15)",
            transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 15px 30px rgba(31, 107, 59, 0.2)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 10px 20px rgba(31, 107, 59, 0.15)";
          }}
        >
          {config.acao.label}
        </button>
      )}
    </div>
  );
}
