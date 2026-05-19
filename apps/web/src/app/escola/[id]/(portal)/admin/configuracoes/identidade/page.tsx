"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/feedback/FeedbackSystem";
import { useToast } from "@/components/feedback/FeedbackSystem";
import { Badge } from "@/components/ui/Badge";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildPortalHref } from "@/lib/navigation";

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
  dados_pagamento: {
    banco: string;
    titular_conta: string;
    iban: string;
    numero_conta: string;
    kwik_chave: string;
  };
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
  fin_recibo_pdf?: boolean;
  sec_upload_docs?: boolean;
  sec_matricula_online?: boolean;
  doc_qr_code?: boolean;
  app_whatsapp_auto?: boolean;
  suporte_prioritario?: boolean;
};

type AssinaturaResumo = {
  valor_kz: number | null;
  ciclo: "mensal" | "anual" | null;
  status: string | null;
};

type Props = {
  params: Promise<{ id: string }>;
};

export default function IdentidadePage({ params }: Props) {
  const { id: escolaId } = use(params);
  const { escolaSlug } = useEscolaId();
  const escolaParam = escolaSlug || escolaId;
  const base = buildPortalHref(escolaParam, "/admin/configuracoes");
  const { error, success } = useToast();

  const [loading, setLoading] = useState(true);
  const [savingBanking, setSavingBanking] = useState(false);
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
    dados_pagamento: {
      banco: "",
      titular_conta: "",
      iban: "",
      numero_conta: "",
      kwik_chave: "",
    },
  });
  const [planoLimites, setPlanoLimites] = useState<PlanoLimites | null>(null);
  const [assinatura, setAssinatura] = useState<AssinaturaResumo | null>(null);
  const [savingLogo, setSavingLogo] = useState(false);
  const beneficiosPlano = useMemo(() => {
    if (!planoLimites) return [];
    return [
      { label: "Recibos em PDF", enabled: Boolean(planoLimites.fin_recibo_pdf) },
      { label: "Upload de documentos", enabled: Boolean(planoLimites.sec_upload_docs) },
      { label: "Matrícula online", enabled: Boolean(planoLimites.sec_matricula_online) },
      { label: "Documentos com QR", enabled: Boolean(planoLimites.doc_qr_code) },
      { label: "WhatsApp automático", enabled: Boolean(planoLimites.app_whatsapp_auto) },
      { label: "Suporte prioritário", enabled: Boolean(planoLimites.suporte_prioritario) },
    ];
  }, [planoLimites]);

  const logoPreview = useMemo(() => formData.logo_url?.trim() || "", [formData.logo_url]);

  async function uploadLogo(file: File) {
    setSavingLogo(true);
    try {
      const fd = new FormData();
      fd.set("logo", file);
      const res = await fetch(`/api/escola/${escolaParam}/admin/configuracoes/identidade`, {
        method: "PUT",
        body: fd,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        error(json?.error || "Falha ao actualizar logo.");
        return;
      }
      setFormData((prev) => ({ ...prev, logo_url: json.data?.logo_url ?? prev.logo_url }));
      success("Logo atualizado com sucesso.");
    } catch {
      error("Erro ao carregar logo.");
    } finally {
      setSavingLogo(false);
    }
  }

  async function removeLogo() {
    setSavingLogo(true);
    try {
      const fd = new FormData();
      fd.set("removeLogo", "true");
      const res = await fetch(`/api/escola/${escolaParam}/admin/configuracoes/identidade`, {
        method: "PUT",
        body: fd,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        error(json?.error || "Falha ao remover logo.");
        return;
      }
      setFormData((prev) => ({ ...prev, logo_url: null }));
      success("Logo removido com sucesso.");
    } catch {
      error("Erro ao remover logo.");
    } finally {
      setSavingLogo(false);
    }
  }

  async function saveBankingData() {
    setSavingBanking(true);
    try {
      const fd = new FormData();
      fd.set("banco", formData.dados_pagamento.banco);
      fd.set("titular_conta", formData.dados_pagamento.titular_conta);
      fd.set("iban", formData.dados_pagamento.iban);
      fd.set("numero_conta", formData.dados_pagamento.numero_conta);
      fd.set("kwik_chave", formData.dados_pagamento.kwik_chave);
      const res = await fetch(`/api/escola/${escolaParam}/admin/configuracoes/identidade`, {
        method: "PUT",
        body: fd,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        error(json?.error || "Falha ao guardar dados bancários.");
        return;
      }
      setFormData((prev) => ({
        ...prev,
        dados_pagamento: {
          banco: json.data?.dados_pagamento?.banco ?? "",
          titular_conta: json.data?.dados_pagamento?.titular_conta ?? "",
          iban: json.data?.dados_pagamento?.iban ?? "",
          numero_conta: json.data?.dados_pagamento?.numero_conta ?? "",
          kwik_chave: json.data?.dados_pagamento?.kwik_chave ?? "",
        },
      }));
      success("Dados bancários actualizados com sucesso.");
    } catch {
      error("Erro ao guardar dados bancários.");
    } finally {
      setSavingBanking(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/escola/${escolaParam}/admin/configuracoes/identidade`, {
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
          dados_pagamento: {
            banco: json?.data?.dados_pagamento?.banco ?? "",
            titular_conta: json?.data?.dados_pagamento?.titular_conta ?? "",
            iban: json?.data?.dados_pagamento?.iban ?? "",
            numero_conta: json?.data?.dados_pagamento?.numero_conta ?? "",
            kwik_chave: json?.data?.dados_pagamento?.kwik_chave ?? "",
          },
        });
        setPlanoLimites(json?.limites ?? null);
        setAssinatura(json?.assinatura ?? null);
      } catch (err) {
        console.error(err);
        error("Erro inesperado ao carregar identidade.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (escolaParam) load();
    return () => {
      cancelled = true;
    };
  }, [escolaParam]);

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
                  <div className="mt-3 flex items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700">
                      {savingLogo ? "A carregar..." : "Carregar logo"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        className="hidden"
                        disabled={savingLogo}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void uploadLogo(file);
                          e.currentTarget.value = "";
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      disabled={savingLogo || !formData.logo_url}
                      onClick={() => void removeLogo()}
                    >
                      Remover
                    </button>
                  </div>
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

              <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-50 pb-4 mb-2">
                  <div>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Dados Bancários</h3>
                    <p className="mt-1 text-xs text-slate-400">Usados em documentos e instruções de pagamento da escola.</p>
                  </div>
                  <button
                    type="button"
                    className="rounded-lg bg-klasse-green px-3 py-2 text-xs font-bold text-white hover:bg-klasse-green-700 disabled:opacity-50"
                    disabled={savingBanking}
                    onClick={() => void saveBankingData()}
                  >
                    {savingBanking ? "A guardar..." : "Guardar"}
                  </button>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Banco</label>
                  <input
                    className={inputClass.replace("bg-slate-50", "bg-white")}
                    value={formData.dados_pagamento.banco}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        dados_pagamento: { ...prev.dados_pagamento, banco: e.target.value },
                      }))
                    }
                    placeholder="Ex.: BAI"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Titular da conta</label>
                  <input
                    className={inputClass.replace("bg-slate-50", "bg-white")}
                    value={formData.dados_pagamento.titular_conta}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        dados_pagamento: { ...prev.dados_pagamento, titular_conta: e.target.value },
                      }))
                    }
                    placeholder="Nome do titular"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">IBAN</label>
                  <input
                    className={`${inputClass.replace("bg-slate-50", "bg-white")} font-mono uppercase`}
                    value={formData.dados_pagamento.iban}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        dados_pagamento: { ...prev.dados_pagamento, iban: e.target.value.toUpperCase() },
                      }))
                    }
                    placeholder="AO06..."
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Chave KWIK</label>
                  <input
                    className={inputClass.replace("bg-slate-50", "bg-white")}
                    value={formData.dados_pagamento.kwik_chave}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        dados_pagamento: { ...prev.dados_pagamento, kwik_chave: e.target.value },
                      }))
                    }
                    placeholder="Telefone ou chave KWIK"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Número da conta</label>
                  <input
                    className={inputClass.replace("bg-slate-50", "bg-white")}
                    value={formData.dados_pagamento.numero_conta}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        dados_pagamento: { ...prev.dados_pagamento, numero_conta: e.target.value },
                      }))
                    }
                    placeholder="Opcional"
                  />
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
                      <span className="font-bold text-slate-800">
                        {assinatura?.valor_kz
                          ? `Kz ${assinatura.valor_kz.toLocaleString("pt-AO")}`
                          : planoLimites.price_mensal_kz
                            ? `Kz ${planoLimites.price_mensal_kz.toLocaleString("pt-AO")}`
                            : "Sob consulta"}
                      </span>
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
                    <div className="pt-2">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Benefícios</div>
                      <div className="mt-2 grid gap-2 text-[11px] text-slate-600">
                        {beneficiosPlano.map((item) => (
                          <div key={item.label} className="flex items-center justify-between">
                            <span>{item.label}</span>
                            <span className={`font-semibold ${item.enabled ? "text-klasse-green-600" : "text-slate-400"}`}>
                              {item.enabled ? "Ativo" : "Indisponível"}
                            </span>
                          </div>
                        ))}
                      </div>
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
