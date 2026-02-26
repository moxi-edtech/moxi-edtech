"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CreditCard,
  FileText,
  UserPlus,
  Wallet,
  Plus,
} from "lucide-react";
import { ModalPagamentoRapido } from "@/components/secretaria/ModalPagamentoRapido";
import { useToast } from "@/components/feedback/FeedbackSystem";

type MensalidadeResumo = {
  id: string;
  mes: number; // 1..12
  ano: number;
  valor: number;
  status: string;
  vencimento?: string;
};

interface AcoesRapidasBalcaoProps {
  alunoId: string;
  alunoNome: string;
  alunoTurma?: string | null;
  alunoBI?: string | null;
  mensalidades: MensalidadeResumo[];
}

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

const moneyAOA = new Intl.NumberFormat("pt-AO", {
  style: "currency",
  currency: "AOA",
  maximumFractionDigits: 0,
});

function isPendente(status?: string | null) {
  const s = (status ?? "").toLowerCase();
  return s === "pendente" || s === "pago_parcial";
}

function sortByCompetenciaAsc(a: MensalidadeResumo, b: MensalidadeResumo) {
  const da = new Date(a.ano, (a.mes ?? 1) - 1, 1).getTime();
  const db = new Date(b.ano, (b.mes ?? 1) - 1, 1).getTime();
  return da - db;
}

function sortByVencimentoAsc(a: MensalidadeResumo, b: MensalidadeResumo) {
  const da = a.vencimento ? new Date(a.vencimento).getTime() : Number.POSITIVE_INFINITY;
  const db = b.vencimento ? new Date(b.vencimento).getTime() : Number.POSITIVE_INFINITY;
  if (da === db) return sortByCompetenciaAsc(a, b);
  return da - db;
}

type QuickAction = {
  id: "pagar" | "doc_freq" | "doc_notas" | "matricula" | "extrato";
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  badge?: "alert" | null;
  isPagamento?: boolean;
  inadimplente?: boolean;
  disabled?: boolean;
};

function QuickCard(props: {
  action: QuickAction;
  dense?: boolean;
}) {
  const { action } = props;
  const Icon = action.icon;

  const isPagamentoCritico = action.isPagamento && action.inadimplente;

  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      className={cx(
        "relative w-full rounded-2xl border border-slate-200 bg-white p-4 text-left",
        "hover:border-[#1F6B3B]/30 hover:shadow-sm transition-all",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        isPagamentoCritico && "border-rose-200"
      )}
    >
      {action.badge === "alert" ? (
        <span className="absolute top-3 right-3 inline-flex h-2.5 w-2.5 items-center justify-center rounded-full bg-rose-500 animate-pulse" />
      ) : null}

      <div className="flex items-start gap-3">
        <div
          className={cx(
            "rounded-xl border border-slate-200 p-2 flex items-center justify-center shrink-0",
            isPagamentoCritico ? "bg-rose-100 text-rose-600 border-rose-200" : "bg-slate-100 text-slate-500"
          )}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-900">{action.title}</div>
          <div className="text-xs text-slate-400">{action.subtitle}</div>
        </div>
      </div>
    </button>
  );
}

export function AcoesRapidasBalcao({
  alunoId,
  alunoNome,
  alunoTurma,
  alunoBI,
  mensalidades,
}: AcoesRapidasBalcaoProps) {
  const router = useRouter();
  const { success, error } = useToast();

  const [modalAberto, setModalAberto] = useState(false);
  const [mensalidadeAtual, setMensalidadeAtual] = useState<MensalidadeResumo | null>(
    null
  );

  const { pendentes, totalPendente, mensalidadeSugerida } = useMemo(() => {
    const pend = (mensalidades ?? []).filter((m) => isPendente(m.status));
    const total = pend.reduce((sum, m) => sum + (Number.isFinite(m.valor) ? m.valor : 0), 0);

    const suggested =
      pend.length > 0
        ? [...pend].sort(sortByVencimentoAsc)[0]
        : (mensalidades?.length ?? 0) > 0
          ? [...mensalidades].sort(sortByCompetenciaAsc)[0]
          : null;

    return { pendentes: pend, totalPendente: total, mensalidadeSugerida: suggested };
  }, [mensalidades]);

  const openPagamento = useCallback(() => {
    if (!mensalidadeSugerida) {
      error("Não há mensalidades pendentes para este aluno.");
      return;
    }
    setMensalidadeAtual(mensalidadeSugerida);
    setModalAberto(true);
  }, [mensalidadeSugerida]);

  const goDocumento = useCallback(
    (tipo: "declaracao_frequencia" | "declaracao_notas") => {
      router.push(`/secretaria/documentos?alunoId=${alunoId}&tipo=${tipo}`);
    },
    [router, alunoId]
  );

  const goMatricula = useCallback(() => {
    router.push(`/secretaria/admissoes/nova?alunoExistenteId=${alunoId}`);
  }, [router, alunoId]);

  const goExtrato = useCallback(() => {
    router.push(`/financeiro?aluno=${alunoId}`);
  }, [router, alunoId]);

  const actions: QuickAction[] = useMemo(
    () => [
      {
        id: "pagar",
        title: "Pagar",
        subtitle: "Propina",
        icon: CreditCard,
        onClick: openPagamento,
        isPagamento: true,
        inadimplente: totalPendente > 0,
        badge: totalPendente > 0 ? "alert" : null,
        disabled: !mensalidadeSugerida,
      },
      {
        id: "doc_freq",
        title: "Declaração",
        subtitle: "Simples",
        icon: FileText,
        onClick: () => goDocumento("declaracao_frequencia"),
      },
      {
        id: "doc_notas",
        title: "Declaração",
        subtitle: "Com notas",
        icon: BookOpen,
        onClick: () => goDocumento("declaracao_notas"),
      },
      {
        id: "matricula",
        title: "Matrícula",
        subtitle: "Nova inscrição",
        icon: UserPlus,
        onClick: goMatricula,
      },
      {
        id: "extrato",
        title: "Extrato",
        subtitle: "Financeiro",
        icon: Wallet,
        onClick: goExtrato,
      },
    ],
    [openPagamento, totalPendente, mensalidadeSugerida, goDocumento, goMatricula, goExtrato]
  );

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Balcão rápido</span>
            <span className="text-sm font-bold text-slate-900 truncate">{alunoNome}</span>
          </div>
        </div>

        <div
          className={cx(
            "rounded-2xl border px-4 py-3 shadow-sm flex flex-col gap-1",
            totalPendente > 0
              ? "bg-[#E3B23C]/10 border-[#E3B23C]/25"
              : "bg-[#1F6B3B]/5 border-[#1F6B3B]/20"
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <span
              className={cx(
                "text-[10px] font-bold uppercase tracking-widest",
                totalPendente > 0 ? "text-[#E3B23C]" : "text-[#1F6B3B]/70"
              )}
            >
              {totalPendente > 0 ? "Total pendente" : "Situação financeira"}
            </span>
            <span className="text-[10px] font-semibold text-slate-400">Resumo</span>
          </div>
          <div className="flex items-end justify-between gap-3">
            <div
              className={cx(
                "text-2xl font-bold",
                totalPendente > 0 ? "text-[#E3B23C]" : "text-[#1F6B3B]"
              )}
            >
              {moneyAOA.format(totalPendente)}
            </div>
            <span className="text-xs text-slate-400">Kz</span>
          </div>
        </div>

        {pendentes.length > 0 && mensalidadeSugerida ? (
          <div className="rounded-2xl border border-[#E3B23C]/20 bg-[#E3B23C]/10 px-4 py-3 text-xs text-slate-500">
            Mês em aberto:{" "}
            <span className="text-sm font-bold text-[#E3B23C]">
              {mensalidadeSugerida.mes}/{mensalidadeSugerida.ano} — {moneyAOA.format(mensalidadeSugerida.valor)}
            </span>{" "}
            <button
              type="button"
              onClick={openPagamento}
              className="ml-2 text-xs font-bold text-[#1F6B3B] underline"
            >
              Pagar agora
            </button>
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {actions.map((a, index) => {
            const shouldSpan = actions.length === 5 && index === actions.length - 1;
            return (
              <div key={a.id} className={shouldSpan ? "sm:col-span-3" : ""}>
                <QuickCard action={a} />
              </div>
            );
          })}
        </div>
      </div>

      <ModalPagamentoRapido
        aluno={{
          id: alunoId,
          nome: alunoNome,
          turma: alunoTurma ?? undefined,
          bi: alunoBI ?? undefined,
        }}
        mensalidade={mensalidadeAtual}
        open={modalAberto}
        onClose={() => {
          setModalAberto(false);
          setMensalidadeAtual(null);
        }}
        onSuccess={() => {
          router.refresh();
          success("Situação financeira atualizada.");
        }}
      />
    </>
  );
}
