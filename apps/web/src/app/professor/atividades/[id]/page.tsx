"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { useToast } from "@/components/feedback/FeedbackSystem";
import { buildPortalHref, getEscolaParamFromPath } from "@/lib/navigation";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  UserCheck,
  AlertCircle,
  FileText,
  Send,
  Layers,
  Award
} from "lucide-react";

type Submission = {
  id: string;
  aluno_id: string;
  tentativa: number;
  estado: "iniciada" | "submetida" | "corrigida";
  nota?: number | null;
  feedback?: string | null;
  submitted_at?: string | null;
  updated_at: string;
  alunos?: {
    id: string;
    nome?: string | null;
    nome_completo?: string | null;
  } | null;
};

type ActivityDetail = {
  id: string;
  titulo: string;
  instrucoes?: string | null;
  tipo: string;
  turma_id: string;
  disciplina_id: string;
  status: "rascunho" | "publicada" | "encerrada";
  prazo?: string | null;
  tentativas_permitidas: number;
  nota_maxima: number;
  atividade_questoes?: Array<{
    id: string;
    ordem: number;
    tipo: string;
    enunciado: string;
    opcoes: string[];
    pontos: number;
  }>;
};

export default function ProfessorAtividadeDetalhesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const pathname = usePathname();
  const escolaParam = getEscolaParamFromPath(pathname);
  const professorHref = (path: string) => buildPortalHref(escolaParam, path);

  const { success, error: toastError } = useToast();

  const [activity, setActivity] = useState<ActivityDetail | null>(null);
  const [entregas, setEntregas] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [gradeValue, setGradeValue] = useState("");
  const [feedbackValue, setFeedbackValue] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/professor/atividades/${id}`, { cache: "no-store" });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Actividade não encontrada");
      }

      setActivity(json.activity || null);
      setEntregas(json.entregas || []);
    } catch (err) {
      toastError("Erro ao Carregar", err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleTogglePublish = async () => {
    if (!activity) return;
    try {
      const newStatus = activity.status === "publicada" ? "rascunho" : "publicada";
      const res = await fetch(`/api/professor/atividades/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        if (json.next_action) {
          toastError("Não foi possível publicar", json.error);
          return;
        }
        throw new Error(json.error || "Erro ao atualizar estado");
      }

      success("Estado Alterado", `Actividade ${newStatus === "publicada" ? "publicada aos alunos" : "guardada como rascunho"}.`);
      loadData();
    } catch (err: any) {
      toastError("Erro", err.message || String(err));
    }
  };

  const handleGrade = async (entregaId: string) => {
    if (!gradeValue || !activity) return;
    setGradingId(entregaId);
    try {
      const res = await fetch(`/api/professor/atividades/${id}/entregas/${entregaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nota: Number(gradeValue), feedback: feedbackValue || null }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Não foi possível corrigir");
      success("Entrega corrigida", "A nota e o feedback foram guardados.");
      setGradeValue("");
      setFeedbackValue("");
      await loadData();
    } catch (err: any) {
      toastError("Correcção não guardada", err.message || String(err));
    } finally {
      setGradingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-24">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        
        <div className="flex items-center gap-3">
          <Link
            href={professorHref("/professor/atividades")}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all shadow-2xs"
          >
            <ArrowLeft size={18} />
          </Link>
          <span className="text-xs font-black uppercase tracking-widest text-slate-400">Voltar para Actividades</span>
        </div>

        {loading ? (
          <div className="h-64 animate-pulse rounded-3xl bg-white border border-slate-200" />
        ) : !activity ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
            <h3 className="text-lg font-black text-slate-900">Actividade não encontrada</h3>
          </div>
        ) : (
          <>
            {/* HERO CARD DA ACTIVIDADE */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {activity.tipo}
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                      activity.status === "publicada" ? "bg-emerald-600 text-white border-emerald-600" : "bg-amber-50 text-amber-800 border-amber-200"
                    }`}>
                      {activity.status}
                    </span>
                  </div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                    {activity.titulo}
                  </h1>
                </div>

                <button
                  type="button"
                  onClick={handleTogglePublish}
                  className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    activity.status === "publicada"
                      ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      : "bg-emerald-600 text-white hover:bg-emerald-500 shadow-md"
                  }`}
                >
                  {activity.status === "publicada" ? "Reverter para Rascunho" : "Publicar para a Turma"}
                </button>
                {activity.status === "rascunho" && (
                  <Link
                    href={professorHref(`/professor/atividades?edit=${id}`)}
                    className="px-4 py-2.5 rounded-xl text-xs font-black border border-slate-200 text-slate-700 hover:bg-slate-50"
                  >
                    Editar rascunho
                  </Link>
                )}
              </div>

              {activity.instrucoes && (
                <p className="text-xs font-medium text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  {activity.instrucoes}
                </p>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Questões</span>
                  <p className="text-base font-black text-slate-900 mt-0.5">
                    {activity.atividade_questoes?.length ?? 0}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Nota Máxima</span>
                  <p className="text-base font-black text-emerald-700 mt-0.5">
                    {activity.nota_maxima} pts
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Tentativas</span>
                  <p className="text-base font-black text-slate-900 mt-0.5">
                    {activity.tentativas_permitidas} máx
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Prazo</span>
                  <p className="text-base font-black text-amber-700 mt-0.5">
                    {activity.prazo ? new Date(activity.prazo).toLocaleDateString() : "Sem Prazo"}
                  </p>
                </div>
              </div>
            </div>

            {/* TABELA DE SUBMISSÕES DOS ALUNOS */}
            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden space-y-3">
              <div className="p-4 border-b border-slate-200/80 bg-slate-50/80 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase">Entregas dos Alunos ({entregas.length})</h3>
                  <p className="text-xs text-slate-500 font-medium">Acompanhe as submissões em tempo real</p>
                </div>
              </div>

              {entregas.length === 0 ? (
                <div className="p-8 text-center text-xs font-semibold text-slate-500">
                  Nenhuma entrega submetida até ao momento.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3">Aluno</th>
                        <th className="px-4 py-3 text-center">Tentativa</th>
                        <th className="px-4 py-3 text-center">Estado</th>
                        <th className="px-4 py-3 text-center">Nota</th>
                        <th className="px-4 py-3">Feedback / acção</th>
                        <th className="px-4 py-3 text-right">Data de Envio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {entregas.map((ent) => (
                        <tr key={ent.id} className="hover:bg-slate-50/80">
                          <td className="px-4 py-3 font-bold text-slate-900">
                            {ent.alunos?.nome || ent.alunos?.nome_completo || `Aluno ID: ${ent.aluno_id.slice(0, 8)}`}
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-bold text-slate-600">
                            #{ent.tentativa}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                              ent.estado === "submetida" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-800 border-amber-200"
                            }`}>
                              {ent.estado}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-black text-slate-900">
                            {ent.nota !== null && ent.nota !== undefined ? `${ent.nota} pts` : "—"}
                          </td>
                          <td className="px-4 py-3 min-w-[260px]">
                            {ent.estado === "submetida" ? (
                              <div className="flex flex-wrap gap-2">
                                <input
                                  type="number"
                                  min="0"
                                  max={activity.nota_maxima}
                                  value={gradingId === ent.id ? gradeValue : ent.nota ?? ""}
                                  onChange={(event) => { setGradingId(ent.id); setGradeValue(event.target.value); }}
                                  placeholder="Nota"
                                  className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-xs"
                                />
                                <input
                                  value={gradingId === ent.id ? feedbackValue : ent.feedback ?? ""}
                                  onChange={(event) => { setGradingId(ent.id); setFeedbackValue(event.target.value); }}
                                  placeholder="Feedback opcional"
                                  className="min-w-[130px] flex-1 rounded-lg border border-slate-200 px-2 py-1 text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleGrade(ent.id)}
                                  disabled={gradingId === ent.id && !gradeValue}
                                  className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-black text-white disabled:opacity-50"
                                >
                                  Guardar
                                </button>
                              </div>
                            ) : ent.feedback ? <span className="text-slate-500">{ent.feedback}</span> : <span className="text-slate-400">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-400">
                            {ent.submitted_at ? new Date(ent.submitted_at).toLocaleString() : "Em andamento"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
}
