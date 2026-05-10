"use client";

import { Loader2, FileText, Image as ImageIcon, CheckCircle2, XCircle } from "lucide-react";
import { usePagamentosPendentes } from "@/hooks/usePagamentosPendentes";
import { useToast, useConfirm } from "@/components/feedback/FeedbackSystem";

const kwanza = new Intl.NumberFormat("pt-AO", {
  style: "currency",
  currency: "AOA",
  maximumFractionDigits: 0,
});

function isPdf(url: string) {
  return url.toLowerCase().includes(".pdf");
}

export default function PagamentosPendentesWindow() {
  const { success, error: toastError } = useToast();
  const confirm = useConfirm();
  const {
    rows,
    total,
    page,
    pageCount,
    loading,
    error,
    actioningById,
    canPrev,
    canNext,
    setPage,
    validar,
  } = usePagamentosPendentes(15);

  async function handleAction(pagamentoId: string, aprovado: boolean) {
    let mensagemSecretaria: string | null = null;
    if (!aprovado) {
      const motivo = await confirm({
        title: "Rejeitar comprovativo",
        message: "Por favor, indique o motivo da rejeição. Esta informação será partilhada com o aluno para que ele possa corrigir o envio.",
        inputType: "text",
        placeholder: "Ex: Comprovativo ilegível ou valor incorrecto",
        confirmLabel: "Confirmar rejeição",
        variant: "danger"
      });

      if (!motivo || !motivo.trim()) {
        if (motivo !== null) {
          toastError("Por favor, indique o motivo para a rejeição.");
        }
        return;
      }
      mensagemSecretaria = motivo.trim();
    }

    const result = await validar(pagamentoId, aprovado, mensagemSecretaria);
    if (!result.ok) {
      toastError(result.error || "Falha ao validar pagamento.");
      return;
    }
    success(aprovado ? "Pagamento aprovado com sucesso." : "Pagamento rejeitado com sucesso.");
  }

  return (
    <section className="mx-auto w-full max-w-7xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Janela de recebimento</h1>
          <p className="text-sm text-slate-500">Validação de comprovantes pendentes via fluxo auditável.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
          {total} pendente(s)
        </span>
      </header>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-10 text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando pagamentos pendentes...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-sm font-medium text-emerald-700">
          Nenhum pagamento pendente no momento.
        </div>
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Aluno</th>
                <th className="px-4 py-3">Turma</th>
                <th className="px-4 py-3">Esperado</th>
                <th className="px-4 py-3">Enviado</th>
                <th className="px-4 py-3">Comprovante</th>
                <th className="px-4 py-3">Criado em</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rows.map((row) => {
                const actioning = Boolean(actioningById[row.pagamento_id]);
                return (
                  <tr key={row.pagamento_id} className="align-middle">
                    <td className="px-4 py-3 font-medium text-slate-900">{row.aluno_nome}</td>
                    <td className="px-4 py-3 text-slate-600">{row.turma_codigo || "—"}</td>
                    <td className="px-4 py-3 text-slate-800">{kwanza.format(Number(row.valor_esperado || 0))}</td>
                    <td className="px-4 py-3 text-slate-800">{kwanza.format(Number(row.valor_enviado || 0))}</td>
                    <td className="px-4 py-3">
                      {row.comprovante_url ? (
                        <div className="space-y-1">
                          <a
                            href={row.comprovante_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1 font-medium text-slate-700 hover:bg-slate-50"
                          >
                            {isPdf(row.comprovante_url) ? <FileText className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                            Visualizar
                          </a>
                          {row.mensagem_aluno ? (
                            <p className="max-w-xs text-xs text-slate-500">{row.mensagem_aluno}</p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-slate-400">Sem comprovante</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(row.created_at).toLocaleString("pt-PT", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => void handleAction(row.pagamento_id, true)}
                          disabled={actioning}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {actioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          Aprovar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleAction(row.pagamento_id, false)}
                          disabled={actioning}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {actioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                          Rejeitar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <footer className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={() => setPage((prev) => Math.max(0, prev - 1))}
          disabled={!canPrev || loading}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Anterior
        </button>
        <span className="text-sm text-slate-500">
          Página {Math.min(page + 1, pageCount)} de {pageCount}
        </span>
        <button
          type="button"
          onClick={() => setPage((prev) => prev + 1)}
          disabled={!canNext || loading}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Próxima
        </button>
      </footer>
    </section>
  );
}
