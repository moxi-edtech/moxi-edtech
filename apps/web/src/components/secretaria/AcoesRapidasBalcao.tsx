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

function sortByCompetenciaDesc(a: MensalidadeResumo, b: MensalidadeResumo) {
  // Mais recente primeiro
  const da = new Date(a.ano, (a.mes ?? 1) - 1, 1).getTime();
  const db = new Date(b.ano, (b.mes ?? 1) - 1, 1).getTime();
  return db - da;
}

type QuickAction = {
  id: "pagar" | "doc_freq" | "doc_notas" | "matricula" | "extrato";
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  emphasis?: "primary";
  badge?: "alert" | null;
  disabled?: boolean;
};

function QuickCard(props: {
  action: QuickAction;
  dense?: boolean;
}) {
  const { action } = props;
  const Icon = action.icon;

  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      className={cx(
        "relative w-full rounded-xl border border-slate-200 bg-white p-4 text-left",
        "hover:bg-slate-50 transition-colors",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        action.emphasis === "primary" && "ring-1 ring-klasse-gold/25"
      )}
    >
      {action.badge === "alert" ? (
        <span className="absolute top-2 right-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white text-xs font-semibold">
          !
        </span>
      ) : null}

      <div className="flex items-start gap-3">
        <div
          className={cx(
            "h-10 w-10 rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center shrink-0"
          )}
        >
          <Icon className="h-5 w-5 text-slate-600" />
        </div>

        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{action.title}</div>
          <div className="text-xs text-slate-500">{action.subtitle}</div>
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
        ? [...pend].sort(sortByCompetenciaDesc)[0]
        : (mensalidades?.length ?? 0) > 0
          ? [...mensalidades].sort(sortByCompetenciaDesc)[0]
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
        emphasis: "primary",
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
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Ações rápidas
            </div>
            <div className="text-sm font-medium text-slate-900 truncate">
              {alunoNome}
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-slate-500">Pendente</div>
            <div
              className={cx(
                "text-sm font-semibold",
                totalPendente > 0 ? "text-slate-900" : "text-slate-500"
              )}
              title={moneyAOA.format(totalPendente)}
            >
              {moneyAOA.format(totalPendente)}
            </div>
          </div>
        </div>

        {/* Top actions (3 col) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {actions.slice(0, 3).map((a) => (
            <QuickCard key={a.id} action={a} />
          ))}
        </div>

        {/* Secondary actions (2 col) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {actions.slice(3).map((a) => (
            <QuickCard key={a.id} action={a} />
          ))}
        </div>

        {/* Context hint (optional, neutral) */}
        {pendentes.length > 0 && mensalidadeSugerida ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            Sugestão: pagar{" "}
            <span className="font-semibold text-slate-900">
              {mensalidadeSugerida.mes}/{mensalidadeSugerida.ano}
            </span>{" "}
            ({moneyAOA.format(mensalidadeSugerida.valor)}).
          </div>
        ) : null}
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
