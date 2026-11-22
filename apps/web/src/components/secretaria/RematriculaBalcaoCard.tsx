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
      <div className="xl:col-span-12 rounded-2xl border border-border bg-card shadow-sm p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-full bg-muted-foreground/15 animate-pulse" />
          <div className="h-4 w-32 bg-muted-foreground/15 rounded animate-pulse" />
        </div>
        <div className="h-3 w-48 bg-muted rounded animate-pulse" />
        <div className="pt-2">
          <div className="h-10 w-full bg-muted rounded-xl animate-pulse" />
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
        <div className="xl:col-span-12 rounded-2xl border border-klasse-green/20 bg-klasse-green/5 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-klasse-green dark:text-klasse-green-300" />
            <h3 className="text-sm font-bold uppercase tracking-wide text-klasse-green dark:text-klasse-green-300">
              Rematrícula {anoLabel}
            </h3>
            <span className="ml-auto inline-flex items-center rounded-full bg-card border border-klasse-green/10 px-2 py-0.5 text-xs font-semibold text-klasse-green dark:text-klasse-green-300">
              {anoLabel}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Confirme a permanência do aluno em {anoLabel}.
            {turmaAtual && (
              <span className="block mt-1 text-muted-foreground">
                Turma actual: <strong>{turmaAtual}</strong>
              </span>
            )}
          </p>
          <div className="pt-1">
            <button
              onClick={onConfirmar}
              className="w-full flex items-center justify-center gap-2 rounded-xl
                bg-klasse-green px-4 py-2.5 text-sm font-bold text-white
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
            <div className="rounded-xl border border-rose-200 bg-card/60 p-3 flex items-baseline justify-between">
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
              Regularizar no balcão
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
        <div className="xl:col-span-12 rounded-2xl border border-klasse-green/30 bg-klasse-green/10 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-klasse-green dark:text-klasse-green-300" />
            <h3 className="text-sm font-bold uppercase tracking-wide text-klasse-green dark:text-klasse-green-300">
              Rematrícula concluída
            </h3>
            <span className="ml-auto inline-flex items-center rounded-full bg-card border border-klasse-green/10 px-2 py-0.5 text-xs font-semibold text-klasse-green dark:text-klasse-green-300">
              {anoLabel}
            </span>
          </div>
          <div className="text-sm text-foreground space-y-1">
            {pedido?.created_at && (
              <p>
                Data:{" "}
                <strong>
                  {new Date(pedido.created_at).toLocaleDateString("pt-AO", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    timeZone: "Africa/Luanda",
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
                    bg-card border border-klasse-green/20 px-4 py-2 text-sm font-bold
                    text-klasse-green dark:text-klasse-green-300 hover:bg-klasse-green/5 transition-colors"
                >
                  <Printer className="h-4 w-4" />
                  Abrir comprovante
                </button>
                <button
                  onClick={() => window.open(comprovante.printUrl, "_blank", "noopener,noreferrer")}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl
                    bg-card border border-border px-4 py-2 text-sm font-bold
                    text-foreground hover:bg-muted transition-colors"
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
              bg-card/50 border border-amber-300 px-4 py-2.5 text-sm font-bold
              text-amber-700 hover:bg-card/80 transition-colors">
              Abrir pendência
            </button>
          </div>
        </div>
      );

    // ── WINDOW_CLOSED ─────────────────────────────────────────────────────
    case "WINDOW_CLOSED":
      return (
        <div className="xl:col-span-12 rounded-2xl border border-border bg-muted shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">
              Período de rematrícula fechado
            </h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Abra uma janela de rematrícula para este ano letivo antes de iniciar novas operações.
          </p>
        </div>
      );

    default:
      return null;
  }
}
