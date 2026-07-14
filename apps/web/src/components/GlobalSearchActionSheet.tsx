"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import { ModalShell } from "@/components/ui/ModalShell";
import BalcaoAtendimento from "@/components/secretaria/BalcaoAtendimento";
import { FichaRapidaModal } from "@/components/secretaria/FichaRapidaModal";
import { ModalPagamentoRapido } from "@/components/secretaria/ModalPagamentoRapido";
import { PautaRapidaModal } from "@/components/secretaria/PautaRapidaModal";
import type { MinimalSearchResult, SearchAction } from "@/hooks/useGlobalSearch";

type ActiveSearchAction = {
  action: SearchAction;
  result: MinimalSearchResult;
} | null;

type Props = {
  active: ActiveSearchAction;
  escolaId: string;
  onClose: () => void;
  onSuccess?: () => void;
};

type QuickPaymentAluno = {
  id: string;
  nome: string;
  turma?: string;
  bi?: string;
};

type QuickPaymentMensalidade = {
  id: string;
  mes: number;
  ano: number;
  valor: number;
  vencimento?: string;
  status: string;
};

type QuickPaymentResponse = {
  ok?: boolean;
  error?: string;
  aluno?: {
    id?: string;
    nome?: string | null;
    turma?: string | null;
    bi?: string | null;
  };
  mensalidade?: {
    id?: string;
    mes?: number | null;
    ano?: number | null;
    valor?: number | null;
    vencimento?: string | null;
    status?: string | null;
  } | null;
};

const quickPaymentCache = new Map<string, Promise<QuickPaymentResponse>>();

function loadQuickPayment(alunoId: string) {
  const cached = quickPaymentCache.get(alunoId);
  if (cached) return cached;

  const promise = fetch(`/api/alunos/${alunoId}/pagamento-rapido`, { cache: "no-store" })
    .then((response) => response.json().then((json: QuickPaymentResponse) => {
      if (!response.ok) {
        quickPaymentCache.delete(alunoId);
      }
      return json;
    }))
    .catch((error: unknown) => {
      quickPaymentCache.delete(alunoId);
      throw error;
    });

  quickPaymentCache.set(alunoId, promise);
  return promise;
}

export function prefetchGlobalSearchAction(action: SearchAction, result: MinimalSearchResult) {
  if (action.kind === "payment") {
    void loadQuickPayment(result.id);
  }
}

type PaymentLoadState = {
  resultId: string;
  loading: boolean;
  error: string | null;
  aluno: QuickPaymentAluno | null;
  mensalidade: QuickPaymentMensalidade | null;
};

function PaymentActionModal({ result, onClose, onSuccess }: {
  result: MinimalSearchResult;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [state, setState] = useState<PaymentLoadState>({
    resultId: result.id,
    loading: true,
    error: null,
    aluno: null,
    mensalidade: null,
  });

  useEffect(() => {
    let active = true;
    setState({
      resultId: result.id,
      loading: true,
      error: null,
      aluno: null,
      mensalidade: null,
    });

    loadQuickPayment(result.id)
      .then((json) => {
        if (!active) return;
        if (!json.ok || !json.aluno) {
          throw new Error(json.error || "Não foi possível carregar o pagamento rápido.");
        }

        const nextAluno = {
          id: json.aluno.id || result.id,
          nome: json.aluno.nome || result.label,
          turma: json.aluno.turma || undefined,
          bi: json.aluno.bi || undefined,
        };

        const nextMensalidade =
          json.mensalidade?.id
            ? {
                id: json.mensalidade.id,
                mes: Number(json.mensalidade.mes ?? 0),
                ano: Number(json.mensalidade.ano ?? new Date().getFullYear()),
                valor: Number(json.mensalidade.valor ?? 0),
                vencimento: json.mensalidade.vencimento || undefined,
                status: json.mensalidade.status || "pendente",
              }
            : null;

        setState({
          resultId: result.id,
          loading: false,
          error: null,
          aluno: nextAluno,
          mensalidade: nextMensalidade,
        });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState({
          resultId: result.id,
          loading: false,
          error: err instanceof Error ? err.message : "Falha ao preparar pagamento.",
          aluno: null,
          mensalidade: null,
        });
      });

    return () => {
      active = false;
    };
  }, [result.id, result.label]);

  if (state.loading) {
    return (
      <ModalShell open title="Preparar pagamento" description={result.label} onClose={onClose}>
        <div className="flex items-center justify-center gap-3 py-12 text-sm font-semibold text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-klasse-green" />
          A carregar mensalidades em aberto...
        </div>
      </ModalShell>
    );
  }

  if (state.error || !state.aluno) {
    return (
      <ModalShell open title="Pagamento" description={result.label} onClose={onClose}>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700">
          <AlertCircle className="mb-3 h-5 w-5" />
          {state.error || "Aluno não encontrado para pagamento."}
        </div>
      </ModalShell>
    );
  }

  if (!state.mensalidade) {
    return (
      <ModalShell open title="Pagamento" description={result.label} onClose={onClose}>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-600">
          Não há mensalidades pendentes para este aluno.
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalPagamentoRapido
      aluno={state.aluno}
      mensalidade={state.mensalidade}
      open
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}

export function GlobalSearchActionSheet({ active, escolaId, onClose, onSuccess }: Props) {
  const title = useMemo(() => {
    if (!active) return "";
    if (active.action.kind === "desk") return "Balcão";
    if (active.action.kind === "grade") return "Lançar nota";
    if (active.action.kind === "profile") return "Perfil do aluno";
    return "Pagamento";
  }, [active]);

  if (!active) return null;

  if (active.action.kind === "payment") {
    return <PaymentActionModal result={active.result} onClose={onClose} onSuccess={onSuccess} />;
  }

  if (active.action.kind === "profile") {
    return <FichaRapidaModal alunoId={active.result.id} onClose={onClose} onSuccess={onSuccess} />;
  }

  if (active.action.kind === "desk") {
    return (
      <ModalShell open title={title} description={active.result.label} onClose={onClose}>
        <div className="min-h-[560px] overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <BalcaoAtendimento escolaId={escolaId} selectedAlunoId={active.result.id} showSearch={false} />
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell open title={title} description={active.result.label} onClose={onClose}>
      <PautaRapidaModal hideNavigation />
    </ModalShell>
  );
}
