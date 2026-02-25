"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bell, CheckCheck, Info, X, Zap } from "lucide-react";
import {
  useNotificacoes,
  type Notificacao,
  type Prioridade,
} from "@/hooks/useNotificacoes";

const PRIORIDADE_CONFIG: Record<
  Prioridade,
  {
    icon: ComponentType<{ size?: number; className?: string }>;
    dot: string;
    bg: string;
    text: string;
  }
> = {
  info: {
    icon: Info,
    dot: "bg-slate-400",
    bg: "bg-slate-50",
    text: "text-slate-600",
  },
  aviso: {
    icon: AlertTriangle,
    dot: "bg-[#E3B23C]",
    bg: "bg-[#E3B23C]/5",
    text: "text-[#9a7010]",
  },
  urgente: {
    icon: Zap,
    dot: "bg-rose-500",
    bg: "bg-rose-50",
    text: "text-rose-700",
  },
};

function formatRelativo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  const horas = Math.floor(diff / 3600000);
  const dias = Math.floor(diff / 86400000);

  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m`;
  if (horas < 24) return `${horas}h`;
  return `${dias}d`;
}

function NotificacaoItem({
  notificacao,
  onLida,
  onAction,
}: {
  notificacao: Notificacao;
  onLida: (id: string) => void;
  onAction: (url: string, id: string) => void;
}) {
  const cfg = PRIORIDADE_CONFIG[notificacao.prioridade];
  const Icon = cfg.icon;

  return (
    <div
      className={`relative flex gap-3 px-4 py-3 border-b border-slate-100 last:border-0 transition-colors cursor-pointer ${
        notificacao.lida ? "opacity-60 hover:opacity-80" : "hover:bg-slate-50"
      }`}
      onClick={() => {
        if (notificacao.action_url) {
          onAction(notificacao.action_url, notificacao.id);
        } else {
          onLida(notificacao.id);
        }
      }}
    >
      {!notificacao.lida && (
        <span className={`absolute left-2 top-4 h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      )}

      <div className={`flex-shrink-0 mt-0.5 h-8 w-8 rounded-xl flex items-center justify-center ${cfg.bg}`}>
        <Icon size={14} className={cfg.text} />
      </div>

      <div className="flex-1 min-w-0">
        <p
          className={`text-xs font-bold leading-tight ${
            notificacao.lida ? "text-slate-500" : "text-slate-800"
          }`}
        >
          {notificacao.titulo}
        </p>
        {notificacao.corpo && (
          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">
            {notificacao.corpo}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] text-slate-400">{formatRelativo(notificacao.created_at)}</span>
          {notificacao.action_label && (
            <span className={`text-[10px] font-bold ${cfg.text}`}>
              {notificacao.action_label} →
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function NotificacoesDropdown() {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const { notificacoes, naoLidas, loading, marcarLida, marcarTodasLidas } = useNotificacoes();

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleAction = (url: string, id: string) => {
    marcarLida(id);
    setOpen(false);
    router.push(url);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex items-center justify-center h-10 w-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
        aria-label="Notificações"
      >
        <Bell size={16} className="text-slate-600" />
        {naoLidas > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center border-2 border-white">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 overflow-hidden animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Notificações</h3>
              {naoLidas > 0 && (
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-black text-rose-700">
                  {naoLidas} novas
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {naoLidas > 0 && (
                <button
                  onClick={marcarTodasLidas}
                  className="flex items-center gap-1 text-[10px] font-bold text-[#1F6B3B] hover:underline"
                >
                  <CheckCheck size={11} />
                  Marcar todas
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center">
                <div className="h-4 w-32 bg-slate-100 animate-pulse rounded-full mx-auto" />
              </div>
            ) : notificacoes.length === 0 ? (
              <div className="py-10 text-center">
                <Bell size={24} className="text-slate-200 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-400">Nenhuma notificação</p>
              </div>
            ) : (
              notificacoes.map((n) => (
                <NotificacaoItem
                  key={n.id}
                  notificacao={n}
                  onLida={marcarLida}
                  onAction={handleAction}
                />
              ))
            )}
          </div>

          {notificacoes.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50">
              <p className="text-[10px] text-slate-400 text-center">Últimas 50 notificações</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
