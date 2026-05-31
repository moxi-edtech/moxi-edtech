"use client";

import React, { useEffect, useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/Drawer";
import { kwanza } from "./utils";
import { User, Phone, Mail, ExternalLink, Loader2, X } from "lucide-react";
import Link from "next/link";

interface StudentDetail {
  id: string;
  alunoId: string;
  nome: string;
  processo: string;
  foto: string | null;
  valor: number;
  pago: number;
  status: string;
  vencimento: string;
  turma: string;
  encarregado: string;
  contacto: string;
  email: string;
}

interface FinancialDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  escolaId: string;
  classeId?: string;
  turmaId?: string;
  classeLabel: string;
  mes?: string; // MM
  ano: string; // YYYY
  anoLetivoId?: string;
  status?: string; // pendente, pago
  source?: "mensalidades" | "matriculas";
  type?: "matricula" | "confirmacao" | "bolsista";
}

export function FinancialDetailDrawer({
  isOpen,
  onClose,
  escolaId,
  classeId,
  turmaId,
  classeLabel,
  mes,
  ano,
  anoLetivoId,
  status = "pendente",
  source = "mensalidades",
  type,
}: FinancialDetailDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<StudentDetail[]>([]);
  const [error, setError] = useState<string | null>(null);

  const canLoad =
    isOpen &&
    ano &&
    (source === "mensalidades" || (source === "matriculas" && (classeId || turmaId)));

  useEffect(() => {
    if (canLoad) {
      void loadDetails();
    }
  }, [canLoad, classeId, turmaId, mes, ano, anoLetivoId, status, source, type]);

  async function loadDetails() {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/financeiro/relatorios/drill-down?escolaId=${escolaId}&ano=${ano}&source=${source}&status=${status}`;
      if (anoLetivoId) url += `&ano_letivo_id=${encodeURIComponent(anoLetivoId)}`;
      if (classeId) url += `&classe_id=${classeId}`;
      if (turmaId) url += `&turma_id=${turmaId}`;
      if (mes) url += `&mes=${mes}`;
      if (type) url += `&type=${type}`;

      const res = await fetch(url);
      const json = await res.json();
      if (json.ok) {
        setStudents(json.items || []);
      } else {
        throw new Error(json.error || "Erro ao carregar detalhes");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const formatMonth = (m?: string, a?: string) => {
    if (!m || !a) return "";
    return new Date(`${a}-${m}-01T12:00:00`).toLocaleDateString("pt-PT", {
      month: "long",
      year: "numeric",
    });
  };

  const getTitle = () => {
    if (source === "matriculas") {
      if (type === "bolsista") return `Bolsistas: ${classeLabel}`;
      if (type === "confirmacao") return `Confirmações: ${classeLabel}`;
      return `Matrículas: ${classeLabel}`;
    }
    return `${status === "pago" ? "Recebimentos" : "Inadimplência"}: ${classeLabel}`;
  };

  const paymentAmountLabel = status === "pago" ? "Valor recebido" : "Total devido";

  return (
    <Drawer open={isOpen} onOpenChange={(val) => !val && onClose()}>
      <DrawerContent className="max-h-[90vh]">
        <div className="mx-auto w-full max-w-4xl overflow-hidden flex flex-col h-full">
          <DrawerHeader className="border-b bg-slate-50/50">
            <div className="flex items-center justify-between">
              <div>
                <DrawerTitle className="text-xl font-bold text-slate-900">
                  {getTitle()}
                </DrawerTitle>
                <DrawerDescription className="text-sm text-slate-500">
                  {source === "matriculas" 
                    ? `Alunos registrados no ano letivo ${ano}.`
                    : `Alunos com propinas ${status === "pago" ? "liquidadas" : "em atraso"} ${
                        mes ? `para ${formatMonth(mes, ano)}` : `no ano letivo ${ano}`
                      }.`}
                </DrawerDescription>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-2 hover:bg-slate-200 text-slate-400 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <Loader2 className="h-8 w-8 animate-spin mb-3 text-indigo-600" />
                <p className="text-sm font-medium">Cruzando dados operacionais...</p>
              </div>
            ) : error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-center text-sm text-rose-700">
                {error}
              </div>
            ) : students.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-center">
                <div className="rounded-full bg-slate-100 p-4 mb-4">
                  <User className="h-10 w-10" />
                </div>
                <p className="text-base font-semibold text-slate-600">Nenhum aluno encontrado</p>
                <p className="text-sm max-w-xs mt-1">
                  Não existem registros para este período.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {students.map((student) => (
                  <div
                    key={student.id}
                    className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-4 mb-4">
                      <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-full bg-slate-100 border border-slate-200">
                        {student.foto ? (
                          <img src={student.foto} alt={student.nome} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-slate-400">
                            <User className="h-6 w-6" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="truncate text-sm font-bold text-slate-900">{student.nome}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Proc: {student.processo}</span>
                          <span className="h-1 w-1 rounded-full bg-slate-300"></span>
                          <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">{student.turma}</span>
                        </div>
                      </div>
                      <Link
                        href={`/escola/${escolaId}/alunos/${student.alunoId}`}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                        title="Ver perfil completo"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        <span className="font-medium truncate">{student.encarregado || "Não informado"}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        {student.contacto && (
                          <a
                            href={`tel:${student.contacto}`}
                            className="flex items-center gap-2 text-xs text-indigo-600 hover:underline font-medium"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            {student.contacto}
                          </a>
                        )}
                        {student.email && (
                          <a
                            href={`mailto:${student.email}`}
                            className="flex items-center gap-2 text-xs text-indigo-600 hover:underline font-medium"
                          >
                            <Mail className="h-3.5 w-3.5" />
                            E-mail
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="mt-auto flex items-center justify-between rounded-lg bg-slate-50 p-2.5">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                          {source === "matriculas" ? "Status Matrícula" : paymentAmountLabel}
                        </p>
                        <p className="text-sm font-black text-slate-900 uppercase">
                          {source === "matriculas"
                            ? student.status
                            : kwanza.format(status === "pago" ? student.pago : student.valor)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                          {source === "matriculas" ? "Registrado em" : "Vencimento"}
                        </p>
                        <p className={`text-xs font-bold ${source === "matriculas" ? "text-indigo-600" : "text-rose-600"}`}>
                          {new Date(student.vencimento).toLocaleDateString("pt-PT")}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DrawerFooter className="border-t bg-slate-50/50 p-4">
            <div className="flex w-full items-center justify-between text-sm">
              <div className="text-slate-500 font-medium">
                Total de <span className="font-bold text-slate-900">{students.length}</span> alunos listados
              </div>
              <button
                onClick={onClose}
                className="rounded-lg bg-slate-900 px-6 py-2 text-sm font-bold text-white hover:bg-slate-800 transition-colors shadow-sm"
              >
                Fechar Visualização
              </button>
            </div>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
