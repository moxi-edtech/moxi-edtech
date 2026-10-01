"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  RefreshCw,
  XCircle,
} from "lucide-react";

type CarryoverStatus =
  | "pendente"
  | "em_recurso"
  | "resolvida_aprovada"
  | "resolvida_reprovada"
  | "cancelada";

type CarryoverItem = {
  id: string;
  status: CarryoverStatus;
  presentation: {
    terminal: boolean;
    tone: "amber" | "sky" | "emerald" | "rose" | "slate";
    title: string;
    description: string;
    nextAction: string | null;
  };
  disciplina: { id: string; nome: string; sigla?: string | null };
  origem: { matricula_id: string; ano_letivo: number | null };
  destino: { matricula_id: string; ano_letivo: number | null } | null;
  resultado: {
    status?: string | null;
    nota?: number | null;
    fonte?: string | null;
    resolvido_em?: string | null;
  };
};

type ResponseShape = {
  ok: boolean;
  summary?: { total: number; abertas: number; resolvidas: number };
  items?: CarryoverItem[];
  error?: string;
};

const TONE = {
  amber: "border-amber-200 bg-amber-50 text-amber-950",
  sky: "border-sky-200 bg-sky-50 text-sky-950",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-950",
  rose: "border-rose-200 bg-rose-50 text-rose-950",
  slate: "border-slate-200 bg-slate-50 text-slate-800",
} as const;

function StatusIcon({ status }: { status: CarryoverStatus }) {
  if (status === "resolvida_aprovada") return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
  if (status === "resolvida_reprovada") return <XCircle className="h-5 w-5 text-rose-600" />;
  if (status === "em_recurso") return <Clock3 className="h-5 w-5 text-sky-600" />;
  return <AlertTriangle className="h-5 w-5 text-amber-600" />;
}

function fonteLabel(source?: string | null) {
  if (source === "extraordinario") return "Exame extraordinário";
  if (source === "recurso") return "Recurso";
  return source ? source.replace(/_/g, " ") : null;
}

export function AcademicCarryoversCard({ studentId }: { studentId?: string | null }) {
  const [items, setItems] = useState<CarryoverItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const endpoint = useMemo(
    () => `/api/aluno/raa/dependencias${studentId ? `?studentId=${encodeURIComponent(studentId)}` : ""}`,
    [studentId],
  );

  const load = async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(endpoint, { cache: "no-store", signal });
      const json = await response.json().catch(() => null) as ResponseShape | null;
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Não foi possível carregar as dependências académicas.");
      }
      setItems(json.items ?? []);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar as dependências académicas.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const ctrl = new AbortController();
    void load(ctrl.signal);
    return () => ctrl.abort();
  }, [endpoint]);

  if (loading) {
    return <div className="h-28 animate-pulse rounded-3xl border border-slate-200 bg-white" aria-label="A carregar dependências académicas" />;
  }

  if (error) {
    return (
      <section className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">
        <p className="font-bold">Não foi possível verificar as dependências de anos anteriores.</p>
        <p className="mt-1 text-xs text-rose-800">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-rose-800 shadow-sm"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Tentar novamente
        </button>
      </section>
    );
  }

  if (items.length === 0) return null;

  const abertas = items.filter((item) => !item.presentation.terminal).length;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Anos anteriores</p>
          <h3 className="mt-1 text-base font-black text-slate-950">Dependências académicas</h3>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-600">
            Estas disciplinas pertencem à matrícula do ano anterior. A matrícula atual continua válida enquanto o RAA acompanha a resolução.
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
          {abertas > 0 ? `${abertas} em aberto` : "Tudo resolvido"}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <article key={item.id} className={`rounded-2xl border p-4 ${TONE[item.presentation.tone]}`}>
            <div className="flex items-start gap-3">
              <StatusIcon status={item.status} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black">{item.disciplina.nome}</p>
                  {item.origem.ano_letivo ? (
                    <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold">
                      Origem {item.origem.ano_letivo}
                    </span>
                  ) : null}
                  {item.destino?.ano_letivo ? (
                    <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold">
                      Atual {item.destino.ano_letivo}
                    </span>
                  ) : null}
                </div>

                <p className="mt-1 text-xs font-bold">{item.presentation.title}</p>
                <p className="mt-1 text-xs leading-relaxed opacity-80">{item.presentation.description}</p>

                <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
                  {fonteLabel(item.resultado.fonte) ? (
                    <span className="rounded-lg bg-white/70 px-2 py-1">{fonteLabel(item.resultado.fonte)}</span>
                  ) : null}
                  {typeof item.resultado.nota === "number" ? (
                    <span className="rounded-lg bg-white/70 px-2 py-1">Nota: {item.resultado.nota.toFixed(1)}</span>
                  ) : null}
                  {item.resultado.resolvido_em ? (
                    <span className="rounded-lg bg-white/70 px-2 py-1">
                      Resolvida em {new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium" }).format(new Date(item.resultado.resolvido_em))}
                    </span>
                  ) : null}
                </div>

                {item.presentation.nextAction ? (
                  <p className="mt-3 text-xs font-bold">Próximo passo: {item.presentation.nextAction}</p>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
