"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/components/feedback/FeedbackSystem";
import {
  Sparkles,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  FileText,
  HelpCircle,
  ArrowRight,
  BookOpen
} from "lucide-react";

type StudentActivity = {
  id: string;
  titulo: string;
  instrucoes?: string | null;
  tipo: "quiz" | "exercicio" | "tarefa" | "simulado";
  status: string;
  prazo?: string | null;
  tentativas_permitidas: number;
  nota_maxima: number;
  plano_aula?: { data: string; tema: string } | null;
  published_at?: string | null;
  atividade_questoes?: Array<{
    id: string;
    ordem: number;
    tipo: string;
    enunciado: string;
    opcoes: string[];
    pontos: number;
  }>;
  ultima_entrega?: {
    id: string;
    tentativa: number;
    estado: "iniciada" | "submetida" | "corrigida";
    nota?: number | null;
    feedback?: string | null;
    submitted_at?: string | null;
  } | null;
};

export default function AlunoAtividadesPage() {
  const { error: toastError } = useToast();
  const searchParams = useSearchParams();
  const studentId = searchParams?.get("aluno") ?? null;
  const query = studentId ? `?aluno=${studentId}` : "";

  const [atividades, setAtividades] = useState<StudentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/aluno/atividades", { cache: "no-store" });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Erro ao carregar actividades");
      }

      setAtividades(json.items || []);
    } catch (err: any) {
      toastError("Erro", err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 pb-24">
      {/* HEADER DA PÁGINA */}
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Portal do Aluno</span>
        </div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
          Actividades & Quizzes
        </h1>
        <p className="text-xs font-medium text-slate-500">
          Acompanhe os seus exercícios, quizzes e tarefas publicadas pelos seus professores.
        </p>
      </header>

      {/* LISTAGEM DE ACTIVIDADES */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-3xl bg-slate-100 border border-slate-200" />
          ))}
        </div>
      ) : atividades.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-base font-black text-slate-900">Nenhuma actividade pendente</h3>
          <p className="text-xs font-medium text-slate-500 max-w-sm mx-auto">
            As actividades e quizzes publicados pelos seus professores aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {atividades.map((act) => {
            const numQuestoes = act.atividade_questoes?.length ?? 0;
            const entrega = act.ultima_entrega;
            const isSubmetida = entrega?.estado === "submetida" || entrega?.estado === "corrigida";
            const isIniciada = entrega?.estado === "iniciada";

            const prazoDate = act.prazo ? new Date(act.prazo) : null;
            const isExpirado = prazoDate ? prazoDate.getTime() < Date.now() : false;

            return (
              <div
                key={act.id}
                className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-2xs hover:shadow-md hover:border-emerald-500/40 transition-all space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 font-mono">
                        {act.tipo}
                      </span>

                      {isSubmetida ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={12} />
                          Submetida ({entrega?.nota !== null && entrega?.nota !== undefined ? `${entrega.nota} pts` : "Aguarda Correção"})
                        </span>
                      ) : isIniciada ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-50 text-amber-800 border border-amber-200">
                          <Clock size={12} />
                          Em Andamento (Rascunho)
                        </span>
                      ) : isExpirado ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-50 text-rose-700 border border-rose-200">
                          <AlertCircle size={12} />
                          Prazo Terminado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-blue-50 text-blue-700 border border-blue-200">
                          Pendente
                        </span>
                      )}
                    </div>

                    <h3 className="font-black text-slate-900 text-base group-hover:text-emerald-700 transition-colors">
                      {act.titulo}
                    </h3>
                    {act.instrucoes && (
                      <p className="text-xs font-medium text-slate-500 line-clamp-2">
                        {act.instrucoes}
                      </p>
                    )}
                  </div>

                  <Link
                    href={`/aluno/atividades/${act.id}${query}`}
                    className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-black transition-all shrink-0 self-start sm:self-center cursor-pointer active:scale-95 ${
                      isSubmetida
                        ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        : isIniciada
                        ? "bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-2xs"
                        : isExpirado
                        ? "bg-slate-100 text-slate-500 cursor-not-allowed"
                        : "bg-emerald-600 text-white hover:bg-emerald-500 shadow-md"
                    }`}
                  >
                    <span>
                      {isSubmetida
                        ? "Ver Resumo"
                        : isIniciada
                        ? "Retomar Rascunho"
                        : isExpirado
                        ? "Ver Detalhes"
                        : "Iniciar Actividade"}
                    </span>
                    <ArrowRight size={14} />
                  </Link>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-400 pt-1 border-t border-slate-100">
                  <span>{numQuestoes} {numQuestoes === 1 ? "Questão" : "Questões"}</span>
                  <span>Pontuação Máx: {act.nota_maxima} pts</span>
                  {prazoDate && (
                    <span className="font-mono text-amber-700">
                      Prazo: {prazoDate.toLocaleDateString()} às {prazoDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
