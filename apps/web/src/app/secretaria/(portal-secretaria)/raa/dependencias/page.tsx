"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  RefreshCw,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

type Status = "pendente" | "em_recurso" | "resolvida_aprovada" | "resolvida_reprovada" | "cancelada";

type Item = {
  id: string;
  status: Status;
  aluno: { id: string; nome: string; numero_processo?: string | null };
  disciplina: { id: string; nome: string; sigla?: string | null };
  origem: { matricula_id: string; ano_letivo: number | null };
  destino: { matricula_id: string; ano_letivo: number | null } | null;
  presentation: {
    terminal: boolean;
    title: string;
    description: string;
    nextAction: string | null;
  };
  resultado: {
    status?: string | null;
    nota?: number | null;
    fonte?: string | null;
    resolvido_em?: string | null;
  };
};

const LABELS: Record<Status, string> = {
  pendente: "Pendente",
  em_recurso: "Em resolução",
  resolvida_aprovada: "Resolvida",
  resolvida_reprovada: "Resultado negativo",
  cancelada: "Cancelada",
};

const BADGE: Record<Status, string> = {
  pendente: "bg-amber-50 text-amber-800",
  em_recurso: "bg-sky-50 text-sky-800",
  resolvida_aprovada: "bg-emerald-50 text-emerald-800",
  resolvida_reprovada: "bg-rose-50 text-rose-800",
  cancelada: "bg-slate-100 text-slate-600",
};

function StatusIcon({ status }: { status: Status }) {
  if (status === "resolvida_aprovada") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (status === "resolvida_reprovada") return <XCircle className="h-4 w-4 text-rose-600" />;
  if (status === "em_recurso") return <Clock3 className="h-4 w-4 text-sky-600" />;
  return <AlertTriangle className="h-4 w-4 text-amber-600" />;
}

export default function DependenciasAcademicasPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [filter, setFilter] = useState<"abertas" | "todas" | Status>("abertas");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/academico/raa/dependencias", { cache: "no-store" });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Não foi possível carregar a fila.");
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar a fila.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => {
    if (filter === "todas") return items;
    if (filter === "abertas") return items.filter((item) => item.status === "pendente" || item.status === "em_recurso");
    return items.filter((item) => item.status === filter);
  }, [filter, items]);

  const abertas = items.filter((item) => item.status === "pendente" || item.status === "em_recurso").length;
  const resolvidas = items.filter((item) => item.status.startsWith("resolvida_")).length;

  return (
    <div className="space-y-5">
      <DashboardHeader
        title="Dependências académicas"
        description="Acompanhe disciplinas carregadas entre anos letivos. O resultado é atualizado pelo RAA; esta fila não altera notas manualmente."
        breadcrumbs={[
          { label: "Início", href: "/" },
          { label: "Secretaria", href: "/secretaria" },
          { label: "RAA", href: "/secretaria/raa/reapreciacoes" },
          { label: "Dependências" },
        ]}
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-500">Total</p>
          <p className="mt-1 text-2xl font-black text-slate-950">{items.length}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold text-amber-700">Em aberto</p>
          <p className="mt-1 text-2xl font-black text-amber-950">{abertas}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold text-emerald-700">Resolvidas</p>
          <p className="mt-1 text-2xl font-black text-emerald-950">{resolvidas}</p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">Fila de acompanhamento</h2>
            <p className="mt-1 text-xs text-slate-500">
              Para resolver uma dependência, publique o recurso/exame extraordinário correspondente. O estado será sincronizado automaticamente.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as typeof filter)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="abertas">Em aberto</option>
              <option value="pendente">Pendentes</option>
              <option value="em_recurso">Em resolução</option>
              <option value="resolvida_aprovada">Resolvidas</option>
              <option value="resolvida_reprovada">Resultado negativo</option>
              <option value="todas">Todas</option>
            </select>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-lg border border-slate-200 p-2 text-slate-600"
              aria-label="Atualizar dependências"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {message ? (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{message}</p>
        ) : null}

        <div className="mt-4 space-y-3">
          {!loading && visible.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
              Nenhuma dependência neste estado.
            </p>
          ) : null}

          {visible.map((item) => (
            <article key={item.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <StatusIcon status={item.status} />
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-950">{item.aluno.nome}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {item.aluno.numero_processo ? `Processo ${item.aluno.numero_processo} · ` : ""}
                      {item.disciplina.nome}
                    </p>
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${BADGE[item.status]}`}>
                  {LABELS[item.status]}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                {item.origem.ano_letivo ? <span className="rounded-lg bg-slate-50 px-2 py-1">Origem {item.origem.ano_letivo}</span> : null}
                {item.destino?.ano_letivo ? <span className="rounded-lg bg-slate-50 px-2 py-1">Destino {item.destino.ano_letivo}</span> : null}
                {item.resultado.fonte ? <span className="rounded-lg bg-slate-50 px-2 py-1">{item.resultado.fonte.replaceAll("_", " ")}</span> : null}
                {typeof item.resultado.nota === "number" ? <span className="rounded-lg bg-slate-50 px-2 py-1">Nota {item.resultado.nota.toFixed(1)}</span> : null}
              </div>

              <p className="mt-3 text-sm font-semibold text-slate-800">{item.presentation.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.presentation.description}</p>
              {item.presentation.nextAction ? (
                <p className="mt-2 text-xs font-semibold text-slate-700">Próximo passo: {item.presentation.nextAction}</p>
              ) : null}

              {!item.presentation.terminal ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href="/secretaria/raa/reapreciacoes"
                    className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    Abrir recursos
                  </Link>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
