"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Wand2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  School,
  BookOpen,
  Calendar,
  ArrowRight,
  Layers,
} from "lucide-react";
import { toast } from "sonner";

type BackfillPreviewAPI = {
  ok?: boolean;
  preview?: {
    sessions?: Array<{ nome: string }>;
    courses?: Array<{ codigo?: string; nome?: string }>; // não usado pelo endpoint atual
    cursos?: Array<{ codigo?: string; nome?: string }>;
    classes?: Array<{ numero?: number; nome?: string }>;
    turmas?: Array<{ nome: string }>;
  };
  create?: { sessions?: number; courses?: number; classes?: number; turmas?: number };
};

type BackfillPreview = {
  missing: {
    sessions: string[];
    courses: string[];
    classes: string[];
    turmas: string[];
  };
  counts: {
    sessions: number;
    courses: number;
    classes: number;
    turmas: number;
  };
};

interface BackfillStepProps {
  importId: string;
  escolaId: string;
  onNext: () => void;
  onBack: () => void;
}

export default function BackfillStep({ importId, escolaId, onNext, onBack }: BackfillStepProps) {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [rawPreview, setRawPreview] = useState<BackfillPreviewAPI | null>(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const normalized: BackfillPreview | null = useMemo(() => {
    if (!rawPreview) return null;
    const p = rawPreview.preview || {};
    const sessions = (p.sessions || []).map((s: any) => String(s?.nome ?? "")).filter(Boolean);
    const coursesSrc = (p.cursos || (p as any).courses || []) as Array<{ codigo?: string; nome?: string }>;
    const courses = coursesSrc.map((c) => (c?.codigo ? String(c.codigo) : String(c?.nome ?? ""))).filter(Boolean);
    const classes = (p.classes || [])
      .map((c: any) => (c?.nome ? String(c.nome) : c?.numero != null ? `${c.numero}ª Classe` : ""))
      .filter(Boolean);
    const turmas = (p.turmas || []).map((t: any) => String(t?.nome ?? "")).filter(Boolean);
    return {
      missing: { sessions, courses, classes, turmas },
      counts: {
        sessions: sessions.length,
        courses: courses.length,
        classes: classes.length,
        turmas: turmas.length,
      },
    };
  }, [rawPreview]);

  const fetchPreview = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/migracao/${encodeURIComponent(importId)}/academico/backfill?escola_id=${encodeURIComponent(escolaId)}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Falha ao analisar estrutura acadêmica.");
      const json = (await res.json()) as any;
      // Nosso endpoint retorna { ok, preview, create }
      setRawPreview(json as BackfillPreviewAPI);
    } catch (err: any) {
      setError(err?.message || "Erro ao carregar preview.");
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    try {
      setProcessing(true);
      setError(null);
      const resStruct = await fetch(`/api/migracao/${encodeURIComponent(importId)}/academico/backfill?escola_id=${encodeURIComponent(escolaId)}`, { method: "POST" });
      if (!resStruct.ok) {
        const j = await resStruct.json().catch(() => ({}));
        throw new Error(j?.error || "Erro ao criar estrutura acadêmica.");
      }
      // Ofertas (opcional) — não falha o fluxo se der erro
      try {
        await fetch(`/api/escolas/${encodeURIComponent(escolaId)}/academico/offers/backfill`, { method: "POST" });
      } catch (_) {}
      toast.success("Estrutura criada com sucesso! 🚀");
      setSuccess(true);
      // Recarrega preview para refletir estado atual (opcional)
      fetchPreview();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao processar.");
      setError(err?.message || "Erro ao processar.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="w-10 h-10 text-teal-600 animate-spin" />
        <p className="text-sm text-slate-500 font-medium">
          A analisar o ficheiro e a comparar com a escola...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
        <h3 className="text-red-800 font-bold">Erro na Análise</h3>
        <p className="text-red-600 text-sm mb-4">{error}</p>
        <button onClick={fetchPreview} className="text-xs font-bold text-red-700 underline">
          Tentar novamente
        </button>
      </div>
    );
  }

  const counts = normalized?.counts || { sessions: 0, courses: 0, classes: 0, turmas: 0 };
  const nothingToCreate = Object.values(counts).reduce((a, b) => a + b, 0) === 0;

  if (nothingToCreate && !success) {
    return (
      <div className="text-center py-10">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-xl font-bold text-slate-800">Tudo pronto!</h3>
        <p className="text-slate-500 max-w-md mx-auto mt-2">
          A estrutura acadêmica no ficheiro já existe na escola. Pode avançar diretamente para a matrícula.
        </p>
        <div className="mt-8">
          <button onClick={onNext} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 transition shadow-lg">
            Avançar para Matrículas <ArrowRight className="inline w-4 h-4 ml-2" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold mb-4 border border-indigo-100">
          <Wand2 className="w-3 h-3" /> Inteligência MoxiNexa
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Análise Estrutural</h2>
        <p className="text-slate-500 text-sm mt-2 max-w-xl mx-auto">
          Detetámos elementos no seu ficheiro Excel que ainda não existem na escola. Podemos criá-los automaticamente para si antes de matricular os alunos.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <PreviewCard icon={Calendar} label="Anos Letivos" count={counts.sessions} items={normalized?.missing.sessions || []} color="blue" isSuccess={success} />
        <PreviewCard icon={BookOpen} label="Cursos" count={counts.courses} items={normalized?.missing.courses || []} color="purple" isSuccess={success} />
        <PreviewCard icon={Layers} label="Classes" count={counts.classes} items={normalized?.missing.classes || []} color="orange" isSuccess={success} />
        <PreviewCard icon={School} label="Turmas" count={counts.turmas} items={normalized?.missing.turmas || []} color="teal" isSuccess={success} />
      </div>

      <div className="flex flex-col items-center justify-center pt-6 border-t border-slate-100">
        {!success ? (
          <>
            <p className="text-xs text-slate-400 mb-4">Ao confirmar, vamos criar estes registos no banco de dados.</p>
            <div className="flex gap-4">
              <button onClick={onBack} className="px-6 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition">
                Voltar
              </button>
              <button onClick={handleExecute} disabled={processing} className="group bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> A Criar Estrutura...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 group-hover:rotate-12 transition-transform" /> Criar Estrutura Automática
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center animate-in zoom-in duration-300">
            <div className="flex items-center gap-2 text-emerald-600 font-bold mb-6 bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-100">
              <CheckCircle2 className="w-5 h-5" /> Estrutura criada com sucesso!
            </div>
            <button onClick={onNext} className="bg-slate-900 hover:bg-slate-800 text-white px-10 py-4 rounded-xl font-bold text-base shadow-xl hover:-translate-y-1 transition-all flex items-center gap-2">
              Prosseguir para Matrícula <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewCard({ icon: Icon, label, count, items, color, isSuccess }: any) {
  const hasItems = count > 0;
  const colors: any = {
    blue: "bg-blue-50 text-blue-600 border-blue-200",
    purple: "bg-purple-50 text-purple-600 border-purple-200",
    orange: "bg-orange-50 text-orange-600 border-orange-200",
    teal: "bg-teal-50 text-teal-600 border-teal-200",
    gray: "bg-slate-50 text-slate-400 border-slate-100",
  };
  const style = hasItems ? colors[color] : colors.gray;
  return (
    <div className={`relative p-5 rounded-2xl border ${hasItems ? style.split(" ")[2] : "border-slate-100"} bg-white shadow-sm transition-all ${isSuccess && hasItems ? "ring-2 ring-emerald-500 border-transparent" : ""}`}>
      {isSuccess && hasItems && (
        <div className="absolute -top-3 -right-3 bg-emerald-500 text-white rounded-full p-1 shadow-md animate-in zoom-in">
          <CheckCircle2 className="w-4 h-4" />
        </div>
      )}
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2.5 rounded-xl ${hasItems ? style : "bg-slate-100 text-slate-300"}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
          <p className={`text-xl font-black ${hasItems ? "text-slate-800" : "text-slate-300"}`}>{count}</p>
        </div>
      </div>
      <div className="space-y-1">
        {hasItems ? (
          (items || []).slice(0, 3).map((item: string, i: number) => (
            <div key={i} className="text-xs font-medium text-slate-600 truncate bg-slate-50 px-2 py-1 rounded border border-slate-100">
              {item}
            </div>
          ))
        ) : (
          <p className="text-xs text-slate-300 italic">Nada a criar</p>
        )}
        {hasItems && (items?.length || 0) > 3 && (
          <p className="text-[10px] text-slate-400 font-bold pl-1">+ {(items.length - 3)} outros...</p>
        )}
      </div>
    </div>
  );
}

