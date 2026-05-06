"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ArrowLeftIcon, CheckCircleIcon, PencilSquareIcon } from "@heroicons/react/24/outline";
import { enqueueOfflineAction } from "@/lib/offline/queue";
import { fetchJsonWithOffline } from "@/lib/offline/fetch";
import { OfflineBanner } from "@/components/system/OfflineBanner";

type AlunoDetails = {
  id: string;
  escola_id: string | null;
  profile_id: string | null;
  nome: string;
  email: string | null;
  telefone: string | null;
  responsavel: string | null;
  telefone_responsavel: string | null;
  data_nascimento: string | null;
  sexo: string | null;
  bi_numero: string | null;
  tipo_documento: string | null;
  numero_documento: string | null;
  naturalidade: string | null;
  provincia: string | null;
  pai_nome: string | null;
  mae_nome: string | null;
  nif: string | null;
  endereco: string | null;
  encarregado_email: string | null;
  encarregado_relacao: string | null;
  responsavel_financeiro_nome: string | null;
  responsavel_financeiro_nif: string | null;
  mesmo_que_encarregado: boolean | null;
};

export default function EditarAlunoPage() {
  const router = useRouter();
  const params = useParams();
  const alunoId = useMemo(() => String(params?.id ?? ""), [params]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [queued, setQueued] = useState(false);
  const [offlineMeta, setOfflineMeta] = useState<{ fromCache: boolean; updatedAt: string | null }>({
    fromCache: false,
    updatedAt: null,
  });

  const [form, setForm] = useState<AlunoDetails | null>(null);

  useEffect(() => {
    if (!alunoId) return;
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const cacheKey = `secretaria:alunos:${alunoId}:edit`;
        const { data: json, fromCache, updatedAt } = await fetchJsonWithOffline<{ ok: boolean; item?: AlunoDetails; error?: string }>(
          `/api/secretaria/alunos/${encodeURIComponent(alunoId)}`,
          undefined,
          cacheKey
        );
        if (!json?.ok) throw new Error(json?.error || "Falha ao carregar aluno");
        if (active) {
          setForm(json.item as AlunoDetails);
          setOfflineMeta({ fromCache, updatedAt });
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false };
  }, [alunoId]);

  const updateField = (key: keyof AlunoDetails, value: string) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    setQueued(false);
    try {
      const payload: Partial<AlunoDetails> = {
        nome: form.nome,
        email: form.email || undefined,
        telefone: form.telefone || undefined,
        responsavel: form.responsavel,
        telefone_responsavel: form.telefone_responsavel,
        data_nascimento: form.data_nascimento,
        sexo: form.sexo,
        bi_numero: form.bi_numero,
        tipo_documento: form.tipo_documento,
        numero_documento: form.numero_documento,
        naturalidade: form.naturalidade,
        provincia: form.provincia,
        pai_nome: form.pai_nome,
        mae_nome: form.mae_nome,
        nif: form.nif,
        endereco: form.endereco,
        encarregado_email: form.encarregado_email || undefined,
        encarregado_relacao: form.encarregado_relacao,
        responsavel_financeiro_nome: form.responsavel_financeiro_nome,
        responsavel_financeiro_nif: form.responsavel_financeiro_nif,
        mesmo_que_encarregado: form.mesmo_que_encarregado,
      };

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await enqueueOfflineAction({
          url: `/api/secretaria/alunos/${encodeURIComponent(alunoId)}`,
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          type: "editar_aluno",
        });
        setQueued(true);
        setSuccess(true);
        return;
      }

      const res = await fetch(`/api/secretaria/alunos/${encodeURIComponent(alunoId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao atualizar cadastro');
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-moxinexa-light to-slate-50 py-8">
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
          <div className="inline-flex items-center justify-center w-16 h-16 bg-moxinexa-teal rounded-full mb-4">
            <PencilSquareIcon className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-moxinexa-dark mb-2">Editar cadastro do aluno</h1>
          <p className="text-moxinexa-gray text-lg">Atualize os dados pessoais e de contato</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <div className="mb-4">
            <OfflineBanner fromCache={offlineMeta.fromCache} updatedAt={offlineMeta.updatedAt} />
          </div>
          {loading ? (
            <div>Carregando…</div>
          ) : error ? (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          ) : form ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              {success && (
                <div className={`rounded-xl p-4 flex items-center gap-3 ${
                  queued ? "bg-klasse-gold-50 border border-klasse-gold-200" : "bg-green-50 border border-green-200"
                }`}>
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircleIcon className={`w-5 h-5 ${queued ? "text-klasse-gold-600" : "text-green-600"}`} />
                  </div>
                  <div>
                    <p className={`font-medium ${queued ? "text-klasse-gold-800" : "text-green-800"}`}>
                      {queued
                        ? "Sem internet. Atualização salva para sincronizar depois."
                        : "Cadastro atualizado com sucesso!"}
                    </p>
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
                    onChange={(e) => updateField('nome', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-moxinexa-dark">Email</label>
                  <input
                    type="email"
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
                    value={form.email ?? ''}
                    onChange={(e) => updateField('email', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-moxinexa-dark">Data de nascimento</label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
                    value={form.data_nascimento ?? ''}
                    onChange={(e) => updateField('data_nascimento', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-moxinexa-dark">Sexo</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
                    value={form.sexo ?? ''}
                    onChange={(e) => updateField('sexo', e.target.value)}
                  >
                    <option value="">Não informado</option>
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                    <option value="O">Outro</option>
                    <option value="N">Prefiro não informar</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-moxinexa-dark">Telefone do aluno</label>
                  <input
                    type="tel"
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
                    value={form.telefone ?? ''}
                    onChange={(e) => updateField('telefone', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-moxinexa-dark">Tipo de documento</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
                    value={form.tipo_documento ?? ''}
                    onChange={(e) => updateField('tipo_documento', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-moxinexa-dark">Número do documento</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
                    value={form.numero_documento ?? form.bi_numero ?? ''}
                    onChange={(e) => {
                      updateField('numero_documento', e.target.value);
                      if ((form.tipo_documento ?? '').toUpperCase() === 'BI') updateField('bi_numero', e.target.value);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-moxinexa-dark">NIF</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
                    value={form.nif ?? ''}
                    onChange={(e) => updateField('nif', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-moxinexa-dark">BI legado</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
                    value={form.bi_numero ?? ''}
                    onChange={(e) => updateField('bi_numero', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-moxinexa-dark">Naturalidade</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
                    value={form.naturalidade ?? ''}
                    onChange={(e) => updateField('naturalidade', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-moxinexa-dark">Província</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
                    value={form.provincia ?? ''}
                    onChange={(e) => updateField('provincia', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-moxinexa-dark">Nome do pai</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
                    value={form.pai_nome ?? ''}
                    onChange={(e) => updateField('pai_nome', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-moxinexa-dark">Nome da mãe</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
                    value={form.mae_nome ?? ''}
                    onChange={(e) => updateField('mae_nome', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-moxinexa-dark">Endereço</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
                    value={form.endereco ?? ''}
                    onChange={(e) => updateField('endereco', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2 md:col-span-1">
                  <label className="block text-sm font-medium text-moxinexa-dark">Relação do encarregado</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
                    value={form.encarregado_relacao ?? ''}
                    onChange={(e) => updateField('encarregado_relacao', e.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-1">
                  <label className="block text-sm font-medium text-moxinexa-dark">Nome do responsável</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
                    value={form.responsavel ?? ''}
                    onChange={(e) => updateField('responsavel', e.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-1">
                  <label className="block text-sm font-medium text-moxinexa-dark">Telefone do responsável</label>
                  <input
                    type="tel"
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
                    value={form.telefone_responsavel ?? ''}
                    onChange={(e) => updateField('telefone_responsavel', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2 md:col-span-1">
                  <label className="block text-sm font-medium text-moxinexa-dark">Email do encarregado</label>
                  <input
                    type="email"
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
                    value={form.encarregado_email ?? ''}
                    onChange={(e) => updateField('encarregado_email', e.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-1">
                  <label className="block text-sm font-medium text-moxinexa-dark">Responsável financeiro</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
                    value={form.responsavel_financeiro_nome ?? ''}
                    onChange={(e) => updateField('responsavel_financeiro_nome', e.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-1">
                  <label className="block text-sm font-medium text-moxinexa-dark">NIF financeiro</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
                    value={form.responsavel_financeiro_nif ?? ''}
                    onChange={(e) => updateField('responsavel_financeiro_nif', e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
                <Button type="button" variant="outline" tone="gray" onClick={() => router.back()} disabled={saving}>Cancelar</Button>
                <Button type="submit" tone="teal" disabled={saving}>
                  {saving ? 'Salvando…' : 'Salvar alterações'}
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
