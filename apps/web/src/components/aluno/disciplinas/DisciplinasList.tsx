"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

type Disciplina = { id: string; nome: string };

export function DisciplinasList() {
  const [loading, setLoading] = useState(true);
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/aluno/disciplinas', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao carregar disciplinas');
        if (mounted) setDisciplinas(json.disciplinas || []);
      } catch (e) {
        if (mounted) setDisciplinas([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />;

  if (!disciplinas.length) return <div className="text-sm text-slate-500">Nenhuma disciplina encontrada.</div>;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {disciplinas.map((d) => (
        <div key={d.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">{d.nome}</p>
          <p className="text-xs text-slate-400">Disciplina ativa</p>
        </div>
      ))}
    </div>
  );
}
