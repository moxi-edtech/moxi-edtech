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
        const res = await fetch('/api/aluno/disciplinas', { cache: 'force-cache' });
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

  if (loading) return <div>Carregando disciplinas…</div>;

  if (!disciplinas.length) return <div className="text-sm text-gray-600">Nenhuma disciplina encontrada.</div>;

  return (
    <ul className="list-disc list-inside text-sm text-gray-700">
      {disciplinas.map((d) => (
        <li key={d.id}>{d.nome}</li>
      ))}
    </ul>
  );
}
