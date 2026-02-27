"use client"

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react"
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Info,
  Loader2,
  RefreshCw,
  WifiOff,
  X,
  Zap,
} from "lucide-react"

const K = {
  green: "#1F6B3B",
  rose: "#e11d48",
  amber: "#E3B23C",
  slate9: "#94a3b8",
}

export type ToastVariant = "success" | "error" | "warning" | "info" | "offline" | "syncing"

export type Toast = {
  id: string
  variant: ToastVariant
  title: string
  message?: string
  action?: { label: string; onClick: () => void }
  duration?: number
  icon?: React.ReactNode
}

type ToastAction =
  | { type: "ADD"; toast: Toast }
  | { type: "REMOVE"; id: string }
  | { type: "CLEAR" }

const ToastCtx = createContext<{
  toasts: Toast[]
  toast: (opts: Omit<Toast, "id">) => string
  dismiss: (id: string) => void
  clear: () => void
} | null>(null)

function toastReducer(state: Toast[], action: ToastAction): Toast[] {
  switch (action.type) {
    case "ADD":
      return [...state.filter((t) => t.id !== action.toast.id), action.toast]
    case "REMOVE":
      return state.filter((t) => t.id !== action.id)
    case "CLEAR":
      return []
    default:
      return state
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, dispatch] = useReducer(toastReducer, [])

  const toast = useCallback((opts: Omit<Toast, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`
    dispatch({ type: "ADD", toast: { ...opts, id } })
    return id
  }, [])

  const dismiss = useCallback((id: string) => {
    dispatch({ type: "REMOVE", id })
  }, [])

  const clear = useCallback(() => dispatch({ type: "CLEAR" }), [])

  return (
    <ToastCtx.Provider value={{ toasts, toast, dismiss, clear }}>
      <OfflineBanner />
      {children}
      <ToastStack />
    </ToastCtx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error("useToast precisa de ToastProvider")

  return {
    ...ctx,
    success: (title: string, message?: string, action?: Toast["action"]) =>
      ctx.toast({ variant: "success", title, message, action }),
    error: (title: string, message?: string, action?: Toast["action"]) =>
      ctx.toast({ variant: "error", title, message, action, duration: 0 }),
    warning: (title: string, message?: string, action?: Toast["action"]) =>
      ctx.toast({ variant: "warning", title, message, action }),
    offline: () =>
      ctx.toast({
        variant: "offline",
        duration: 0,
        title: "Sem ligação",
        message: "As alterações ficam guardadas e serão enviadas quando a rede voltar.",
        icon: <WifiOff size={16} />,
      }),
    syncing: (label = "A sincronizar...") =>
      ctx.toast({ variant: "syncing", duration: 0, title: label }),
    synced: (label = "Sincronizado.") =>
      ctx.toast({ variant: "success", title: label, duration: 2000 }),
  }
}

const TOAST_CONFIG: Record<
  ToastVariant,
  { bg: string; border: string; icon: React.ReactNode; textColor: string }
> = {
  success: {
    bg: K.green,
    border: K.green,
    icon: <CheckCircle2 size={16} />,
    textColor: "text-white",
  },
  error: {
    bg: K.rose,
    border: K.rose,
    icon: <AlertCircle size={16} />,
    textColor: "text-white",
  },
  warning: {
    bg: K.amber,
    border: K.amber,
    icon: <AlertTriangle size={16} />,
    textColor: "text-white",
  },
  info: {
    bg: K.slate9,
    border: K.slate9,
    icon: <Info size={16} />,
    textColor: "text-slate-900",
  },
  offline: {
    bg: K.slate9,
    border: K.slate9,
    icon: <WifiOff size={16} />,
    textColor: "text-slate-900",
  },
  syncing: {
    bg: K.slate9,
    border: K.slate9,
    icon: <Loader2 size={16} className="animate-spin" />,
    textColor: "text-slate-900",
  },
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const cfg = TOAST_CONFIG[toast.variant]
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const duration = toast.duration ?? 4000
    if (duration === 0) return
    timerRef.current = setTimeout(onDismiss, duration)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [toast.id, toast.duration, onDismiss])

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex items-start gap-3 rounded-xl px-4 py-3 shadow-xl
        animate-in slide-in-from-bottom-2 duration-200 min-w-[280px] max-w-sm"
      style={{ backgroundColor: cfg.bg }}
    >
      <span className={`flex-shrink-0 mt-0.5 ${cfg.textColor}`}>
        {toast.icon ?? cfg.icon}
      </span>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold ${cfg.textColor}`}>{toast.title}</p>
        {toast.message && (
          <p className={`text-xs mt-0.5 opacity-80 ${cfg.textColor}`}>{toast.message}</p>
        )}
        {toast.action && (
          <button
            onClick={toast.action.onClick}
            className={`mt-2 text-xs font-bold underline underline-offset-2 ${cfg.textColor} opacity-90 hover:opacity-100`}
          >
            {toast.action.label} →
          </button>
        )}
      </div>

      <button
        onClick={onDismiss}
        className={`flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity ${cfg.textColor}`}
        aria-label="Fechar"
      >
        <X size={14} />
      </button>
    </div>
  )
}

function ToastStack() {
  const { toasts, dismiss } = useContext(ToastCtx)!

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 items-end"
      aria-label="Notificações"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  )
}

export type SyncStatus = "idle" | "syncing" | "synced" | "error" | "offline"

export function SyncIndicator({
  status,
  label,
  compact = false,
}: {
  status: SyncStatus
  label?: string
  compact?: boolean
}) {
  if (status === "idle") return null

  const config = {
    syncing: {
      icon: <Loader2 size={11} className="animate-spin" />,
      color: "text-slate-400",
      text: "A guardar…",
    },
    synced: {
      icon: <CheckCircle2 size={11} />,
      color: "text-[#1F6B3B]",
      text: "Guardado",
    },
    error: {
      icon: <AlertCircle size={11} />,
      color: "text-rose-600",
      text: "Falhou",
    },
    offline: {
      icon: <WifiOff size={11} />,
      color: "text-[#E3B23C]",
      text: "Offline",
    },
  }[status]

  if (compact) {
    return <span className={config.color} title={label ?? config.text}>{config.icon}</span>
  }

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${config.color}`}>
      {config.icon}
      {label ?? config.text}
    </span>
  )
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p className="flex items-center gap-1 text-xs text-rose-600 mt-1 font-medium">
      <AlertCircle size={11} className="flex-shrink-0" />
      {message}
    </p>
  )
}

export function OfflineBanner() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const onOffline = () => setOffline(true)
    const onOnline = () => setOffline(false)
    window.addEventListener("offline", onOffline)
    window.addEventListener("online", onOnline)
    setOffline(!navigator.onLine)
    return () => {
      window.removeEventListener("offline", onOffline)
      window.removeEventListener("online", onOnline)
    }
  }, [])

  if (!offline) return null

  return (
    <div
      className="fixed top-0 inset-x-0 z-[300] bg-[#E3B23C] text-white text-xs font-semibold
      flex items-center justify-center gap-2 py-2 px-4 animate-in slide-in-from-top duration-200"
    >
      <WifiOff size={13} />
      Sem ligação à internet — as alterações serão guardadas quando a rede voltar
    </div>
  )
}

export type AlertSeverity = "critical" | "warning" | "info"

export type OperationalAlert = {
  id: string
  severity: AlertSeverity
  categoria: "financeiro" | "academico" | "sistema" | "documentos"
  titulo: string
  descricao: string
  count?: number
  link?: string
  link_label?: string
  desde?: string
}

function AlertCard({ alert }: { alert: OperationalAlert }) {
  const cfg = {
    critical: {
      border: "border-rose-200",
      bg: "bg-rose-50",
      icon: <AlertCircle size={16} className="text-rose-600 flex-shrink-0 mt-0.5" />,
      badge: "bg-rose-100 text-rose-700",
      count: "text-rose-600",
    },
    warning: {
      border: "border-[#E3B23C]/25",
      bg: "bg-[#E3B23C]/10",
      icon: <AlertTriangle size={16} className="text-[#E3B23C] flex-shrink-0 mt-0.5" />,
      badge: "bg-[#E3B23C]/20 text-[#E3B23C]",
      count: "text-[#E3B23C]",
    },
    info: {
      border: "border-slate-200",
      bg: "bg-slate-50",
      icon: <Info size={16} className="text-slate-400 flex-shrink-0 mt-0.5" />,
      badge: "bg-slate-100 text-slate-400",
      count: "text-slate-400",
    },
  }[alert.severity]

  return (
    <div className={`flex items-start gap-3 rounded-xl border ${cfg.border} ${cfg.bg} px-4 py-3`}>
      {cfg.icon}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-bold text-slate-900">{alert.titulo}</p>
          {alert.count !== undefined && (
            <span className={`text-xs font-black px-1.5 py-0.5 rounded-full ${cfg.badge}`}>
              {alert.count}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5">{alert.descricao}</p>
      </div>
      {alert.link && (
        <a
          href={alert.link}
          className="flex items-center gap-1 flex-shrink-0 text-xs font-bold text-slate-700
            hover:text-slate-900 border border-slate-200 rounded-lg px-3 py-1.5 bg-white
            hover:border-slate-300 transition-colors"
        >
          {alert.link_label ?? "Ver"} <ArrowRight size={11} />
        </a>
      )}
    </div>
  )
}

export function RadarOperacional({
  alerts,
  loading = false,
  role = "secretaria",
}: {
  alerts: OperationalAlert[]
  loading?: boolean
  role?: "secretaria" | "admin" | "financeiro"
}) {
  const [collapsed, setCollapsed] = useState(false)
  const critical = alerts.filter((a) => a.severity === "critical")
  const warnings = alerts.filter((a) => a.severity === "warning")
  const infos = alerts.filter((a) => a.severity === "info")

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 size={14} className="animate-spin" /> A verificar pendências…
        </div>
      </div>
    )
  }

  if (alerts.length === 0) {
    return (
      <div
        className="flex items-center gap-3 rounded-2xl border border-[#1F6B3B]/20
        bg-[#1F6B3B]/5 px-5 py-4"
      >
        <CheckCircle2 size={18} className="text-[#1F6B3B] flex-shrink-0" />
        <div>
          <p className="text-sm font-bold text-[#1F6B3B]">Tudo em ordem</p>
          <p className="text-xs text-slate-500 mt-0.5">Sem pendências que precisem de atenção.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <Zap size={16} className="text-[#E3B23C]" />
            {critical.length > 0 && (
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </div>
          <span className="text-sm font-bold text-slate-900">
            {role === "admin" ? "Saúde do Sistema" : role === "financeiro" ? "Radar Financeiro" : "Radar de Atenção"}
          </span>
          <div className="flex items-center gap-1.5">
            {critical.length > 0 && (
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700">
                {critical.length} crítico{critical.length !== 1 ? "s" : ""}
              </span>
            )}
            {warnings.length > 0 && (
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-[#E3B23C]/20 text-[#E3B23C]">
                {warnings.length} alerta{warnings.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        <ChevronDown
          size={16}
          className={`text-slate-400 transition-transform ${collapsed ? "" : "rotate-180"}`}
        />
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-2 border-t border-slate-100">
          <div className="pt-3 space-y-2">
            {[...critical, ...warnings, ...infos].map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export type NotaStatus = "lancada" | "pendente" | "bloqueada"
export type FaltaRisco = "ok" | "atencao" | "critico"

export type DisciplinaBoletim = {
  id: string
  nome: string
  nota_t1?: number | null
  nota_t2?: number | null
  nota_t3?: number | null
  nota_final?: number | null
  faltas: number
  faltas_max: number
  status: NotaStatus
}

function FaltasIndicador({ faltas, max }: { faltas: number; max: number }) {
  if (max <= 0) {
    return (
      <div className="rounded-lg px-2.5 py-1.5 bg-slate-50">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-500">Sem dados de faltas</span>
          <span className="text-[10px] text-slate-400">0/0</span>
        </div>
      </div>
    )
  }

  const restantes = max - faltas
  const risco: FaltaRisco = restantes <= 0 ? "critico" : restantes <= 3 ? "atencao" : "ok"

  const cfg = {
    ok: { color: "text-[#1F6B3B]", bg: "bg-[#1F6B3B]/10", bar: "bg-[#1F6B3B]" },
    atencao: { color: "text-[#E3B23C]", bg: "bg-[#E3B23C]/10", bar: "bg-[#E3B23C]" },
    critico: { color: "text-rose-600", bg: "bg-rose-50", bar: "bg-rose-500" },
  }[risco]

  const pct = Math.min(Math.round((faltas / max) * 100), 100)

  return (
    <div className={`rounded-lg px-2.5 py-1.5 ${cfg.bg}`}>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-[10px] font-bold ${cfg.color}`}>
          {risco === "critico"
            ? "Limite atingido"
            : risco === "atencao"
              ? `${restantes} falta${restantes !== 1 ? "s" : ""} restante${restantes !== 1 ? "s" : ""}`
              : `${faltas} falta${faltas !== 1 ? "s" : ""}`}
        </span>
        <span className={`text-[10px] ${cfg.color} opacity-70`}>
          {faltas}/{max}
        </span>
      </div>
      <div className="h-1 w-full bg-white/60 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${cfg.bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function DisciplinaRow({
  d,
  trimestre,
}: {
  d: DisciplinaBoletim
  trimestre: 1 | 2 | 3 | "final"
}) {
  const nota =
    trimestre === "final"
      ? d.nota_final
      : trimestre === 1
        ? d.nota_t1
        : trimestre === 2
          ? d.nota_t2
          : d.nota_t3

  const notaColor =
    nota === null || nota === undefined
      ? "text-slate-400"
      : nota >= 10
        ? "text-[#1F6B3B] font-black"
        : nota >= 8
          ? "text-[#E3B23C] font-bold"
          : "text-rose-600 font-bold"

  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{d.nome}</p>
        <div className="mt-1.5">
          <FaltasIndicador faltas={d.faltas} max={d.faltas_max} />
        </div>
      </div>
      <div className="flex-shrink-0 text-right">
        {nota !== null && nota !== undefined ? (
          <span className={`text-lg ${notaColor}`}>{nota}</span>
        ) : (
          <span className="text-sm text-slate-300 font-medium">—</span>
        )}
        {d.status === "pendente" && (
          <p className="text-[9px] text-[#E3B23C] font-bold uppercase mt-0.5">Pendente</p>
        )}
        {d.status === "bloqueada" && (
          <p className="text-[9px] text-rose-500 font-bold uppercase mt-0.5">Bloqueada</p>
        )}
      </div>
    </div>
  )
}

export function BoletimAluno({
  disciplinas,
  trimestre = 1,
  nomeAluno,
}: {
  disciplinas: DisciplinaBoletim[]
  trimestre?: 1 | 2 | 3 | "final"
  nomeAluno?: string
}) {
  const [tab, setTab] = useState<1 | 2 | 3 | "final">(trimestre)

  const tabs: Array<{ id: 1 | 2 | 3 | "final"; label: string }> = [
    { id: 1, label: "1º Trim." },
    { id: 2, label: "2º Trim." },
    { id: 3, label: "3º Trim." },
    { id: "final", label: "Final" },
  ]

  const aprovadas = disciplinas.filter((d) => {
    const n =
      tab === "final"
        ? d.nota_final
        : tab === 1
          ? d.nota_t1
          : tab === 2
            ? d.nota_t2
            : d.nota_t3
    return n !== null && n !== undefined && n >= 10
  }).length
  const reprovadas = disciplinas.filter((d) => {
    const n =
      tab === "final"
        ? d.nota_final
        : tab === 1
          ? d.nota_t1
          : tab === 2
            ? d.nota_t2
            : d.nota_t3
    return n !== null && n !== undefined && n < 10
  }).length

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="bg-[#1F6B3B] px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-white/60 font-medium uppercase tracking-wide">Boletim</p>
            <p className="text-base font-black text-white mt-0.5">{nomeAluno ?? "Aluno"}</p>
          </div>
          <div className="flex items-center gap-3">
            {aprovadas > 0 && (
              <div className="text-center">
                <p className="text-lg font-black text-white">{aprovadas}</p>
                <p className="text-[9px] text-white/60 font-bold uppercase">Aprov.</p>
              </div>
            )}
            {reprovadas > 0 && (
              <div className="text-center">
                <p className="text-lg font-black text-rose-300">{reprovadas}</p>
                <p className="text-[9px] text-rose-300/70 font-bold uppercase">Reprov.</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 mt-4 bg-white/10 rounded-xl p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all
                ${tab === t.id ? "bg-white text-[#1F6B3B]" : "text-white/70 hover:text-white"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5">
        {disciplinas.map((d) => (
          <DisciplinaRow key={d.id} d={d} trimestre={tab} />
        ))}
      </div>
    </div>
  )
}

export function Skeleton({
  className = "",
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) {
  return <div className={`animate-pulse rounded-lg bg-slate-100 ${className}`} style={style} />
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-0 divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-4">
          <Skeleton className="h-4 w-4 rounded" />
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton
              key={j}
              className="h-4"
              style={{ width: `${[40, 20, 15, 25][j % 4]}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  )
}

export function OperationProgress({
  label,
  current,
  total,
  status = "running",
}: {
  label: string
  current: number
  total: number
  status?: "running" | "done" | "error"
}) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0

  const cfg = {
    running: { bar: "bg-[#E3B23C]", icon: <Loader2 size={14} className="animate-spin text-[#E3B23C]" /> },
    done: { bar: "bg-[#1F6B3B]", icon: <CheckCircle2 size={14} className="text-[#1F6B3B]" /> },
    error: { bar: "bg-rose-500", icon: <AlertCircle size={14} className="text-rose-600" /> },
  }[status]

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 space-y-3">
      <div className="flex items-center gap-2">
        {cfg.icon}
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        <span className="ml-auto text-xs font-bold text-slate-500">
          {current}/{total}
        </span>
      </div>
      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${cfg.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {status === "running" && (
        <p className="text-[11px] text-slate-400">A processar… pode navegar noutras abas.</p>
      )}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {icon && (
        <div className="mb-4 p-4 rounded-2xl bg-slate-100 text-slate-400">
          {icon}
        </div>
      )}
      <p className="text-sm font-bold text-slate-700">{title}</p>
      {description && (
        <p className="text-xs text-slate-400 mt-1 max-w-xs">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 rounded-xl bg-[#E3B23C] px-5 py-2 text-sm font-bold text-white
            hover:brightness-95 transition-all active:scale-95"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

export function ErrorState({
  title = "Não foi possível carregar",
  description,
  onRetry,
}: {
  title?: string
  description?: string
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="mb-4 p-4 rounded-2xl bg-rose-50 text-rose-400">
        <AlertCircle size={24} />
      </div>
      <p className="text-sm font-bold text-slate-700">{title}</p>
      {description && (
        <p className="text-xs text-slate-400 mt-1 max-w-xs">{description}</p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200
            px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <RefreshCw size={13} /> Tentar novamente
        </button>
      )}
    </div>
  )
}
