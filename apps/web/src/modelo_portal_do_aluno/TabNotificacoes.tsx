// src/components/aluno/tabs/TabNotificacoes.tsx
'use client';

import { useState } from "react";
import { BookOpen, CreditCard, Calendar, Bell } from "lucide-react";
import type { Notificacao } from "../types";
import { AlunoCard } from "../shared/AlunoCard";
import { Pill } from "../shared/Pill";

const TIPO_CONFIG = {
  nota:      { icon: BookOpen,   cor: "#c084fc", bg: "#150f20" },
  pagamento: { icon: CreditCard, cor: "#f87171", bg: "#1c0a0a" },
  evento:    { icon: Calendar,   cor: "#60a5fa", bg: "#0a1020" },
  aviso:     { icon: Bell,       cor: "#fbbf24", bg: "#1a1500" },
} as const;

interface TabNotificacoesProps {
  notificacoes:       Notificacao[];
  onMarcarLida?:      (id: string | number) => void;
  onMarcarTodasLidas?: () => void;
}

export function TabNotificacoes({
  notificacoes: notificacoesIniciais,
  onMarcarLida,
  onMarcarTodasLidas,
}: TabNotificacoesProps) {
  // Estado local para resposta imediata na UI
  // O componente pai pode sincronizar com o servidor via onMarcarLida
  const [notifs, setNotifs] = useState(notificacoesIniciais);

  const naoLidas = notifs.filter(n => !n.lida).length;

  const marcarLida = (id: string | number) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
    onMarcarLida?.(id);
  };

  const marcarTodas = () => {
    setNotifs(prev => prev.map(n => ({ ...n, lida: true })));
    onMarcarTodasLidas?.();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Header com badge + acção */}
      {naoLidas > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Pill
            label={`${naoLidas} não lida${naoLidas > 1 ? "s" : ""}`}
            cor="#fbbf24" bg="#1a1500"
          />
          <button
            onClick={marcarTodas}
            style={{
              fontSize: 11, color: "#4ade80",
              background: "none", border: "none",
              cursor: "pointer",
              fontFamily: "'DM Sans', system-ui",
              fontWeight: 600,
            }}
          >
            Marcar todas como lidas
          </button>
        </div>
      )}

      {/* Lista */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {notifs.map(n => {
          const cfg  = TIPO_CONFIG[n.tipo] ?? TIPO_CONFIG.aviso;
          const Icon = cfg.icon;

          return (
            <AlunoCard
              key={n.id}
              onClick={() => marcarLida(n.id)}
              style={{
                padding: "14px 16px",
                borderColor: !n.lida ? "#1f4028" : "#1a2e1e",
                background:  !n.lida ? "#0d1a10" : "#0f1a12",
              }}
            >
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>

                {/* Ícone do tipo */}
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: cfg.bg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <Icon size={15} color={cfg.cor} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{
                      fontSize: 13,
                      fontWeight: !n.lida ? 700 : 600,
                      color: !n.lida ? "#f0fdf4" : "#9ca3af",
                    }}>
                      {n.titulo}
                    </div>
                    {/* Indicador de não lida */}
                    {!n.lida && (
                      <div style={{
                        width: 7, height: 7, borderRadius: "50%",
                        background: "#4ade80", flexShrink: 0, marginTop: 3,
                        boxShadow: "0 0 6px #4ade80",
                      }} />
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "#4b5563", marginTop: 2 }}>
                    {n.desc}
                  </div>
                  <div style={{ fontSize: 10, color: "#1f2937", marginTop: 4, fontFamily: "'DM Mono', monospace" }}>
                    {n.tempo}
                  </div>
                </div>
              </div>
            </AlunoCard>
          );
        })}

        {/* Estado vazio */}
        {notifs.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 16px" }}>
            <Bell size={32} color="#1a2e1e" style={{ margin: "0 auto 12px" }} />
            <p style={{ fontSize: 13, color: "#374151" }}>Sem notificações</p>
          </div>
        )}
      </div>
    </div>
  );
}
