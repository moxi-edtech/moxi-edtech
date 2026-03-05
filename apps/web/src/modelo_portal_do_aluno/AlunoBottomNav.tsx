// src/components/aluno/layout/AlunoBottomNav.tsx
'use client';

import { Home, BookOpen, CreditCard, FileText, Bell } from "lucide-react";
import type { TabId } from "../types";

interface NavItem {
  id:    TabId;
  icon:  React.ElementType;
  label: string;
  badge?: number;
}

interface AlunoBottomNavProps {
  tabActiva:        TabId;
  onNav:            (tab: TabId) => void;
  notificacoesNaoLidas?: number;
}

export function AlunoBottomNav({ tabActiva, onNav, notificacoesNaoLidas = 0 }: AlunoBottomNavProps) {
  const tabs: NavItem[] = [
    { id: "home",         icon: Home,       label: "Início"   },
    { id: "notas",        icon: BookOpen,   label: "Notas"    },
    { id: "financeiro",   icon: CreditCard, label: "Financeiro" },
    { id: "documentos",   icon: FileText,   label: "Documentos" },
    { id: "notificacoes", icon: Bell,       label: "Avisos", badge: notificacoesNaoLidas },
  ];

  return (
    <nav style={{
      position: "fixed", bottom: 0,
      left: "50%", transform: "translateX(-50%)",
      width: "100%", maxWidth: 430,
      background: "#060d08ee",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      borderTop: "1px solid #0f1a12",
      padding: "8px 8px calc(8px + env(safe-area-inset-bottom))",
      display: "grid", gridTemplateColumns: "repeat(5, 1fr)",
      zIndex: 40,
    }}>
      {tabs.map(t => {
        const active = tabActiva === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onNav(t.id)}
            aria-label={t.label}
            aria-current={active ? "page" : undefined}
            style={{
              display: "flex", flexDirection: "column",
              alignItems: "center", gap: 4,
              padding: "8px 4px",
              background: "none", border: "none",
              cursor: "pointer", position: "relative",
              transition: "all 0.15s",
              fontFamily: "'DM Sans', system-ui",
            }}
          >
            {/* Indicador activo */}
            {active && (
              <div style={{
                position: "absolute", top: 0,
                left: "50%", transform: "translateX(-50%)",
                width: 20, height: 2, borderRadius: 2,
                background: "#4ade80",
                boxShadow: "0 0 8px #4ade80",
              }} />
            )}

            {/* Badge de notificações */}
            {(t.badge ?? 0) > 0 && (
              <div style={{
                position: "absolute", top: 4,
                right: "calc(50% - 18px)",
                width: 16, height: 16,
                borderRadius: "50%",
                background: "#dc2626",
                border: "2px solid #060d08",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 8, fontWeight: 800, color: "#fff",
              }}>
                {t.badge}
              </div>
            )}

            <t.icon
              size={20}
              color={active ? "#4ade80" : "#374151"}
              style={{
                filter: active ? "drop-shadow(0 0 6px #4ade8088)" : "none",
                transition: "all 0.15s",
              }}
            />
            <span style={{
              fontSize: 9,
              fontWeight: active ? 800 : 600,
              color: active ? "#4ade80" : "#374151",
              letterSpacing: "0.04em",
            }}>
              {t.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
