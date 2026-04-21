"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { CourseCard } from "@/components/shared/CourseCard";

type CursoItem = {
  id: string;
  descricao: string;
  valor_total: number;
  status_pagamento: string;
  referencia: string | null;
  emissao_em: string | null;
  vencimento_em: string | null;
  cohort: {
    id: string;
    codigo: string;
    nome: string;
    curso_nome: string;
    data_inicio: string;
    data_fim: string;
    status: string;
  } | null;
};

export default function MeusCursosClient() {
  const router = useRouter();
  const [items, setItems] = useState<CursoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/formacao/meus-cursos", { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as
          | { ok: boolean; error?: string; items?: CursoItem[] }
          | null;
        if (!res.ok || !json?.ok || !Array.isArray(json.items)) {
          throw new Error(json?.error || "Falha ao carregar cursos");
        }
        setItems(json.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro inesperado");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <header className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1F6B3B]/10 text-[#1F6B3B]">
            <GraduationCap size={24} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">meu percurso</p>
        </div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Meus Cursos</h1>
        <p className="mt-2 text-sm text-slate-500 font-medium">
          Acompanha o teu progresso académico e o estado das tuas inscrições.
        </p>
      </header>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 text-sm font-bold">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map(i => (
            <div key={i} className="h-48 rounded-[2rem] bg-white border border-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {items.map((item) => (
            <CourseCard
              key={item.id}
              id={item.id}
              title={item.cohort?.curso_nome ?? item.descricao}
              price={item.valor_total}
              format="PRESENCIAL"
              actionLabel="Ver Pagamento"
              onActionClick={(_id) => router.push("/pagamentos")}
            />
          ))}

          {!loading && items.length === 0 && (
            <div className="col-span-full py-20 text-center rounded-[2.2rem] bg-white border border-dashed border-slate-200">
              <GraduationCap size={48} className="mx-auto text-slate-200 mb-4" />
              <p className="text-slate-400 font-bold">Ainda não tens inscrições ativas.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
