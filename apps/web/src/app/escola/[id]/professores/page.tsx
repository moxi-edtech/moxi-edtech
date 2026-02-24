"use client"

import React, { useEffect, useMemo, useState, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  UserPlusIcon,
  UsersIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline"
import {
  BookOpen, UserCheck, UserX, LayoutGrid, List,
  X, AlertCircle, CheckCircle2, ChevronLeft, RefreshCw,
} from "lucide-react"

// ─── Design tokens ────────────────────────────────────────────────────────────
//
//  GREEN  → hero identity + healthy states (ativo, compliance OK)
//  GOLD   → single primary CTA per tab + step active indicator
//  ROSE   → critical states + destructive actions
//  AMBER  → warning / pending states
//  SLATE  → chrome, secondary actions, pill tab active
//

// ─── Types ────────────────────────────────────────────────────────────────────

type Professor = {
  user_id:              string
  nome:                 string
  email:                string
  last_login:           string | null
  disciplinas?:         string[]
  disciplinas_ids?:     string[]
  teacher_id?:          string | null
  carga_horaria_maxima?: number | null
  turnos_disponiveis?:  Array<"Manhã" | "Tarde" | "Noite">
  telefone_principal?:  string | null
  habilitacoes?:        string | null
  area_formacao?:       string | null
  vinculo_contratual?:  string | null
  is_diretor_turma?:    boolean | null
  genero?:              string | null
  data_nascimento?:     string | null
  numero_bi?:           string | null
  atribuicoes?:         Array<{
    turma_id:              string
    turma_nome:            string | null
    disciplina_nome:       string | null
    carga_horaria_semanal: number | null
  }>
  carga_horaria_real?:  number | null
  compliance_status?:   string | null
  pendencias_total?:    number | null
}

import { PendenciaItem, PendenciaTipo, PendenciasResponse } from "~types/pendencia"

type PendenciasState = {
  loading: boolean
  error:   string | null
  data:    PendenciasResponse | null
}

type ToastState = { type: "success" | "error"; message: string } | null
type Tab        = "adicionar" | "atribuir" | "gerenciar"

// ─── Input / Select primitives ────────────────────────────────────────────────
// Single source for consistent focus ring across all form fields.

const inputCls = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#E3B23C] focus:ring-2 focus:ring-[#E3B23C]/20 transition-all placeholder:text-slate-400"
const selectCls = `${inputCls} cursor-pointer`

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onDismiss, 4000)
    return () => clearTimeout(t)
  }, [toast, onDismiss])

  if (!toast) return null
  return (
    <div className={`
      fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl
      text-sm font-semibold animate-in slide-in-from-bottom-2 duration-200
      ${toast.type === "success" ? "bg-[#1F6B3B] text-white" : "bg-rose-600 text-white"}
    `}>
      {toast.message}
      <button onClick={onDismiss} className="opacity-70 hover:opacity-100"><X size={14} /></button>
    </div>
  )
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({ open, message, loading, onConfirm, onCancel }: {
  open: boolean; message: string; loading: boolean
  onConfirm: () => void; onCancel: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 animate-in zoom-in-95 duration-150">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-slate-700">{message}</p>
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} disabled={loading}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-bold disabled:opacity-60 transition-colors hover:bg-rose-700">
            {loading ? "A remover…" : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Pill tabs ────────────────────────────────────────────────────────────────

function PillTabs({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "adicionar", label: "Adicionar",  icon: UserPlusIcon },
    { id: "atribuir",  label: "Atribuir",   icon: ClipboardDocumentListIcon },
    { id: "gerenciar", label: "Gerenciar",  icon: Cog6ToothIcon },
  ]
  return (
    <div className="inline-flex items-center gap-1 bg-slate-100 rounded-xl p-1">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button key={id} onClick={() => onChange(id)}
          className={`
            flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200
            ${active === id ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}
          `}>
          <Icon className="w-4 h-4" />
          {label}
        </button>
      ))}
    </div>
  )
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step, labels }: { step: number; labels: string[] }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {labels.map((label, idx) => (
        <React.Fragment key={label}>
          <div className="flex items-center gap-2">
            <span className={`
              flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold border transition-all
              ${step === idx
                ? "border-[#E3B23C] bg-[#E3B23C] text-white"
                : step > idx
                ? "border-[#1F6B3B] bg-[#1F6B3B]/10 text-[#1F6B3B]"
                : "border-slate-200 text-slate-400"}
            `}>
              {step > idx ? <CheckCircle2 size={12} /> : idx + 1}
            </span>
            <span className={`text-xs font-semibold hidden sm:block ${
              step === idx ? "text-[#E3B23C]" : step > idx ? "text-[#1F6B3B]" : "text-slate-400"
            }`}>
              {label}
            </span>
          </div>
          {idx < labels.length - 1 && (
            <div className={`h-px flex-1 transition-colors ${step > idx ? "bg-[#1F6B3B]/30" : "bg-slate-200"}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

// ─── Compliance badge ─────────────────────────────────────────────────────────

function ComplianceBadge({ status }: { status: string }) {
  const s = status.toUpperCase()
  const cfg = s === "CRITICAL"
    ? { label: "Crítico",  dot: "bg-rose-500",     text: "text-rose-600",    ring: "ring-rose-200" }
    : s === "PENDING_MAC"
    ? { label: "Pendente", dot: "bg-amber-400",    text: "text-amber-600",   ring: "ring-amber-200" }
    : { label: "OK",       dot: "bg-[#1F6B3B]",   text: "text-[#1F6B3B]",  ring: "ring-[#1F6B3B]/20" }

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ${cfg.ring} ${cfg.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

function PendenciasResumoBadge({ total }: { total: number }) {
  const hasPendencias = total > 0
  const cfg = hasPendencias
    ? { label: `Pendências: ${total}`, dot: "bg-amber-400", text: "text-amber-600", ring: "ring-amber-200" }
    : { label: "Sem pendências", dot: "bg-[#1F6B3B]", text: "text-[#1F6B3B]", ring: "ring-[#1F6B3B]/20" }

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ${cfg.ring} ${cfg.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

// ─── Status badge (pendências) ────────────────────────────────────────────────

function PendenciaBadge({ status, label, count, total }: {
  status: PendenciaTipo["status"]; label: string; count: number; total: number
}) {
  const cfg = status === "ok"
    ? { dot: "bg-[#1F6B3B]",  text: "text-[#1F6B3B]",  ring: "ring-[#1F6B3B]/20" }
    : status === "pendente"
    ? { dot: "bg-amber-400",   text: "text-amber-600",   ring: "ring-amber-200" }
    : status === "sem_avaliacao"
    ? { dot: "bg-rose-500",    text: "text-rose-600",    ring: "ring-rose-200" }
    : { dot: "bg-slate-400",   text: "text-slate-500",   ring: "ring-slate-200" }

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ${cfg.ring} ${cfg.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {label}{count > 0 ? ` ${count}/${total}` : " OK"}
    </span>
  )
}

// ─── Credentials banner ───────────────────────────────────────────────────────

function CredentialsBanner({ creds, onCopy, onDismiss }: {
  creds: { email: string; senha: string }
  onCopy: () => void
  onDismiss: () => void
}) {
  return (
    <div className="rounded-xl border border-[#1F6B3B]/20 bg-[#1F6B3B]/8 p-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-bold text-[#1F6B3B] text-xs uppercase tracking-wide">Credenciais geradas</p>
          <p className="text-slate-700">Email: <span className="font-mono font-semibold">{creds.email}</span></p>
          <p className="text-slate-700">Senha: <span className="font-mono font-semibold">{creds.senha}</span></p>
        </div>
        <button onClick={onDismiss} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
          <X size={14} />
        </button>
      </div>
      <button onClick={onCopy}
        className="mt-3 rounded-lg border border-[#1F6B3B]/30 bg-white px-3 py-1.5 text-xs font-bold text-[#1F6B3B] hover:bg-[#1F6B3B]/5 transition-colors">
        Copiar credenciais
      </button>
    </div>
  )
}

// ─── Prof detail drawer ───────────────────────────────────────────────────────
// Unified view: dados pessoais + formação + turmas + carga + pendências.
// Replaces the old standalone pendências drawer.

function ProfDetailDrawer({ prof, pendenciasState, onClose, onEdit }: {
  prof:            Professor
  pendenciasState: PendenciasState | undefined
  onClose:         () => void
  onEdit:          () => void
}) {
  const atribuicoes = prof.atribuicoes ?? []
  const cargaMax    = prof.carga_horaria_maxima ?? 0
  const cargaReal   = prof.carga_horaria_real   ?? 0
  const cargaPct    = cargaMax > 0 ? Math.min(Math.round((cargaReal / cargaMax) * 100), 100) : 0
  const cargaColor  = cargaReal > cargaMax ? "bg-rose-500"
    : cargaReal >= cargaMax * 0.8 ? "bg-amber-400"
    : "bg-[#1F6B3B]"

  const infoRows: Array<{ label: string; value: string | null | undefined }> = [
    { label: "BI",          value: prof.numero_bi },
    { label: "Telefone",    value: prof.telefone_principal },
    { label: "Nascimento",  value: prof.data_nascimento },
    { label: "Género",      value: prof.genero === "M" ? "Masculino" : prof.genero === "F" ? "Feminino" : null },
    { label: "Habilitações",value: prof.habilitacoes },
    { label: "Formação",    value: prof.area_formacao },
    { label: "Vínculo",     value: prof.vinculo_contratual },
    { label: "Turnos",      value: prof.turnos_disponiveis?.join(", ") || null },
  ]

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-slate-950/60 backdrop-blur-sm"
      onClick={onClose}>
      <div
        className="h-full w-full max-w-lg bg-white shadow-2xl overflow-y-auto animate-in slide-in-from-right-4 duration-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Drawer header — green identity ──────────────────────────────── */}
        <div className="bg-[#1F6B3B] px-6 pt-6 pb-5 flex-shrink-0">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-4">
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(prof.nome || prof.email)}&background=ffffff&color=1F6B3B&size=80`}
                alt={prof.nome}
                className="w-14 h-14 rounded-2xl border-2 border-white/30 flex-shrink-0"
              />
              <div className="min-w-0">
                <h2 className="text-lg font-black text-white truncate">{prof.nome || "Sem nome"}</h2>
                <p className="text-xs text-white/60 truncate mt-0.5">{prof.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    prof.last_login
                      ? "bg-white/20 text-white"
                      : "bg-amber-400/20 text-amber-200"
                  }`}>
                    {prof.last_login
                      ? <><UserCheck size={9} /> Ativo</>
                      : <><UserX size={9} /> Pendente</>
                    }
                  </span>
                  <ComplianceBadge status={prof.compliance_status ?? "OK"} />
                </div>
              </div>
            </div>
            <button onClick={onClose}
              className="p-2 rounded-xl bg-white/10 text-white/70 hover:text-white hover:bg-white/20 transition-colors flex-shrink-0 mt-0.5">
              <X size={17} />
            </button>
          </div>

          {/* Carga horária bar */}
          {cargaMax > 0 && (
            <div className="bg-white/10 rounded-xl p-3">
              <div className="flex justify-between text-[10px] font-bold text-white/70 mb-1.5">
                <span>Carga horária</span>
                <span className={cargaReal > cargaMax ? "text-rose-300" : cargaReal >= cargaMax * 0.8 ? "text-amber-300" : "text-white/80"}>
                  {cargaReal} / {cargaMax} tempos · {cargaPct}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${cargaColor}`} style={{ width: `${cargaPct}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Dados pessoais + formação */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
              Dados pessoais e formação
            </h3>
            <div className="rounded-xl border border-slate-200 bg-slate-50 divide-y divide-slate-100">
              {infoRows.filter((r) => r.value).map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs text-slate-400 font-medium">{label}</span>
                  <span className="text-xs font-semibold text-slate-700">{value}</span>
                </div>
              ))}
              {infoRows.every((r) => !r.value) && (
                <p className="px-4 py-3 text-xs text-slate-400">Sem dados registados.</p>
              )}
            </div>
          </section>

          {/* Turmas atribuídas */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
              Turmas e disciplinas ({atribuicoes.length})
            </h3>
            {atribuicoes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400">
                Sem turmas atribuídas.
              </div>
            ) : (
              <div className="space-y-2">
                {atribuicoes.map((a, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{a.turma_nome ?? "Turma"}</p>
                      <p className="text-[10px] text-slate-400 truncate">{a.disciplina_nome ?? "Disciplina"}</p>
                    </div>
                    {a.carga_horaria_semanal != null && (
                      <span className="text-[10px] font-bold text-slate-500 flex-shrink-0 ml-3">
                        {a.carga_horaria_semanal}t/sem
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Pendências de pauta */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
              Pendências de pauta
            </h3>
            {!pendenciasState || pendenciasState.loading ? (
              <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                <RefreshCw size={13} className="animate-spin" /> A carregar…
              </div>
            ) : pendenciasState.error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                {pendenciasState.error}
              </div>
            ) : !pendenciasState.data || pendenciasState.data.items.length === 0 ? (
              <div className="flex items-center gap-2 rounded-xl bg-[#1F6B3B]/8 border border-[#1F6B3B]/20 px-4 py-3">
                <CheckCircle2 size={15} className="text-[#1F6B3B] flex-shrink-0" />
                <p className="text-xs font-semibold text-[#1F6B3B]">Sem pendências no momento.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Summary strip */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Pendências",      value: pendenciasState.data.resumo.total_pendencias, color: "text-[#E3B23C]" },
                    { label: "Turmas afetadas", value: pendenciasState.data.resumo.turmas_afetadas,   color: "text-slate-700" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <p className="text-[9px] uppercase font-bold text-slate-400 mb-0.5">{label}</p>
                      <p className={`text-base font-black ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>
                {/* Items */}
                {pendenciasState.data.items.map((item) => (
                  <div key={item.turma_disciplina_id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-bold text-slate-900 mb-1">
                      {item.turma_nome ?? "Turma"} · {item.disciplina_nome ?? "Disciplina"}
                    </p>
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-semibold text-slate-500">
                        Trim. {item.trimestre ?? "—"}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-semibold text-slate-500">
                        {item.total_alunos} alunos
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {item.tipos.map((tipo) => (
                        <PendenciaBadge key={`${item.turma_disciplina_id}-${tipo.tipo}`}
                          status={tipo.status} label={tipo.tipo}
                          count={tipo.pendentes} total={item.total_alunos} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ── Footer actions ───────────────────────────────────────────────── */}
        <div className="flex-shrink-0 border-t border-slate-100 px-6 py-4 bg-slate-50 flex justify-between items-center">
          <button onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
            Fechar
          </button>
          <button onClick={() => { onClose(); onEdit() }}
            className="rounded-xl bg-[#E3B23C] px-5 py-2 text-sm font-bold text-white hover:brightness-95 transition-all active:scale-95">
            Editar professor
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Professor card (grid view) ──────────────────────────────────────────────

function ProfCard({ prof, onView, onEdit, onResend, onReset }: {
  prof:    Professor
  onView:  () => void
  onEdit:  () => void
  onResend: () => void
  onReset:  () => void
}) {
  const atribuicoes = prof.atribuicoes ?? []
  const labels      = Array.from(new Set(
    atribuicoes.map((a) => `${a.turma_nome ?? "Turma"} · ${a.disciplina_nome ?? "Disciplina"}`)
  ))
  const visible     = labels.slice(0, 3)
  const remaining   = labels.length - visible.length

  const cargaMax   = prof.carga_horaria_maxima ?? 0
  const cargaReal  = prof.carga_horaria_real   ?? 0
  const cargaLabel = cargaMax > 0 ? `${cargaReal} / ${cargaMax} tempos` : `${cargaReal} tempos`
  const cargaCls   = !cargaMax
    ? "border-slate-200 text-slate-500"
    : cargaReal > cargaMax  ? "border-rose-200 bg-rose-50 text-rose-600"
    : cargaReal >= cargaMax * 0.8 ? "border-amber-200 bg-amber-50 text-amber-700"
    : "border-[#1F6B3B]/20 bg-[#1F6B3B]/8 text-[#1F6B3B]"

  return (
    <div className="group rounded-xl border border-slate-200 bg-white p-4 transition-all hover:shadow-md hover:border-slate-300">
      {/* Header — avatar + name clickable */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <button onClick={onView} className="flex items-center gap-3 min-w-0 text-left hover:opacity-80 transition-opacity">
          <img
            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(prof.nome || prof.email)}&background=1F6B3B&color=fff`}
            alt={prof.nome}
            className="h-11 w-11 rounded-xl border border-slate-200 flex-shrink-0"
          />
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate group-hover:text-[#1F6B3B] transition-colors">
              {prof.nome || "Sem nome"}
            </p>
            <p className="text-xs text-slate-400 truncate">{prof.email}</p>
          </div>
        </button>
        <div className="flex flex-col items-end gap-1">
          <ComplianceBadge status={prof.compliance_status ?? "OK"} />
          <PendenciasResumoBadge total={prof.pendencias_total ?? 0} />
        </div>
      </div>

      {/* Status + atribuições */}
      <div className="flex items-center justify-between text-xs mb-3">
        <div className="flex items-center gap-1.5">
          {prof.last_login
            ? <><UserCheck size={12} className="text-[#1F6B3B]" /><span className="text-[#1F6B3B] font-semibold">Ativo</span></>
            : <><UserX size={12} className="text-amber-500" /><span className="text-amber-600 font-semibold">Pendente</span></>
          }
        </div>
        <div className="flex items-center gap-1.5 text-slate-500">
          <BookOpen size={12} className="text-slate-400" />
          {atribuicoes.length > 0 ? `${atribuicoes.length} turma(s)` : "Sem turmas"}
        </div>
      </div>

      {/* Carga horária */}
      <div className="mb-3">
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${cargaCls}`}>
          {cargaLabel}
        </span>
      </div>

      {/* Turmas */}
      {visible.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {visible.map((l) => (
            <span key={l} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600">
              {l}
            </span>
          ))}
          {remaining > 0 && (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-500">
              +{remaining}
            </span>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-400 mb-3">Sem turmas atribuídas.</p>
      )}

      {/* Actions — visible on hover */}
      <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit}
          className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors">
          Editar
        </button>
        {!prof.last_login && (
          <button onClick={onResend}
            className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors">
            Reenviar convite
          </button>
        )}
        <button onClick={onReset}
          className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors">
          Nova senha
        </button>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProfessoresPage() {
  const router   = useRouter()
  const p        = useParams() as Record<string, string | string[] | undefined>
  const escolaId = useMemo(() => (Array.isArray(p.id) ? p.id[0] : (p.id ?? "")), [p.id])

  // ── Core state ──────────────────────────────────────────────────────────────
  const [tab,       setTab]       = useState<Tab>("adicionar")
  const [loading,   setLoading]   = useState(true)
  const [toast,     setToast]     = useState<ToastState>(null)
  const [professores, setProfessores] = useState<Professor[]>([])
  const [turmas,    setTurmas]    = useState<{ id: string; nome: string }[]>([])
  const [todasTurmas, setTodasTurmas] = useState<{ id: string; nome: string }[]>([])
  const [cursos,    setCursos]    = useState<{ id: string; nome: string }[]>([])
  const [disciplinas,  setDisciplinas]  = useState<{ id: string; nome: string; catalogoId?: string | null }[]>([])
  const [disciplinasCatalogo, setDisciplinasCatalogo] = useState<{ id: string; nome: string }[]>([])
  const [lastCredentials, setLastCredentials] = useState<{ email: string; senha: string } | null>(null)

  // ── Atribuir state ──────────────────────────────────────────────────────────
  const [atribTurmaId,       setAtribTurmaId]       = useState("")
  const [atribProfessorUserId, setAtribProfessorUserId] = useState("")
  const [atribCursoId,       setAtribCursoId]       = useState("")
  const [atribDisciplinaId,  setAtribDisciplinaId]  = useState("")
  const [atribuindo,         setAtribuindo]          = useState(false)
  const [turmaAssignments,   setTurmaAssignments]   = useState<any[] | null>(null)
  const [confirmRemove,      setConfirmRemove]       = useState<{ disciplinaId: string } | null>(null)
  const [removing,           setRemoving]            = useState(false)

  // ── Adicionar state ──────────────────────────────────────────────────────────
  const [teacherStep,       setTeacherStep]       = useState(0)
  const [teacherSubmitting, setTeacherSubmitting] = useState(false)
  const TEACHER_FORM_DEFAULT = {
    nome_completo: "", genero: "M" as "M" | "F", data_nascimento: "",
    numero_bi: "", email: "", telefone_principal: "",
    habilitacoes: "Licenciatura" as "Ensino Médio" | "Bacharelato" | "Licenciatura" | "Mestrado" | "Doutoramento",
    area_formacao: "",
    vinculo_contratual: "Efetivo" as "Efetivo" | "Colaborador" | "Eventual",
    carga_horaria_maxima: 20,
    turnos_disponiveis: [] as Array<"Manhã" | "Tarde" | "Noite">,
    disciplinas_habilitadas: [] as string[],
    is_diretor_turma: false,
  }
  const [teacherForm, setTeacherForm] = useState(TEACHER_FORM_DEFAULT)
  const updateTeacher = (key: keyof typeof TEACHER_FORM_DEFAULT, value: any) =>
    setTeacherForm((prev) => ({ ...prev, [key]: value }))

  // ── Gerenciar state ──────────────────────────────────────────────────────────
  const [search,            setSearch]            = useState("")
  const [statusFilter,      setStatusFilter]      = useState("todos")
  const [atribuicaoFilter,  setAtribuicaoFilter]  = useState("todos")
  const [complianceFilter,  setComplianceFilter]  = useState("todos")
  const [viewMode,          setViewMode]          = useState<"grid" | "list">("grid")
  const [editOpen,          setEditOpen]          = useState(false)
  const [editTarget,        setEditTarget]        = useState<Professor | null>(null)
  const [editForm,          setEditForm]          = useState({
    genero: "M" as "M" | "F", data_nascimento: "", numero_bi: "",
    telefone_principal: "",
    habilitacoes: "Licenciatura" as "Ensino Médio" | "Bacharelato" | "Licenciatura" | "Mestrado" | "Doutoramento",
    area_formacao: "",
    vinculo_contratual: "Efetivo" as "Efetivo" | "Colaborador" | "Eventual",
    carga_horaria_maxima: 20,
    turnos_disponiveis: [] as Array<"Manhã" | "Tarde" | "Noite">,
    disciplinas_habilitadas: [] as string[],
    is_diretor_turma: false,
  })
  const [detailTarget,          setDetailTarget]          = useState<Professor | null>(null)
  const [pendenciasByProfessor, setPendenciasByProfessor] = useState<Record<string, PendenciasState>>({})

  // ── Derived ──────────────────────────────────────────────────────────────────
  const ativos    = professores.filter((p) => !!p.last_login).length
  const pendentes = Math.max(0, professores.length - ativos)

  const filteredProfessores = useMemo(() => {
    const term = search.trim().toLowerCase()
    return professores.filter((p) => {
      const matchSearch = term
        ? [p.nome, p.email, ...(p.disciplinas || [])].filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(term))
        : true
      const matchStatus =
        statusFilter === "todos" ? true
        : statusFilter === "ativos" ? Boolean(p.last_login)
        : !p.last_login
      const hasAtrib = (p.atribuicoes?.length ?? 0) > 0
      const matchAtrib =
        atribuicaoFilter === "todos" ? true
        : atribuicaoFilter === "com" ? hasAtrib : !hasAtrib
      const cs = (p.compliance_status ?? "OK").toUpperCase()
      const matchCompliance =
        complianceFilter === "todos" ? true
        : complianceFilter === "ok" ? cs === "OK"
        : complianceFilter === "pendente" ? cs === "PENDING_MAC"
        : cs === "CRITICAL"
      return matchSearch && matchStatus && matchAtrib && matchCompliance
    })
  }, [professores, search, statusFilter, atribuicaoFilter, complianceFilter])

  // ── Persist view / filters ──────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return
    const vm = window.localStorage.getItem("professoresViewMode")
    if (vm === "grid" || vm === "list") setViewMode(vm)
    const saved = window.localStorage.getItem("professoresFilters")
    if (!saved) return
    try {
      const parsed = JSON.parse(saved)
      if (parsed.search)            setSearch(parsed.search)
      if (parsed.statusFilter)      setStatusFilter(parsed.statusFilter)
      if (parsed.atribuicaoFilter)  setAtribuicaoFilter(parsed.atribuicaoFilter)
      if (parsed.complianceFilter)  setComplianceFilter(parsed.complianceFilter)
    } catch {}
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem("professoresViewMode", viewMode)
  }, [viewMode])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem("professoresFilters", JSON.stringify(
      { search, statusFilter, atribuicaoFilter, complianceFilter }
    ))
  }, [search, statusFilter, atribuicaoFilter, complianceFilter])

  // ── Persist credentials ──────────────────────────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem("lastTeacherCredentials")
    if (!stored) return
    try {
      const parsed = JSON.parse(stored)
      if (parsed?.email && parsed?.senha) setLastCredentials(parsed)
    } catch { localStorage.removeItem("lastTeacherCredentials") }
  }, [])

  useEffect(() => {
    if (!lastCredentials) return
    const t = setTimeout(() => setLastCredentials(null), 15000)
    return () => clearTimeout(t)
  }, [lastCredentials])

  // ── Toast helper ─────────────────────────────────────────────────────────────
  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ type, message })
  }, [])

  // ── Load data ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!escolaId) return
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        const [profRes, turmasRes, cursosRes] = await Promise.all([
          fetch(`/api/secretaria/professores?cargo=professor&days=36500&pageSize=200`, { cache: "no-store" }),
          fetch(`/api/escolas/${escolaId}/turmas`, { cache: "no-store" }),
          fetch(`/api/escolas/${escolaId}/cursos`, { cache: "no-store" }),
        ])

        const profJson   = await profRes.json().catch(() => null)
        const turmasJson = await turmasRes.json().catch(() => null)
        const cursosJson = await cursosRes.json().catch(() => null)

        if (!profRes.ok || !profJson?.ok) throw new Error(profJson?.error || "Falha ao carregar professores")

        const profs: Professor[] = (profJson?.items || []).map((pp: any) => ({
          user_id: pp.user_id, email: pp.email || "", nome: pp.nome || "",
          last_login: pp.last_login ?? null,
          disciplinas: Array.isArray(pp.disciplinas) ? pp.disciplinas : [],
          disciplinas_ids: Array.isArray(pp.disciplinas_ids) ? pp.disciplinas_ids : [],
          teacher_id: pp.teacher_id ?? null,
          genero: pp.genero ?? null, data_nascimento: pp.data_nascimento ?? null,
          numero_bi: pp.numero_bi ?? null,
          carga_horaria_maxima: pp.carga_horaria_maxima ?? null,
          turnos_disponiveis: Array.isArray(pp.turnos_disponiveis) ? pp.turnos_disponiveis : [],
          telefone_principal: pp.telefone_principal ?? null,
          habilitacoes: pp.habilitacoes ?? null, area_formacao: pp.area_formacao ?? null,
          vinculo_contratual: pp.vinculo_contratual ?? null,
          is_diretor_turma: pp.is_diretor_turma ?? false,
          atribuicoes: Array.isArray(pp.atribuicoes) ? pp.atribuicoes : [],
          carga_horaria_real: pp.carga_horaria_real ?? null,
          compliance_status: pp.compliance_status ?? null,
          pendencias_total: typeof pp.pendencias_total === "number" ? pp.pendencias_total : 0,
        }))

        const turmasList: { id: string; nome: string }[] = turmasRes.ok && Array.isArray(turmasJson?.items ?? turmasJson?.data)
          ? (turmasJson.items ?? turmasJson.data).map((t: any) => ({
              id: t.id, nome: t.nome ?? t.turma_nome ?? t.turma_codigo ?? "Sem nome",
            }))
          : []

        const cursosList: { id: string; nome: string }[] = cursosRes.ok && Array.isArray(cursosJson?.data)
          ? cursosJson.data.map((c: any) => ({ id: c.id, nome: c.nome }))
          : []

        if (!cancelled) {
          setProfessores(profs)
          setTurmas(turmasList)
          setTodasTurmas(turmasList)
          setCursos(cursosList)
        }
      } catch (e) {
        if (!cancelled) showToast(e instanceof Error ? e.message : "Falha ao carregar dados", "error")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [escolaId, showToast])

  // ── Load disciplinas catalogo ─────────────────────────────────────────────
  useEffect(() => {
    if (tab !== "adicionar" && tab !== "gerenciar") return
    let cancelled = false
    const load = async () => {
      try {
        const res  = await fetch(`/api/secretaria/disciplinas`, { cache: "no-store" })
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.ok) return
        const seen = new Map<string, string>()
        for (const item of json.items || []) {
          const id   = item.disciplina_id || item.id
          const nome = item.nome || ""
          if (id && !seen.has(id)) seen.set(id, nome)
        }
        if (!cancelled) setDisciplinasCatalogo(Array.from(seen.entries()).map(([id, nome]) => ({ id, nome })))
      } catch {}
    }
    load()
    return () => { cancelled = true }
  }, [tab])

  // ── Load turmas por curso ─────────────────────────────────────────────────
  useEffect(() => {
    if (!escolaId || !atribCursoId) {
      setTurmas(todasTurmas); setAtribTurmaId(""); setDisciplinas([]); setAtribDisciplinaId("")
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        const res  = await fetch(`/api/escolas/${escolaId}/turmas?curso_id=${atribCursoId}`, { cache: "no-store" })
        const json = await res.json().catch(() => null)
        const payload = json?.items ?? json?.data
        if (!res.ok || !Array.isArray(payload)) throw new Error()
        if (!cancelled) {
          setTurmas(payload.map((t: any) => ({ id: t.id, nome: t.nome ?? t.turma_nome ?? "Sem nome" })))
          setAtribTurmaId(""); setDisciplinas([]); setAtribDisciplinaId("")
        }
      } catch { if (!cancelled) { setTurmas([]); setAtribTurmaId(""); setDisciplinas([]); setAtribDisciplinaId("") } }
    }
    load()
    return () => { cancelled = true }
  }, [atribCursoId, escolaId, todasTurmas])

  // ── Load disciplinas por turma ────────────────────────────────────────────
  useEffect(() => {
    if (!escolaId || !atribTurmaId) { setDisciplinas([]); setAtribDisciplinaId(""); return }
    let cancelled = false
    const load = async () => {
      try {
        const res  = await fetch(`/api/escolas/${escolaId}/turmas/${atribTurmaId}/disciplinas`, { cache: "no-store" })
        const json = await res.json().catch(() => null)
        if (!res.ok || !Array.isArray(json?.items)) throw new Error()
        if (!cancelled) {
          setDisciplinas(
            json.items
              .map((d: any) => ({
                id: d.curso_matriz_id ?? d.disciplina?.id,
                nome: d.disciplina?.nome ?? "Sem disciplina",
                catalogoId: d.disciplina?.id ?? null,
              }))
              .filter((d: any) => Boolean(d.id))
          )
        }
      } catch { if (!cancelled) setDisciplinas([]) }
    }
    load()
    return () => { cancelled = true }
  }, [atribTurmaId, escolaId])

  // ── Handlers ──────────────────────────────────────────────────────────────
  const loadTurmaAssignments = async (turmaId: string) => {
    if (!turmaId) { setTurmaAssignments(null); return }
    try {
      const res  = await fetch(`/api/escolas/${escolaId}/turmas/${turmaId}/disciplinas`, { cache: "no-store" })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao carregar atribuições")
      setTurmaAssignments(json.items || [])
    } catch { setTurmaAssignments([]) }
  }

  const handleSubmitAtribuir = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!atribTurmaId || !atribProfessorUserId || !atribCursoId || !atribDisciplinaId)
      return showToast("Selecione professor, curso, turma e disciplina", "error")
    setAtribuindo(true)
    try {
      const res  = await fetch(`/api/escolas/${escolaId}/turmas/${atribTurmaId}/atribuir-professor`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disciplina_id: atribDisciplinaId, professor_user_id: atribProfessorUserId }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao atribuir")
      showToast("Atribuição salva com sucesso.", "success")
      await loadTurmaAssignments(atribTurmaId)
    } catch (e) { showToast(e instanceof Error ? e.message : "Erro ao atribuir", "error") }
    finally { setAtribuindo(false) }
  }

  const handleRemoveAtribuicao = async () => {
    if (!confirmRemove) return
    setRemoving(true)
    try {
      const res  = await fetch(`/api/escolas/${escolaId}/turmas/${atribTurmaId}/disciplinas/${confirmRemove.disciplinaId}`, { method: "DELETE" })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao remover")
      showToast("Atribuição removida.", "success")
      setConfirmRemove(null)
      await loadTurmaAssignments(atribTurmaId)
    } catch (e) { showToast(e instanceof Error ? e.message : "Erro ao remover", "error") }
    finally { setRemoving(false) }
  }

  const validateStep = (step: number) => {
    if (step === 0) {
      if (!teacherForm.nome_completo.trim()) return "Informe o nome completo"
      if (!teacherForm.email.trim()) return "Informe o email"
      if (!teacherForm.data_nascimento) return "Informe a data de nascimento"
      if (!teacherForm.numero_bi.trim()) return "Informe o número de BI"
      if (!/^[A-Za-z0-9]{14}$/.test(teacherForm.numero_bi.trim())) return "O BI deve ter 14 caracteres alfanuméricos"
      if (!teacherForm.telefone_principal.trim()) return "Informe o telefone"
    }
    if (step === 1) {
      if (!teacherForm.habilitacoes) return "Informe as habilitações"
      if (!teacherForm.vinculo_contratual) return "Informe o vínculo contratual"
    }
    if (step === 2) {
      if (!teacherForm.carga_horaria_maxima || teacherForm.carga_horaria_maxima <= 0) return "Informe a carga horária máxima"
      if (teacherForm.turnos_disponiveis.length === 0) return "Selecione ao menos um turno"
      if (teacherForm.disciplinas_habilitadas.length === 0) return "Selecione ao menos uma disciplina"
    }
    return null
  }

  const handleCreateProfessor = async () => {
    setTeacherSubmitting(true)
    try {
      const res  = await fetch(`/api/escolas/${escolaId}/professores/create`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...teacherForm, carga_horaria_maxima: Number(teacherForm.carga_horaria_maxima) }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao criar professor")
      const senhaTemp = json?.senha_temp as string | null
      if (senhaTemp) {
        const creds = { email: teacherForm.email.trim(), senha: senhaTemp }
        setLastCredentials(creds)
        localStorage.setItem("lastTeacherCredentials", JSON.stringify(creds))
      }
      showToast("Professor criado com sucesso!", "success")
      setTeacherForm(TEACHER_FORM_DEFAULT)
      setTeacherStep(0)
      setTab("gerenciar")
    } catch (e) { showToast(e instanceof Error ? e.message : "Falha ao criar professor", "error") }
    finally { setTeacherSubmitting(false) }
  }

  const handleCopyCredentials = async () => {
    if (!lastCredentials) return
    try {
      await navigator.clipboard.writeText(`Email: ${lastCredentials.email}\nSenha temporária: ${lastCredentials.senha}`)
      showToast("Credenciais copiadas.", "success")
    } catch { showToast("Falha ao copiar.", "error") }
  }

  const openEdit = (prof: Professor) => {
    setEditTarget(prof)
    setEditForm({
      genero: (prof.genero as any) || "M",
      data_nascimento: prof.data_nascimento || "",
      numero_bi: prof.numero_bi || "",
      telefone_principal: prof.telefone_principal || "",
      habilitacoes: (prof.habilitacoes as any) || "Licenciatura",
      area_formacao: prof.area_formacao || "",
      vinculo_contratual: (prof.vinculo_contratual as any) || "Efetivo",
      carga_horaria_maxima: prof.carga_horaria_maxima || 20,
      turnos_disponiveis: prof.turnos_disponiveis || [],
      disciplinas_habilitadas: prof.disciplinas_ids || [],
      is_diretor_turma: Boolean(prof.is_diretor_turma),
    })
    setEditOpen(true)
  }

  const handleUpdateProfessor = async () => {
    if (!editTarget) return
    try {
      const res  = await fetch(`/api/escolas/${escolaId}/professores/${editTarget.user_id}/update`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editForm, carga_horaria_maxima: Number(editForm.carga_horaria_maxima) }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao atualizar professor")
      showToast("Professor atualizado.", "success")
      setEditOpen(false)
      setEditTarget(null)
    } catch (e) { showToast(e instanceof Error ? e.message : "Falha ao atualizar professor", "error") }
  }

  const handleResendInvite = async (email: string) => {
    try {
      const res  = await fetch(`/api/escolas/${escolaId}/usuarios/resend`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao reenviar convite")
      showToast("Convite reenviado.", "success")
    } catch (e) { showToast(e instanceof Error ? e.message : "Falha ao reenviar convite", "error") }
  }

  const handleResetPassword = async (prof: Professor) => {
    try {
      const res  = await fetch(`/api/escolas/${escolaId}/professores/${prof.user_id}/reset-password`, { method: "POST" })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao gerar senha")
      const senhaTemp = json?.senha_temp as string | null
      if (senhaTemp) {
        const creds = { email: prof.email, senha: senhaTemp }
        setLastCredentials(creds)
        localStorage.setItem("lastTeacherCredentials", JSON.stringify(creds))
      }
      showToast("Senha temporária gerada.", "success")
    } catch (e) { showToast(e instanceof Error ? e.message : "Falha ao gerar senha", "error") }
  }

  const loadPendencias = (profileId: string) => {
    setPendenciasByProfessor((prev) => {
      if (prev[profileId]?.loading || prev[profileId]?.data) return prev
      return { ...prev, [profileId]: { loading: true, error: null, data: null } }
    })
    fetch(`/api/escolas/${escolaId}/professores/${profileId}/pendencias`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (!json?.ok) throw new Error(json?.error || "Falha")
        setPendenciasByProfessor((prev) => ({ ...prev, [profileId]: { loading: false, error: null, data: json } }))
      })
      .catch((err) => {
        setPendenciasByProfessor((prev) => ({
          ...prev, [profileId]: { loading: false, error: err.message, data: null }
        }))
      })
  }

  const openDetail = (prof: Professor) => {
    setDetailTarget(prof)
    loadPendencias(prof.user_id)
  }

  const activeFilterCount = [
    search.trim(), statusFilter !== "todos", atribuicaoFilter !== "todos", complianceFilter !== "todos"
  ].filter(Boolean).length

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors">
            <ArrowLeftIcon className="w-4 h-4" /> Voltar
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Professores</h1>
            <p className="text-xs text-slate-400 mt-0.5">Gestão docente da escola</p>
          </div>
        </div>
        <div className="text-xs text-slate-400 flex items-center gap-1.5">
          <span>Início</span>
          <span>/</span>
          <span className="font-semibold text-[#1F6B3B]">Professores</span>
        </div>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total",     value: professores.length, icon: UsersIcon,      dark: true  },
          { label: "Ativos",    value: ativos,              icon: UserCheck,      dark: false, green: true },
          { label: "Pendentes", value: pendentes,           icon: UserX,          dark: false, amber: true },
          { label: "Cursos",    value: cursos.length,       icon: Cog6ToothIcon, dark: false },
        ].map(({ label, value, icon: Icon, dark, green, amber }) => (
          <div key={label} className={`
            flex items-center gap-4 p-5 rounded-2xl border shadow-sm transition-all
            ${dark ? "bg-slate-900 border-slate-900" : "bg-white border-slate-200"}
          `}>
            <div className={`p-2.5 rounded-xl ${
              dark  ? "bg-white/10 text-[#E3B23C]"
              : green ? "bg-[#1F6B3B]/10 text-[#1F6B3B]"
              : amber ? "bg-amber-50 text-amber-600"
              : "bg-slate-50 text-slate-400"
            }`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className={`text-2xl font-black ${dark ? "text-white" : "text-slate-900"}`}>
                {loading ? "—" : value}
              </p>
              <p className={`text-xs font-medium ${dark ? "text-slate-400" : "text-slate-500"}`}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Pill tabs ───────────────────────────────────────────────────────── */}
      <PillTabs active={tab} onChange={setTab} />

      {/* ── Tab: Adicionar ─────────────────────────────────────────────────── */}
      {tab === "adicionar" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <div className="p-2 rounded-xl bg-[#E3B23C]/10">
              <UserPlusIcon className="w-5 h-5 text-[#E3B23C]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Novo Professor</h2>
              <p className="text-xs text-slate-400">Preencha os dados em 3 passos.</p>
            </div>
          </div>

          <StepIndicator step={teacherStep} labels={["Dados pessoais", "Formação", "Disponibilidade"]} />

          {teacherStep === 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              <input className={inputCls} placeholder="Nome completo" value={teacherForm.nome_completo}
                onChange={(e) => updateTeacher("nome_completo", e.target.value)} />
              <select className={selectCls} value={teacherForm.genero}
                onChange={(e) => updateTeacher("genero", e.target.value)}>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
              </select>
              <input className={inputCls} type="date" value={teacherForm.data_nascimento}
                onChange={(e) => updateTeacher("data_nascimento", e.target.value)} />
              <div>
                <input className={inputCls} placeholder="Número do BI (14 caracteres)" value={teacherForm.numero_bi}
                  maxLength={14} onChange={(e) => updateTeacher("numero_bi", e.target.value)} />
                <p className="text-[10px] text-slate-400 mt-1 ml-1">14 caracteres alfanuméricos.</p>
              </div>
              <input className={inputCls} type="email" placeholder="Email institucional" value={teacherForm.email}
                onChange={(e) => updateTeacher("email", e.target.value)} />
              <input className={inputCls} type="tel" placeholder="Telefone principal" value={teacherForm.telefone_principal}
                onChange={(e) => updateTeacher("telefone_principal", e.target.value)} />
            </div>
          )}

          {teacherStep === 1 && (
            <div className="grid gap-4 md:grid-cols-2">
              <select className={selectCls} value={teacherForm.habilitacoes}
                onChange={(e) => updateTeacher("habilitacoes", e.target.value)}>
                {["Ensino Médio","Bacharelato","Licenciatura","Mestrado","Doutoramento"].map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
              <input className={inputCls} placeholder="Área de formação" value={teacherForm.area_formacao}
                onChange={(e) => updateTeacher("area_formacao", e.target.value)} />
              <select className={selectCls} value={teacherForm.vinculo_contratual}
                onChange={(e) => updateTeacher("vinculo_contratual", e.target.value)}>
                {["Efetivo","Colaborador","Eventual"].map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          )}

          {teacherStep === 2 && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <input className={inputCls} type="number" min={1}
                  placeholder="Carga horária máxima (tempos/semana)"
                  value={teacherForm.carga_horaria_maxima}
                  onChange={(e) => updateTeacher("carga_horaria_maxima", Number(e.target.value))} />
                <div className="flex flex-wrap gap-4 items-center rounded-xl border border-slate-200 px-3 py-2.5 bg-white">
                  {(["Manhã","Tarde","Noite"] as const).map((turno) => (
                    <label key={turno} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" className="accent-[#E3B23C]"
                        checked={teacherForm.turnos_disponiveis.includes(turno)}
                        onChange={(e) => {
                          const next = new Set(teacherForm.turnos_disponiveis)
                          e.target.checked ? next.add(turno) : next.delete(turno)
                          updateTeacher("turnos_disponiveis", Array.from(next))
                        }} />
                      {turno}
                    </label>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Disciplinas habilitadas</p>
                {disciplinasCatalogo.length === 0
                  ? <p className="text-xs text-slate-400">Nenhuma disciplina disponível.</p>
                  : <div className="grid gap-2 md:grid-cols-2">
                      {disciplinasCatalogo.map((d) => (
                        <label key={d.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" className="accent-[#E3B23C]"
                            checked={teacherForm.disciplinas_habilitadas.includes(d.id)}
                            onChange={(e) => {
                              const next = new Set(teacherForm.disciplinas_habilitadas)
                              e.target.checked ? next.add(d.id) : next.delete(d.id)
                              updateTeacher("disciplinas_habilitadas", Array.from(next))
                            }} />
                          {d.nome}
                        </label>
                      ))}
                    </div>
                }
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="accent-[#E3B23C]"
                  checked={teacherForm.is_diretor_turma}
                  onChange={(e) => updateTeacher("is_diretor_turma", e.target.checked)} />
                Professor pode ser Diretor de Turma
              </label>
            </div>
          )}

          {/* Step navigation */}
          <div className="mt-8 flex items-center justify-between">
            <button onClick={() => setTeacherStep((s) => Math.max(0, s - 1))}
              disabled={teacherStep === 0}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors">
              Voltar
            </button>
            {teacherStep < 2 ? (
              <button onClick={() => {
                const err = validateStep(teacherStep)
                if (err) return showToast(err, "error")
                setTeacherStep((s) => s + 1)
              }}
                className="rounded-xl bg-[#E3B23C] px-5 py-2 text-sm font-bold text-white hover:brightness-95 transition-all active:scale-95">
                Próximo
              </button>
            ) : (
              <button onClick={() => {
                const err = validateStep(teacherStep)
                if (err) return showToast(err, "error")
                handleCreateProfessor()
              }} disabled={teacherSubmitting}
                className="rounded-xl bg-[#E3B23C] px-5 py-2 text-sm font-bold text-white hover:brightness-95 transition-all active:scale-95 disabled:opacity-60">
                {teacherSubmitting ? "A guardar…" : "Guardar Professor"}
              </button>
            )}
          </div>

          {lastCredentials && (
            <div className="mt-6">
              <CredentialsBanner creds={lastCredentials} onCopy={handleCopyCredentials}
                onDismiss={() => { setLastCredentials(null); localStorage.removeItem("lastTeacherCredentials") }} />
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Atribuir ──────────────────────────────────────────────────── */}
      {tab === "atribuir" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <div className="p-2 rounded-xl bg-[#E3B23C]/10">
              <ClipboardDocumentListIcon className="w-5 h-5 text-[#E3B23C]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Atribuir Professor</h2>
              <p className="text-xs text-slate-400">Vincule professores a turmas e disciplinas.</p>
            </div>
          </div>

          <form onSubmit={handleSubmitAtribuir} className="space-y-3 max-w-lg">
            <select className={selectCls} required value={atribProfessorUserId}
              onChange={(e) => setAtribProfessorUserId(e.target.value)}>
              <option value="">Selecione um professor</option>
              {professores.map((p) => (
                <option key={p.user_id} value={p.user_id}>{p.nome || p.email}</option>
              ))}
            </select>
            <select className={selectCls} required value={atribCursoId}
              onChange={(e) => setAtribCursoId(e.target.value)}>
              <option value="">Selecione um curso</option>
              {cursos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <select className={selectCls} required value={atribTurmaId}
              onChange={(e) => { setAtribTurmaId(e.target.value); loadTurmaAssignments(e.target.value) }}>
              <option value="">Selecione uma turma</option>
              {turmas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
            <select className={selectCls} required value={atribDisciplinaId}
              disabled={!atribTurmaId} onChange={(e) => setAtribDisciplinaId(e.target.value)}>
              <option value="">{atribTurmaId ? "Selecione uma disciplina" : "Selecione uma turma primeiro"}</option>
              {disciplinas.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
            <button type="submit" disabled={atribuindo}
              className="rounded-xl bg-[#E3B23C] px-5 py-2.5 text-sm font-bold text-white hover:brightness-95 disabled:opacity-60 transition-all active:scale-95">
              {atribuindo ? "A guardar…" : "Confirmar Atribuição"}
            </button>
          </form>

          {/* Atribuições da turma */}
          {atribTurmaId && (
            <div className="mt-8">
              <h3 className="text-sm font-bold text-slate-900 mb-3">Atribuições desta turma</h3>
              {turmaAssignments === null
                ? <p className="text-sm text-slate-400">Selecione uma turma para visualizar.</p>
                : turmaAssignments.length === 0
                ? <p className="text-sm text-slate-400">Nenhuma atribuição encontrada.</p>
                : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          {["Disciplina", "Professor", "Vínculos", ""].map((h) => (
                            <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {turmaAssignments.map((a: any) => (
                          <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 text-slate-700 font-medium">{a.disciplina?.nome || "—"}</td>
                            <td className="px-4 py-3 text-slate-600">{a.professor?.nome || a.professor?.email || "—"}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {["horarios","notas","presencas","planejamento"].map((v) => (
                                  <span key={v} className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                                    a.vinculos?.[v]
                                      ? "bg-[#1F6B3B]/10 text-[#1F6B3B] border-[#1F6B3B]/20"
                                      : "bg-slate-100 text-slate-500 border-slate-200"
                                  }`}>
                                    {v.charAt(0).toUpperCase() + v.slice(1)}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => setConfirmRemove({ disciplinaId: a.disciplina?.id })}
                                className="rounded-lg border border-rose-200 px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50 transition-colors">
                                Remover
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              }
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Gerenciar ─────────────────────────────────────────────────── */}
      {tab === "gerenciar" && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Toolbar */}
          <div className="p-5 border-b border-slate-100">
            <div className="flex flex-wrap items-center gap-2">
              <input type="text" placeholder="Buscar professor…" value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`${inputCls} flex-1 min-w-[180px] max-w-xs`} />

              {[
                { value: statusFilter, onChange: setStatusFilter, options: [
                  ["todos","Status: todos"],["ativos","Ativos"],["pendentes","Pendentes"]
                ]},
                { value: atribuicaoFilter, onChange: setAtribuicaoFilter, options: [
                  ["todos","Atribuições: todas"],["com","Com turmas"],["sem","Sem turmas"]
                ]},
                { value: complianceFilter, onChange: setComplianceFilter, options: [
                  ["todos","Pautas: todas"],["ok","OK"],["pendente","Pendente (MAC)"],["critico","Crítico"]
                ]},
              ].map(({ value, onChange, options }, i) => (
                <select key={i} value={value} onChange={(e) => onChange(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:border-[#E3B23C] cursor-pointer">
                  {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              ))}

              {activeFilterCount > 0 && (
                <button onClick={() => { setSearch(""); setStatusFilter("todos"); setAtribuicaoFilter("todos"); setComplianceFilter("todos") }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors">
                  <X size={13} /> Limpar ({activeFilterCount})
                </button>
              )}

              <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 ml-auto">
                <button onClick={() => setViewMode("grid")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    viewMode === "grid" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"
                  }`}>
                  <LayoutGrid size={12} /> Grid
                </button>
                <button onClick={() => setViewMode("list")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    viewMode === "list" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"
                  }`}>
                  <List size={12} /> Lista
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-slate-400">{filteredProfessores.length} de {professores.length} professores</p>
            </div>
          </div>

          <div className="p-5">
            {lastCredentials && (
              <div className="mb-5">
                <CredentialsBanner creds={lastCredentials} onCopy={handleCopyCredentials}
                  onDismiss={() => { setLastCredentials(null); localStorage.removeItem("lastTeacherCredentials") }} />
              </div>
            )}

            {viewMode === "grid" ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredProfessores.map((p) => (
                  <ProfCard key={p.user_id} prof={p}
                    onView={() => openDetail(p)}
                    onEdit={() => openEdit(p)}
                    onResend={() => handleResendInvite(p.email)}
                    onReset={() => handleResetPassword(p)} />
                ))}
                {filteredProfessores.length === 0 && (
                  <div className="col-span-full py-12 text-center text-slate-400 text-sm">
                    Nenhum professor encontrado. Ajuste os filtros.
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                    {["Professor","Status","Atribuições","Pendências","Compliance","Ações"].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                    ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProfessores.map((p) => {
                      const atribuicoes = p.atribuicoes ?? []
                      const labels = Array.from(new Set(
                        atribuicoes.map((a) => `${a.turma_nome ?? "Turma"} · ${a.disciplina_nome ?? "Disciplina"}`)
                      ))
                      const visible   = labels.slice(0, 2)
                      const remaining = labels.length - visible.length
                      return (
                        <tr key={p.user_id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-4">
                            <button onClick={() => openDetail(p)} className="flex items-center gap-3 hover:opacity-80 transition-opacity text-left">
                              <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(p.nome || p.email)}&background=1F6B3B&color=fff`}
                                alt={p.nome} className="h-9 w-9 rounded-xl border border-slate-200 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-900 hover:text-[#1F6B3B] truncate transition-colors">{p.nome || "Sem nome"}</p>
                                <p className="text-xs text-slate-400 truncate">{p.email}</p>
                              </div>
                            </button>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ${
                              p.last_login ? "ring-[#1F6B3B]/20 text-[#1F6B3B]" : "ring-amber-200 text-amber-600"
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${p.last_login ? "bg-[#1F6B3B]" : "bg-amber-400"}`} />
                              {p.last_login ? "Ativo" : "Pendente"}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-xs text-slate-600">
                            {visible.join(" · ")}{remaining > 0 ? ` +${remaining}` : ""}
                            {visible.length === 0 && <span className="text-slate-400">Sem turmas</span>}
                          </td>
                          <td className="px-5 py-4">
                            <PendenciasResumoBadge total={p.pendencias_total ?? 0} />
                          </td>
                          <td className="px-5 py-4">
                            <ComplianceBadge status={p.compliance_status ?? "OK"} />
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex flex-wrap justify-end gap-1.5">
                              <button onClick={() => openDetail(p)}
                                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:border-[#1F6B3B]/30 hover:text-[#1F6B3B] transition-colors">
                                Ver
                              </button>
                              <button onClick={() => openEdit(p)}
                                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900 transition-colors">
                                Editar
                              </button>
                              {!p.last_login && (
                                <button onClick={() => handleResendInvite(p.email)}
                                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900 transition-colors">
                                  Reenviar
                                </button>
                              )}
                              <button onClick={() => handleResetPassword(p)}
                                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900 transition-colors">
                                Nova senha
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {filteredProfessores.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400 text-sm">
                          Nenhum professor encontrado. Ajuste os filtros.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Drawer: professor detail (dados + turmas + carga + pendências) ──── */}
      {detailTarget && (
        <ProfDetailDrawer
          prof={detailTarget}
          pendenciasState={pendenciasByProfessor[detailTarget.user_id]}
          onClose={() => setDetailTarget(null)}
          onEdit={() => openEdit(detailTarget)}
        />
      )}

      {/* ── Modal: editar professor ─────────────────────────────────────────── */}
      {editOpen && editTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900">Editar Professor</h3>
                <p className="text-xs text-slate-400 mt-0.5">{editTarget.nome || editTarget.email}</p>
              </div>
              <button onClick={() => setEditOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors" aria-label="Fechar">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <select className={selectCls} value={editForm.genero}
                  onChange={(e) => setEditForm((p) => ({ ...p, genero: e.target.value as any }))}>
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                </select>
                <input className={inputCls} type="date" value={editForm.data_nascimento}
                  onChange={(e) => setEditForm((p) => ({ ...p, data_nascimento: e.target.value }))} />
                <input className={inputCls} placeholder="Número do BI" maxLength={14} value={editForm.numero_bi}
                  onChange={(e) => setEditForm((p) => ({ ...p, numero_bi: e.target.value }))} />
                <input className={inputCls} type="tel" placeholder="Telefone principal" value={editForm.telefone_principal}
                  onChange={(e) => setEditForm((p) => ({ ...p, telefone_principal: e.target.value }))} />
                <select className={selectCls} value={editForm.habilitacoes}
                  onChange={(e) => setEditForm((p) => ({ ...p, habilitacoes: e.target.value as any }))}>
                  {["Ensino Médio","Bacharelato","Licenciatura","Mestrado","Doutoramento"].map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
                <input className={inputCls} placeholder="Área de formação" value={editForm.area_formacao}
                  onChange={(e) => setEditForm((p) => ({ ...p, area_formacao: e.target.value }))} />
                <select className={selectCls} value={editForm.vinculo_contratual}
                  onChange={(e) => setEditForm((p) => ({ ...p, vinculo_contratual: e.target.value as any }))}>
                  {["Efetivo","Colaborador","Eventual"].map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <input className={inputCls} type="number" min={1} placeholder="Carga horária máxima"
                  value={editForm.carga_horaria_maxima}
                  onChange={(e) => setEditForm((p) => ({ ...p, carga_horaria_maxima: Number(e.target.value) }))} />
              </div>

              <div className="flex flex-wrap gap-4 rounded-xl border border-slate-200 px-3 py-2.5">
                {(["Manhã","Tarde","Noite"] as const).map((t) => (
                  <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" className="accent-[#E3B23C]"
                      checked={editForm.turnos_disponiveis.includes(t)}
                      onChange={(e) => {
                        const next = new Set(editForm.turnos_disponiveis)
                        e.target.checked ? next.add(t) : next.delete(t)
                        setEditForm((p) => ({ ...p, turnos_disponiveis: Array.from(next) }))
                      }} />
                    {t}
                  </label>
                ))}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Disciplinas habilitadas</p>
                <div className="grid gap-2 md:grid-cols-2">
                  {disciplinasCatalogo.map((d) => (
                    <label key={d.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" className="accent-[#E3B23C]"
                        checked={editForm.disciplinas_habilitadas.includes(d.id)}
                        onChange={(e) => {
                          const next = new Set(editForm.disciplinas_habilitadas)
                          e.target.checked ? next.add(d.id) : next.delete(d.id)
                          setEditForm((p) => ({ ...p, disciplinas_habilitadas: Array.from(next) }))
                        }} />
                      {d.nome}
                    </label>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="accent-[#E3B23C]"
                  checked={editForm.is_diretor_turma}
                  onChange={(e) => setEditForm((p) => ({ ...p, is_diretor_turma: e.target.checked }))} />
                Professor pode ser Diretor de Turma
              </label>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
              <button onClick={() => setEditOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
                Cancelar
              </button>
              <button onClick={handleUpdateProfessor}
                className="rounded-xl bg-[#E3B23C] px-5 py-2 text-sm font-bold text-white hover:brightness-95 transition-all active:scale-95">
                Guardar alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm: remover atribuição ─────────────────────────────────────── */}
      <ConfirmDialog
        open={Boolean(confirmRemove)}
        message="Remover esta atribuição? O professor perderá acesso à turma e disciplina."
        loading={removing}
        onConfirm={handleRemoveAtribuicao}
        onCancel={() => setConfirmRemove(null)}
      />

      {/* ── Toast ───────────────────────────────────────────────────────────── */}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
