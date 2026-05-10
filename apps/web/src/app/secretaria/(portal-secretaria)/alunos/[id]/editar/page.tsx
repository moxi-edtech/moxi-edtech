"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeftIcon, CheckCircleIcon, User, FileText, Phone, CreditCard } from "lucide-react";
import { enqueueOfflineAction } from "@/lib/offline/queue";
import { fetchJsonWithOffline } from "@/lib/offline/fetch";
import { OfflineBanner } from "@/components/system/OfflineBanner";
import { toast } from "sonner";

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
  status: string | null;
};

export default function EditarAlunoPage({ id: propId }: { id?: string }) {
  const router = useRouter();
  const params = useParams();
  const alunoId = useMemo(() => propId || String(params?.alunoId ?? params?.id ?? ""), [params, propId]);

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

  const updateField = (key: keyof AlunoDetails, value: any) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setSuccess(false);
    setQueued(false);
    
    try {
      const payload: Partial<AlunoDetails> = {
        nome: form.nome,
        email: form.email || null,
        telefone: form.telefone || null,
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
        encarregado_email: form.encarregado_email || null,
        encarregado_relacao: form.encarregado_relacao,
        responsavel_financeiro_nome: form.responsavel_financeiro_nome,
        responsavel_financeiro_nif: form.responsavel_financeiro_nif,
        mesmo_que_encarregado: form.mesmo_que_encarregado,
        status: form.status,
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
        toast.warning("Sem internet. Atualização agendada para sincronização.");
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
      toast.success("Cadastro atualizado com sucesso!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-moxinexa-teal"></div>
      </div>
    );
  }

  if (error && !form) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center">
        <div className="bg-red-50 text-red-700 p-6 rounded-2xl border border-red-200">
          <h2 className="text-xl font-bold mb-2">Erro ao carregar dados</h2>
          <p className="mb-4">{error}</p>
          <Button onClick={() => window.location.reload()} tone="gray">Tentar novamente</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="max-w-5xl mx-auto px-4 pt-4">
        <DashboardHeader
          title="Editar Aluno"
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Secretaria", href: "/secretaria" },
            { label: "Alunos", href: "/secretaria/alunos" },
            { label: "Editar" },
          ]}
        />
      </div>
      {/* Header Fixo */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900 truncate max-w-[200px] md:max-w-md">
                Editar: {form?.nome}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              tone="gray" 
              onClick={() => router.back()} 
              disabled={saving}
              className="hidden sm:inline-flex"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit} 
              tone="teal" 
              disabled={saving}
              className="shadow-sm"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <OfflineBanner fromCache={offlineMeta.fromCache} updatedAt={offlineMeta.updatedAt} />

        {success && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
            <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
            <p className="font-medium">
              {queued ? "Alterações salvas offline. Sincronização pendente." : "Cadastro atualizado com sucesso!"}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <Tabs defaultValue="identificacao" className="w-full">
            <TabsList className="w-full justify-start mb-8 bg-transparent p-0 h-auto gap-4 overflow-x-auto scrollbar-hide">
              <TabsTrigger 
                value="identificacao" 
                className="bg-white border border-slate-200 data-[state=active]:border-moxinexa-teal data-[state=active]:bg-moxinexa-teal/5 data-[state=active]:text-moxinexa-teal rounded-xl px-6 py-3 h-auto shadow-sm transition-all"
              >
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span>Identificação</span>
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="documentacao" 
                className="bg-white border border-slate-200 data-[state=active]:border-moxinexa-teal data-[state=active]:bg-moxinexa-teal/5 data-[state=active]:text-moxinexa-teal rounded-xl px-6 py-3 h-auto shadow-sm transition-all"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span>Documentação</span>
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="contactos" 
                className="bg-white border border-slate-200 data-[state=active]:border-moxinexa-teal data-[state=active]:bg-moxinexa-teal/5 data-[state=active]:text-moxinexa-teal rounded-xl px-6 py-3 h-auto shadow-sm transition-all"
              >
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  <span>Contactos</span>
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="responsavel" 
                className="bg-white border border-slate-200 data-[state=active]:border-moxinexa-teal data-[state=active]:bg-moxinexa-teal/5 data-[state=active]:text-moxinexa-teal rounded-xl px-6 py-3 h-auto shadow-sm transition-all"
              >
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  <span>Responsável & Financeiro</span>
                </div>
              </TabsTrigger>
            </TabsList>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
              {/* Tab 1: Identificação */}
              <TabsContent value="identificacao" className="space-y-6 m-0">
                <div className="grid md:grid-cols-2 gap-6">
                  <Input
                    label="Nome Completo"
                    value={form?.nome ?? ''}
                    onChange={(e) => updateField('nome', e.target.value)}
                    required
                  />
                  <Select
                    label="Status do Aluno"
                    value={form?.status ?? ''}
                    onChange={(e) => updateField('status', e.target.value)}
                    options={[
                      { value: 'ativo', label: 'Ativo' },
                      { value: 'inativo', label: 'Inativo' },
                      { value: 'pendente', label: 'Pendente' },
                      { value: 'suspenso', label: 'Suspenso' },
                      { value: 'trancado', label: 'Trancado' },
                      { value: 'concluido', label: 'Concluído' },
                      { value: 'transferido', label: 'Transferido' },
                      { value: 'desistente', label: 'Desistente' },
                    ]}
                  />
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  <Input
                    label="Data de Nascimento"
                    type="date"
                    value={form?.data_nascimento ?? ''}
                    onChange={(e) => updateField('data_nascimento', e.target.value)}
                  />
                  <Select
                    label="Sexo"
                    value={form?.sexo ?? ''}
                    onChange={(e) => updateField('sexo', e.target.value)}
                    options={[
                      { value: '', label: 'Não informado' },
                      { value: 'M', label: 'Masculino' },
                      { value: 'F', label: 'Feminino' },
                      { value: 'O', label: 'Outro' },
                      { value: 'N', label: 'Prefiro não informar' },
                    ]}
                  />
                  <Input
                    label="Naturalidade"
                    value={form?.naturalidade ?? ''}
                    onChange={(e) => updateField('naturalidade', e.target.value)}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                  <Input
                    label="Nome do Pai"
                    value={form?.pai_nome ?? ''}
                    onChange={(e) => updateField('pai_nome', e.target.value)}
                  />
                  <Input
                    label="Nome da Mãe"
                    value={form?.mae_nome ?? ''}
                    onChange={(e) => updateField('mae_nome', e.target.value)}
                  />
                </div>
              </TabsContent>

              {/* Tab 2: Documentação */}
              <TabsContent value="documentacao" className="space-y-6 m-0">
                <div className="grid md:grid-cols-3 gap-6">
                  <Select
                    label="Tipo de Documento"
                    value={form?.tipo_documento ?? ''}
                    onChange={(e) => updateField('tipo_documento', e.target.value)}
                    options={[
                      { value: 'BI', label: 'Bilhete de Identidade (BI)' },
                      { value: 'PASSAPORTE', label: 'Passaporte' },
                      { value: 'CARTAO_RESIDENTE', label: 'Cartão de Residente' },
                      { value: 'CEDULA', label: 'Cédula' },
                      { value: 'OUTRO', label: 'Outro' },
                    ]}
                  />
                  <Input
                    label="Número do Documento"
                    value={form?.numero_documento ?? ''}
                    onChange={(e) => updateField('numero_documento', e.target.value)}
                  />
                  <Input
                    label="NIF"
                    value={form?.nif ?? ''}
                    onChange={(e) => updateField('nif', e.target.value)}
                  />
                </div>
                <div className="grid md:grid-cols-3 gap-6 pt-4 border-t border-slate-100">
                   <Input
                    label="BI (Legado/Referência)"
                    value={form?.bi_numero ?? ''}
                    onChange={(e) => updateField('bi_numero', e.target.value)}
                  />
                   <Input
                    label="Província de Emissão"
                    value={form?.provincia ?? ''}
                    onChange={(e) => updateField('provincia', e.target.value)}
                  />
                </div>
              </TabsContent>

              {/* Tab 3: Contactos */}
              <TabsContent value="contactos" className="space-y-6 m-0">
                <div className="grid md:grid-cols-2 gap-6">
                  <Input
                    label="E-mail do Aluno"
                    type="email"
                    value={form?.email ?? ''}
                    onChange={(e) => updateField('email', e.target.value)}
                  />
                  <Input
                    label="Telefone do Aluno"
                    type="tel"
                    value={form?.telefone ?? ''}
                    onChange={(e) => updateField('telefone', e.target.value)}
                  />
                </div>
                <div className="pt-4 border-t border-slate-100">
                  <Input
                    label="Endereço Completo"
                    value={form?.endereco ?? ''}
                    onChange={(e) => updateField('endereco', e.target.value)}
                  />
                </div>
              </TabsContent>

              {/* Tab 4: Responsável & Financeiro */}
              <TabsContent value="responsavel" className="space-y-8 m-0">
                <div className="space-y-6">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Dados do Encarregado de Educação</h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <Input
                      label="Nome do Encarregado"
                      value={form?.responsavel ?? ''}
                      onChange={(e) => updateField('responsavel', e.target.value)}
                    />
                    <Input
                      label="Relação (Ex: Pai, Mãe, Tio)"
                      value={form?.encarregado_relacao ?? ''}
                      onChange={(e) => updateField('encarregado_relacao', e.target.value)}
                    />
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    <Input
                      label="E-mail do Encarregado"
                      type="email"
                      value={form?.encarregado_email ?? ''}
                      onChange={(e) => updateField('encarregado_email', e.target.value)}
                    />
                    <Input
                      label="Telefone do Encarregado"
                      type="tel"
                      value={form?.telefone_responsavel ?? ''}
                      onChange={(e) => updateField('telefone_responsavel', e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-6 pt-8 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Responsável Financeiro (Faturação)</h3>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 text-moxinexa-teal focus:ring-moxinexa-teal"
                        checked={form?.mesmo_que_encarregado || false}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          updateField('mesmo_que_encarregado', checked);
                          if (checked) {
                            updateField('responsavel_financeiro_nome', form?.responsavel);
                            updateField('responsavel_financeiro_nif', form?.nif);
                          }
                        }}
                      />
                      <span className="text-xs text-slate-500 font-medium">Mesmo que o encarregado</span>
                    </label>
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    <Input
                      label="Nome para Faturação"
                      value={form?.responsavel_financeiro_nome ?? ''}
                      onChange={(e) => updateField('responsavel_financeiro_nome', e.target.value)}
                    />
                    <Input
                      label="NIF para Faturação"
                      value={form?.responsavel_financeiro_nif ?? ''}
                      onChange={(e) => updateField('responsavel_financeiro_nif', e.target.value)}
                    />
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </form>
      </div>
    </div>
  );
}
