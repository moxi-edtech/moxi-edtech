"use client";

import React, { useMemo } from "react";
import { X } from "lucide-react";
import { ExtratoActions } from "@/components/financeiro/ExtratoActions";
import { ModalPagamentoRapido } from "@/components/secretaria/ModalPagamentoRapido";
import { useParams } from "next/navigation";

interface ModalExtratoAlunoProps {
  aluno: {
    id: string;
    nome: string;
    turma: string;
  };
  mensalidades: Array<{
    id: string;
    mesReferencia: number;
    anoReferencia: number;
    valor: number;
    status: "pendente" | "paga" | "atrasada" | "cancelada";
    dataVencimento: Date | string | null;
    diasAtraso?: number;
  }>;
  onClose: () => void;
}

const statusLabel = (status: ModalExtratoAlunoProps["mensalidades"][number]["status"]) => {
  if (status === "paga") return "Pago";
  if (status === "atrasada") return "Atrasada";
  if (status === "cancelada") return "Cancelada";
  return "Pendente";
};

const statusTone = (status: ModalExtratoAlunoProps["mensalidades"][number]["status"]) => {
  if (status === "paga") return "bg-klasse-green-50 text-klasse-green-700 border-klasse-green-200";
  if (status === "atrasada") return "bg-rose-50 text-rose-700 border-rose-200";
  if (status === "cancelada") return "bg-slate-50 text-slate-600 border-slate-200";
  return "bg-klasse-gold-50 text-klasse-gold-700 border-klasse-gold-200";
};

const formatVencimento = (mensalidade: ModalExtratoAlunoProps["mensalidades"][number]) => {
  const raw = mensalidade.dataVencimento;
  if (!raw) return "—";

  const date = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("pt-AO");
};

const formatMoney = (valor: number) =>
  valor.toLocaleString("pt-AO", { style: "currency", currency: "AOA" });

const ModalExtratoAluno: React.FC<ModalExtratoAlunoProps> = ({ aluno, mensalidades, onClose }) => {
  const params = useParams();
  const escolaId = params?.id as string;
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [paymentOpen, setPaymentOpen] = React.useState(false);

  const ordenadas = useMemo(() => {
    return [...mensalidades].sort((a, b) => {
      if (a.anoReferencia !== b.anoReferencia) return b.anoReferencia - a.anoReferencia;
      return b.mesReferencia - a.mesReferencia;
    });
  }, [mensalidades]);

  const pendentes = useMemo(
    () => ordenadas.filter((item) => item.status === "pendente" || item.status === "atrasada"),
    [ordenadas]
  );
  const selectedMensalidades = useMemo(
    () => pendentes.filter((item) => selectedIds.includes(item.id)),
    [pendentes, selectedIds]
  );
  const totalSelecionado = useMemo(
    () => selectedMensalidades.reduce((sum, item) => sum + item.valor, 0),
    [selectedMensalidades]
  );

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => (
      prev.includes(id) ? prev.filter((currentId) => currentId !== id) : [...prev, id]
    ));
  };

  const openSinglePayment = (mensalidadeId: string) => {
    setSelectedIds([mensalidadeId]);
    setPaymentOpen(true);
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Extrato do Aluno</h2>
            <p className="text-slate-600">{aluno.nome} • {aluno.turma}</p>
          </div>
          <div className="flex items-center gap-3">
            {selectedMensalidades.length > 0 ? (
              <button
                type="button"
                onClick={() => setPaymentOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-klasse-gold-500 px-3 py-2 text-xs font-bold text-white shadow-sm shadow-klasse-gold-500/10 transition-all hover:bg-klasse-gold-600"
              >
                Receber selecionadas • {formatMoney(totalSelecionado)}
              </button>
            ) : null}
            <ExtratoActions alunoId={aluno.id} />
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[75vh]">
          <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-white text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-medium w-10"></th>
                  <th className="px-4 py-3 font-medium">Referência</th>
                  <th className="px-4 py-3 font-medium">Vencimento</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Valor</th>
                  <th className="px-4 py-3 font-medium text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {ordenadas.map((mensalidade, index) => (
                  <tr
                    key={mensalidade.id || `${mensalidade.anoReferencia}-${mensalidade.mesReferencia}-${index}`}
                    className="border-b last:border-b-0 border-slate-200 bg-white"
                  >
                    <td className="px-4 py-3">
                      {(mensalidade.status === "pendente" || mensalidade.status === "atrasada") ? (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(mensalidade.id)}
                          onChange={() => toggleSelected(mensalidade.id)}
                          className="h-4 w-4 rounded border-slate-300 text-klasse-gold-500 focus:ring-klasse-gold-500"
                        />
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">
                      {String(mensalidade.mesReferencia).padStart(2, "0")}/{mensalidade.anoReferencia}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatVencimento(mensalidade)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusTone(mensalidade.status)}`}>
                        {statusLabel(mensalidade.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">
                      {formatMoney(mensalidade.valor)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(mensalidade.status === "pendente" || mensalidade.status === "atrasada") && (
                        <button
                          type="button"
                          onClick={() => openSinglePayment(mensalidade.id)}
                          className="inline-flex items-center gap-2 bg-klasse-gold-500 hover:bg-klasse-gold-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm shadow-klasse-gold-500/10 transition-all focus:ring-4 focus:ring-klasse-gold-500/20 outline-none"
                        >
                          Receber
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {ordenadas.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      Nenhuma mensalidade encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      </div>

      <ModalPagamentoRapido
        escolaId={escolaId}
        aluno={{
          id: aluno.id,
          nome: aluno.nome,
          turma: aluno.turma,
        }}
        mensalidade={selectedMensalidades[0]
          ? {
              id: selectedMensalidades[0].id,
              mes: selectedMensalidades[0].mesReferencia,
              ano: selectedMensalidades[0].anoReferencia,
              valor: selectedMensalidades[0].valor,
              vencimento: selectedMensalidades[0].dataVencimento ? String(selectedMensalidades[0].dataVencimento) : undefined,
              status: selectedMensalidades[0].status,
            }
          : null}
        mensalidades={pendentes.map((item) => ({
          id: item.id,
          mes: item.mesReferencia,
          ano: item.anoReferencia,
          valor: item.valor,
          vencimento: item.dataVencimento ? String(item.dataVencimento) : undefined,
          status: item.status,
        }))}
        initialSelectedIds={selectedIds}
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        onSuccess={() => {
          setPaymentOpen(false);
          setSelectedIds([]);
        }}
      />
    </>
  );
};

export default ModalExtratoAluno;
