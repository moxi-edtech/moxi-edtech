"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/feedback/FeedbackSystem";
import { useToast } from "@/components/feedback/FeedbackSystem";
import { Badge } from "@/components/ui/Badge";

type IdentidadeForm = {
  nome: string;
  nif: string | null;
  endereco: string | null;
  logo_url: string | null;
  cor_primaria: string | null;
  plano_atual: string | null;
  created_at: string | null;
  status: string | null;
  aluno_portal_enabled: boolean;
};

type PlanoLimites = {
  plan: string;
  price_mensal_kz: number;
  max_alunos: number | null;
  max_admin_users: number | null;
  max_storage_gb: number | null;
  professores_ilimitados: boolean;
  api_enabled: boolean;
  multi_campus: boolean;
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
    plano_atual: null,
    created_at: null,
    status: null,
    aluno_portal_enabled: false,
  });
  const [planoLimites, setPlanoLimites] = useState<PlanoLimites | null>(null);

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
          plano_atual: json?.data?.plano_atual ?? null,
          created_at: json?.data?.created_at ?? null,
          status: json?.data?.status ?? null,
          aluno_portal_enabled: !!json?.data?.aluno_portal_enabled,
        });
        setPlanoLimites(json?.limites ?? null);
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
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 font-sora">Identidade da Escola</h1>
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
                <div className="flex items-center justify-between border-b border-slate-50 pb-4 mb-2">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Identidade Oficial</h3>
                  {formData.plano_atual && (
                    <span className="inline-flex items-center rounded-full bg-klasse-green px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-sm">
                      Plano {formData.plano_atual}
                    </span>
                  )}
                </div>

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
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-50 pb-4 mb-2">Aparência da Marca</h3>
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
                  <p className="text-xs text-slate-400 mt-2 italic">* Definido automaticamente para o portal da sua escola.</p>
                </div>
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-6 shadow-sm">
                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-50 pb-3 mb-4">Estado da Subscrição</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400 uppercase">Status</span>
                      <Badge className={`${formData.status === 'ativa' ? 'bg-klasse-green-500' : 'bg-rose-500'} text-white border-0 text-[9px] font-black`}>
                        {formData.status?.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400 uppercase">Portal Aluno</span>
                      <Badge className={`${formData.aluno_portal_enabled ? 'bg-slate-500' : 'bg-slate-200'} text-white border-0 text-[9px] font-black`}>
                        {formData.aluno_portal_enabled ? 'ACTIVADO' : 'DESACTIVADO'}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400 uppercase">Membro desde</span>
                      <span className="text-xs font-bold text-slate-700 font-mono">
                        {formData.created_at ? new Date(formData.created_at).toLocaleDateString('pt-AO') : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {planoLimites && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-50 pb-3 mb-2">Contrato do Plano</h3>
                  <div className="grid gap-3 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold uppercase text-slate-400">Preço mensal</span>
                      <span className="font-bold text-slate-800">Kz {planoLimites.price_mensal_kz.toLocaleString("pt-AO")}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold uppercase text-slate-400">Alunos</span>
                      <span className="font-bold text-slate-800">
                        {planoLimites.max_alunos ? `Até ${planoLimites.max_alunos}` : "Ilimitado"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold uppercase text-slate-400">Utilizadores admin</span>
                      <span className="font-bold text-slate-800">
                        {planoLimites.max_admin_users ? `Até ${planoLimites.max_admin_users}` : "Ilimitado"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold uppercase text-slate-400">Professores</span>
                      <span className="font-bold text-slate-800">
                        {planoLimites.professores_ilimitados ? "Ilimitado" : "Limitado"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold uppercase text-slate-400">Storage</span>
                      <span className="font-bold text-slate-800">
                        {planoLimites.max_storage_gb ? `${planoLimites.max_storage_gb} GB` : "Ilimitado"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold uppercase text-slate-400">API</span>
                      <span className="font-bold text-slate-800">{planoLimites.api_enabled ? "Ativa" : "Não"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold uppercase text-slate-400">Multi-campus</span>
                      <span className="font-bold text-slate-800">{planoLimites.multi_campus ? "Ativo" : "Não"}</span>
                    </div>
                    {planoLimites.max_admin_users && (
                      <div className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                        No piloto (3–6 meses), o limite de utilizadores administrativos é apenas monitorado.
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-800">Prévia do logótipo</h3>
                <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 min-h-[180px]">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logótipo" className="max-h-40 object-contain animate-in fade-in zoom-in duration-300" />
                  ) : (
                    <div className="text-xs text-slate-400 text-center">
                      Logótipo oficial não carregado.
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
