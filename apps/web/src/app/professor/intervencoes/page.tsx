"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { useToast } from "@/components/feedback/FeedbackSystem";
import { buildPortalHref, getEscolaParamFromPath } from "@/lib/navigation";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  Send,
  UserCheck,
  Phone,
  FileCheck,
  CheckCircle2,
  Clock,
  Plus,
  ArrowLeft
} from "lucide-react";

type Intervention = {
  id: string;
  aluno_id: string;
  turma_id: string;
  tipo: "enviar_alerta" | "atribuir_ficha" | "contactar_familia" | "acompanhar_aluno";
  status: "pendente" | "em_tratamento" | "concluida" | "cancelada";
  motivo?: string | null;
  payload: Record<string, unknown>;
  due_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  alunos?: { id: string; nome?: string | null; nome_completo?: string | null } | null;
  turmas?: { id: string; nome?: string | null } | null;
};

export default function ProfessorIntervencoesPage() {
  const pathname = usePathname();
  const escolaParam = getEscolaParamFromPath(pathname);
  const professorHref = (path: string) => buildPortalHref(escolaParam, path);

  const { success, error: toastError } = useToast();
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await fetch("/api/professor/pedagogia/interventions", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Erro ao carregar intervenções");
      setInterventions(json.items || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setLoadError(message);
      toastError("Erro", message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const completeIntervention = async (id: string) => {
    setUpdatingId(id);
    try {
      const res = await fetch("/api/professor/pedagogia/interventions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: "concluida" }) });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Não foi possível concluir");
      success("Acção concluída", "A intervenção foi actualizada na fila.");
      await loadData();
    } catch (err) { toastError("Acção não concluída", err instanceof Error ? err.message : String(err)); }
    finally { setUpdatingId(null); }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-24">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <DashboardHeader
            title="Radar & Fila de Intervenção Pedagógica"
            description="Ações proativas para suporte e acompanhamento de alunos em risco académico."
            breadcrumbs={[
              { label: "Início", href: "/professor" },
              { label: "Pedagógico", href: "/professor" },
              { label: "Intervenções" },
            ]}
          />
        </header>

        {loadError ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700"><p className="font-black">Não foi possível carregar as intervenções.</p><p className="mt-1">{loadError}</p><button type="button" onClick={() => void loadData()} className="mt-3 rounded-lg bg-rose-700 px-3 py-2 text-xs font-black text-white">Tentar novamente</button></div>
        ) : loading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-3xl bg-white border border-slate-200" />
            ))}
          </div>
        ) : interventions.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-slate-900">Sem intervenções pendentes</h3>
            <p className="text-xs font-medium text-slate-500 max-w-sm mx-auto">
              Todas as ações de acompanhamento pedagógico estão em dia.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {interventions.map((item) => (
              <div
                key={item.id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase bg-amber-50 text-amber-800 border border-amber-200">
                    <AlertTriangle size={14} />
                    {item.tipo.replace("_", " ")}
                  </span>
                  <span className="text-xs font-mono font-semibold text-slate-400">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-black text-slate-900">
                    {item.alunos?.nome || item.alunos?.nome_completo || `Aluno ${item.aluno_id.slice(0, 8)}`}
                  </h4>
                  <p className="text-xs font-semibold text-slate-500">Turma: {item.turmas?.nome || item.turma_id.slice(0, 8)}</p>
                  {item.motivo && (
                    <p className="text-xs font-medium text-slate-600 mt-1">
                      {item.motivo}
                    </p>
                  )}
                </div>

                <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">
                    Estado: <span className="text-slate-900 uppercase font-black">{item.status}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => completeIntervention(item.id)}
                    disabled={updatingId === item.id || item.status === "concluida"}
                    className="px-4 py-2 rounded-xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-500 shadow-2xs"
                  >
                    {updatingId === item.id ? "A guardar…" : item.status === "concluida" ? "Concluída" : "Concluir Acção"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
