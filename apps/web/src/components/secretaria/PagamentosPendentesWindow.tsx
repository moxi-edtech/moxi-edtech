"use client";

import { Loader2, FileText, Image as ImageIcon, CheckCircle2, XCircle } from "lucide-react";
import { usePagamentosPendentes, type PagamentosPendentesFilters } from "@/hooks/usePagamentosPendentes";
import { useToast, useConfirm } from "@/components/feedback/FeedbackSystem";
import { useMemo, useState } from "react";

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
  const [decisionNotice, setDecisionNotice] = useState<{ tone: "success" | "info"; title: string; detail: string; alunoId?: string } | null>(null);
  const [filters, setFilters] = useState<PagamentosPendentesFilters>({ origem: "todos", estado: "todos", prioridade: "todos" });
  const [actionError, setActionError] = useState<{ pagamentoId: string; aprovado: boolean; message: string } | null>(null);
  const queryFilters = useMemo(() => filters, [filters]);
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
    reload,
    validar,
  } = usePagamentosPendentes(15, queryFilters);

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
      const message = result.error || "Falha ao validar pagamento.";
      setActionError({ pagamentoId, aprovado, message });
      toastError(message);
      return;
    }
    setActionError(null);
    const row = rows.find((item) => item.pagamento_id === pagamentoId);
    const isServico = row?.tipo_entidade === "servico";
    setDecisionNotice({
      tone: aprovado ? "success" : "info",
      title: aprovado
        ? isServico ? "Serviço liberado" : "Pagamento aprovado"
        : "Comprovativo rejeitado",
      detail: aprovado
        ? isServico ? "O aluno já pode voltar ao portal e descarregar o serviço." : "O pagamento foi liquidado e o recibo será actualizado."
        : "O motivo foi enviado ao aluno. Ele poderá corrigir e reenviar o comprovativo.",
      alunoId: row?.aluno_id,
    });
    success(aprovado ? "Decisão concluída e registada." : "Rejeição registada com motivo.");
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

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-3">
        <label className="text-xs font-semibold text-slate-600">
          Serviço / mensalidade
          <select value={filters.origem} onChange={(event) => setFilters((prev) => ({ ...prev, origem: event.target.value as PagamentosPendentesFilters["origem"] }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-800">
            <option value="todos">Todos</option>
            <option value="servico">Serviços</option>
            <option value="mensalidade">Mensalidades</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Estado
          <select value={filters.estado} onChange={(event) => setFilters((prev) => ({ ...prev, estado: event.target.value as PagamentosPendentesFilters["estado"] }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-800">
            <option value="todos">Todos</option>
            <option value="comprovativo_enviado">Comprovativo enviado</option>
            <option value="sem_comprovativo">Sem comprovativo</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Prioridade
          <select value={filters.prioridade} onChange={(event) => setFilters((prev) => ({ ...prev, prioridade: event.target.value as PagamentosPendentesFilters["prioridade"] }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-800">
            <option value="todos">Todas</option>
            <option value="urgente">Urgente — mais de 48h</option>
            <option value="importante">Importante — mais de 24h</option>
            <option value="normal">Normal</option>
          </select>
        </label>
      </div>

      {rows.some((row) => row.estado_operacional === "comprovativo_enviado" && row.idade_horas >= 24) ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div>
            <p className="font-bold">Há comprovativos enviados sem processamento há mais de 24 horas.</p>
            <p className="text-xs">Priorize estes casos ou abra o feed operacional para acompanhar a reconciliação.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setFilters((prev) => ({ ...prev, estado: "comprovativo_enviado", prioridade: "importante" }))} className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold hover:bg-amber-100">Ver atrasados</button>
            <a href="/financeiro" className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-800">Abrir actividade</a>
          </div>
        </div>
      ) : null}

      {actionError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <div>
            <p className="font-bold">Não foi possível concluir esta decisão.</p>
            <p className="text-xs">{actionError.message} O comprovativo continua na fila; pode tentar novamente ou actualizar o estado.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void handleAction(actionError.pagamentoId, actionError.aprovado)} className="rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-800">Tentar novamente</button>
            <button type="button" onClick={() => { setActionError(null); void reload(); }} className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-bold hover:bg-rose-100">Actualizar fila</button>
          </div>
        </div>
      ) : null}

      {decisionNotice ? (
        <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${decisionNotice.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-blue-200 bg-blue-50 text-blue-800"}`}>
          <div>
            <p className="font-bold">{decisionNotice.title}</p>
            <p className="mt-0.5 text-xs">{decisionNotice.detail}</p>
          </div>
          <div className="flex items-center gap-2">
            {decisionNotice.alunoId ? (
              <a href={`/secretaria/alunos/${decisionNotice.alunoId}`} className="rounded-lg border border-current/20 bg-white/70 px-3 py-1.5 text-xs font-bold hover:bg-white">
                Abrir ficha do aluno
              </a>
            ) : null}
            <button type="button" onClick={() => setDecisionNotice(null)} className="rounded-lg px-2 py-1 text-xs font-semibold opacity-70 hover:opacity-100">
              Fechar
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-10 text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando pagamentos pendentes...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          <div className="flex flex-wrap items-center justify-between gap-3"><span>{error}</span><button type="button" onClick={() => void reload()} className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-bold hover:bg-rose-100">Tentar carregar novamente</button></div>
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
                <th className="px-4 py-3">Tipo / Serviço</th>
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
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{row.aluno_nome}</p>
                      <p className="text-[10px] text-slate-500">{row.turma_codigo || "—"}</p>
                      <a href={`/secretaria/alunos/${row.aluno_id}`} className="mt-1 inline-block text-[10px] font-bold text-blue-700 hover:underline">
                        Ver contexto do aluno
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wider ${
                        row.tipo_entidade === 'servico' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {row.tipo_entidade}
                      </span>
                      <p className="mt-1 text-xs font-semibold text-slate-600">
                        {row.servico_nome || row.servico_codigo || "—"}
                      </p>
                    </td>
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
                          {row.tipo_entidade === "servico" ? "Aprovar e liberar" : "Aprovar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleAction(row.pagamento_id, false)}
                          disabled={actioning}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {actioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                          Rejeitar e informar
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
