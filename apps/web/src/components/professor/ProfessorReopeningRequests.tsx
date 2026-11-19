"use client";

import Link from "next/link";
import { ProfessorSkeletonBone } from "@/components/professor/ProfessorLoadingSkeletons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Clock3 } from "lucide-react";
import { reopeningFeedback, type ReopeningDisplayState } from "@/lib/academico/reopening-display";

type Assignment = {
  turma: { id: string; nome: string | null };
  disciplina: { id: string | null; nome: string | null };
};
type RequestItem = {
  id: string;
  turma_id: string;
  disciplina_id: string | null;
  disciplina_catalogo_id: string | null;
  trimestre: number;
  ano_letivo_id: string;
  status: ReopeningDisplayState;
  motivo: string;
  decisao_motivo: string | null;
  expira_em: string | null;
  created_at: string;
  decidido_em: string | null;
};
type ReopeningResponse = { ok: boolean; items?: RequestItem[] };

export default function ProfessorReopeningRequests({
  assignments,
  notesHref,
}: {
  assignments: Assignment[];
  notesHref: string;
}) {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/professor/notas/reabertura", { cache: "no-store" });
      if (res.status === 401) {
        setItems([]);
        setSessionExpired(true);
        setError(true);
        return;
      }
      if (!res.ok) throw new Error("GET");
      const data = await res.json() as ReopeningResponse;
      if (!data.ok || !Array.isArray(data.items)) throw new Error("DATA");
      setItems(data.items);
      setSessionExpired(false);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const onFocus = () => void load();
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    const timer = window.setInterval(onVisible, 60_000);
    window.addEventListener("klasse:reabertura-atualizada", onVisible);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("klasse:reabertura-atualizada", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const recent = useMemo(() => items.slice(0, 4), [items]);

  return (
    <section aria-label="Pedidos de reabertura de notas" className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="h-5 w-5 text-klasse-green" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-klasse-green">Pedidos de reabertura</h2>
      </div>
      {loading ? (
        <div role="status" aria-label="A carregar pedidos de reabertura" className="mt-3 space-y-2 motion-safe:animate-pulse">
          <span className="sr-only">A carregar pedidos de reabertura</span>
          <ProfessorSkeletonBone className="h-4 w-3/5 max-w-52" />
          <ProfessorSkeletonBone className="h-3 w-2/5 max-w-40" />
          <ProfessorSkeletonBone className="h-3 w-4/5 max-w-72" />
        </div>
      ) :
        error ? <button type="button" onClick={() => void load()} className="mt-3 text-sm font-semibold text-klasse-green">{sessionExpired ? "Sessão expirada. Volta a autenticar-te." : "Não foi possível actualizar. Tentar novamente"}</button> :
          <div className="mt-3 space-y-3" aria-live="polite" aria-relevant="text">
            {recent.length === 0 && <p className="text-sm text-muted-foreground">Sem pedidos de reabertura.</p>}
            {recent.map((item) => {
              const feedback = reopeningFeedback[item.status] ?? reopeningFeedback.EXPIRADO;
              const disciplinaCurricular = item.disciplina_catalogo_id ?? item.disciplina_id;
              const atrib = assignments.find((a) => a.turma.id === item.turma_id && a.disciplina.id === disciplinaCurricular);
              const query = new URLSearchParams({
                turma_id: item.turma_id,
                ...(disciplinaCurricular ? { disciplina_id: disciplinaCurricular } : {}),
                ano_letivo_id: item.ano_letivo_id,
                trimestre: String(item.trimestre),
              });
              const href = notesHref + (notesHref.includes("?") ? "&" : "?") + query.toString();
              return (
                <div key={item.id} className="border-t border-border pt-3 first:border-t-0 first:pt-0">
                  <p className="text-sm font-medium text-foreground">
                    {atrib?.disciplina.nome ?? "Disciplina"} · {atrib?.turma.nome ?? "Turma"} · {item.trimestre}.º trimestre
                  </p>
                  <p data-testid="reopening-state" className="mt-1 text-xs font-semibold text-foreground">{feedback.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{feedback.next}</p>
                  {item.status === "APROVADO" && item.expira_em && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                      Válido até {new Intl.DateTimeFormat("pt-AO", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Luanda" }).format(new Date(item.expira_em))}
                    </p>
                  )}
                  {item.decisao_motivo && <p className="mt-1 text-xs text-muted-foreground">Decisão: {item.decisao_motivo}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">Pedido em {new Intl.DateTimeFormat("pt-AO", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Luanda" }).format(new Date(item.created_at))}{item.decidido_em ? ` · Decidido em ${new Intl.DateTimeFormat("pt-AO", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Luanda" }).format(new Date(item.decidido_em))}` : ""}</p>
                  <Link href={href} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-klasse-green hover:underline">
                    Abrir pauta <span aria-hidden="true">›</span>
                  </Link>
                </div>
              );
            })}
          </div>}
    </section>
  );
}
