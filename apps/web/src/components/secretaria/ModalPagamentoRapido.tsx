"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote, Calculator, CheckCircle, CreditCard,
  Loader2, Smartphone, Wallet, X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ReciboImprimivel } from "@/components/financeiro/ReciboImprimivel";
import { useToast } from "@/components/feedback/FeedbackSystem";
import { FluxoPosAccao, ConfirmacaoContextual, Passo } from "@/components/harmonia";
import { useRouter } from "next/navigation";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildPortalHref } from "@/lib/navigation";

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
  partial_reason?: string;
  promise_date?:   string;
};

type ReciboState = { url_validacao: string | null; logo_url?: string | null } | null;

type MensalidadeOption = {
  id: string;
  mes: number;
  ano: number;
  valor: number;
  vencimento?: string;
  status: string;
};

type ReciboBatchItem = {
  id: string;
  url_validacao: string | null;
  valor: number;
  referencia: string;
  referenciasDetalhadas?: string[];
};

export interface ModalPagamentoRapidoProps {
  escolaId?:    string | null;
  aluno: {
    id:    string;
    nome:  string;
    turma?: string;
    bi?:    string;
  };
  mensalidade: MensalidadeOption | null;
  mensalidades?: MensalidadeOption[];
  initialSelectedIds?: string[];
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
  referencia: "", evidencia_url: "", gateway_ref: "", partial_reason: "", promise_date: "",
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

function sortMensalidades(items: MensalidadeOption[]) {
  return [...items].sort((a, b) => {
    if (a.ano !== b.ano) return a.ano - b.ano;
    return a.mes - b.mes;
  });
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

function summarizeReferencias(referencias: string[]) {
  const limpas = referencias.filter((item) => item && item.trim().length > 0);
  if (limpas.length <= 1) return limpas[0] ?? "Mensalidade";
  if (limpas.length === 2) return limpas.join(" + ");
  return `${limpas[0]} + ${limpas.length - 1} meses`;
}

function MensalidadesSelector({
  mensalidades,
  selectedIds,
  onToggle,
  disabled,
}: {
  mensalidades: MensalidadeOption[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Mensalidades
        </p>
        <span className="text-[11px] font-semibold text-slate-400">
          {selectedIds.length} selecionada(s)
        </span>
      </div>

      <div className="space-y-2">
        {mensalidades.map((item) => {
          const checked = selectedIds.includes(item.id);
          const { cls, label } = statusConfig(item.status);
          const vencimentoLabel = item.vencimento
            ? new Date(item.vencimento).toLocaleDateString("pt-PT")
            : null;

          return (
            <label
              key={item.id}
              className={[
                "flex items-start gap-3 rounded-2xl border px-3 py-3 transition-all",
                checked ? "border-[#E3B23C] bg-white ring-2 ring-[#E3B23C]/10" : "border-slate-200 bg-white",
                disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:border-slate-300",
              ].join(" ")}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(item.id)}
                disabled={disabled}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-[#E3B23C] focus:ring-[#E3B23C]"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{mesAnoLabel(item.mes, item.ano)}</p>
                    {vencimentoLabel ? (
                      <p className="text-[11px] text-slate-500">Venc. {vencimentoLabel}</p>
                    ) : null}
                  </div>
                  <p className="text-sm font-black text-slate-900">{moneyAOA.format(item.valor)}</p>
                </div>
                <div className="mt-2">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${cls}`}>
                    {label}
                  </span>
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
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
  const isPartial = valorPago > 0 && valorPago < valorDevido;
  const saldoRestante = valorDevido - valorPago;

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
        {isPartial ? (
          <div className="border-t border-slate-200 pt-2 flex items-center justify-between">
            <span className="font-bold text-amber-600">Saldo restante</span>
            <span className="font-black text-amber-600">{moneyAOA.format(saldoRestante)}</span>
          </div>
        ) : (
          <div className="border-t border-slate-200 pt-2 flex items-center justify-between">
            <span className="font-bold text-slate-900">Troco</span>
            <span className="font-black text-slate-900">{moneyAOA.format(troco)}</span>
          </div>
        )}
      </div>

      {!trocoValido && !isPartial && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2
          text-xs text-rose-700 font-medium">
          O valor recebido deve ser igual ou superior ao valor da mensalidade.
        </div>
      )}

      {isPartial && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2
          text-xs text-amber-800 font-medium">
          Pagamento parcial detectado. Justificativa e promessa são obrigatórias.
        </div>
      )}
    </div>
  );
}

function EstadoConcluido({ 
  aluno, 
  valor, 
  mesAno, 
  escolaId, 
  onClose 
}: { 
  aluno: ModalPagamentoRapidoProps["aluno"]; 
  valor: number; 
  mesAno: string; 
  escolaId: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const { escolaSlug } = useEscolaId();
  const escolaParam = escolaSlug || escolaId;
  return (
    <div className="py-2 space-y-6">
      <ConfirmacaoContextual
        acaoId="pagamento.registado"
        contexto={{
          valor: moneyAOA.format(valor),
          nome: aluno.nome,
          mes: mesAno,
        }}
        onClose={() => {}}
      />

      <FluxoPosAccao
        acaoId="pagamento.registado"
        contexto={{
          valor: moneyAOA.format(valor),
          nome: aluno.nome,
          mes: mesAno,
        }}
        onEscolher={(passo: Passo) => {
          if (passo.id === "emitir_recibo" && escolaParam) {
            router.push(buildPortalHref(escolaParam, "/financeiro/pagamentos"));
          } else if (passo.id === "ver_atrasos" && escolaParam) {
            router.push(buildPortalHref(escolaParam, "/financeiro/radar"));
          } else if (passo.id === "novo_pagamento") {
            onClose();
          }
        }}
        onDismiss={onClose}
      />
    </div>
  );
}

// ─── Hook: lógica de submissão ────────────────────────────────────────────────

function usePagamentoSubmit({
  aluno,
  mensalidadesSelecionadas,
  metodo,
  detalhes,
  valorPagoNum,
  trocoValido,
  onConcluido,
  onRecibos,
  safeClose,
  onSuccess,
}: {
  aluno:          ModalPagamentoRapidoProps["aluno"];
  mensalidadesSelecionadas: MensalidadeOption[];
  metodo:         MetodoPagamento;
  detalhes:       MetodoDetalhes;
  valorPagoNum:   number;
  trocoValido:    boolean;
  onConcluido:    () => void;
  onRecibos:      (r: ReciboBatchItem[]) => void;
  safeClose:      () => void;
  onSuccess?:     () => void;
}) {
  const [processando, setProcessando] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const { error } = useToast();

  useEffect(() => () => abortRef.current?.abort(), []);

  const submit = useCallback(async () => {
    if (mensalidadesSelecionadas.length === 0 || !trocoValido || processando) return;

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
      const recibosGerados: ReciboBatchItem[] = [];

      for (const mensalidade of mensalidadesSelecionadas) {
        const idempotencyKey = crypto.randomUUID?.() ??
          `${Date.now()}-${Math.random().toString(16).slice(2)}-${mensalidade.id}`;

        const referencia = mesAnoLabel(mensalidade.mes, mensalidade.ano);
        const valor = mensalidadesSelecionadas.length === 1
          ? (valorPagoNum || mensalidade.valor)
          : mensalidade.valor;

        const res = await fetch("/api/secretaria/balcao/pagamentos", {
          method:  "POST",
          headers: {
            "Content-Type":    "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          signal: abortRef.current.signal,
          body: JSON.stringify({
            aluno_id:       aluno.id,
            mensalidade_id: mensalidade.id,
            valor,
            metodo,
            reference:      detalhes.referencia    || null,
            evidence_url:   detalhes.evidencia_url || null,
            meta: {
              observacao:      `Pagamento rápido - ${referencia}`,
              origem:          "pagamento_rapido",
              gateway_ref:     detalhes.gateway_ref || null,
              partial_reason:  detalhes.partial_reason || null,
              promise_date:    detalhes.promise_date || null,
            },
          }),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || `Falha ao registar pagamento de ${referencia}.`);
        }

        if (json.fiscal?.ok) {
          recibosGerados.push({
            id: String(json.fiscal.documento_id ?? mensalidade.id),
            url_validacao: json.fiscal.url_validacao ?? null,
            valor,
            referencia,
          });
        } else {
          recibosGerados.push({
            id: mensalidade.id,
            url_validacao: null,
            valor,
            referencia,
          });
        }
      }

      if (recibosGerados.length > 1) {
        const referenciasDetalhadas = recibosGerados.map((item) => item.referencia);
        onRecibos([
          {
            id: `batch:${mensalidadesSelecionadas.map((item) => item.id).join(",")}`,
            url_validacao: null,
            valor: recibosGerados.reduce((sum, item) => sum + Number(item.valor || 0), 0),
            referencia: summarizeReferencias(referenciasDetalhadas),
            referenciasDetalhadas,
          },
        ]);
      } else {
        onRecibos(recibosGerados);
      }
      onConcluido();
      if (onSuccess) onSuccess();

    } catch (err: any) {
      if (err?.name === "AbortError") return;
      error(err instanceof Error ? err.message : "Não foi possível processar o pagamento.");
    } finally {
      setProcessando(false);
    }
  }, [
    mensalidadesSelecionadas, trocoValido, processando, metodo, detalhes,
    valorPagoNum, aluno.id,
    onConcluido, onRecibos, onSuccess, error,
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
  mensalidades,
  initialSelectedIds,
  open,
  onClose,
  onSuccess,
}: ModalPagamentoRapidoProps) {
  // ── Estado do formulário ─────────────────────────────────────────────────
  const [metodo,   setMetodo]   = useState<MetodoPagamento>("cash");
  const [detalhes, setDetalhes] = useState<MetodoDetalhes>(DETALHES_VAZIOS);
  const [valor,    setValor]    = useState("");
  const [concluido, setConcluido] = useState(false);
  const [recibos,   setRecibos]   = useState<ReciboBatchItem[]>([]);
  const [escolaNome, setEscolaNome] = useState<string | null>(null);
  const [escolaLogoUrl, setEscolaLogoUrl] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);
  const availableMensalidades = useMemo(() => {
    if (mensalidades?.length) return sortMensalidades(mensalidades);
    return mensalidade ? [mensalidade] : [];
  }, [mensalidade, mensalidades]);
  const isBatchMode = availableMensalidades.length > 1;
  const mensalidadesSelecionadas = useMemo(
    () => availableMensalidades.filter((item) => selectedIds.includes(item.id)),
    [availableMensalidades, selectedIds]
  );
  const mensalidadePrincipal = mensalidadesSelecionadas[0] ?? availableMensalidades[0] ?? null;

  // ── Derivados ────────────────────────────────────────────────────────────
  const valorNum   = useMemo(() => safeNumber(valor), [valor]);
  const valorDevido = useMemo(
    () => mensalidadesSelecionadas.reduce((sum, item) => sum + item.valor, 0),
    [mensalidadesSelecionadas]
  );
  const troco      = valorNum - valorDevido;
  const trocoValido = isBatchMode
    ? mensalidadesSelecionadas.length > 0
    : Number.isFinite(troco) && troco >= 0;
  const isPartial = !isBatchMode && valorNum > 0 && valorNum < valorDevido;
  const mesAno     = useMemo(
    () => {
      if (mensalidadesSelecionadas.length > 1) return `${mensalidadesSelecionadas.length} mensalidades`;
      return mesAnoLabel(mensalidadePrincipal?.mes, mensalidadePrincipal?.ano);
    },
    [mensalidadePrincipal?.mes, mensalidadePrincipal?.ano, mensalidadesSelecionadas.length]
  );

  const sugestoes = useMemo(() => {
    if (isBatchMode || metodo !== "cash" || valorDevido <= 0) return [];
    return Array.from(new Set([
      valorDevido,
      Math.ceil(valorDevido / 100) * 100,
      Math.ceil(valorDevido / 500) * 500,
    ])).sort((a, b) => a - b);
  }, [isBatchMode, metodo, valorDevido]);

  const canConfirm = mensalidadesSelecionadas.length > 0 && (trocoValido || (isPartial && !!detalhes.partial_reason?.trim() && !!detalhes.promise_date));

  const safeClose = useCallback(() => { onClose(); }, [onClose]);
  const toggleMensalidade = useCallback((id: string) => {
    setSelectedIds((prev) => (
      prev.includes(id) ? prev.filter((currentId) => currentId !== id) : [...prev, id]
    ));
  }, []);

  // ── Reset ao abrir ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setConcluido(false);
    setMetodo("cash");
    setDetalhes(DETALHES_VAZIOS);
    const fallbackSelectedIds = initialSelectedIds?.length
      ? initialSelectedIds.filter((id) => availableMensalidades.some((item) => item.id === id))
      : availableMensalidades[0]?.id
        ? [availableMensalidades[0].id]
        : [];
    setSelectedIds(fallbackSelectedIds);
    const initialTotal = fallbackSelectedIds.reduce((sum, id) => {
      const item = availableMensalidades.find((mens) => mens.id === id);
      return sum + Number(item?.valor ?? 0);
    }, 0);
    setValor(initialTotal > 0 ? String(initialTotal) : "");
    setRecibos([]);
    setTimeout(() => confirmBtnRef.current?.focus(), 50);
  }, [open, initialSelectedIds, availableMensalidades]);

  // ── Reset detalhes ao mudar método ──────────────────────────────────────
  useEffect(() => { setDetalhes(DETALHES_VAZIOS); }, [metodo]);

  useEffect(() => {
    if (!isBatchMode) return;
    setValor(valorDevido > 0 ? String(valorDevido) : "");
  }, [isBatchMode, valorDevido]);

  // ── Buscar nome da escola ────────────────────────────────────────────────
  useEffect(() => {
    if (!open || !escolaId) return;
    fetch(`/api/escolas/${escolaId}/nome`, { cache: "no-store" })
      .then(r => r.json())
      .then(j => {
        if (j?.ok && j?.nome) setEscolaNome(j.nome);
        if (j?.ok) setEscolaLogoUrl(j.logo_url ?? null);
      })
      .catch(() => {});
  }, [escolaId, open]);

  // ── Print pós-pagamento ──────────────────────────────────────────────────
  useEffect(() => {
    if (recibos.length === 0) return;
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, [recibos]);

  // ── Submissão ────────────────────────────────────────────────────────────
  const { processando, submit } = usePagamentoSubmit({
    aluno, mensalidadesSelecionadas, metodo, detalhes, valorPagoNum: valorNum,
    trocoValido,
    onConcluido: () => setConcluido(true),
    onRecibos:   (payload) => setRecibos(payload),
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

  const { label: statusLabel, cls: statusCls } = statusConfig(mensalidadePrincipal?.status);
  const vencimentoLabel = mensalidadePrincipal?.vencimento
    ? new Date(mensalidadePrincipal.vencimento).toLocaleDateString("pt-PT")
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
                    {mensalidadePrincipal && (
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
              <EstadoConcluido 
                aluno={aluno}
                valor={valorNum || valorDevido}
                mesAno={mesAno} 
                escolaId={escolaId ?? null}
                onClose={safeClose}
              />
            ) : (
              <>
                {/* Card da mensalidade */}
                {availableMensalidades.length > 0 ? (
                  isBatchMode ? (
                    <MensalidadesSelector
                      mensalidades={availableMensalidades}
                      selectedIds={selectedIds}
                      onToggle={toggleMensalidade}
                      disabled={processando}
                    />
                  ) : (
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
                            {moneyAOA.format(mensalidadePrincipal?.valor ?? 0)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
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
                {isBatchMode ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          Total automático
                        </p>
                        <p className="mt-1 text-base font-bold text-slate-900">
                          {mensalidadesSelecionadas.length} mensalidade(s)
                        </p>
                      </div>
                      <p className="text-2xl font-black text-slate-900">{moneyAOA.format(valorDevido)}</p>
                    </div>
                  </div>
                ) : (
                  <ValorInput
                    valor={valor}
                    onChange={setValor}
                    sugestoes={sugestoes}
                    disabled={processando}
                  />
                )}

                {/* Bloco de Justificativa para Pagamento Parcial */}
                {isPartial && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">
                      Justificativa do Pagamento Parcial
                    </p>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                          Motivo <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                          value={detalhes.partial_reason}
                          onChange={e => setDetalhes(prev => ({ ...prev, partial_reason: e.target.value }))}
                          disabled={processando}
                          placeholder="Ex: Aluno esqueceu parte do valor..."
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10 min-h-[60px]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                          Próximo pagamento (Promessa) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={detalhes.promise_date}
                          onChange={e => setDetalhes(prev => ({ ...prev, promise_date: e.target.value }))}
                          disabled={processando}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Troco (só cash) */}
                {!isBatchMode && metodo === "cash" && valorNum > 0 && (
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
            {concluido ? null : (
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
                    `Confirmar — ${moneyAOA.format(isBatchMode ? valorDevido : (valorNum || valorDevido))}`
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recibo (imprimível, fora do modal) */}
      {recibos.map((recibo) => (
        <ReciboImprimivel
          key={recibo.id}
          escolaNome={escolaNome ?? "Escola"}
          alunoNome={aluno.nome}
          valor={recibo.valor}
          data={new Date().toISOString()}
          urlValidacao={recibo.url_validacao}
          logoUrl={escolaLogoUrl}
          referencia={recibo.referencia}
          referenciasDetalhadas={recibo.referenciasDetalhadas}
        />
      ))}
    </>
  );
}
