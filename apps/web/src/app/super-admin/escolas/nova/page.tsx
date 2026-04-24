"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import AuditPageView from "@/components/audit/AuditPageView";
import { createClient } from "@/lib/supabase/client";
import {
  Building2,
  UserPlus,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Info,
  ChevronRight,
  Database,
  Mail,
  Phone,
  Layout,
  RefreshCw,
  Loader2
} from "lucide-react";
import { toast } from "sonner";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface OnboardingRequest {
  id: string;
  escola_nome: string;
  escola_nif: string | null;
  escola_morada: string | null;
  escola_email: string | null;
  escola_tel: string | null;
  director_nome: string | null;
  status: string;
}

export default function NovaEscolaPage() {
  return (
    <>
      <AuditPageView portal="super_admin" acao="PAGE_VIEW" entity="escola_create" />
      <div className="bg-slate-50 p-6">
        <CriarEscolaForm />
      </div>
    </>
  );
}

function CriarEscolaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [formData, setFormData] = useState({
    nome: "",
    nif: "",
    endereco: "",
    plano: "essencial",
    adminEmail: "",
    adminTelefone: "",
    adminNome: "",
    adminPapel: "admin",
  });

  const [loading, setLoading] = useState(false);
  const [loadingOnboarding, setLoadingOnboarding] = useState(false);
  const [onboardingRequests, setOnboardingRequests] = useState<OnboardingRequest[]>([]);
  const [selectedOnboardingId, setSelectedOnboardingId] = useState("");
  
  const [msg, setMsg] = useState<null | { type: "ok" | "err"; text: string }>(null);
  const [creationResult, setCreationResult] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState(1);

  // Carregar pedidos de onboarding pendentes para o Pre-fill
  useEffect(() => {
    const fetchRequests = async () => {
      setLoadingOnboarding(true);
      try {
        const { data } = await supabase
          .from('onboarding_requests')
          .select('id, escola_nome, escola_nif, escola_morada, escola_email, escola_tel, director_nome, status')
          .in('status', ['pendente', 'em_configuracao'])
          .order('created_at', { ascending: false });
        
        if (data) setOnboardingRequests(data);
      } catch (err) {
        console.error("Erro ao carregar pedidos:", err);
      } finally {
        setLoadingOnboarding(false);
      }
    };
    fetchRequests();
  }, [supabase]);

  // Aplicar Pre-fill se selecionado
  const handlePreFill = (id: string) => {
    const req = onboardingRequests.find(r => r.id === id);
    if (!req) return;

    setFormData({
      nome: req.escola_nome,
      nif: req.escola_nif || "",
      endereco: req.escola_morada || "",
      plano: "essencial",
      adminEmail: req.escola_email || "",
      adminTelefone: req.escola_tel || "",
      adminNome: req.director_nome || "",
      adminPapel: "admin",
    });
    setSelectedOnboardingId(id);
    toast.success("Dados preenchidos a partir do pedido de onboarding!");
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep < 2) {
      setCurrentStep(2);
      return;
    }

    setMsg(null);
    setCreationResult(null);

    try {
      setLoading(true);

      const res = await fetch("/api/escolas/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: formData.nome.trim(),
          nif: formData.nif || null,
          endereco: formData.endereco || null,
          plano: formData.plano,
          onboarding_id: selectedOnboardingId || null,
          admin: {
            email: formData.adminEmail.trim(),
            telefone: formData.adminTelefone || null,
            nome: formData.adminNome.trim(),
            papel: formData.adminPapel,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Erro desconhecido ao criar escola.");
      }

      setCreationResult(data);
      setMsg({
        type: "ok",
        text: `Escola "${formData.nome}" criada com sucesso!`,
      });
      setCurrentStep(3);
    } catch (err: any) {
      setMsg({ type: "err", text: err.message || String(err) });
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isNifValid = formData.nif.length === 0 || formData.nif.length === 9;

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-klasse-fade-up">
      
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-klasse-green rounded-3xl shadow-xl shadow-klasse-green/20 mb-2">
          <Building2 className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight font-sora">
          Criar Nova Escola
        </h1>
        <p className="text-slate-500 font-medium max-w-md mx-auto">
          Configure uma nova instância dedicada para a instituição e seu administrador principal.
        </p>
      </div>

      {/* Progress Steps */}
      <div className="relative flex items-center justify-between max-w-md mx-auto mb-12">
        {[1, 2, 3].map((step) => (
          <div key={step} className="flex flex-col items-center z-10">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center border-2 font-bold transition-all ${
                step === currentStep
                  ? "bg-klasse-green text-white border-klasse-green shadow-lg shadow-klasse-green/20"
                  : step < currentStep
                  ? "bg-klasse-green-500 text-white border-klasse-green-500"
                  : "bg-white text-slate-300 border-slate-100"
              }`}
            >
              {step < currentStep ? <CheckCircle2 size={20} /> : step}
            </div>
            <span className={`text-[10px] mt-2 font-black uppercase tracking-widest ${step === currentStep ? "text-klasse-green" : "text-slate-400"}`}>
              {step === 1 && "Instituição"}
              {step === 2 && "Administrador"}
              {step === 3 && "Sucesso"}
            </span>
          </div>
        ))}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-100 -z-0" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Step 1: School Information */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-klasse-fade-up">
            
            {/* Pre-fill Selector */}
            <div className="bg-klasse-gold-50 border border-klasse-gold-100 rounded-3xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-klasse-gold-100 rounded-xl text-klasse-gold-700">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-klasse-gold-900">Preencher via Onboarding</h3>
                  <p className="text-xs text-klasse-gold-700/70 font-medium">Use dados já submetidos por uma escola.</p>
                </div>
              </div>
              <select 
                value={selectedOnboardingId}
                onChange={(e) => handlePreFill(e.target.value)}
                disabled={loadingOnboarding}
                className="w-full bg-white border-klasse-gold-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-klasse-gold-500 focus:border-klasse-gold-500"
              >
                <option value="">Seleccionar pedido pendente...</option>
                {onboardingRequests.map(r => (
                  <option key={r.id} value={r.id}>{r.escola_nome} ({r.escola_nif || 'Sem NIF'})</option>
                ))}
              </select>
            </div>

            <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Layout size={18} className="text-klasse-green" /> Informações da Escola
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Nome da Escola *</label>
                    <input
                      className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-4 focus:ring-klasse-green/5 focus:border-klasse-green outline-none transition-all"
                      placeholder="Ex: Colégio Horizonte"
                      value={formData.nome}
                      onChange={(e) => handleInputChange('nome', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">NIF *</label>
                    <input
                      className={`w-full border rounded-xl p-3 text-sm focus:ring-4 focus:ring-klasse-green/5 outline-none transition-all ${!isNifValid ? 'border-rose-300' : 'border-slate-200 focus:border-klasse-green'}`}
                      placeholder="9 dígitos"
                      value={formData.nif}
                      onChange={(e) => handleInputChange('nif', e.target.value.replace(/\D/g, '').slice(0, 9))}
                      maxLength={9}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Endereço</label>
                  <input
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-4 focus:ring-klasse-green/5 focus:border-klasse-green outline-none transition-all"
                    placeholder="Ex: Luanda, Viana..."
                    value={formData.endereco}
                    onChange={(e) => handleInputChange('endereco', e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Plano Base</label>
                  <select
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-4 focus:ring-klasse-green/5 focus:border-klasse-green outline-none transition-all appearance-none bg-white"
                    value={formData.plano}
                    onChange={(e) => handleInputChange("plano", e.target.value)}
                  >
                    <option value="essencial">Essencial</option>
                    <option value="profissional">Profissional</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button 
                type="button" 
                onClick={() => setCurrentStep(2)}
                disabled={!formData.nome || !isNifValid || formData.nif.length < 9}
                className="bg-klasse-green text-white px-8 rounded-xl font-bold gap-2"
              >
                Próximo Passo <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Administrator Information */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-klasse-fade-up">
            <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <UserPlus size={18} className="text-klasse-gold" /> Administrador Principal
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex gap-3 text-slate-800 text-xs font-medium leading-relaxed">
                  <Info size={16} className="shrink-0" />
                  Este utilizador terá acesso total e será responsável por configurar a escola.
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Nome Completo *</label>
                  <input
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-4 focus:ring-klasse-green/5 focus:border-klasse-green outline-none transition-all"
                    placeholder="Nome do gestor principal"
                    value={formData.adminNome}
                    onChange={(e) => handleInputChange('adminNome', e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Email do Administrador *</label>
                    <input
                      type="email"
                      className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-4 focus:ring-klasse-green/5 focus:border-klasse-green outline-none transition-all"
                      placeholder="email@escola.com"
                      value={formData.adminEmail}
                      onChange={(e) => handleInputChange('adminEmail', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Telefone do Administrador</label>
                    <input
                      className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-4 focus:ring-klasse-green/5 focus:border-klasse-green outline-none transition-all"
                      placeholder="9XXXXXXXX"
                      value={formData.adminTelefone}
                      onChange={(e) => handleInputChange('adminTelefone', e.target.value.replace(/\D/g, ''))}
                      maxLength={9}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Papel Inicial</label>
                  <select
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-4 focus:ring-klasse-green/5 focus:border-klasse-green outline-none transition-all appearance-none bg-white"
                    value={formData.adminPapel}
                    onChange={(e) => handleInputChange('adminPapel', e.target.value)}
                  >
                    <option value="admin">Administrador</option>
                    <option value="admin_financeiro">Administrador + Financeiro</option>
                    <option value="secretaria_financeiro">Secretaria + Financeiro</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between">
              <Button type="button" variant="outline" onClick={() => setCurrentStep(1)} className="rounded-xl font-bold border-slate-200">
                <ArrowLeft size={16} className="mr-2" /> Voltar
              </Button>
              <Button 
                type="submit" 
                disabled={loading || !formData.adminNome || !formData.adminEmail}
                className="bg-klasse-green text-white px-10 rounded-xl font-bold gap-2 shadow-lg shadow-klasse-green/10"
              >
                {loading ? <RefreshCw size={16} className="animate-spin" /> : <Database size={16} />}
                Criar Instância
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Success Confirmation */}
        {currentStep === 3 && creationResult && (
          <div className="space-y-6 animate-klasse-fade-up">
            <div className="bg-klasse-green-50 border-2 border-klasse-green-100 rounded-[2rem] p-8 text-center space-y-4">
              <div className="w-20 h-20 bg-klasse-green-500 rounded-full flex items-center justify-center mx-auto shadow-xl shadow-klasse-green-200">
                <CheckCircle2 size={40} className="text-white" />
              </div>
              <h2 className="text-2xl font-black text-klasse-green-900 font-sora">Escola Criada!</h2>
              <p className="text-klasse-green-700 font-medium">O ambiente para <strong className="text-klasse-green-900">{formData.nome}</strong> está pronto.</p>
            </div>

            <Card className="rounded-3xl border-slate-200 shadow-xl overflow-hidden bg-white">
              <CardContent className="p-8 space-y-6">
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Credenciais do Administrador</h4>
                  <div className="grid md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Utilizador / Email</p>
                      <p className="font-bold text-slate-900 break-all">{creationResult.adminEmail}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Senha Temporária</p>
                      <p className="font-mono font-black text-klasse-green text-lg tracking-wider">
                        {creationResult.adminPassword || "Já existente"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row gap-3">
                  <Button
                    className="flex-1 bg-klasse-green text-white rounded-xl font-bold py-6 shadow-lg shadow-klasse-green/10"
                    onClick={() => router.push(`/escola/${creationResult.escolaId}/admin`)}
                  >
                    Abrir Painel da Escola <ArrowRight size={18} className="ml-2" />
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-slate-200 rounded-xl font-bold text-slate-600 py-6"
                    onClick={() => router.push('/super-admin/escolas')}
                  >
                    Voltar p/ Lista
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

      </form>
    </div>
  );
}
