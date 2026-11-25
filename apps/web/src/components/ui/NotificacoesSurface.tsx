"use client";

import { useEffect, useId, useRef, useState, type ComponentType, type RefObject } from "react";
import { AlertTriangle, Bell, CheckCheck, Info, X, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { Notificacao, Prioridade } from "@/hooks/useNotificacoes";

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
    dot: "bg-amber",
    bg: "bg-amber/10",
    text: "text-foreground",
  },
  urgente: {
    icon: Zap,
    dot: "bg-destructive",
    bg: "bg-destructive/10",
    text: "text-foreground",
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

function NotificacaoItem({ notificacao, onClick }: { notificacao: Notificacao; onClick: () => void }) {
  const cfg = PRIORIDADE_CONFIG[notificacao.prioridade] ?? PRIORIDADE_CONFIG.info;
  const Icon = cfg.icon;
  return (
    <li className="border-b border-border last:border-0">
      <button type="button" onClick={onClick}
        className={`relative flex w-full min-w-0 items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-klasse-gold ${notificacao.lida ? "text-muted-foreground" : "text-foreground"}`}>
        <span className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${cfg.bg}`}>
          <Icon size={17} className={cfg.text} aria-hidden="true"/>
          {!notificacao.lida && <span className={`absolute -left-1 -top-1 h-2 w-2 rounded-full ${cfg.dot}`} aria-hidden="true"/>}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block break-words text-sm font-semibold leading-snug md:text-xs">{notificacao.titulo}{!notificacao.lida && <span className="sr-only"> · Não lida</span>}</span>
          {notificacao.corpo && <span className="mt-1 block whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground md:line-clamp-2 md:text-xs">{notificacao.corpo}</span>}
          <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{formatRelativo(notificacao.created_at)}</span>
            {notificacao.action_label && <span className="break-words font-semibold text-klasse-green dark:text-foreground">{notificacao.action_label} →</span>}
          </span>
        </span>
      </button>
    </li>
  );
}

type Props = {
  triggerRef: RefObject<HTMLButtonElement | null>;
  notificacoes: Notificacao[];
  naoLidas: number;
  loading: boolean;
  onLida: (id: string) => void | Promise<void>;
  onTodasLidas: () => void | Promise<void>;
  onAction: (notificacao: Notificacao) => void;
};

/** Single surface: a portal-backed modal sheet on mobile, anchored dropdown on desktop. */
export function NotificacoesSurface({ triggerRef, notificacoes, naoLidas, loading, onLida, onTodasLidas, onAction }: Props) {
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const desktopClose = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(true);
  const panelId = useId();
  const titleId = useId();

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const change = () => { setOpen(false); setMobile(mq.matches); };
    setMobile(mq.matches);
    mq.addEventListener("change", change);
    return () => mq.removeEventListener("change", change);
  }, []);

  function closeDesktop(focus = false) {
    setOpen(false);
    if (focus) requestAnimationFrame(() => triggerRef.current?.focus());
  }

  useEffect(() => {
    if (!open || mobile) return;
    desktopClose.current?.focus();
    const outside = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); triggerRef.current?.focus(); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open, mobile, triggerRef]);

  function activate(notification: Notificacao) {
    if (notification.action_url || notification.tipo === "A" || notification.modal_id) {
      restoreFocus.current = false;
      setOpen(false);
      onAction(notification);
    } else {
      void onLida(notification.id);
    }
  }

  const content = (isMobile: boolean) => <>
    <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-4 py-3">
      <div className="min-w-0">
        {isMobile ? <DialogTitle id={titleId} className="text-lg font-semibold text-klasse-green dark:text-foreground">Notificações</DialogTitle> : <h2 id={titleId} className="text-sm font-semibold text-foreground">Notificações</h2>}
        {isMobile && <DialogDescription className="sr-only">Consulte as suas notificações e avisos.</DialogDescription>}
        {naoLidas > 0 && <p className="mt-1 text-xs font-medium text-muted-foreground">{naoLidas} por ler</p>}
      </div>
      <button ref={isMobile ? undefined : desktopClose} type="button" aria-label="Fechar notificações"
        onClick={() => isMobile ? setOpen(false) : closeDesktop(true)}
        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20">
        <X size={18} aria-hidden="true"/>
      </button>
    </div>
    {naoLidas > 0 && <div className="flex shrink-0 justify-end border-b border-border px-4 py-1">
      <button type="button" onClick={() => void onTodasLidas()} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-xs font-semibold text-klasse-green hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 dark:text-foreground">
        <CheckCheck size={16} aria-hidden="true"/> Marcar todas como lidas
      </button>
    </div>}
    <div aria-busy={loading} className={`min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain ${isMobile ? "" : "max-h-[min(24rem,calc(100dvh-12rem))]"}`}>
      {loading ? <p role="status" className="px-4 py-10 text-center text-sm text-muted-foreground">A carregar notificações…</p>
        : notificacoes.length === 0 ? <div className="px-4 py-12 text-center"><Bell size={26} className="mx-auto mb-3 text-muted-foreground" aria-hidden="true"/><p className="text-sm font-semibold text-muted-foreground">Nenhuma notificação</p></div>
        : <ul aria-label="Lista de notificações">{notificacoes.map(n => <NotificacaoItem key={n.id} notificacao={n} onClick={() => activate(n)}/>)}</ul>}
    </div>
    <div className={`shrink-0 border-t border-border bg-card px-4 pt-2 text-center text-xs text-muted-foreground ${isMobile ? "pb-[max(0.75rem,env(safe-area-inset-bottom))]" : "pb-2"}`}>
      {notificacoes.length > 0 ? "Últimas 50 notificações" : "As novas notificações aparecem aqui."}
    </div>
  </>;

  return <div ref={ref} className="relative">
    <button ref={triggerRef} type="button" onClick={() => {
      restoreFocus.current = true;
      setMobile(window.matchMedia("(max-width: 767px)").matches);
      setOpen(previous => !previous);
    }} className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 md:h-10 md:w-10"
      aria-label={naoLidas > 0 ? `Notificações, ${naoLidas} por ler` : "Notificações"} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? panelId : undefined}>
      <Bell size={18} className="text-muted-foreground" aria-hidden="true"/>
      {naoLidas > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full border-2 border-card bg-destructive px-0.5 text-[10px] font-bold text-white">{naoLidas > 9 ? "9+" : naoLidas}</span>}
    </button>

    {mobile ? <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent id={panelId} layout="bottom-sheet" closeButton={false} overlayClassName="bg-black/40"
        aria-modal="true" aria-labelledby={titleId} onCloseAutoFocus={event => {
          event.preventDefault();
          if (restoreFocus.current) requestAnimationFrame(() => triggerRef.current?.focus());
        }}>
        {content(true)}
      </DialogContent>
    </Dialog> : open && <div id={panelId} role="dialog" aria-labelledby={titleId}
      className="absolute right-0 top-full z-50 mt-2 flex w-80 max-w-[calc(100vw-2rem)] min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
      {content(false)}
    </div>}
  </div>;
}
