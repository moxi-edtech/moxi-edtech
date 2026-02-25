"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote, Calculator, CheckCircle, CreditCard,
  Loader2, Smartphone, Wallet, X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ReciboImprimivel } from "@/components/financeiro/ReciboImprimivel";
import { usePlanFeature } from "@/hooks/usePlanFeature";
import { useToast } from "@/components/feedback/FeedbackSystem";

// ─── Tokens ──────────────────────────────────────────────────────────────────
// Fonte de verdade: nunca usar cores avulsas fora deste mapa.
const T = {
  green:      "#1F6B3B",
  green_ring: "ring-[#1F6B3B]/20",
  gold:       "#E3B23C",
  gold_ring:  "ring-[#E3B23C]/20",
  rose:       "text-rose-600",
  rose_bg:    "bg-rose-50",
  rose_border:"border-rose-200",
} as const;

// ─── Tipos ────────────────────────────────────────────────────────────────────

type MetodoPagamento = "cash" | "tpa" | "transfer" | "mcx" | "kiwk";

type MetodoDetalhes = {
  referencia:    string;
  evidencia_url: string;
  gateway_ref:   string;
};

type ReciboState = { url_validacao: string | null } | null;

export interface ModalPagamentoRapidoProps {
  escolaId?:    string | null;
  aluno: {
    id:    string;
    nome:  string;
    turma?: string;
    bi?:    string;
  };
  mensalidade: {
    id:          string;
    mes:         number;
    ano:         number;
    valor:       number;
    vencimento?: string;
    status:      string;
  } | null;
  open:       boolean;
  onClose:    () => void;
  onSuccess?: () => void;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun",
               "Jul","Ago","Set","Out","Nov","Dez"] as const;

const METODOS_CONFIG = [
  { id: "cash"     as const, label: "Cash",       helper: "Balcão",       icon: Banknote   },
  { id: "tpa"      as const, label: "TPA",        helper: "Cartão",       icon: CreditCard },
  { id: "transfer" as const, label: "Transferência", helper: "Comprovativo", icon: Wallet  },
  { id: "mcx"      as const, label: "Multicaixa", helper: "MCX",          icon: Smartphone },
  { id: "kiwk"     as const, label: "KIWK",       helper: "Instantâneo",  icon: Smartphone },
] as const;

const DETALHES_VAZIOS: MetodoDetalhes = {
  referencia: "", evidencia_url: "", gateway_ref: "",
};

// ─── Formatters ───────────────────────────────────────────────────────────────

const moneyAOA = new Intl.NumberFormat("pt-AO", {
  style: "currency", currency: "AOA", minimumFractionDigits: 2,
});

function safeNumber(input: string): number {
  const n = Number(input.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function mesAnoLabel(mes?: number | null, ano?: number | null): string {
  if (!mes || mes < 1 || mes > 12 || !ano) return "Mensalidade";
  return `${MESES[mes - 1]}/${ano}`;
}

function statusConfig(status?: string | null) {
  const s = (status ?? "").toLowerCase();
  if (s === "pago")
    return { label: "Pago",      cls: "bg-[#1F6B3B]/10 text-[#1F6B3B] border-[#1F6B3B]/20" };
  if (s === "pago_parcial")
    return { label: "Parcial",   cls: "bg-[#E3B23C]/10 text-[#9a7010] border-[#E3B23C]/20" };
  if (s === "pendente")
    return { label: "Pendente",  cls: "bg-[#E3B23C]/10 text-[#9a7010] border-[#E3B23C]/20" };
  if (s === "em_atraso" || s === "atraso")
    return { label: "Em atraso", cls: "bg-rose-50 text-rose-700 border-rose-200" };
  return { label: status ?? "—", cls: "bg-slate-100 text-slate-600 border-slate-200" };
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function MetodoGrid({
  value,
  onChange,
  disabled,
}: {
  value:    MetodoPagamento;
  onChange: (v: MetodoPagamento) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {METODOS_CONFIG.map(({ id, label, helper, icon: Icon }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            disabled={disabled}
            className={[
              "flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              active
                ? "border-[#E3B23C] ring-4 ring-[#E3B23C]/10 bg-white"
                : "border-slate-200 bg-white hover:bg-slate-50",
            ].join(" ")}
          >
            <div className={[
              "h-9 w-9 rounded-xl border flex items-center justify-center flex-shrink-0",
              active
                ? "border-[#E3B23C]/30 bg-[#E3B23C]/10"
                : "border-slate-200 bg-slate-100",
            ].join(" ")}>
              <Icon className={`h-4 w-4 ${active ? "text-[#E3B23C]" : "text-slate-500"}`} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{label}</p>
              <p className="text-[11px] text-slate-400">{helper}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function DetalhesMetodo({
  metodo,
  detalhes,
  onChange,
  disabled,
}: {
  metodo:   MetodoPagamento;
  detalhes: MetodoDetalhes;
  onChange: (d: Partial<MetodoDetalhes>) => void;
  disabled?: boolean;
}) {
  if (metodo === "cash") return null;

  const inputCls = [
    "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold",
    "text-slate-900 outline-none transition-all",
    "focus:border-[#E3B23C] focus:ring-4 focus:ring-[#E3B23C]/20",
    disabled ? "opacity-50 cursor-not-allowed" : "",
  ].join(" ");

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
      {/* Referência — obrigatória para TPA, opcional para outros */}
      {(metodo === "tpa" || metodo === "mcx" || metodo === "kiwk") && (
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
            Referência {metodo === "tpa" ? <span className="text-rose-500">*</span> : "(opcional)"}
          </label>
          <input
            value={detalhes.referencia}
            onChange={e => onChange({ referencia: e.target.value })}
            disabled={disabled}
            placeholder={metodo === "tpa" ? "TPA-2026-000882" : "Opcional"}
            className={inputCls}
          />
        </div>
      )}

      {/* Gateway ref — MCX e KIWK */}
      {(metodo === "mcx" || metodo === "kiwk") && (
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
            Ref. gateway (opcional)
          </label>
          <input
            value={detalhes.gateway_ref}
            onChange={e => onChange({ gateway_ref: e.target.value })}
            disabled={disabled}
            placeholder={metodo === "kiwk" ? "KIWK-ref" : "Gateway ref"}
            className={inputCls}
          />
        </div>
      )}

      {/* Comprovativo — transferência */}
      {metodo === "transfer" && (
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
            URL do comprovativo <span className="text-rose-500">*</span>
          </label>
          <input
            value={detalhes.evidencia_url}
            onChange={e => onChange({ evidencia_url: e.target.value })}
            disabled={disabled}
            placeholder="https://..."
            className={inputCls}
          />
        </div>
      )}
    </div>
  );
}

function ValorInput({
  valor,
  onChange,
  sugestoes,
  disabled,
}: {
  valor:     string;
  onChange:  (v: string) => void;
  sugestoes: number[];
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-bold text-slate-900">
        Valor recebido
      </label>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={valor}
          onChange={e => onChange(e.target.value)}
          placeholder="0,00"
          disabled={disabled}
          aria-label="Valor recebido em AOA"
          className={[
            "w-full rounded-2xl border border-slate-200 bg-white",
            "px-4 py-3 pr-16 text-xl font-black text-slate-900 outline-none transition-all",
            "focus:border-[#E3B23C] focus:ring-4 focus:ring-[#E3B23C]/20",
            disabled ? "opacity-50 cursor-not-allowed" : "",
          ].join(" ")}
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
          AOA
        </span>
      </div>

      {sugestoes.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {sugestoes.map(v => (
            <button
              key={v}
              type="button"
              onClick={() => onChange(String(v))}
              disabled={disabled}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5
                text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300
                transition-colors disabled:opacity-50"
            >
              {moneyAOA.format(v)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TrocoCard({ troco, valido }: { troco: number; valido: boolean }) {
  return (
    <div className={[
      "flex items-center justify-between rounded-2xl border p-4",
      valido ? "border-slate-200 bg-white" : "border-rose-200 bg-rose-50",
    ].join(" ")}>
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-slate-100 border border-slate-200
          flex items-center justify-center">
          <Calculator className="h-4 w-4 text-slate-500" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">Troco</p>
          <p className="text-[11px] text-slate-400">A devolver no balcão</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-[10px] text-slate-400 mb-0.5">Valor</p>
        <p className={`text-xl font-black ${valido ? "text-slate-900" : "text-rose-600"}`}>
          {moneyAOA.format(troco)}
        </p>
      </div>
    </div>
  );
}

function ResumoCard({
  valorDevido,
  valorPago,
  troco,
  trocoValido,
}: {
  valorDevido: number;
  valorPago:   number;
  troco:       number;
  trocoValido: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
        Resumo
      </p>
      <div className="space-y-2 text-sm">
        {[
          { label: "Valor da mensalidade", value: moneyAOA.format(valorDevido) },
          { label: "Valor recebido",        value: moneyAOA.format(valorPago) },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-slate-500">{label}</span>
            <span className="font-semibold text-slate-900">{value}</span>
          </div>
        ))}
        <div className="border-t border-slate-200 pt-2 flex items-center justify-between">
          <span className="font-bold text-slate-900">Troco</span>
          <span className="font-black text-slate-900">{moneyAOA.format(troco)}</span>
        </div>
      </div>

      {!trocoValido && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2
          text-xs text-rose-700 font-medium">
          O valor recebido deve ser igual ou superior ao valor da mensalidade.
        </div>
      )}
    </div>
  );
}

function EstadoConcluido() {
  return (
    <div className="py-10 text-center space-y-4">
      <div className="mx-auto inline-flex h-16 w-16 items-center justify-center
        rounded-full bg-[#1F6B3B]/10 ring-1 ring-[#1F6B3B]/20">
        <CheckCircle className="h-8 w-8 text-[#1F6B3B]" />
      </div>
      <div>
        <h3 className="text-xl font-black text-slate-900">Pagamento registado</h3>
        <p className="mt-1 text-sm text-slate-500">
          Recibo emitido automaticamente.
        </p>
      </div>
      <p className="text-xs text-slate-400">A fechar automaticamente…</p>
    </div>
  );
}

// ─── Hook: lógica de submissão ────────────────────────────────────────────────

function usePagamentoSubmit({
  aluno,
  mensalidade,
  metodo,
  detalhes,
  valorPagoNum,
  mesAno,
  trocoValido,
  canEmitirRecibo,
  onConcluido,
  onRecibo,
  safeClose,
  onSuccess,
}: {
  aluno:          ModalPagamentoRapidoProps["aluno"];
  mensalidade:    ModalPagamentoRapidoProps["mensalidade"];
  metodo:         MetodoPagamento;
  detalhes:       MetodoDetalhes;
  valorPagoNum:   number;
  mesAno:         string;
  trocoValido:    boolean;
  canEmitirRecibo: boolean;
  onConcluido:    () => void;
  onRecibo:       (r: ReciboState) => void;
  safeClose:      () => void;
  onSuccess?:     () => void;
}) {
  const [processando, setProcessando] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const { success, error } = useToast();

  useEffect(() => () => abortRef.current?.abort(), []);

  const submit = useCallback(async () => {
    if (!mensalidade || !trocoValido || processando) return;

    if (metodo === "tpa" && !detalhes.referencia.trim()) {
      error("Referência obrigatória para TPA."); return;
    }
    if (metodo === "transfer" && !detalhes.evidencia_url.trim()) {
      error("Comprovativo obrigatório para Transferência."); return;
    }

    setProcessando(true);
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const idempotencyKey = crypto.randomUUID?.() ??
        `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const res = await fetch("/api/financeiro/pagamentos/registrar", {
        method:  "POST",
        headers: {
          "Content-Type":    "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          aluno_id:       aluno.id,
          mensalidade_id: mensalidade.id,
          valor:          valorPagoNum || mensalidade.valor,
          metodo,
          reference:      detalhes.referencia    || null,
          evidence_url:   detalhes.evidencia_url || null,
          meta: {
            observacao:  `Pagamento rápido - ${mesAno}`,
            origem:      "pagamento_rapido",
            gateway_ref: detalhes.gateway_ref || null,
          },
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok)
        throw new Error(json?.error || "Falha ao registar pagamento.");

      // Recibo (guard de plano)
      if (canEmitirRecibo) {
        const reciboRes = await fetch("/api/financeiro/recibos/emitir", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mensalidadeId: mensalidade.id }),
        }).catch(() => null);

        if (reciboRes?.ok) {
          const rj = await reciboRes.json().catch(() => null);
          if (rj?.ok) onRecibo({ url_validacao: rj.url_validacao ?? null });
        }
      }

      success("Pagamento registado.", "Recibo disponível para impressão.");
      onConcluido();
      setTimeout(() => { safeClose(); onSuccess?.(); }, 1200);

    } catch (err: any) {
      if (err?.name === "AbortError") return;
      error(err instanceof Error ? err.message : "Não foi possível processar o pagamento.");
    } finally {
      setProcessando(false);
    }
  }, [
    mensalidade, trocoValido, processando, metodo, detalhes,
    valorPagoNum, mesAno, canEmitirRecibo, aluno.id,
    onConcluido, onRecibo, safeClose, onSuccess, success, error,
  ]);

  return { processando, submit };
}

// ═════════════════════════════════════════════════════════════════════════════
// Componente principal
// ═════════════════════════════════════════════════════════════════════════════

export function ModalPagamentoRapido({
  escolaId,
  aluno,
  mensalidade,
  open,
  onClose,
  onSuccess,
}: ModalPagamentoRapidoProps) {
  // ── Estado do formulário ─────────────────────────────────────────────────
  const [metodo,   setMetodo]   = useState<MetodoPagamento>("cash");
  const [detalhes, setDetalhes] = useState<MetodoDetalhes>(DETALHES_VAZIOS);
  const [valor,    setValor]    = useState("");
  const [concluido, setConcluido] = useState(false);
  const [recibo,    setRecibo]    = useState<ReciboState>(null);
  const [escolaNome, setEscolaNome] = useState<string | null>(null);

  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);
  const { isEnabled: canEmitirRecibo } = usePlanFeature("fin_recibo_pdf");

  // ── Derivados ────────────────────────────────────────────────────────────
  const valorNum   = useMemo(() => safeNumber(valor), [valor]);
  const valorDevido = mensalidade?.valor ?? 0;
  const troco      = valorNum - valorDevido;
  const trocoValido = Number.isFinite(troco) && troco >= 0;
  const mesAno     = useMemo(
    () => mesAnoLabel(mensalidade?.mes, mensalidade?.ano),
    [mensalidade?.mes, mensalidade?.ano]
  );

  const sugestoes = useMemo(() => {
    if (metodo !== "cash" || valorDevido <= 0) return [];
    return Array.from(new Set([
      valorDevido,
      Math.ceil(valorDevido / 100) * 100,
      Math.ceil(valorDevido / 500) * 500,
    ])).sort((a, b) => a - b);
  }, [metodo, valorDevido]);

  const canConfirm = !!mensalidade && trocoValido;

  const safeClose = useCallback(() => { onClose(); }, [onClose]);

  // ── Reset ao abrir ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setConcluido(false);
    setMetodo("cash");
    setDetalhes(DETALHES_VAZIOS);
    setValor(mensalidade?.valor != null ? String(mensalidade.valor) : "");
    setRecibo(null);
    setTimeout(() => confirmBtnRef.current?.focus(), 50);
  }, [open, mensalidade?.id, mensalidade?.valor]);

  // ── Reset detalhes ao mudar método ──────────────────────────────────────
  useEffect(() => { setDetalhes(DETALHES_VAZIOS); }, [metodo]);

  // ── Buscar nome da escola ────────────────────────────────────────────────
  useEffect(() => {
    if (!open || !escolaId) return;
    fetch(`/api/escolas/${escolaId}/nome`, { cache: "no-store" })
      .then(r => r.json())
      .then(j => { if (j?.ok && j?.nome) setEscolaNome(j.nome); })
      .catch(() => {});
  }, [escolaId, open]);

  // ── Print pós-pagamento ──────────────────────────────────────────────────
  useEffect(() => {
    if (!recibo) return;
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, [recibo]);

  // ── Submissão ────────────────────────────────────────────────────────────
  const { processando, submit } = usePagamentoSubmit({
    aluno, mensalidade, metodo, detalhes, valorPagoNum: valorNum,
    mesAno, trocoValido, canEmitirRecibo,
    onConcluido: () => setConcluido(true),
    onRecibo:    setRecibo,
    safeClose, onSuccess,
  });

  // ── Teclado ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !concluido && !processando) { safeClose(); return; }
      if (e.key === "Enter") {
        const t = e.target as HTMLElement;
        const typing = t?.tagName === "INPUT" || t?.tagName === "TEXTAREA";
        if (!typing) { e.preventDefault(); submit(); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, concluido, processando, safeClose, submit]);

  if (!open) return null;

  const { label: statusLabel, cls: statusCls } = statusConfig(mensalidade?.status);
  const vencimentoLabel = mensalidade?.vencimento
    ? new Date(mensalidade.vencimento).toLocaleDateString("pt-PT")
    : null;

  return (
    <>
      {/* Overlay + modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl
          ring-1 ring-slate-200 overflow-hidden">

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="relative border-b border-slate-100 px-6 py-4">
            {/* Faixa dourada topo */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5
              bg-gradient-to-r from-transparent via-[#E3B23C]/60 to-transparent" />

            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                {/* Ícone */}
                <div className="h-11 w-11 rounded-2xl bg-slate-100 border border-slate-200
                  flex items-center justify-center flex-shrink-0">
                  {concluido
                    ? <CheckCircle className="h-6 w-6 text-[#1F6B3B]" />
                    : <CreditCard  className="h-6 w-6 text-slate-600" />
                  }
                </div>

                {/* Título + aluno */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-black text-slate-900">
                      {concluido ? "Pagamento concluído" : "Pagamento rápido"}
                    </h2>
                    {mensalidade && (
                      <span className={`inline-flex items-center rounded-full border
                        px-2 py-0.5 text-[10px] font-bold ${statusCls}`}>
                        {statusLabel}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500 truncate">{aluno.nome}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {aluno.turma && (
                      <span className="inline-flex rounded-full border border-slate-200
                        px-2 py-0.5 text-[10px] text-slate-500">{aluno.turma}</span>
                    )}
                    {aluno.bi && (
                      <span className="inline-flex rounded-full border border-slate-200
                        px-2 py-0.5 text-[10px] text-slate-500">BI: {aluno.bi}</span>
                    )}
                  </div>
                </div>
              </div>

              {!concluido && !processando && (
                <button
                  type="button"
                  onClick={safeClose}
                  aria-label="Fechar"
                  className="flex-shrink-0 rounded-xl p-2 transition hover:bg-slate-100
                    focus:outline-none focus:ring-4 focus:ring-[#E3B23C]/20"
                >
                  <X className="h-5 w-5 text-slate-500" />
                </button>
              )}
            </div>
          </div>

          {/* ── Body ────────────────────────────────────────────────────── */}
          <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-5">
            {concluido ? (
              <EstadoConcluido />
            ) : (
              <>
                {/* Card da mensalidade */}
                {mensalidade ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          Mensalidade
                        </p>
                        <p className="mt-1 text-base font-bold text-slate-900">{mesAno}</p>
                        {vencimentoLabel && (
                          <p className="mt-0.5 text-xs text-slate-500">
                            Venc. <span className="font-semibold text-slate-700">{vencimentoLabel}</span>
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[10px] text-slate-400">Valor</p>
                        <p className="text-xl font-black text-slate-900">
                          {moneyAOA.format(mensalidade.valor)}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-[#E3B23C]/20 bg-[#E3B23C]/5
                    p-4 text-sm text-slate-600">
                    Nenhuma mensalidade seleccionada.
                  </div>
                )}

                {/* Método de pagamento */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-900">Método</p>
                    <span className="text-[11px] text-slate-400">Padrão: Cash</span>
                  </div>
                  <MetodoGrid value={metodo} onChange={setMetodo} disabled={processando} />
                  <DetalhesMetodo
                    metodo={metodo}
                    detalhes={detalhes}
                    onChange={d => setDetalhes(prev => ({ ...prev, ...d }))}
                    disabled={processando}
                  />
                </div>

                {/* Valor recebido */}
                <ValorInput
                  valor={valor}
                  onChange={setValor}
                  sugestoes={sugestoes}
                  disabled={processando}
                />

                {/* Troco (só cash) */}
                {metodo === "cash" && valorNum > 0 && (
                  <TrocoCard troco={troco} valido={trocoValido} />
                )}

                {/* Resumo */}
                <ResumoCard
                  valorDevido={valorDevido}
                  valorPago={valorNum}
                  troco={troco}
                  trocoValido={trocoValido}
                />
              </>
            )}
          </div>

          {/* ── Footer ──────────────────────────────────────────────────── */}
          <div className="border-t border-slate-100 bg-white px-6 py-4">
            {concluido ? (
              <p className="text-center text-sm text-slate-400">
                A fechar automaticamente…
              </p>
            ) : (
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={safeClose}
                  disabled={processando}
                  className="flex-1 rounded-xl"
                >
                  Cancelar
                </Button>
                <Button
                  ref={confirmBtnRef}
                  onClick={submit}
                  disabled={!canConfirm || processando}
                  className="flex-1 rounded-xl bg-[#E3B23C] text-white
                    hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processando ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      A processar…
                    </span>
                  ) : (
                    `Confirmar — ${moneyAOA.format(valorNum || valorDevido)}`
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recibo (imprimível, fora do modal) */}
      {recibo && (
        <ReciboImprimivel
          escolaNome={escolaNome ?? "Escola"}
          alunoNome={aluno.nome}
          valor={mensalidade?.valor ?? 0}
          data={new Date().toISOString()}
          urlValidacao={recibo.url_validacao}
        />
      )}
    </>
  );
}