"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Clock3 } from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

const days = ["", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
type HorarioItem = {
  slot_id: string; disciplina_id: string; disciplina_nome: string | null;
  dia_semana: number; inicio: string; fim: string; sala_nome: string | null; ordem: number;
};
type HorarioResponse = {
  ok: boolean; publicado: boolean; turma?: { nome?: string | null }; items?: HorarioItem[];
};

export default function ProfessorTurmaHorarioPage() {
  const params = useParams<{ turmaId: string }>();
  const turmaId = params?.turmaId;
  const [payload, setPayload] = useState<HorarioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!turmaId) { setPayload(null); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/professor/turmas/${encodeURIComponent(turmaId)}/horario`, { cache: "no-store" });
      const json = await response.json().catch(() => null);
      if (!response.ok || json?.ok !== true) throw new Error("Não foi possível consultar o horário.");
      setPayload(json as HorarioResponse);
    } catch {
      setPayload(null);
      setError("Não foi possível consultar o horário desta turma.");
    } finally {
      setLoading(false);
    }
  }, [turmaId]);

  useEffect(() => { void load(); }, [load]);
  const grouped = useMemo(() => (payload?.items ?? []).reduce((acc, item) => {
    const list = acc.get(item.dia_semana) ?? [];
    list.push(item);
    acc.set(item.dia_semana, list);
    return acc;
  }, new Map<number, HorarioItem[]>()), [payload]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
        <DashboardHeader
          title={`Horário · ${payload?.turma?.nome ?? "Turma"}`}
          description="Consulta as aulas, os horários e as salas da turma."
          breadcrumbs={[{ label: "Início", href: "/professor" }, { label: "Horário" }]}
        />
        {error ? (
          <div role="alert" className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-semibold text-foreground">{error}</p>
            <button type="button" onClick={() => void load()}
              className="mt-3 min-h-11 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-primary hover:bg-muted">
              Tentar novamente
            </button>
          </div>
        ) : loading ? (
          <p role="status" className="rounded-xl bg-muted p-5 text-sm text-muted-foreground">A carregar horário…</p>
        ) : !payload ? (
          <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">Turma não disponível.</p>
        ) : !payload.publicado ? (
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="font-semibold text-foreground">Horário ainda não publicado</p>
            <p className="mt-1 text-sm text-muted-foreground">A escola ainda não publicou as aulas desta turma.</p>
          </div>
        ) : grouped.size === 0 ? (
          <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">Ainda não há aulas publicadas nesta turma.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from(grouped.entries()).sort(([a], [b]) => a - b).map(([day, items]) => (
              <section key={day} className="rounded-xl border border-border bg-card p-4">
                <h2 className="mb-3 text-base font-semibold text-primary">{days[day] ?? "Dia"}</h2>
                <div className="space-y-2">
                  {items.map(item => (
                    <article key={`${item.slot_id}-${item.disciplina_id}`} className="flex items-start gap-3 rounded-xl bg-muted p-3">
                      <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">{item.disciplina_nome || "Aula"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.inicio.slice(0, 5)}–{item.fim.slice(0, 5)}
                          {item.sala_nome ? ` · ${item.sala_nome}` : ""}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
