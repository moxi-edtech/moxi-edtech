"use client";

import { useEffect, useState } from "react";
import { Loader2, Book } from "lucide-react";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildEscolaUrl } from "@/lib/escola/url";

type Disciplina = {
  id: string;
  nome: string;
};

export default function ClasseDetailClient({ classeId }: { classeId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const { escolaId, isLoading: escolaLoading, error: escolaError } = useEscolaId();

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(buildEscolaUrl(escolaId, '/disciplinas'));
        const json = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json.error || "Falha ao carregar disciplinas");
        }
        const items = json.items || json.data || [];
        const filtered = Array.isArray(items)
          ? items.filter((d: any) => !d.classe_id || String(d.classe_id) === String(classeId))
          : [];
        setDisciplinas(filtered);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro desconhecido");
      } finally {
        setLoading(false);
      }
    };
    if (escolaId) loadData();
  }, [classeId, escolaId]);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 p-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h1 className="text-2xl font-bold text-moxinexa-navy">Disciplinas da Classe</h1>
        </div>

        {(loading || escolaLoading) && (
            <div className="text-center p-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-moxinexa-teal" />
            <p className="text-slate-500 mt-2">Carregando...</p>
            </div>
        )}

        {(error || escolaError) && <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">{error || escolaError}</div>}

        {!loading && !error && disciplinas.length > 0 && (
            <div className="bg-white rounded-xl shadow border">
            <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Nome
                    </th>
                </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                {disciplinas.map((disciplina) => (
                    <tr key={disciplina.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                        {disciplina.nome}
                    </td>
                    </tr>
                ))}
                </tbody>
            </table>
            </div>
        )}
    </div>
  );
}
