"use client";

import React, { useState, useEffect } from "react";
import { getPagamentosPendentes, validarPagamentoAction } from "@/features/financeiro/actions";
import type { PagamentoPendenteRow } from "@/hooks/usePagamentosPendentes";
import { useToast, useConfirm } from "@/components/feedback/FeedbackSystem";
import { StatusPill } from "@/components/ui/StatusPill";
import { ModalShell } from "@/components/ui/ModalShell";
import { Loader2, CheckCircle, XCircle, ExternalLink, Clock, AlertCircle } from "lucide-react";

interface FilaValidacaoPagamentosProps {
  escolaId: string;
}

export function FilaValidacaoPagamentos({ escolaId }: FilaValidacaoPagamentosProps) {
  const [pagamentos, setPagamentos] = useState<PagamentoPendenteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [approvalTarget, setApprovalTarget] = useState<PagamentoPendenteRow | null>(null);
  
  const { success, error, warning } = useToast();
  const confirm = useConfirm();

  const loadPagamentos = async () => {
    setLoading(true);
    const data = await getPagamentosPendentes(escolaId);
    const normalized = data.map((row) => {
      // A Server Action ainda expõe a view gerada antes dos campos operacionais.
      // Normalizamos a fronteira para o modelo usado pelo modal e pela fila.
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
    setPagamentos(normalized);
    setLoading(false);
  };

  useEffect(() => {
    loadPagamentos();
  }, [escolaId]);

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
      loadPagamentos();
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
      loadPagamentos();
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p className="text-sm font-medium">Carregando cockpit de receitas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cards de Resumo de Receita Unificada */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex min-h-[100px] flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total em Validação (Caixa)</p>
            <p className="mt-1.5 text-2xl font-black text-slate-900 leading-none">
              {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 }).format(stats.total)}
            </p>
          </div>
          <p className="text-[10px] text-slate-500 font-semibold mt-2">Fluxo geral de entrada pendente</p>
        </div>

        <div className="flex min-h-[100px] flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Mensalidades & Matrículas</p>
            <p className="mt-1.5 text-2xl font-black leading-none text-klasse-green">
              {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 }).format(stats.mensalidades)}
            </p>
          </div>
          <p className="text-[10px] text-slate-500 font-semibold mt-2">{stats.mensalidadesCount} lançamentos aguardando</p>
        </div>

        <div className="flex min-h-[100px] flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Serviços & Emolumentos</p>
            <p className="mt-1.5 text-2xl font-black leading-none text-klasse-gold">
              {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 }).format(stats.servicos)}
            </p>
          </div>
          <p className="text-[10px] text-slate-500 font-semibold mt-2">{stats.servicosCount} solicitações aguardando</p>
        </div>
      </div>

      {/* Conteúdo Dinâmico: Tabela ou Empty State */}
      {pagamentos.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 py-20">
          <CheckCircle className="w-12 h-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900">Tudo em dia!</h3>
          <p className="text-sm text-slate-500 max-w-xs text-center">Nenhum lançamento de mensalidade ou serviço aguarda validação no momento.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-klasse-gold" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Aguardando Validação</h2>
            </div>
            <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-200">
              {pagamentos.length} Lançamentos
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-white text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 font-semibold uppercase text-[10px] tracking-widest">Aluno / Turma</th>
                  <th className="px-6 py-4 font-semibold uppercase text-[10px] tracking-widest">Item / Serviço</th>
                  <th className="px-6 py-4 font-semibold uppercase text-[10px] tracking-widest">Valor Enviado</th>
                  <th className="px-6 py-4 font-semibold uppercase text-[10px] tracking-widest">Método / Referência</th>
                  <th className="px-6 py-4 font-semibold uppercase text-[10px] tracking-widest text-center">Comprovativo</th>
                  <th className="px-6 py-4 font-semibold uppercase text-[10px] tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagamentos.map((p) => (
                  <tr key={p.pagamento_id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{p.aluno_nome}</div>
                      <div className="text-[10px] text-slate-500 font-medium uppercase tracking-tighter">{p.turma_codigo || "Sem turma"}</div>
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
                        <div className="font-semibold text-slate-700">{p.servico_nome || "Mensalidade Escolar"}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-700">
                      {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(p.valor_enviado)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <StatusPill status={p.metodo} variant="financeiro" size="xs" />
                        <span className="text-[10px] text-slate-500 font-mono">{p.reference || "—"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {p.comprovante_url ? (
                        <a 
                          href={p.comprovante_url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors text-xs font-semibold"
                        >
                          Ver Doc <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-400 italic text-xs">Não enviado</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleReject(p)}
                          disabled={processingId === p.pagamento_id}
                          className="inline-flex items-center gap-2 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 px-3 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
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
                          className="inline-flex items-center gap-2 bg-klasse-green-600 hover:bg-klasse-green-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm shadow-klasse-green-600/20 disabled:opacity-50"
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
          
          <div className="bg-slate-50 px-6 py-3 border-t border-slate-200">
            <p className="flex items-center gap-1.5 text-[10px] text-slate-500 italic">
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
        <button type="button" onClick={onClose} disabled={processing} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Cancelar</button>
        <button type="button" onClick={onConfirm} disabled={processing} className="rounded-lg bg-klasse-green-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{processing ? "A processar..." : label}</button>
      </div>
    }>
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Aluno</p>
          <p className="mt-1 font-bold text-slate-900">{pagamento.aluno_nome}</p>
          <p className="mt-1 text-xs text-slate-600">Turma: {pagamento.turma_codigo || "Não indicada"}</p>
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
        <p className="text-xs text-slate-500">Confira no comprovativo a referência da operação bancária. Ela não é extraída automaticamente deste documento.</p>
        <div className="rounded-xl border border-klasse-gold-200 bg-klasse-gold-50 p-3 text-sm text-klasse-gold-900"><p className="font-bold">Depois da aprovação</p><p className="mt-1">{consequence}</p></div>
        {!pagamento.comprovante_url && !isGratuito ? <p className="text-sm text-rose-700">Não há comprovativo anexado. Revise antes de aprovar.</p> : null}
      </div>
    </ModalShell>
  );
}

function formatKwanza(value: unknown) {
  return new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function ContextDetail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-bold text-slate-800">{value}</p></div>;
}
