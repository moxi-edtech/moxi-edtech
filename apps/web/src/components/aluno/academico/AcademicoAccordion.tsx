"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";

type Disciplina = {
  id: string;
  nome: string;
  nota_t1?: number | null;
  nota_t2?: number | null;
  nota_t3?: number | null;
  nota_final?: number | null;
};

type BoletimResponse = {
  ok: boolean;
  nome_aluno?: string | null;
  disciplinas: Disciplina[];
};

function fmtNota(v?: number | null) {
  return typeof v === "number" ? v.toFixed(1) : "—";
}

function finalStatus(nota?: number | null) {
  if (typeof nota !== "number") return { label: "Pendente", cls: "bg-slate-100 text-slate-700" };
  return nota >= 10
    ? { label: "Aprovado", cls: "bg-klasse-green-100 text-klasse-green-700" }
    : { label: "Reprovado", cls: "bg-red-100 text-red-700" };
}

export function AcademicoAccordion() {
  const searchParams = useSearchParams();
  const studentId = useMemo(() => searchParams?.get("aluno") ?? null, [searchParams]);
  const [loading, setLoading] = useState(true);
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/aluno/boletim${studentId ? `?studentId=${studentId}` : ""}`, { cache: "no-store", signal: ctrl.signal })
      .then((r) => r.json() as Promise<BoletimResponse>)
      .then((json) => setDisciplinas(json.disciplinas ?? []))
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [studentId]);

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
      ) : (
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Desempenho por disciplina</h2>
          <div className="mt-3 space-y-2">
            {disciplinas.map((disc) => {
              const status = finalStatus(disc.nota_final);
              return (
                <details key={disc.id} className="rounded-xl border border-slate-200 p-3">
                  <summary className="cursor-pointer list-none text-sm font-medium text-slate-900">{disc.nome}</summary>
                  <div className="mt-3 grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
                    <div className="rounded-lg border border-slate-100 p-2">
                      <p className="text-xs text-slate-500">1º Trimestre</p>
                      <p>MAC: {fmtNota(disc.nota_t1)}</p>
                      <p>NPP: {fmtNota(disc.nota_t1)}</p>
                      <p>PT: {fmtNota(disc.nota_t1)}</p>
                      <p className="mt-1 font-medium">MT: {fmtNota(disc.nota_t1)}</p>
                    </div>
                    <div className="rounded-lg border border-slate-100 p-2">
                      <p className="text-xs text-slate-500">2º Trimestre</p>
                      <p>MAC: {fmtNota(disc.nota_t2)}</p>
                      <p>NPP: {fmtNota(disc.nota_t2)}</p>
                      <p>PT: {fmtNota(disc.nota_t2)}</p>
                      <p className="mt-1 font-medium">MT: {fmtNota(disc.nota_t2)}</p>
                    </div>
                    <div className="rounded-lg border border-slate-100 p-2">
                      <p className="text-xs text-slate-500">3º Trimestre</p>
                      <p>MAC: {fmtNota(disc.nota_t3)}</p>
                      <p>NPP: {fmtNota(disc.nota_t3)}</p>
                      <p>PT: {fmtNota(disc.nota_t3)}</p>
                      <p className="mt-1 font-medium">MT: {fmtNota(disc.nota_t3)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">Final: {fmtNota(disc.nota_final)}</p>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${status.cls}`}>{status.label}</span>
                  </div>
                </details>
              );
            })}
            {disciplinas.length === 0 && <p className="text-sm text-slate-500">Sem disciplinas no boletim.</p>}
          </div>
        </section>
      )}

      <div className="flex justify-end">
        <Button asChild variant="outline" tone="gold" className="min-h-11">
          <a href={`/api/aluno/boletim/pdf${studentId ? `?studentId=${studentId}` : ""}`} target="_blank" rel="noreferrer">Descarregar Boletim (PDF)</a>
        </Button>
      </div>
    </div>
  );
}
