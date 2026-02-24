"use client";

import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { Skeleton } from "@/components/feedback/FeedbackSystem";
import Link from "next/link";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildEscolaUrl } from "@/lib/escola/url";

type Classe = {
  id: string;
  nome: string;
  // Add other properties as needed
};

export default function ClassesListClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classes, setClasses] = useState<Classe[]>([]);
  const { escolaId, isLoading: escolaLoading, error: escolaError } = useEscolaId();

  useEffect(() => {
    const loadData = async () => {
      if (!escolaId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(buildEscolaUrl(escolaId, '/classes'));
        const json = await res.json();
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || "Falha ao carregar classes");
        }

        const items = Array.isArray(json?.items)
          ? json.items
          : Array.isArray(json?.data)
            ? json.data
            : [];

        setClasses(items);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro desconhecido");
      } finally {
        setLoading(false);
      }
    };
    if (escolaId) loadData();
  }, [escolaId]);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 p-6">
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <h1 className="text-2xl font-bold text-moxinexa-navy">Classes</h1>
        <p className="text-sm text-slate-500 mt-1">
          Lista de todas as classes disponíveis.
        </p>
      </div>

      {(loading || escolaLoading) && (
        <div className="text-center p-8">
          <div className="mx-auto space-y-2 max-w-xs">
            <Skeleton className="h-4 w-40 mx-auto" />
            <Skeleton className="h-3 w-56 mx-auto" />
          </div>
        </div>
      )}

      {(error || escolaError) && <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">{error || escolaError}</div>}

      {!loading && !error && Array.isArray(classes) && classes.length > 0 && (
        <div className="bg-white rounded-xl shadow border">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {classes.map((classe) => (
                <tr key={classe.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                    {classe.nome}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <Link href={`/secretaria/classes/${classe.id}`} className="text-emerald-600 hover:text-emerald-900">
                        Ver Disciplinas
                    </Link>
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
