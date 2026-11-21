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
    <div className="min-w-0 space-y-5 pb-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-primary">Actividades</h1>
        <p className="text-sm text-muted-foreground">
          Consulta as tarefas, começa uma actividade ou retoma um rascunho.
        </p>
      </header>

      {/* LISTAGEM DE ACTIVIDADES */}
      {loading ? (
        <div role="status" aria-label="A carregar actividades" className="space-y-3 motion-safe:animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-muted border border-border" />
          ))}
        </div>
      ) : atividades.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">Nenhuma actividade pendente</h3>
          <p className="text-xs font-medium text-muted-foreground max-w-sm mx-auto">
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
                className="group relative space-y-3 overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-klasse-gold/40"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-muted text-foreground font-mono">
                        {act.tipo}
                      </span>

                      {isSubmetida ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={12} />
                          Submetida ({entrega?.nota !== null && entrega?.nota !== undefined ? `${entrega.nota} pts` : "Aguarda Correção"})
                        </span>
                      ) : isIniciada ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase bg-amber-50 text-amber-800 border border-amber-200">
                          <Clock size={12} />
                          Em Andamento (Rascunho)
                        </span>
                      ) : isExpirado ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase bg-rose-50 text-rose-700 border border-rose-200">
                          <AlertCircle size={12} />
                          Prazo Terminado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase bg-blue-50 text-blue-700 border border-blue-200">
                          Pendente
                        </span>
                      )}
                    </div>

                    <h3 className="font-semibold text-foreground text-base group-hover:text-primary transition-colors">
                      {act.titulo}
                    </h3>
                    {act.instrucoes && (
                      <p className="text-xs font-medium text-muted-foreground line-clamp-2">
                        {act.instrucoes}
                      </p>
                    )}
                  </div>

                  <Link
                    href={`/aluno/atividades/${act.id}${query}`}
                    className={`inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 self-start rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 sm:self-center  ${
                      isSubmetida
                        ? "bg-muted text-foreground hover:bg-muted/80"
                        : isIniciada
                        ? "klasse-portal-cta shadow-sm"
                        : isExpirado
                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                        : "klasse-portal-cta shadow-sm"
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

                <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-muted-foreground pt-1 border-t border-border">
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
