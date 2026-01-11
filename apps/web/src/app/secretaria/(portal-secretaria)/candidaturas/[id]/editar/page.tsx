"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { ArrowLeftIcon, CheckCircleIcon, PencilSquareIcon } from "@heroicons/react/24/outline";

type CandidaturaForm = {
  nome: string;
  email: string;
  telefone: string;
  endereco: string;
  data_nascimento: string;
  sexo: string;
  bi_numero: string;
  nif: string;
  responsavel_nome: string;
  responsavel_contato: string;
  encarregado_email: string;
};

export default function EditarCandidaturaPage() {
  const router = useRouter();
  const params = useParams();
  const candidaturaId = useMemo(() => String(params?.id ?? ""), [params]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState<CandidaturaForm | null>(null);

  useEffect(() => {
    if (!candidaturaId) return;
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/secretaria/candidaturas/${encodeURIComponent(candidaturaId)}`);
        const json = await res.json();
        if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao carregar candidatura");
        const item = json.item || {};
        const payload = item.dados_candidato || {};
        const nome = item.nome_candidato || payload.nome_completo || payload.nome || "";

        if (active) {
          setForm({
            nome,
            email: payload.email || payload.encarregado_email || "",
            telefone: payload.telefone || payload.responsavel_contato || "",
            endereco: payload.endereco || "",
            data_nascimento: payload.data_nascimento || "",
            sexo: payload.sexo || "",
            bi_numero: payload.bi_numero || "",
            nif: payload.nif || "",
            responsavel_nome: payload.responsavel_nome || payload.encarregado_nome || "",
            responsavel_contato: payload.responsavel_contato || "",
            encarregado_email: payload.encarregado_email || "",
          });
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [candidaturaId]);

  const updateField = (key: keyof CandidaturaForm, value: string) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const payload = {
        nome: form.nome.trim(),
        email: form.email.trim() || null,
        telefone: form.telefone.trim() || null,
        endereco: form.endereco.trim() || null,
        data_nascimento: form.data_nascimento || null,
        sexo: form.sexo || null,
        bi_numero: form.bi_numero.trim() || null,
        nif: form.nif.trim() || null,
        responsavel_nome: form.responsavel_nome.trim() || null,
        responsavel_contato: form.responsavel_contato.trim() || null,
        encarregado_email: form.encarregado_email.trim() || null,
      };

      const res = await fetch(`/api/secretaria/candidaturas/${encodeURIComponent(candidaturaId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao atualizar candidatura");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-moxinexa-light to-blue-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-moxinexa-teal transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Voltar
          </button>
        </div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500 rounded-full mb-4">
            <PencilSquareIcon className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-moxinexa-dark mb-2">Resolver pendências da candidatura</h1>
          <p className="text-moxinexa-gray text-lg">Atualize apenas os dados necessários para matrícula</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          {loading ? (
            <div>Carregando…</div>
          ) : error ? (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          ) : form ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              {success && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircleIcon className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-green-800">Pendências atualizadas com sucesso!</p>
                  </div>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-moxinexa-dark">Nome completo</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
                    value={form.nome}
                    onChange={(e) => updateField("nome", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-moxinexa-dark">Email</label>
                  <input
                    type="email"
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-moxinexa-dark">Telefone</label>
                  <input
                    type="tel"
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
                    value={form.telefone}
                    onChange={(e) => updateField("telefone", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-moxinexa-dark">BI</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
                    value={form.bi_numero}
                    onChange={(e) => updateField("bi_numero", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-moxinexa-dark">NIF</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
                    value={form.nif}
                    onChange={(e) => updateField("nif", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-moxinexa-dark">Responsável</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
                    value={form.responsavel_nome}
                    onChange={(e) => updateField("responsavel_nome", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-moxinexa-dark">Contacto do responsável</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
                    value={form.responsavel_contato}
                    onChange={(e) => updateField("responsavel_contato", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-moxinexa-dark">Email do responsável</label>
                  <input
                    type="email"
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
                    value={form.encarregado_email}
                    onChange={(e) => updateField("encarregado_email", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-moxinexa-dark">Endereço</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
                    value={form.endereco}
                    onChange={(e) => updateField("endereco", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-moxinexa-dark">Data de nascimento</label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
                    value={form.data_nascimento}
                    onChange={(e) => updateField("data_nascimento", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-moxinexa-dark">Sexo</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
                    value={form.sexo}
                    onChange={(e) => updateField("sexo", e.target.value)}
                  >
                    <option value="">Não informado</option>
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                    <option value="O">Outro</option>
                    <option value="N">Prefiro não informar</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" tone="teal" size="lg" disabled={saving}>
                  {saving ? "Salvando..." : "Salvar pendências"}
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
