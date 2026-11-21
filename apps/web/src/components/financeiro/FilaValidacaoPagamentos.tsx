"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { getPagamentosPendentes, validarPagamentoAction } from "@/features/financeiro/actions";
import type { PagamentoPendenteRow } from "@/hooks/usePagamentosPendentes";
import { useToast, useConfirm } from "@/components/feedback/FeedbackSystem";
import { StatusPill } from "@/components/ui/StatusPill";
import { ModalShell } from "@/components/ui/ModalShell";
import { OperationalTableSkeleton, OperationalTablePagination, OperationalTableFilterBar, OperationalTableEmptyState, OperationalTableErrorState } from "@/components/ui/OperationalTableStates";
import { filterAndPaginateOperationalRows } from "@/lib/operacoes/operational-table";
import { Loader2, CheckCircle, XCircle, ExternalLink, Clock, AlertCircle } from "lucide-react";

const PAGE_SIZE = 10;

type EntityFilter = "todos" | "mensalidade" | "servico";

interface FilaValidacaoPagamentosProps {
  escolaId: string;
}

export function FilaValidacaoPagamentos({ escolaId }: FilaValidacaoPagamentosProps) {
  const [pagamentos, setPagamentos] = useState<PagamentoPendenteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [entityFilter, setEntityFilter] = useState<EntityFilter>("todos");
  const [page, setPage] = useState(1);
  const requestSequence = useRef(0);
  const activeSchool = useRef(escolaId);
  const [approvalTarget, setApprovalTarget] = useState<PagamentoPendenteRow | null>(null);
  
  const { success, error, warning } = useToast();
  const confirm = useConfirm();

  useEffect(() => { activeSchool.current = escolaId; }, [escolaId]);

  const loadPagamentos = useCallback(async () => {
    // An old async payment decision must not reload another school's queue.
    if (activeSchool.current !== escolaId) return;
    const requestId = ++requestSequence.current;
    setLoading(true);
    setFetchError(null);
    // A change of school must never display records from a previous tenant.
    setPagamentos([]);
    try {
      const data = await getPagamentosPendentes(escolaId);
      const normalized = (Array.isArray(data) ? data : []).map((row) => {
        // Preserve the operational model at the server-action boundary.
        const source = row as unknown as Partial<PagamentoPendenteRow>;
        return {
          ...source,
          pagamento_id: source.pagamento_id ?? "",
          escola_id: source.escola_id ?? escolaId,
          mensalidade_id: source.mensalidade_id ?? "",
          aluno_id: source.aluno_id ?? "",
          aluno_nome: source.aluno_nome ?? "Aluno sem nome",
          turma_codigo: source.turma_codigo ?? null,
          valor_esperado: Number(source.valor_esperado ?? 0),
          valor_enviado: Number(source.valor_enviado ?? 0),
          comprovante_url: source.comprovante_url ?? null,
          mensagem_aluno: source.mensagem_aluno ?? null,
          reference: source.reference ?? null,
          metodo: source.metodo ?? null,
          tipo_entidade: source.tipo_entidade === "servico" ? "servico" : "mensalidade",
          servico_codigo: source.servico_codigo ?? null,
          servico_nome: source.servico_nome ?? null,
          created_at: source.created_at ?? new Date(0).toISOString(),
          estado_operacional: source.estado_operacional ?? "sem_comprovativo",
          idade_horas: Number(source.idade_horas ?? 0),
          prioridade: source.prioridade ?? "normal",
        } satisfies PagamentoPendenteRow;
      });
      if (requestId === requestSequence.current && activeSchool.current === escolaId) setPagamentos(normalized);
    } catch {
      if (requestId === requestSequence.current && activeSchool.current === escolaId) {
        setFetchError("Não foi possível consultar os recebimentos. Os pagamentos não foram alterados.");
        setPagamentos([]);
      }
    } finally {
      if (requestId === requestSequence.current && activeSchool.current === escolaId) setLoading(false);
    }
  }, [escolaId]);

  useEffect(() => {
    setApprovalTarget(null);
    setQuery("");
    setEntityFilter("todos");
    setPage(1);
    void loadPagamentos();
    return () => { requestSequence.current += 1; };
  }, [loadPagamentos]);

  const filterable = useMemo(() => pagamentos.filter((item) =>
    entityFilter === "todos" || item.tipo_entidade === entityFilter
  ), [pagamentos, entityFilter]);

  const { items: pageItems, filteredCount, currentPage } = useMemo(() =>
    filterAndPaginateOperationalRows({
      rows: filterable,
      search: query,
      getSearchText: (item) => [item.aluno_nome, item.turma_codigo, item.reference, item.servico_nome, item.metodo].filter(Boolean).join(" "),
      page,
      pageSize: PAGE_SIZE,
    }),
  [filterable, query, page]);

  const handleApprove = async (pagamento: PagamentoPendenteRow) => {
    setApprovalTarget(pagamento);
  };

  const confirmApprove = async () => {
    const pagamento = approvalTarget;
    if (!pagamento) return;
    setApprovalTarget(null);
    setProcessingId(pagamento.pagamento_id);
    const res = await validarPagamentoAction(pagamento.pagamento_id, true);
    
    if (res.success) {
      const msg = pagamento.tipo_entidade === "servico"
        ? `Pagamento validado e serviço (${pagamento.servico_nome}) deferido.`
        : "Pagamento validado e mensalidade liquidada.";
      success("Sucesso", msg);
      void loadPagamentos();
    } else {
      error("Erro", res.error || "Não foi possível validar o pagamento.");
    }
    setProcessingId(null);
  };

  const handleReject = async (pagamento: PagamentoPendenteRow) => {
    const motivo = await confirm({
      title: "Rejeitar Comprovativo",
      message: "Por favor, indique o motivo da rejeição. Esta informação será partilhada com o aluno.",
      confirmLabel: "Rejeitar Pagamento",
      variant: "danger",
      inputType: "text",
      placeholder: "Ex: Comprovativo ilegível ou valor incorrecto",
    });

    if (motivo === null) return; // Cancelou o modal

    if (motivo.trim().length === 0) {
      warning("Aviso", "O motivo de rejeição é obrigatório.");
      return;
    }

    setProcessingId(pagamento.pagamento_id);
    const res = await validarPagamentoAction(pagamento.pagamento_id, false, motivo.trim());
    
    if (res.success) {
      success("Sucesso", "Pagamento rejeitado com sucesso.");
      void loadPagamentos();
    } else {
      error("Erro", res.error || "Não foi possível rejeitar o pagamento.");
    }
    setProcessingId(null);
  };

  const stats = pagamentos.reduce(
    (acc, p) => {
      acc.total += Number(p.valor_enviado || 0);
      if (p.tipo_entidade === "servico") {
        acc.servicos += Number(p.valor_enviado || 0);
        acc.servicosCount += 1;
      } else {
        acc.mensalidades += Number(p.valor_enviado || 0);
        acc.mensalidadesCount += 1;
      }
      return acc;
    },
    { total: 0, mensalidades: 0, servicos: 0, mensalidadesCount: 0, servicosCount: 0 }
  );

  if (loading) return <OperationalTableSkeleton label="A carregar pagamentos para validação" columns={6} rows={4} />;
  if (fetchError) return <OperationalTableErrorState title="Não foi possível carregar os pagamentos" description={fetchError} onRetry={() => void loadPagamentos()} />;

  return (
    <div className="space-y-6">
      {/* Cards de Resumo de Receita Unificada */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex min-h-[100px] flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-sm transition hover:shadow-md">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Total em Validação (Caixa)</p>
            <p className="mt-1.5 text-2xl font-black text-foreground leading-none">
              {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 }).format(stats.total)}
            </p>
          </div>
          <p className="text-[10px] text-muted-foreground font-semibold mt-2">Fluxo geral de entrada pendente</p>
        </div>

        <div className="flex min-h-[100px] flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-sm transition hover:shadow-md">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Mensalidades & Matrículas</p>
            <p className="mt-1.5 text-2xl font-black leading-none text-emerald">
              {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 }).format(stats.mensalidades)}
            </p>
          </div>
          <p className="text-[10px] text-muted-foreground font-semibold mt-2">{stats.mensalidadesCount} lançamentos aguardando</p>
        </div>

        <div className="flex min-h-[100px] flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-sm transition hover:shadow-md">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Serviços & Emolumentos</p>
            <p className="mt-1.5 text-2xl font-black leading-none text-amber">
              {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 }).format(stats.servicos)}
            </p>
          </div>
          <p className="text-[10px] text-muted-foreground font-semibold mt-2">{stats.servicosCount} solicitações aguardando</p>
        </div>
      </div>

      {pagamentos.length > 0 && (
        <OperationalTableFilterBar
          query={query}
          onQueryChange={(next) => { setQuery(next); setPage(1); }}
          label="Pesquisar recebimentos"
          placeholder="Pesquisar aluno, turma, referência ou serviço…"
          activeFilters={Number(Boolean(query.trim())) + Number(entityFilter !== "todos")}
          onClearFilters={() => { setQuery(""); setEntityFilter("todos"); setPage(1); }}
        >
          <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground">
            Tipo de recebimento
            <select
              value={entityFilter}
              onChange={(event) => { setEntityFilter(event.target.value as EntityFilter); setPage(1); }}
              className="min-h-11 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20"
            >
              <option value="todos">Todos os tipos</option>
              <option value="mensalidade">Mensalidades</option>
              <option value="servico">Serviços</option>
            </select>
          </label>
          <span aria-live="polite" className="text-xs font-semibold text-muted-foreground">{filteredCount} de {pagamentos.length} recebimentos</span>
        </OperationalTableFilterBar>
      )}

      {/* Conteúdo Dinâmico: Tabela ou Empty State */}
      {pagamentos.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted py-20">
          <CheckCircle className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground">Tudo em dia!</h3>
          <p className="text-sm text-muted-foreground max-w-xs text-center">Nenhum lançamento de mensalidade ou serviço aguarda validação no momento.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted px-4 py-4 sm:px-6">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber" />
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Aguardando Validação</h2>
            </div>
            <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-200">
              {filteredCount} de {pagamentos.length} lançamentos
            </span>
          </div>

          <div className="overflow-x-auto">
            <table aria-label="Pagamentos aguardando validação" className="min-w-[840px] w-full text-left text-sm">
              <thead className="bg-card text-muted-foreground border-b border-border">
                <tr>
                  <th scope="col" className="px-6 py-4 font-semibold uppercase text-[10px] tracking-widest">Aluno / Turma</th>
                  <th scope="col" className="px-6 py-4 font-semibold uppercase text-[10px] tracking-widest">Item / Serviço</th>
                  <th scope="col" className="px-6 py-4 font-semibold uppercase text-[10px] tracking-widest">Valor Enviado</th>
                  <th scope="col" className="px-6 py-4 font-semibold uppercase text-[10px] tracking-widest">Método / Referência</th>
                  <th scope="col" className="px-6 py-4 font-semibold uppercase text-[10px] tracking-widest text-center">Comprovativo</th>
                  <th scope="col" className="px-6 py-4 font-semibold uppercase text-[10px] tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCount === 0 && (
                  <tr><td colSpan={6}><OperationalTableEmptyState title="Nenhum recebimento corresponde aos filtros" description="Ajuste a pesquisa ou o tipo de recebimento para continuar." /></td></tr>
                )}
                {pageItems.map((p) => (
                  <tr key={p.pagamento_id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-foreground">{p.aluno_nome}</div>
                      <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">{p.turma_codigo || "Sem turma"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full w-fit uppercase tracking-wider border ${
                          p.tipo_entidade === "servico"
                            ? "bg-amber-50 text-amber-700 border-amber-200/50"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200/50"
                        }`}>
                          {p.tipo_entidade === "servico" ? "Serviço" : "Mensalidade"}
                        </span>
                        <div className="font-semibold text-foreground">{p.servico_nome || "Mensalidade Escolar"}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-foreground">
                      {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(p.valor_enviado)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <StatusPill status={p.metodo} variant="financeiro" size="xs" />
                        <span className="text-[10px] text-muted-foreground font-mono">{p.reference || "—"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {p.comprovante_url ? (
                        <a 
                          href={p.comprovante_url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-muted px-3 py-2 text-foreground hover:bg-border transition-colors text-xs font-semibold"
                        >
                          Ver Doc <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground italic text-xs">Não enviado</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleReject(p)}
                          disabled={processingId === p.pagamento_id}
                          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-200 bg-card px-3 py-2 text-rose-600 hover:bg-rose-50 text-xs font-bold transition-all disabled:opacity-50"
                          title="Rejeitar comprovativo"
                        >
                          {processingId === p.pagamento_id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <XCircle className="w-3 h-3" />
                          )}
                          Rejeitar
                        </button>
                        <button
                          onClick={() => handleApprove(p)}
                          disabled={processingId === p.pagamento_id}
                          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 text-xs font-bold transition-all shadow-sm shadow-emerald-600/20 disabled:opacity-50"
                        >
                          {processingId === p.pagamento_id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <CheckCircle className="w-3 h-3" />
                          )}
                          {processingId === p.pagamento_id ? "Validando..." : "Validar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="border-t border-border p-3 sm:p-4">
            <OperationalTablePagination
              page={currentPage}
              pageSize={PAGE_SIZE}
              total={filteredCount}
              onPageChange={setPage}
              disabled={Boolean(processingId)}
            />
          </div>
          <div className="bg-muted px-4 py-3 border-t border-border sm:px-6">
            <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground italic">
              <AlertCircle className="w-3 h-3" />
              A validação liquida automaticamente a mensalidade ou defere o serviço no Ledger da escola.
            </p>
          </div>
        </div>
      )}

      <RecebimentoApprovalModal
        pagamento={approvalTarget}
        onClose={() => setApprovalTarget(null)}
        onConfirm={() => void confirmApprove()}
        processing={Boolean(approvalTarget && processingId === approvalTarget.pagamento_id)}
      />
    </div>
  );
}

function RecebimentoApprovalModal({
  pagamento,
  onClose,
  onConfirm,
  processing,
}: {
  pagamento: PagamentoPendenteRow | null;
  onClose: () => void;
  onConfirm: () => void;
  processing: boolean;
}) {
  if (!pagamento) return null;
  const isServico = pagamento.tipo_entidade === "servico";
  const isRematricula = isServico && pagamento.servico_codigo === "SERV_REMATRICULA";
  const isLote = !isServico && Number(pagamento.quantidade_itens || 1) > 1;
  const isGratuito = Number(pagamento.valor_esperado || 0) === 0 && Number(pagamento.valor_enviado || 0) === 0;
  const label = isRematricula
    ? "Validar e rever rematrícula"
    : isGratuito
      ? "Aprovar pedido gratuito"
      : isServico
        ? "Aprovar e liberar serviço"
        : isLote
          ? "Confirmar mensalidades"
          : "Confirmar pagamento";
  const consequence = isRematricula
    ? "O comprovativo será confirmado. Depois, reveja a turma destino antes de concluir a rematrícula."
    : isGratuito
      ? "O pedido será aprovado sem cobrança e ficará registado para rastreabilidade."
      : isServico
        ? "O serviço solicitado será liberado no portal do aluno."
        : isLote
          ? `${pagamento.quantidade_itens} mensalidades serão liquidadas nesta decisão.`
          : "O recebimento será liquidado e o estado do aluno será atualizado.";

  return (
    <ModalShell open title="Revisar recebimento" description="Confirme o contexto antes de concluir a validação." onClose={onClose} footer={
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onClose} disabled={processing} className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-50">Cancelar</button>
        <button type="button" onClick={onConfirm} disabled={processing} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{processing ? "A processar..." : label}</button>
      </div>
    }>
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-muted p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aluno</p>
          <p className="mt-1 font-bold text-foreground">{pagamento.aluno_nome}</p>
          <p className="mt-1 text-xs text-foreground/80">Turma: {pagamento.turma_codigo || "Não indicada"}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ContextDetail label="Tipo" value={isRematricula ? "Rematrícula" : isGratuito ? "Pedido gratuito" : isLote ? "Lote de mensalidades" : isServico ? pagamento.servico_nome || "Serviço escolar" : "Mensalidade"} />
          <ContextDetail label="Código do pedido KLASSE" value={pagamento.reference || "Não informado"} />
          <ContextDetail label="Valor esperado" value={formatKwanza(pagamento.valor_esperado)} />
          <ContextDetail label="Valor enviado" value={formatKwanza(pagamento.valor_enviado)} />
          <ContextDetail label="Método" value={pagamento.metodo || "Não informado"} />
          {isServico ? <ContextDetail label="Código" value={pagamento.servico_codigo || "Não informado"} /> : null}
          {isLote ? <ContextDetail label="Itens" value={`${pagamento.quantidade_itens} mensalidades`} /> : null}
        </div>
        {pagamento.mensagem_aluno ? <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900"><p className="font-bold">Mensagem do aluno</p><p className="mt-1">{pagamento.mensagem_aluno}</p></div> : null}
        <p className="text-xs text-muted-foreground">Confira no comprovativo a referência da operação bancária. Ela não é extraída automaticamente deste documento.</p>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><p className="font-bold">Depois da aprovação</p><p className="mt-1">{consequence}</p></div>
        {!pagamento.comprovante_url && !isGratuito ? <p className="text-sm text-rose-700">Não há comprovativo anexado. Revise antes de aprovar.</p> : null}
      </div>
    </ModalShell>
  );
}

function formatKwanza(value: unknown) {
  return new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function ContextDetail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-border bg-card p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-bold text-foreground">{value}</p></div>;
}
