'use client'

import { useState } from "react";
import { 
  Search, 
  Loader2, 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  AlertCircle,
  ShieldCheck,
  Lock,
  FileDown,
  Phone,
  Eye,
  EyeOff,
  Check
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type BasicStatus = {
  protocolo: string;
  protocolo_publico?: string;
  status: string;
  nome_candidato_mask: string;
  telefone_mask: string | null;
  email_mask: string | null;
};

type VaultData = {
  id: string;
  aluno_id: string;
  nome_completo: string;
  status: string;
  curso: string;
  pode_mudar_senha: boolean;
  pode_baixar_comprovativo: boolean;
  comprovativo_url?: string;
};

export default function StatusInquiryForm({ escolaSlug }: { escolaSlug: string }) {
  const [protocolo, setProtocolo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // States do Fluxo
  const [step, setStep] = useState<'search' | 'challenge' | 'vault'>('search');
  const [basicData, setBasicData] = useState<BasicStatus | null>(null);
  const [contactChallenge, setContactChallenge] = useState("");
  const [vault, setVault] = useState<VaultData | null>(null);
  
  // Password State
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savingPass, setSavingPass] = useState(false);
  const [passSaved, setPassPassSaved] = useState(false);

  const passwordGroups = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
  const passwordMeetsPolicy = password.length >= 10 && passwordGroups >= 3;

  const handleProtocolSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/public/admissoes/${escolaSlug}/consultar?protocolo=${protocolo.trim()}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Inscrição não encontrada");

      setBasicData(data.data);
      setStep('challenge');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao buscar candidatura");
    } finally {
      setLoading(false);
    }
  };

  const handleChallengeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/public/admissoes/${escolaSlug}/consultar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocolo, contato: contactChallenge })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Dado de contato incorreto");

      setVault(data.vault);
      setStep('vault');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro na validação");
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async () => {
    if (!passwordMeetsPolicy) {
      setError("A senha deve ter pelo menos 10 caracteres e combinar 3 tipos: maiúsculas, minúsculas, números ou símbolos.");
      return;
    }
    setSavingPass(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/admissoes/${escolaSlug}/consultar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          protocolo, 
          contato: contactChallenge,
          action: 'set_password',
          password 
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao definir senha");

      setPassPassSaved(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao definir senha");
    } finally {
      setSavingPass(false);
    }
  };

  const getStatusConfig = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'matriculado' || s === 'aprovada') return {
      label: 'Matrícula Efetivada',
      icon: <CheckCircle2 className="text-emerald-500" size={24} />,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-100'
    };
    if (s === 'rejeitada') return {
      label: 'Não Admitido',
      icon: <XCircle className="text-rose-500" size={24} />,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
      border: 'border-rose-100'
    };
    return {
      label: 'Inscrição em Análise',
      icon: <Clock className="text-amber-500" size={24} />,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-100'
    };
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="mb-8">
        <Link 
          href={`/admissoes/${escolaSlug}`}
          className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 transition text-sm font-bold"
        >
          <ArrowLeft size={16} />
          Voltar para Inscrição
        </Link>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header Dinâmico */}
        <div className={`p-8 text-white transition-colors duration-500 ${step === 'vault' ? 'bg-emerald-600' : 'bg-slate-900'}`}>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
              {step === 'vault' ? <ShieldCheck size={28} /> : <Search size={24} />}
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight">
                {step === 'vault' ? 'Cofre de Matrícula' : 'Consultar Inscrição'}
              </h2>
              <p className="text-white/60 text-sm">
                {step === 'vault' ? 'Acesso seguro aos seus documentos' : 'Acompanhe o estado da sua candidatura'}
              </p>
            </div>
          </div>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-600 border border-red-100 flex items-center gap-3">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          {/* PASSO 1: BUSCA POR PROTOCOLO */}
          {step === 'search' && (
            <form onSubmit={handleProtocolSearch} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Número do Protocolo</label>
                <input
                  required
                  autoFocus
                  type="text"
                  value={protocolo}
                  onChange={(e) => setProtocolo(e.target.value.toUpperCase())}
                  className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-6 py-4 outline-none focus:border-slate-900 transition font-mono text-xl uppercase placeholder:text-slate-300"
                  placeholder="Ex: 8A2B4C"
                />
              </div>
              <Button type="submit" loading={loading} fullWidth size="lg" tone="blue" className="h-16 rounded-2xl font-black text-base">
                Verificar Status
              </Button>
            </form>
          )}

          {/* PASSO 2: DESAFIO DE SEGURANÇA */}
          {step === 'challenge' && basicData && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div className={`p-6 rounded-2xl border flex items-center gap-4 ${getStatusConfig(basicData.status).bg} ${getStatusConfig(basicData.status).border}`}>
                {getStatusConfig(basicData.status).icon}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 opacity-70">Resultado</p>
                  <h3 className={`text-lg font-black ${getStatusConfig(basicData.status).color}`}>
                    {basicData.status === 'matriculado' 
                      ? `Parabéns! Matrícula de ${basicData.nome_candidato_mask} Efetivada.`
                      : getStatusConfig(basicData.status).label}
                  </h3>
                </div>
              </div>

              <div className="p-8 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="h-12 w-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                    <Lock size={20} />
                  </div>
                  <h4 className="font-black text-slate-900">Desafio de Segurança</h4>
                  <p className="text-sm text-slate-500 max-w-xs">
                    {basicData.email_mask 
                      ? "Confirme o telefone ou email do encarregado registrado para acessar o cofre."
                      : "Confirme o telefone do encarregado registrado para acessar o cofre."}
                  </p>
                  
                  <form onSubmit={handleChallengeSubmit} className="w-full space-y-4 pt-4">
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1 text-slate-400">
                        <Phone size={16} />
                        <span className="text-[10px] font-bold">/</span>
                        <Check size={14} />
                      </div>
                      <input
                        required
                        type="text"
                        value={contactChallenge}
                        onChange={(e) => setContactChallenge(e.target.value)}
                        placeholder={
                          basicData.telefone_mask && basicData.email_mask
                            ? `Ex: ${basicData.telefone_mask} ou ${basicData.email_mask}`
                            : basicData.telefone_mask 
                              ? `Confirmar Telefone (Ex: ${basicData.telefone_mask})`
                              : `Confirmar Email (Ex: ${basicData.email_mask})`
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white pl-16 pr-4 py-4 outline-none focus:border-slate-900 transition font-bold"
                      />
                    </div>
                    <Button type="submit" loading={loading} fullWidth tone="gold" className="rounded-xl h-14 font-black">
                      Abrir Cofre agora
                    </Button>
                    <button type="button" onClick={() => setStep('search')} className="text-xs font-bold text-slate-400 hover:text-slate-600">
                      Voltar e corrigir protocolo
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* PASSO 3: O COFRE (VAULT) */}
          {step === 'vault' && vault && (
            <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
              {/* Resumo do Aluno */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-6">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Aluno Matriculado</p>
                  <h3 className="text-2xl font-black text-slate-900">{vault.nome_completo}</h3>
                  <p className="text-sm text-slate-500 font-medium">{vault.curso}</p>
                </div>
                <div className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">
                  Oficial
                </div>
              </div>

              {/* Ações do Cofre */}
              <div className="grid gap-6">
                {/* 1. Comprovativo de Matrícula */}
                <div className="p-6 rounded-2xl border-2 border-klasse-gold/20 bg-white hover:border-klasse-gold/40 transition-colors">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-amber-50 flex items-center justify-center text-klasse-gold">
                        <FileDown size={24} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">Comprovativo de Matrícula</h4>
                        <p className="text-xs text-slate-500">Documento oficial em PDF</p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      className="border-klasse-gold text-klasse-gold hover:bg-klasse-gold hover:text-white rounded-xl font-bold text-xs h-10 px-4"
                      onClick={() => vault.comprovativo_url && window.open(vault.comprovativo_url, '_blank')}
                    >
                      Descarregar
                    </Button>
                  </div>
                </div>

                {/* 2. Definir Senha do Portal */}
                <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50">
                  <div className="flex items-center gap-3 mb-4">
                    <Lock size={18} className="text-slate-400" />
                    <h4 className="font-bold text-slate-900 text-sm">Acesso ao Portal do Aluno</h4>
                  </div>
                  
                  {passSaved ? (
                    <div className="bg-green-100 text-green-700 p-4 rounded-xl flex items-center gap-3 text-sm font-bold animate-in zoom-in-95">
                      <CheckCircle2 size={20} />
                      Senha configurada com sucesso!
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-xs text-slate-500">Defina uma senha para acompanhar notas e faturas no portal.</p>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Nova senha"
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-slate-900 transition text-sm font-mono"
                          />
                          <button 
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                          >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                        <Button 
                          onClick={handleSetPassword}
                          disabled={!passwordMeetsPolicy || savingPass}
                          loading={savingPass}
                          tone="blue" 
                          className="rounded-xl px-6 font-bold text-xs"
                        >
                          Salvar
                        </Button>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Mínimo de 10 caracteres e pelo menos 3 tipos: maiúsculas, minúsculas, números ou símbolos.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 text-center">
                <button
                  onClick={() => {
                    setStep('search');
                    setVault(null);
                    setBasicData(null);
                    setProtocolo("");
                    setContactChallenge("");
                    setPassPassSaved(false);
                    setPassword("");
                  }}
                  className="text-sm font-bold text-slate-400 hover:text-slate-600 transition"
                >
                  Nova Consulta
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 text-center">
        <p className="text-sm text-slate-500">
          Dúvidas? Entre em contato com a secretaria da escola.
        </p>
      </div>
    </div>
  )
}
