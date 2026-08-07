"use client";

import React from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Clock,
  ExternalLink,
  Printer,
  RefreshCw,
} from "lucide-react";
import type { RematriculaCardState } from "@/hooks/useRematriculaBalcao";

// ─── Types ───────────────────────────────────────────────────────────────────

interface RematriculaBalcaoCardProps {
  cardState: RematriculaCardState | null;
  loading: boolean;
  anoLetivo: { id: string; ano: number; label: string } | null;
  service: { id: string; nome: string; valor_base: number } | null;
  debt: { total: number; count: number } | null;
  pedido: {
    id: string;
    status: string;
    created_at: string;
    turma_id?: string;
    valor_cobrado?: number;
  } | null;
  comprovante: { docId: string; publicId: string; printUrl: string } | null;
  turmaAtual: string | null;
  onConfirmar: () => void;
  onRetomar: () => void;
  onVerDividas: () => void;
  onConfigurarEmolumentos: () => void;
  onAbrirPendencia: () => void;
}

// ─── Formatter ───────────────────────────────────────────────────────────────

const kwanza = new Intl.NumberFormat("pt-AO", {
  style: "currency",
  currency: "AOA",
  maximumFractionDigits: 0,
});

// ─── Component ───────────────────────────────────────────────────────────────

export function RematriculaBalcaoCard({
  cardState,
  loading,
  anoLetivo,
  service,
  debt,
  pedido,
  comprovante,
  turmaAtual,
  onConfirmar,
  onRetomar,
  onVerDividas,
  onConfigurarEmolumentos,
  onAbrirPendencia,
}: RematriculaBalcaoCardProps) {
  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="xl:col-span-12 rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-full bg-slate-200 animate-pulse" />
          <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="h-3 w-48 bg-slate-100 rounded animate-pulse" />
        <div className="pt-2">
          <div className="h-10 w-full bg-slate-100 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  // ── Null guard ────────────────────────────────────────────────────────────
  if (!cardState) return null;

  const anoLabel = anoLetivo?.label ?? "Ano Lectivo";

  switch (cardState) {
    // ── READY ─────────────────────────────────────────────────────────────
    case "READY":
      return (
        <div className="xl:col-span-12 rounded-2xl border border-[#1F6B3B]/20 bg-[#1F6B3B]/5 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-[#1F6B3B]" />
            <h3 className="text-sm font-bold uppercase tracking-wide text-[#1F6B3B]">
              Rematrícula {anoLabel}
            </h3>
            <span className="ml-auto inline-flex items-center rounded-full bg-white border border-[#1F6B3B]/10 px-2 py-0.5 text-xs font-semibold text-[#1F6B3B]">
              {anoLabel}
            </span>
          </div>
          <p className="text-sm text-slate-600">
            Confirme a permanência do aluno em {anoLabel}.
            {turmaAtual && (
              <span className="block mt-1 text-slate-500">
                Turma actual: <strong>{turmaAtual}</strong>
              </span>
            )}
          </p>
          <div className="pt-1">
            <button
              onClick={onConfirmar}
              className="w-full flex items-center justify-center gap-2 rounded-xl
                bg-[#1F6B3B] px-4 py-2.5 text-sm font-bold text-white
                transition-all hover:brightness-110 active:scale-[0.98]"
            >
              <RefreshCw className="h-4 w-4" />
              Confirmar rematrícula
            </button>
          </div>
        </div>
      );

    // ── DEBT_BLOCKED ──────────────────────────────────────────────────────
    case "DEBT_BLOCKED":
      return (
        <div className="xl:col-span-12 rounded-2xl border border-rose-200 bg-rose-50 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-rose-600" />
            <h3 className="text-sm font-bold uppercase tracking-wide text-rose-700">
              Rematrícula bloqueada
            </h3>
          </div>
          <p className="text-sm text-rose-700/80">
            Regularize as dívidas do aluno antes de continuar.
          </p>
          {debt && (
            <div className="rounded-xl border border-rose-200 bg-white/60 p-3 flex items-baseline justify-between">
              <span className="text-sm text-rose-700">Dívida acumulada</span>
              <span className="text-lg font-black text-rose-800">
                {kwanza.format(debt.total)}
              </span>
            </div>
          )}
          {debt && (
            <p className="text-xs text-rose-600">
              {debt.count} {debt.count === 1 ? "mensalidade pendente" : "mensalidades pendentes"}
            </p>
          )}
          <div className="pt-1">
            <button
              onClick={onVerDividas}
              className="w-full flex items-center justify-center gap-2 rounded-xl
                bg-rose-100 px-4 py-2.5 text-sm font-bold text-rose-700
                hover:bg-rose-200 transition-colors"
            >
              Ver dívidas
            </button>
          </div>
        </div>
      );

    // ── PRICE_NOT_CONFIGURED ──────────────────────────────────────────────
    case "PRICE_NOT_CONFIGURED":
      return (
        <div className="xl:col-span-12 rounded-2xl border border-amber-200 bg-amber-50 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <h3 className="text-sm font-bold uppercase tracking-wide text-amber-700">
              Serviço não configurado
            </h3>
          </div>
          <p className="text-sm text-amber-700/80">
            A escola ainda não definiu o emolumento de rematrícula.
          </p>
          <div className="pt-1">
            <button onClick={onConfigurarEmolumentos} className="text-sm font-bold text-amber-700 hover:text-amber-800 underline underline-offset-4 transition-colors">
              Configurar emolumentos
            </button>
          </div>
        </div>
      );

    // ── ALREADY_COMPLETED ─────────────────────────────────────────────────
    case "ALREADY_COMPLETED":
      return (
        <div className="xl:col-span-12 rounded-2xl border border-[#1F6B3B]/30 bg-[#1F6B3B]/10 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-[#1F6B3B]" />
            <h3 className="text-sm font-bold uppercase tracking-wide text-[#1F6B3B]">
              Rematrícula concluída
            </h3>
            <span className="ml-auto inline-flex items-center rounded-full bg-white border border-[#1F6B3B]/10 px-2 py-0.5 text-xs font-semibold text-[#1F6B3B]">
              {anoLabel}
            </span>
          </div>
          <div className="text-sm text-slate-700 space-y-1">
            {pedido?.created_at && (
              <p>
                Data:{" "}
                <strong>
                  {new Date(pedido.created_at).toLocaleDateString("pt-AO", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </strong>
              </p>
            )}
            {pedido?.valor_cobrado !== undefined && pedido.valor_cobrado !== null && (
              <p>
                Valor pago:{" "}
                <strong>{kwanza.format(pedido.valor_cobrado)}</strong>
              </p>
            )}
          </div>
          <div className="pt-1 flex flex-col gap-2 sm:flex-row">
            {comprovante?.printUrl && (
              <>
                <button
                  onClick={() => window.open(comprovante.printUrl, "_blank", "noopener,noreferrer")}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl
                    bg-white border border-[#1F6B3B]/20 px-4 py-2 text-sm font-bold
                    text-[#1F6B3B] hover:bg-[#1F6B3B]/5 transition-colors"
                >
                  <Printer className="h-4 w-4" />
                  Imprimir comprovante
                </button>
                <button
                  onClick={() => window.open(comprovante.printUrl, "_blank", "noopener,noreferrer")}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl
                    bg-white border border-slate-200 px-4 py-2 text-sm font-bold
                    text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  Ver comprovante
                </button>
              </>
            )}
          </div>
        </div>
      );

    // ── PAYMENT_IN_PROGRESS ───────────────────────────────────────────────
    case "PAYMENT_IN_PROGRESS":
      return (
        <div className="xl:col-span-12 rounded-2xl border border-amber-200 bg-amber-50 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-600" />
            <h3 className="text-sm font-bold uppercase tracking-wide text-amber-700">
              Pagamento em andamento
            </h3>
          </div>
          <p className="text-sm text-amber-700/80">
            Retome o atendimento existente para evitar cobrança duplicada.
          </p>
          <div className="pt-1">
            <button
              onClick={onRetomar}
              className="w-full flex items-center justify-center gap-2 rounded-xl
                bg-amber-500 px-4 py-2.5 text-sm font-bold text-white
                transition-all hover:brightness-110 active:scale-[0.98]"
            >
              <RefreshCw className="h-4 w-4" />
              Retomar pagamento
            </button>
          </div>
        </div>
      );

    // ── RECONCILIATION_REQUIRED ───────────────────────────────────────────
    case "RECONCILIATION_REQUIRED":
      return (
        <div className="xl:col-span-12 rounded-2xl border border-amber-300 bg-amber-100 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-700" />
            <h3 className="text-sm font-bold uppercase tracking-wide text-amber-800">
              Pagamento confirmado — acção administrativa pendente
            </h3>
          </div>
          <p className="text-sm text-amber-800/80">
            Não cobre novamente. A operação precisa de reconciliação.
          </p>
          <div className="pt-1">
            <button onClick={onAbrirPendencia} className="w-full flex items-center justify-center gap-2 rounded-xl
              bg-white/50 border border-amber-300 px-4 py-2.5 text-sm font-bold
              text-amber-700 hover:bg-white/80 transition-colors">
              Abrir pendência
            </button>
          </div>
        </div>
      );

    default:
      return null;
  }
}
