"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/feedback/FeedbackSystem";
import { useToast } from "@/components/feedback/FeedbackSystem";

type IdentidadeForm = {
  nome: string;
  nif: string | null;
  endereco: string | null;
  logo_url: string | null;
  cor_primaria: string | null;
};

type Props = {
  params: Promise<{ id: string }>;
};

export default function IdentidadePage({ params }: Props) {
  const { id: escolaId } = use(params);
  const base = escolaId ? `/escola/${escolaId}/admin/configuracoes` : "";
  const { error } = useToast();

  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<IdentidadeForm>({
    nome: "",
    nif: null,
    endereco: null,
    logo_url: null,
    cor_primaria: null,
  });

  const logoPreview = useMemo(() => formData.logo_url?.trim() || "", [formData.logo_url]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/escola/${escolaId}/admin/configuracoes/identidade`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) {
          error(json?.error ?? "Falha ao carregar identidade.");
          return;
        }
        setFormData({
          nome: json?.data?.nome ?? "",
          nif: json?.data?.nif ?? null,
          endereco: json?.data?.endereco ?? null,
          logo_url: json?.data?.logo_url ?? null,
          cor_primaria: json?.data?.cor_primaria ?? null,
        });
      } catch (err) {
        console.error(err);
        error("Erro inesperado ao carregar identidade.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (escolaId) load();
    return () => {
      cancelled = true;
    };
  }, [escolaId]);

  const inputClass =
    "w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none transition-all focus:border-klasse-gold focus:ring-1 focus:ring-klasse-gold placeholder:text-slate-300 bg-slate-50";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href={base}
              className="group inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors"
            >
              <ArrowLeft className="h-3 w-3 transition-transform group-hover:-translate-x-1" />
              Voltar ao painel
            </Link>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Identidade da Escola</h1>
            <p className="text-sm text-slate-500">
              Dados oficiais definidos pelo super admin. Caso precise alterar,
              solicite ao suporte.
            </p>
          </div>
        </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Skeleton className="h-4 w-40" />
        </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Nome oficial</label>
                  <input
                    className={inputClass}
                    value={formData.nome}
                    readOnly
                    placeholder="Nome da escola"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">NIF</label>
                  <input
                    className={inputClass}
                    value={formData.nif ?? ""}
                    readOnly
                    placeholder="Número fiscal"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Endereço</label>
                  <input
                    className={inputClass}
                    value={formData.endereco ?? ""}
                    readOnly
                    placeholder="Rua, bairro, cidade"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Logótipo (URL)</label>
                  <input
                    className={inputClass}
                    value={formData.logo_url ?? ""}
                    readOnly
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Cor principal</label>
                  <input
                    className={inputClass}
                    value={formData.cor_primaria ?? ""}
                    readOnly
                    placeholder="#E3B23C"
                  />
                  <p className="text-xs text-slate-400 mt-2">Use um hex (#RRGGBB) para a cor oficial.</p>
                </div>
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-800">Prévia do logótipo</h3>
                <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 min-h-[180px]">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logótipo" className="max-h-40 object-contain" />
                  ) : (
                    <div className="text-xs text-slate-400 text-center">
                      Informe a URL do logótipo para visualizar.
                    </div>
                  )}
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
