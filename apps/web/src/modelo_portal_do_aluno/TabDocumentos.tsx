// src/components/aluno/tabs/TabDocumentos.tsx
'use client';

import { FileText, Award, Star, ChevronRight, Zap } from "lucide-react";
import type { Documento } from "../types";
import { AlunoCard } from "../shared/AlunoCard";
import { Pill } from "../shared/Pill";

// Documentos padrão disponíveis para qualquer escola
const DOCUMENTOS_PADRAO: (Documento & { icon: React.ElementType })[] = [
  { titulo: "Declaração de Matrícula",   desc: "Ano 2025–2026 · Válida",     icon: FileText, pronto: true  },
  { titulo: "Boletim de Notas",          desc: "1.º Trimestre · Disponível", icon: Award,    pronto: true  },
  { titulo: "Boletim de Notas",          desc: "2.º Trimestre · Em curso",   icon: Award,    pronto: false },
  { titulo: "Declaração de Frequência",  desc: "Emissão em 24h",             icon: Star,     pronto: true  },
];

interface TabDocumentosProps {
  documentos?: (Documento & { icon?: React.ElementType })[];
  onDownload?: (doc: Documento) => void;
}

export function TabDocumentos({ documentos = DOCUMENTOS_PADRAO, onDownload }: TabDocumentosProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Info banner */}
      <AlunoCard style={{ background: "#0a1209", padding: "14px 16px" }}>
        <div style={{ display: "flex", gap: 10 }}>
          <Zap size={16} color="#4ade80" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
            Documentos gerados automaticamente. Declarações prontas em menos de 30 segundos.
          </p>
        </div>
      </AlunoCard>

      {/* Lista de documentos */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {documentos.map((doc, i) => {
          const Icon = doc.icon ?? FileText;
          return (
            <AlunoCard
              key={i}
              onClick={doc.pronto && onDownload ? () => onDownload(doc) : undefined}
              style={{
                padding: "14px 16px",
                opacity: doc.pronto ? 1 : 0.5,
                animationDelay: `${i * 40}ms`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: doc.pronto ? "#0a1f12" : "#111827",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <Icon size={18} color={doc.pronto ? "#4ade80" : "#374151"} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>
                    {doc.titulo}
                  </div>
                  <div style={{ fontSize: 11, color: "#374151", marginTop: 2 }}>
                    {doc.desc}
                  </div>
                </div>
                {doc.pronto
                  ? <ChevronRight size={16} color="#374151" />
                  : <Pill label="Em breve" cor="#4b5563" bg="#111827" />
                }
              </div>
            </AlunoCard>
          );
        })}
      </div>
    </div>
  );
}
