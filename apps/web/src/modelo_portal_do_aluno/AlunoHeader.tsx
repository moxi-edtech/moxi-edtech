// src/components/aluno/layout/AlunoHeader.tsx
'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import type { Educando, TabId } from "../types";
import { shortSchoolName } from "../utils";

const TAB_LABELS: Record<TabId, string> = {
  home:          "Início",
  notas:         "Notas",
  financeiro:    "Financeiro",
  documentos:    "Documentos",
  notificacoes:  "Avisos",
};

interface AlunoHeaderProps {
  escolaNome:  string | null;
  educandos:   Educando[];
  alunoActivo: Educando;
  tabActiva:   TabId;
  onSwitchAluno: (aluno: Educando) => void;
  onBack:      () => void;
}

export function AlunoHeader({
  escolaNome,
  educandos,
  alunoActivo,
  tabActiva,
  onSwitchAluno,
  onBack,
}: AlunoHeaderProps) {
  const isHome = tabActiva === "home";
  const router = useRouter();
  const supabase = createClient();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (signingOut) return;
    try {
      setSigningOut(true);
      await supabase.auth.signOut();
      router.replace("/redirect");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 30,
      background: "#060d08cc",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      borderBottom: "1px solid #0f1a12",
      padding: "12px 16px",
    }}>
      {/* Linha principal */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>

        {/* Logo + escola */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: "linear-gradient(135deg, #1F6B3B, #2d9655)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 900, color: "#fff",
            boxShadow: "0 0 12px #1F6B3B44",
            flexShrink: 0,
          }}>KL</div>
          <div>
            <p style={{ fontSize: 9, color: "#374151", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Portal do Aluno
            </p>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af" }}>
              {shortSchoolName(escolaNome)}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Student switcher — só aparece se houver mais de 1 */}
          {educandos.length > 1 && (
            <div style={{ display: "flex", gap: 6 }}>
              {educandos.map(a => (
                <button
                  key={a.id}
                  onClick={() => onSwitchAluno(a)}
                  style={{
                    width: 34, height: 34, borderRadius: 10,
                    background: alunoActivo.id === a.id ? `${a.cor}22` : "#0f1a12",
                    border: `2px solid ${alunoActivo.id === a.id ? a.cor : "#1a2e1e"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 800,
                    color: alunoActivo.id === a.id ? a.cor : "#4b5563",
                    cursor: "pointer", transition: "all 0.15s",
                    fontFamily: "'DM Sans', system-ui",
                  }}
                >
                  {a.avatar}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            aria-label="Sair"
            style={{
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid #1a2e1e",
              background: "#0f1a12",
              color: "#9ca3af",
              fontSize: 11,
              fontWeight: 700,
              cursor: signingOut ? "not-allowed" : "pointer",
              opacity: signingOut ? 0.6 : 1,
              fontFamily: "'DM Sans', system-ui",
            }}
          >
            Sair
          </button>
        </div>
      </div>

      {/* Contexto da tab — só aparece fora da home */}
      {!isHome && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
          <button
            onClick={onBack}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#4b5563", padding: 0, lineHeight: 0 }}
            aria-label="Voltar"
          >
            <ArrowLeft size={16} />
          </button>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>
            {TAB_LABELS[tabActiva]}
          </span>
          <span style={{ fontSize: 11, color: "#374151" }}>
            · {alunoActivo.nome.split(" ")[0]}
          </span>
        </div>
      )}
    </header>
  );
}
