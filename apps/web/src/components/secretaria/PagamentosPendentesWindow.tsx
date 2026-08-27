"use client";

import { Loader2, FileText, Image as ImageIcon, CheckCircle2, XCircle } from "lucide-react";
import { usePagamentosPendentes, type PagamentoPendenteRow, type PagamentosPendentesFilters } from "@/hooks/usePagamentosPendentes";
import { useRematriculaBalcao } from "@/hooks/useRematriculaBalcao";
import type { RematriculaPaymentItem } from "@/hooks/useRematriculaBalcao";
import { RematriculaBalcaoModal } from "@/components/secretaria/RematriculaBalcaoModal";
import { ModalShell } from "@/components/ui/ModalShell";
import { useToast, useConfirm } from "@/components/feedback/FeedbackSystem";
import { useEffect, useMemo, useRef, useState } from "react";

const kwanza = new Intl.NumberFormat("pt-AO", {
  style: "currency",
  currency: "AOA",
  maximumFractionDigits: 0,
});

function isPdf(url: string) {
  return url.toLowerCase().includes(".pdf");
}

type RematriculaTarget = {
  aluno_id: string;
  aluno_nome: string;
  aluno_processo: string;
  matricula_id: string;
  ano_letivo_id: string;
  turma_atual: string | null;
  itens_pagamento?: RematriculaPaymentItem[];
};

export default function PagamentosPendentesWindow({ escolaId }: { escolaId: string }) {
  const { success, error: toastError } = useToast();
  const confirm = useConfirm();
  const [decisionNotice, setDecisionNotice] = useState<{ tone: "success" | "info"; title: string; detail: string; alunoId?: string } | null>(null);
  const [filters, setFilters] = useState<PagamentosPendentesFilters>({ origem: "todos", estado: "todos", prioridade: "todos" });
  const [actionError, setActionError] = useState<{ pagamentoId: string; aprovado: boolean; message: string } | null>(null);
  const [approvalRow, setApprovalRow] = useState<PagamentoPendenteRow | null>(null);
  const [rematriculaTarget, setRematriculaTarget] = useState<RematriculaTarget | null>(null);
  const [openRematriculaAfterApproval, setOpenRematriculaAfterApproval] = useState(false);
  const rematriculaAutoOpenHandled = useRef(false);
  const rematricula = useRematriculaBalcao({
    escolaId,
    alunoId: rematriculaTarget?.aluno_id ?? null,
    matriculaId: rematriculaTarget?.matricula_id ?? null,
    academicYearId: rematriculaTarget?.ano_letivo_id ?? null,
  });
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

  useEffect(() => {
    if (!openRematriculaAfterApproval || rematriculaAutoOpenHandled.current || !rematriculaTarget || rematricula.loading || !rematricula.service) return;
    if (["READY", "RECONFIRMATION_REQUIRED", "FINALIST_PENDING"].includes(rematricula.cardState ?? "")) {
      rematriculaAutoOpenHandled.current = true;
      rematricula.openModal();
      return;
    }
    if (rematricula.cardState) {
      rematriculaAutoOpenHandled.current = true;
      toastError("O pagamento foi validado, mas a rematrícula não pode ser aberta neste momento.");
    }
  }, [openRematriculaAfterApproval, rematriculaTarget, rematricula, toastError]);

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
    const quantidadeItens = row?.quantidade_itens ?? 1;
    const isServico = row?.tipo_entidade === "servico";
    const isRematricula = isServico && row?.servico_codigo === "SERV_REMATRICULA";
    setDecisionNotice({
      tone: aprovado ? "success" : "info",
      title: aprovado
        ? isRematricula ? "Pagamento de rematrícula validado" : isServico ? "Serviço liberado" : "Pagamento aprovado"
        : "Comprovativo rejeitado",
      detail: aprovado
        ? isRematricula ? "O comprovativo foi confirmado. A rematrícula será concluída no modal deste aluno." : isServico ? "O aluno já pode voltar ao portal e descarregar o serviço." : quantidadeItens > 1 ? `${quantidadeItens} mensalidades foram liquidadas numa única decisão; os recibos serão actualizados.` : "O pagamento foi liquidado e o recibo será actualizado."
        : "O motivo foi enviado ao aluno. Ele poderá corrigir e reenviar o comprovativo.",
      alunoId: row?.aluno_id,
    });
    if (aprovado && isRematricula) {
      const contextResponse = await fetch(`/api/secretaria/recebimentos/rematricula-context?pagamento_id=${encodeURIComponent(pagamentoId)}`, { cache: "no-store" });
      const contextJson = await contextResponse.json().catch(() => ({}));
      if (contextResponse.ok && contextJson?.ok && contextJson.rematricula?.matricula_id && contextJson.rematricula?.ano_letivo_id) {
        rematriculaAutoOpenHandled.current = false;
        setRematriculaTarget(contextJson.rematricula);
        setOpenRematriculaAfterApproval(true);
      } else {
        toastError(contextJson?.error || "Pagamento aprovado, mas não foi possível preparar o modal de rematrícula.");
      }
    }
    success(aprovado ? "Decisão concluída e registada." : "Rejeição registada com motivo.");
  }

  async function confirmApproval() {
    if (!approvalRow) return;
    const pagamentoId = approvalRow.pagamento_id;
    setApprovalRow(null);
    await handleAction(pagamentoId, true);
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
        <>
        <div className="space-y-3 md:hidden">
          {rows.map((row) => {
            const actioning = Boolean(actioningById[row.pagamento_id]);
            const isRematricula = row.tipo_entidade === "servico" && row.servico_codigo === "SERV_REMATRICULA";
            return (
              <article key={row.pagamento_id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">{row.aluno_nome}</p>
                    <p className="text-xs text-slate-500">{row.turma_codigo || "Turma não indicada"}</p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-700">A aguardar validação</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs">
                  <span className="text-slate-500">Tipo<p className="mt-0.5 font-bold text-slate-800">{isRematricula ? "Rematrícula" : row.servico_nome || row.tipo_entidade}</p></span>
                  <span className="text-slate-500">Valor enviado<p className="mt-0.5 font-bold text-slate-800">{kwanza.format(Number(row.valor_enviado || 0))}</p></span>
                </div>
                {row.comprovante_url ? <a href={row.comprovante_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700">{isPdf(row.comprovante_url) ? <FileText className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />} Ver comprovativo</a> : <p className="mt-3 text-xs text-slate-500">Sem comprovativo anexado.</p>}
                {row.mensagem_aluno ? <p className="mt-2 rounded-xl bg-blue-50 p-3 text-xs text-blue-900"><strong>Mensagem:</strong> {row.mensagem_aluno}</p> : null}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setApprovalRow(row)} disabled={actioning} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-emerald-700 px-3 text-xs font-black text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4" /> Validar</button>
                  <button type="button" onClick={() => void handleAction(row.pagamento_id, false)} disabled={actioning} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-rose-300 bg-rose-50 px-3 text-xs font-black text-rose-700 disabled:opacity-50"><XCircle className="h-4 w-4" /> Rejeitar</button>
                </div>
              </article>
            );
          })}
        </div>
        <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
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
                        {row.quantidade_itens && row.quantidade_itens > 1 ? `${row.quantidade_itens} mensalidades · comprovativo consolidado` : row.servico_nome || row.servico_codigo || "—"}
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
                          onClick={() => setApprovalRow(row)}
                          disabled={actioning}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {actioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          {row.tipo_entidade === "servico" ? "Aprovar e liberar" : row.quantidade_itens && row.quantidade_itens > 1 ? "Aprovar lote" : "Aprovar"}
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
        </>
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

      {rematriculaTarget && rematricula.modalOpen && rematricula.anoLetivo && rematricula.service && (
        <RematriculaBalcaoModal
          open={rematricula.modalOpen}
          onClose={rematricula.closeModal}
          alunoNome={rematriculaTarget.aluno_nome}
          alunoProcesso={rematriculaTarget.aluno_processo}
          turmaAtual={rematriculaTarget.turma_atual}
          matriculaId={rematriculaTarget.matricula_id}
          responsavelContato={rematricula.responsavelContato ?? ""}
          setResponsavelContato={rematricula.setResponsavelContato}
          anoLetivo={rematricula.anoLetivo}
          service={rematricula.service}
          itensPagamento={rematriculaTarget.itens_pagamento}
          paymentAlreadyValidated
          skipTurmaSelection={rematricula.cardState === "RECONFIRMATION_REQUIRED"}
          debt={rematricula.debt}
          turmas={rematricula.turmas}
          turmasLoading={rematricula.turmasLoading}
          progressao={rematricula.progressao}
          notasLancarDepois={rematricula.notasLancarDepois}
          setNotasLancarDepois={rematricula.setNotasLancarDepois}
          decisaoResultado={rematricula.decisaoResultado}
          setDecisaoResultado={rematricula.setDecisaoResultado}
          decisaoFonte={rematricula.decisaoFonte}
          setDecisaoFonte={rematricula.setDecisaoFonte}
          decisaoMotivo={rematricula.decisaoMotivo}
          setDecisaoMotivo={rematricula.setDecisaoMotivo}
          decisaoObservacao={rematricula.decisaoObservacao}
          setDecisaoObservacao={rematricula.setDecisaoObservacao}
          step={rematricula.step}
          setStep={rematricula.setStep}
          selectedTurmaId={rematricula.selectedTurmaId}
          setSelectedTurmaId={rematricula.setSelectedTurmaId}
          metodo={rematricula.metodo}
          setMetodo={rematricula.setMetodo}
          detalhes={rematricula.detalhes}
          setDetalhes={rematricula.setDetalhes}
          submitting={rematricula.submitting}
          result={rematricula.result}
          apiError={rematricula.apiError}
          submit={rematricula.submit}
          onPostAction={() => undefined}
        />
      )}
      <RecebimentoApprovalModal
        row={approvalRow}
        onClose={() => setApprovalRow(null)}
        onConfirm={() => void confirmApproval()}
        confirming={Boolean(approvalRow && actioningById[approvalRow.pagamento_id])}
      />
    </section>
  );
}

function RecebimentoApprovalModal({
  row,
  onClose,
  onConfirm,
  confirming,
}: {
  row: PagamentoPendenteRow | null;
  onClose: () => void;
  onConfirm: () => void;
  confirming: boolean;
}) {
  if (!row) return null;

  const isServico = row.tipo_entidade === "servico";
  const isRematricula = isServico && row.servico_codigo === "SERV_REMATRICULA";
  const isLote = !isServico && (row.quantidade_itens ?? 1) > 1;
  const isGratuito = Number(row.valor_esperado || 0) === 0 && Number(row.valor_enviado || 0) === 0;
  const title = isRematricula
    ? "Revisar rematrícula"
    : isGratuito
      ? "Revisar pedido gratuito"
      : isLote
        ? "Revisar lote de mensalidades"
        : isServico
          ? "Revisar serviço"
          : "Revisar mensalidade";
  const actionLabel = isRematricula
    ? "Validar e escolher turma"
    : isGratuito
      ? "Aprovar pedido gratuito"
      : isServico
        ? "Aprovar e liberar serviço"
        : isLote
          ? "Confirmar mensalidades"
          : "Confirmar pagamento";
  const consequence = isRematricula
    ? "O comprovativo será confirmado e o modal de rematrícula será aberto para rever a turma destino."
    : isGratuito
      ? "A aprovação libera o pedido sem cobrança e mantém o registo da decisão da secretaria."
      : isServico
        ? "A aprovação confirma o comprovativo e libera o serviço solicitado ao aluno."
        : isLote
          ? `A aprovação liquidará ${row.quantidade_itens} mensalidades associadas ao comprovativo.`
          : "A aprovação confirma o comprovativo e atualiza o recebimento do aluno.";

  return (
    <ModalShell
      open
      title={title}
      description="Confirme o contexto antes de concluir esta decisão."
      onClose={onClose}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} disabled={confirming} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">
            Cancelar
          </button>
          <button type="button" onClick={onConfirm} disabled={confirming} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {confirming ? "A processar..." : actionLabel}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Aluno</p>
          <p className="mt-1 font-bold text-slate-900">{row.aluno_nome}</p>
          <p className="mt-1 text-xs text-slate-600">Turma: {row.turma_codigo || "Não indicada"}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Detail label="Tipo" value={isRematricula ? "Rematrícula" : isGratuito ? "Pedido gratuito" : isLote ? "Lote de mensalidades" : isServico ? row.servico_nome || "Serviço escolar" : "Mensalidade"} />
          <Detail label="Código do pedido KLASSE" value={row.reference || "Não informado"} />
          <Detail label="Valor esperado" value={kwanza.format(Number(row.valor_esperado || 0))} />
          <Detail label="Valor enviado" value={kwanza.format(Number(row.valor_enviado || 0))} />
          {isServico && <Detail label="Código do serviço" value={row.servico_codigo || "Não informado"} />}
          {isLote && <Detail label="Itens incluídos" value={`${row.quantidade_itens} mensalidades`} />}
          <Detail label="Método" value={row.metodo || "Não informado"} />
        </div>
        {row.mensagem_aluno ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            <p className="font-bold">Mensagem do aluno</p>
            <p className="mt-1">{row.mensagem_aluno}</p>
          </div>
        ) : null}
        <p className="text-xs text-slate-500">Confira no comprovativo a referência da operação bancária. Ela não é extraída automaticamente deste documento.</p>
        <div className="rounded-xl border border-klasse-gold-200 bg-klasse-gold-50 p-3 text-sm text-klasse-gold-900">
          <p className="font-bold">Depois da aprovação</p>
          <p className="mt-1">{consequence}</p>
        </div>
        {!row.comprovante_url && !isGratuito ? <p className="text-sm text-rose-700">Não há comprovativo anexado. Revise antes de aprovar.</p> : null}
      </div>
    </ModalShell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}
