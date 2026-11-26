"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { buildStudentPortalHref } from "@/lib/navigation";
import { useToast } from "@/components/feedback/FeedbackSystem";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  Save,
  Send,
  Sparkles,
  HelpCircle,
  ChevronRight
} from "lucide-react";

type Question = {
  id: string;
  ordem: number;
  tipo: "escolha_unica" | "verdadeiro_falso" | "resposta_curta";
  enunciado: string;
  opcoes: string[];
  pontos: number;
};

type Activity = {
  id: string;
  titulo: string;
  instrucoes?: string | null;
  tipo: string;
  prazo?: string | null;
  tentativas_permitidas: number;
  nota_maxima: number;
  plano_aula?: { data: string; tema: string; subtema?: string | null; objetivos?: string | null; conteudos?: string | null } | null;
  atividade_questoes?: Question[];
  ultima_entrega?: {
    id: string;
    tentativa: number;
    estado: "iniciada" | "submetida" | "corrigida";
    respostas?: Record<string, any>;
    nota?: number | null;
    feedback?: string | null;
  } | null;
};

export default function AlunoAtividadeRunnerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { success, error: toastError } = useToast();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchValue = searchParams?.toString() ?? "";
  const href = (target: string) => buildStudentPortalHref(pathname, searchValue, target);

  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);

  // Student Answers State
  const [respostas, setRespostas] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);

  // Next Action Error Modal
  const [nextActionError, setNextActionError] = useState<{
    error: string;
    next_action?: { type: string; label: string; href: string };
  } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/aluno/atividades", { cache: "no-store" });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Erro ao carregar actividade");
      }

      const found = (json.items || []).find((item: Activity) => item.id === id);
      if (!found) throw new Error("Actividade não encontrada");

      setActivity(found);

      // Pre-fill answers if draft exists
      if (found.ultima_entrega?.respostas) {
        setRespostas(found.ultima_entrega.respostas);
      }
    } catch (err: any) {
      toastError("Erro", err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleAnswerChange = (ordem: number, value: any) => {
    setRespostas((prev) => ({
      ...prev,
      [String(ordem)]: value,
    }));
  };

  const handleSaveSubmission = async (finalizar: boolean) => {
    if (!activity) return;
    setSubmitting(true);
    setNextActionError(null);

    const tentativaAtual = activity.ultima_entrega?.tentativa ?? 1;

    try {
      const res = await fetch(`/api/aluno/atividades/${id}/submeter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tentativa: tentativaAtual,
          respostas,
          finalizar,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        if (json.next_action) {
          setNextActionError({
            error: json.error || "Acção necessária",
            next_action: json.next_action,
          });
          return;
        }
        throw new Error(json.error || "Erro ao submeter entrega");
      }

      success(
        finalizar ? "Actividade Submetida!" : "Rascunho Guardado",
        finalizar
          ? "A sua entrega foi enviada com sucesso para o professor."
          : "As suas respostas foram salvas. Poderá continuar mais tarde."
      );

      loadData();
    } catch (err: any) {
      toastError("Erro na Entrega", err.message || String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div role="status" aria-label="A carregar actividade" className="space-y-4 pb-4 motion-safe:animate-pulse">
        <div className="h-44 rounded-xl bg-muted border border-border" />
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-4 text-center space-y-2">
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
        <h3 className="text-base font-semibold text-foreground">Actividade Indisponível</h3>
        <Link href={href("/aluno/atividades")} className="inline-block text-xs font-bold text-emerald-600">
          Voltar para Actividades
        </Link>
      </div>
    );
  }

  const entrega = activity.ultima_entrega;
  const isSubmetida = entrega?.estado === "submetida" || entrega?.estado === "corrigida";
  const prazoDate = activity.prazo ? new Date(activity.prazo) : null;
  const isExpirado = prazoDate ? prazoDate.getTime() < Date.now() : false;

  return (
    <div className="min-w-0 space-y-5 pb-4">
      
      {/* BARRA SUPERIOR DE NAVEGAÇÃO */}
      <div className="flex items-center gap-3">
        <Link
          href={href("/aluno/atividades")}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground  transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20" aria-label="Voltar às actividades"
        >
          <ArrowLeft size={18} />
        </Link>
        <span className="text-xs font-semibold  text-muted-foreground">Voltar às Actividades</span>
      </div>

      {/* MODAL DE ALERTA DE PRAZO / NEXT_ACTION */}
      {nextActionError && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 space-y-3 ">
          <div className="flex items-center gap-2 text-amber-950 font-semibold text-sm">
            <AlertCircle className="text-amber-600 shrink-0" size={20} />
            <span>{nextActionError.error}</span>
          </div>
          <p className="text-xs font-medium text-amber-900 leading-relaxed">
            O prazo estabelecido pelo professor terminou. Pode solicitar uma prorrogação através do canal de avisos da escola.
          </p>
          {nextActionError.next_action && (
            <Link
              href={nextActionError.next_action.href.startsWith("/aluno/") ? href(nextActionError.next_action.href) : nextActionError.next_action.href}
              className="klasse-portal-cta inline-flex min-h-11 items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm "
            >
              <span>{nextActionError.next_action.label}</span>
              <ChevronRight size={16} />
            </Link>
          )}
        </div>
      )}

      {/* HEADER DA ACTIVIDADE */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold  bg-muted text-foreground font-mono">
            {activity.tipo}
          </span>

          {isSubmetida ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 size={14} />
              Entregue ({entrega?.nota !== null && entrega?.nota !== undefined ? `${entrega.nota} pts` : "Em Avaliação"})
            </span>
          ) : isExpirado ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
              <AlertCircle size={14} />
              Prazo Expirado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              <Clock size={14} />
              Rascunho em Andamento
            </span>
          )}
        </div>

        <h1 className="text-xl font-semibold text-primary tracking-tight sm:text-2xl">
          {activity.titulo}
        </h1>

        {activity.instrucoes && (
          <p className="text-xs font-medium text-muted-foreground bg-muted/40 p-3 rounded-xl border border-border">
            {activity.instrucoes}
          </p>
        )}

        {activity.plano_aula && (
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <p className="text-xs font-semibold  text-emerald-700">Plano de aula · {activity.plano_aula.data}</p>
            <h2 className="mt-1 text-sm font-semibold text-foreground">{activity.plano_aula.tema}</h2>
            {activity.plano_aula.subtema && <p className="mt-1 text-xs text-muted-foreground">{activity.plano_aula.subtema}</p>}
            {activity.plano_aula.objetivos && <p className="mt-3 text-xs leading-relaxed text-foreground"><strong>Objetivos:</strong> {activity.plano_aula.objetivos}</p>}
            {activity.plano_aula.conteudos && <p className="mt-2 text-xs leading-relaxed text-foreground"><strong>Conteúdos:</strong> {activity.plano_aula.conteudos}</p>}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-muted-foreground pt-1">
          <span>Tentativa {entrega?.tentativa ?? 1} de {activity.tentativas_permitidas}</span>
          <span>Valor Máximo: {activity.nota_maxima} pts</span>
          {prazoDate && (
            <span className="font-mono text-amber-700 font-bold">
              Prazo: {prazoDate.toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      {/* RESOLUÇÃO DE QUESTÕES */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold  text-foreground px-1">
          Questões ({activity.atividade_questoes?.length ?? 0})
        </h2>

        {(activity.atividade_questoes ?? []).map((q, idx) => {
          const currentVal = respostas[String(q.ordem)] ?? "";

          return (
            <div
              key={q.id || idx}
              className="rounded-xl border border-border bg-card p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-primary font-mono">
                  Questão #{q.ordem} ({q.pontos} {q.pontos === 1 ? "ponto" : "pontos"})
                </span>
              </div>

              <p className="text-sm font-bold text-foreground leading-relaxed">
                {q.enunciado}
              </p>

              {/* TIPO: ESCOLHA ÚNICA */}
              {q.tipo === "escolha_unica" && (
                <div className="space-y-2 pt-1">
                  {q.opcoes.map((opt, optIdx) => {
                    const isSelected = currentVal === opt;
                    return (
                      <label
                        key={optIdx}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? "border-klasse-gold/70 bg-klasse-gold-50 text-foreground font-semibold"
                            : "border-border bg-muted/40 text-foreground hover:bg-muted"
                        } ${isSubmetida || isExpirado ? "pointer-events-none opacity-90" : ""}`}
                      >
                        <input
                          type="radio"
                          name={`q-${q.ordem}`}
                          value={opt}
                          disabled={isSubmetida || isExpirado}
                          checked={isSelected}
                          onChange={() => handleAnswerChange(q.ordem, opt)}
                          className="h-4 w-4 accent-klasse-gold focus:ring-klasse-gold/20"
                        />
                        <span className="text-xs font-medium">{opt}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* TIPO: VERDADEIRO / FALSO */}
              {q.tipo === "verdadeiro_falso" && (
                <div className="flex gap-2 pt-1">
                  {["Verdadeiro", "Falso"].map((option) => {
                    const isSelected = currentVal === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        disabled={isSubmetida || isExpirado}
                        onClick={() => handleAnswerChange(q.ordem, option)}
                        className={`flex-1 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? "border-klasse-gold bg-klasse-gold text-foreground"
                            : "border-border bg-muted/40 text-foreground hover:bg-muted"
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* TIPO: RESPOSTA CURTA */}
              {q.tipo === "resposta_curta" && (
                <div className="pt-1">
                  <textarea
                    rows={3}
                    disabled={isSubmetida || isExpirado}
                    value={currentVal}
                    onChange={(e) => handleAnswerChange(q.ordem, e.target.value)}
                    placeholder="Digite a sua resposta explicativa..."
                    className="w-full rounded-xl border border-border bg-card p-3 text-sm text-foreground outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20 disabled:bg-muted"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* BARRA DE AÇÕES (GUARDAR RASCUNHO OU SUBMETER) */}
      {!isSubmetida && !isExpirado && (
        <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 flex items-stretch gap-2 rounded-xl border border-border bg-card p-3">
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSaveSubmission(false)}
            className="inline-flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-border px-2 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 disabled:opacity-50 sm:px-4"
          >
            <Save size={16} className="text-muted-foreground" />
            <span>Guardar Rascunho</span>
          </button>

          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSaveSubmission(true)}
            className="klasse-portal-cta inline-flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-2 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-klasse-gold/20 disabled:opacity-50 sm:px-4 sm:text-sm"
          >
            <Send size={16} />
            <span>Finalizar e Submeter</span>
          </button>
        </div>
      )}

    </div>
  );
}
