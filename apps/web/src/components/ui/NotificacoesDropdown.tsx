"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, Bell, CheckCheck, Info, X, Zap } from "lucide-react";
import { ModalShell } from "@/components/ui/ModalShell";
import {
  useNotificacoes,
  type Notificacao,
  type Prioridade,
} from "@/hooks/useNotificacoes";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildPortalHref, getEscolaParamFromPath } from "@/lib/navigation";

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
    dot: "bg-muted-foreground",
    bg: "bg-muted",
    text: "text-muted-foreground",
  },
  aviso: {
    icon: AlertTriangle,
    dot: "bg-[#E3B23C]",
    bg: "bg-[#E3B23C]/5",
    text: "text-[#9a7010] dark:text-[#E3B23C]",
  },
  urgente: {
    icon: Zap,
    dot: "bg-rose-500",
    bg: "bg-rose-500/10",
    text: "text-rose-600 dark:text-rose-400",
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
  onAction: (notificacao: Notificacao) => void;
}) {
  const cfg = PRIORIDADE_CONFIG[notificacao.prioridade];
  const Icon = cfg.icon;

  return (
    <div
      className={`relative flex gap-3 px-4 py-3 border-b border-border last:border-0 transition-colors cursor-pointer ${
        notificacao.lida ? "opacity-60 hover:opacity-80" : "hover:bg-muted"
      }`}
      onClick={() => {
        if (notificacao.action_url || notificacao.tipo === "A" || notificacao.modal_id) {
          onAction(notificacao);
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
            notificacao.lida ? "text-muted-foreground" : "text-foreground"
          }`}
        >
          {notificacao.titulo}
        </p>
        {notificacao.corpo && (
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
            {notificacao.corpo}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] text-muted-foreground">{formatRelativo(notificacao.created_at)}</span>
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
  const pathname = usePathname();
  const { escolaId, escolaSlug } = useEscolaId();
  const escolaParam = getEscolaParamFromPath(pathname) ?? escolaSlug ?? escolaId;
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [modalNotificacao, setModalNotificacao] = useState<Notificacao | null>(null);

  const { notificacoes, naoLidas, loading, marcarLida, marcarTodasLidas } = useNotificacoes();
  const resolveActionUrl = (actionUrl: string) => {
    if (/^\/(aluno|professor)(\/|$)/.test(actionUrl)) {
      return buildPortalHref(escolaParam, actionUrl);
    }
    return actionUrl;
  };

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleAction = (notificacao: Notificacao) => {
    if (notificacao.tipo === "A" || notificacao.modal_id) {
      setModalNotificacao(notificacao);
      setOpen(false);
      return;
    }

    if (notificacao.action_url) {
      marcarLida(notificacao.id);
      setOpen(false);
      router.push(resolveActionUrl(notificacao.action_url));
      return;
    }

    marcarLida(notificacao.id);
    setOpen(false);
  };

  const handleModalAction = () => {
    if (!modalNotificacao) return;
    marcarLida(modalNotificacao.id);
    const actionUrl = modalNotificacao.action_url;
    setModalNotificacao(null);
    if (actionUrl) {
      router.push(resolveActionUrl(actionUrl));
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex items-center justify-center h-10 w-10 rounded-xl border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label="Notificações"
      >
        <Bell size={16} />
        {naoLidas > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center border-2 border-background">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-1/2 top-11 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl overflow-hidden animate-in slide-in-from-top-2 duration-150 sm:left-auto sm:right-0 sm:w-80 sm:translate-x-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black text-foreground uppercase tracking-wider">Notificações</h3>
              {naoLidas > 0 && (
                <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[9px] font-black text-rose-600 dark:text-rose-400">
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
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center">
                <div className="h-4 w-32 bg-muted animate-pulse rounded-full mx-auto" />
              </div>
            ) : notificacoes.length === 0 ? (
              <div className="py-10 text-center">
                <Bell size={24} className="text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-xs font-semibold text-muted-foreground">Nenhuma notificação</p>
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
            <div className="px-4 py-2.5 border-t border-border bg-muted/40">
              <p className="text-[10px] text-muted-foreground text-center">Últimas 50 notificações</p>
            </div>
          )}
        </div>
      )}

      <ModalShell
        open={Boolean(modalNotificacao)}
        title={modalNotificacao?.titulo ?? "Notificação"}
        description={undefined}
        onClose={() => setModalNotificacao(null)}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalNotificacao(null)}
              className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Fechar
            </button>
            {modalNotificacao?.action_url && (
              <button
                type="button"
                onClick={handleModalAction}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                {modalNotificacao?.action_label || "Abrir"}
              </button>
            )}
          </div>
        }
      >
        <div className="space-y-2 text-sm text-muted-foreground">
          {modalNotificacao?.corpo ? <p>{modalNotificacao.corpo}</p> : null}
        </div>
      </ModalShell>
    </div>
  );
}
