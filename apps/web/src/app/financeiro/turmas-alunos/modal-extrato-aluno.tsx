"use client";

import React, { useMemo } from "react";
import { X } from "lucide-react";
import { ExtratoActions } from "@/components/financeiro/ExtratoActions";

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
    dataVencimento: Date | null;
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
  if (status === "paga") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "atrasada") return "bg-rose-50 text-rose-700 border-rose-200";
  if (status === "cancelada") return "bg-slate-50 text-slate-600 border-slate-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
};

const formatVencimento = (mensalidade: ModalExtratoAlunoProps["mensalidades"][number]) => {
  if (!mensalidade.dataVencimento) return "—";
  return mensalidade.dataVencimento.toLocaleDateString("pt-AO");
};

const formatMoney = (valor: number) =>
  valor.toLocaleString("pt-AO", { style: "currency", currency: "AOA" });

const ModalExtratoAluno: React.FC<ModalExtratoAlunoProps> = ({ aluno, mensalidades, onClose }) => {
  const ordenadas = useMemo(() => {
    return [...mensalidades].sort((a, b) => {
      if (a.anoReferencia !== b.anoReferencia) return b.anoReferencia - a.anoReferencia;
      return b.mesReferencia - a.mesReferencia;
    });
  }, [mensalidades]);

  return (
    <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Extrato do Aluno</h2>
            <p className="text-slate-600">{aluno.nome} • {aluno.turma}</p>
          </div>
          <div className="flex items-center gap-3">
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
                  <th className="px-4 py-3 font-medium">Referência</th>
                  <th className="px-4 py-3 font-medium">Vencimento</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {ordenadas.map((mensalidade, index) => (
                  <tr
                    key={mensalidade.id || `${mensalidade.anoReferencia}-${mensalidade.mesReferencia}-${index}`}
                    className="border-b last:border-b-0 border-slate-200 bg-white"
                  >
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
                  </tr>
                ))}
                {ordenadas.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
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
  );
};

export default ModalExtratoAluno;
