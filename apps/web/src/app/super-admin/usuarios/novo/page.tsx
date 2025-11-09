"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RequireSuperAdmin from "@/app/(guards)/RequireSuperAdmin";
import Button from "@/components/ui/Button";
import type { Database } from "~types/supabase";
import {
  UserPlusIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  InformationCircleIcon,
  SparklesIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline";

export default function Page() {
  return (
    <RequireSuperAdmin>
      <CriarUsuarioForm />
    </RequireSuperAdmin>
  );
}

function CriarUsuarioForm() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    telefone: "",
    tempPassword: "",
    papel: "admin_escola",
    escolaId: "",
  });

  const [generatedNumeroLogin, setGeneratedNumeroLogin] = useState<string | null>(null);
  const [escolas, setEscolas] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<null | { type: "ok" | "err"; text: string }>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [isGeneratingLogin, setIsGeneratingLogin] = useState(false);

  // Map school-level papel to global user_role (Auth/Profile)
  const roleMap: Record<string, Database["public"]["Enums"]["user_role"]> = {
    admin_escola: "admin",
    admin: "admin",
    staff_admin: "admin",
    financeiro: "financeiro",
    secretaria: "secretaria",
    professor: "professor",
    aluno: "aluno",
  };

  // Fetch escolas
  useEffect(() => {
    const fetchEscolas = async () => {
      try {
        const res = await fetch('/api/super-admin/escolas/list', { method: 'GET' })
        const json = await res.json()
        if (!res.ok || !json?.ok) {
          console.error('Falha ao carregar escolas:', json?.error || res.statusText)
          return
        }
        const items = (json.items || []) as Array<{ id: string; nome: string | null }>
        setEscolas(items.map((e) => ({ id: String(e.id), nome: e.nome ?? '' })))
      } catch (e) {
        console.error('Erro inesperado ao listar escolas:', e)
      }
    }
    fetchEscolas()
  }, [])

  // Fetch generated login number
  useEffect(() => {
    const fetchNumeroLogin = async () => {
      if (formData.escolaId && formData.papel) {
        setIsGeneratingLogin(true);
        try {
          const res = await fetch(`/api/super-admin/users/generate-login-number?escolaId=${formData.escolaId}&role=${roleMap[formData.papel]}`, { method: 'GET' });
          const json = await res.json();
          if (res.ok && json.ok) {
            setGeneratedNumeroLogin(json.numeroLogin);
          } else {
            console.error("Failed to generate login number:", json.error);
            setGeneratedNumeroLogin(null);
          }
        } catch (e) {
          console.error("Error fetching login number:", e);
          setGeneratedNumeroLogin(null);
        } finally {
          setIsGeneratingLogin(false);
        }
      } else {
        setGeneratedNumeroLogin(null);
      }
    };
    
    const timeoutId = setTimeout(fetchNumeroLogin, 500); // Debounce
    return () => clearTimeout(timeoutId);
  }, [formData.escolaId, formData.papel]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validar = () => {
    if (!formData.nome.trim()) return "Informe o nome.";
    if (!formData.email.trim()) return "Informe o email.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) return "Email inválido.";
    if (!formData.escolaId) return "Selecione uma escola.";
    if (formData.tempPassword) {
      const err = validatePassword(formData.tempPassword)
      if (err) return `Senha temporária: ${err}`
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    const erro = validar();
    if (erro) {
      setMsg({ type: "err", text: erro });
      return;
    }

    try {
      setLoading(true);

      const roleEnum = roleMap[formData.papel];
      const res = await fetch("/api/super-admin/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          nome: formData.nome, 
          email: formData.email, 
          telefone: formData.telefone, 
          papel: formData.papel, 
          escolaId: formData.escolaId, 
          roleEnum, 
          tempPassword: formData.tempPassword || null 
        }),
      });
      
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Falha ao criar usuário");

      const tempPwdText = json.tempPassword
        ? json.tempPassword
        : '(usuário já existia — senha não alterada)'
      setMsg({
        type: "ok",
        text: `✅ Usuário criado com sucesso! Senha temporária: ${tempPwdText}. Número de Login: ${json.numeroLogin || '(não gerado)'}`,
      });

      // Removido redirecionamento automático para manter o sumário visível
      // O usuário pode navegar manualmente para a lista caso deseje
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error("Erro ao criar usuário:", err);
      setMsg({ type: "err", text: `Erro: ${message}` });
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (currentStep === 1 && formData.nome && formData.email) {
      setCurrentStep(2);
    } else if (currentStep === 2 && formData.escolaId) {
      setCurrentStep(3);
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(1, prev - 1));
  };

  const canProceedToNextStep = () => {
    if (currentStep === 1) return formData.nome.trim() && formData.email.trim();
    if (currentStep === 2) return formData.escolaId;
    return true;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-moxinexa-light to-blue-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back to Dashboard */}
        <div className="mb-4">
          <button
            type="button"
            onClick={() => router.push('/super-admin')}
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-moxinexa-teal transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Voltar ao Dashboard
          </button>
        </div>
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-moxinexa-teal rounded-full mb-4">
            <UserPlusIcon className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-moxinexa-dark mb-2">
            Criar Novo Usuário
          </h1>
          <p className="text-moxinexa-gray text-lg">
            Adicione um novo usuário ao sistema com permissões específicas
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-md mx-auto">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 font-semibold ${
                    step === currentStep
                      ? "bg-moxinexa-teal text-white border-moxinexa-teal"
                      : step < currentStep
                      ? "bg-green-500 text-white border-green-500"
                      : "bg-white text-gray-400 border-gray-300"
                  }`}
                >
                  {step < currentStep ? <CheckCircleIcon className="w-5 h-5" /> : step}
                </div>
                <span
                  className={`text-xs mt-2 font-medium ${
                    step === currentStep ? "text-moxinexa-teal" : "text-gray-500"
                  }`}
                >
                  {step === 1 && "Informações"}
                  {step === 2 && "Escola"}
                  {step === 3 && "Revisão"}
                </span>
              </div>
            ))}
          </div>
          <div className="relative max-w-md mx-auto -mt-5">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-200 -z-10">
              <div
                className="h-full bg-moxinexa-teal transition-all duration-300"
                style={{ width: `${((currentStep - 1) / 2) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-xl p-8 space-y-6 border border-gray-100"
        >
          {/* Step 1: Basic Information */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h2 className="text-xl font-semibold text-moxinexa-dark mb-2">
                  Informações Básicas
                </h2>
                <p className="text-moxinexa-gray text-sm">
                  Insira os dados fundamentais do usuário
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-moxinexa-dark">
                    Nome Completo *
                  </label>
                  <input
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all"
                    value={formData.nome}
                    onChange={(e) => handleInputChange('nome', e.target.value)}
                    disabled={loading}
                    placeholder="Ex: João Silva"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-moxinexa-dark">
                    Email *
                  </label>
                  <input
                    type="email"
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    disabled={loading}
                    placeholder="Ex: joao@escola.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-moxinexa-dark">
                  Telefone
                </label>
                <input
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all"
                  value={formData.telefone}
                  onChange={(e) => handleInputChange('telefone', e.target.value)}
                  disabled={loading}
                  placeholder="Ex: (11) 99999-9999"
                />
              </div>
            </div>
          )}

          {/* Step 2: School and Role */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h2 className="text-xl font-semibold text-moxinexa-dark mb-2">
                  Escola e Função
                </h2>
                <p className="text-moxinexa-gray text-sm">
                  Defina a escola e o papel do usuário no sistema
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-moxinexa-dark">
                    Escola *
                  </label>
                  <select
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all"
                    value={formData.escolaId}
                    onChange={(e) => handleInputChange('escolaId', e.target.value)}
                    disabled={loading}
                    required
                  >
                    <option value="">Selecione uma escola...</option>
                    {escolas.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-moxinexa-dark">
                    Papel *
                  </label>
                  <select
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all"
                    value={formData.papel}
                    onChange={(e) => handleInputChange('papel', e.target.value)}
                    disabled={loading}
                  >
                    {/* Values must match DB check constraint for public.escola_usuarios.papel */}
                    <option value="admin_escola">Diretor</option>
                    <option value="admin">Administrador</option>
                    <option value="financeiro">Financeiro</option>
                    <option value="secretaria">Secretário</option>
                  </select>
                </div>
              </div>

              {/* Generated Login Number */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <SparklesIcon className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-blue-900">Número de Login Gerado</span>
                  {isGeneratingLogin && (
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  )}
                </div>
                <input
                  className="w-full bg-white border border-blue-300 rounded-lg p-3 text-blue-900 font-mono text-sm"
                  value={generatedNumeroLogin || 'Selecione escola e papel para gerar...'}
                  disabled
                />
                <p className="text-blue-700 text-xs mt-2">
                  Gerado automaticamente com base na escola e papel selecionados
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Password and Review */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h2 className="text-xl font-semibold text-moxinexa-dark mb-2">
                  Senha e Confirmação
                </h2>
                <p className="text-moxinexa-gray text-sm">
                  Defina uma senha temporária e revise os dados
                </p>
              </div>

              {/* Review Card */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-moxinexa-dark mb-4">Resumo do Usuário</h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Nome:</span>
                    <p className="font-medium">{formData.nome}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Email:</span>
                    <p className="font-medium">{formData.email}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Telefone:</span>
                    <p className="font-medium">{formData.telefone || "Não informado"}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Papel:</span>
                    <p className="font-medium capitalize">{formData.papel}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Número de Login:</span>
                    <p className="font-medium font-mono">{generatedNumeroLogin || "Não gerado"}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-moxinexa-dark">
                    Senha temporária (opcional)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-500 hover:text-moxinexa-teal transition-colors"
                  >
                    {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                  </button>
                </div>
                
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all"
                  value={formData.tempPassword}
                  onChange={(e) => handleInputChange('tempPassword', e.target.value)}
                  disabled={loading}
                  placeholder="Deixe em branco para gerar automaticamente"
                />
                
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <InformationCircleIcon className="w-4 h-4" />
                  <span>Mín. 8 caracteres, com maiúscula, minúscula, número e caractere especial</span>
                </div>

                {formData.tempPassword && (
                  <div className="mt-4">
                    <PasswordStrength pwd={formData.tempPassword} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-6 border-t border-gray-200">
            <Button
              type="button"
              onClick={prevStep}
              disabled={currentStep === 1 || loading}
              variant="outline"
              tone="gray"
            >
              Voltar
            </Button>

            {currentStep < 3 ? (
              <Button
                type="button"
                onClick={nextStep}
                disabled={!canProceedToNextStep() || loading}
                tone="teal"
              >
                Continuar
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={loading}
                tone="green"
                size="lg"
                className="px-8"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Criando Usuário...
                  </>
                ) : (
                  <>
                    <UserPlusIcon className="w-5 h-5" />
                    Criar Usuário
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Status Message */}
          {msg && (
            <div
              className={`p-4 rounded-lg border ${
                msg.type === "ok"
                  ? "bg-green-50 text-green-800 border-green-200"
                  : "bg-red-50 text-red-800 border-red-200"
              }`}
            >
              <div className="flex items-center gap-2">
                {msg.type === "ok" ? (
                  <CheckCircleIcon className="w-5 h-5" />
                ) : (
                  <ExclamationTriangleIcon className="w-5 h-5" />
                )}
                <span>{msg.text}</span>
              </div>
            </div>
          )}
        </form>

        {/* Quick Tips */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-2xl p-6">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <InformationCircleIcon className="w-5 h-5" />
            Dicas Rápidas
          </h3>
          <ul className="text-blue-800 text-sm space-y-2">
            <li>• O número de login é gerado automaticamente baseado na escola e papel</li>
            <li>• Se não definir senha, o sistema gerará uma automaticamente</li>
            <li>• O usuário receberá instruções de acesso por email</li>
            <li>• Você pode editar essas informações posteriormente</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// Password Strength Component (mantido igual, mas com melhor estilização)
function passwordRules(pwd: string) {
  return [
    { ok: pwd.length >= 8, msg: 'Pelo menos 8 caracteres' },
    { ok: /[A-Z]/.test(pwd), msg: '1 letra maiúscula' },
    { ok: /[a-z]/.test(pwd), msg: '1 letra minúscula' },
    { ok: /\d/.test(pwd), msg: '1 número' },
    { ok: /[^A-Za-z0-9]/.test(pwd), msg: '1 caractere especial' },
  ]
}

function validatePassword(pwd: string) {
  const fail = passwordRules(pwd).find(r => !r.ok)
  return fail?.msg || null
}

function PasswordStrength({ pwd }: { pwd: string }) {
  const rules = passwordRules(pwd)
  const score = rules.filter(r => r.ok).length
  let label = 'Muito fraca'
  let color = 'bg-red-500'
  if (score === 2) { label = 'Fraca'; color = 'bg-amber-500' }
  if (score === 3) { label = 'Média'; color = 'bg-yellow-500' }
  if (score === 4) { label = 'Forte'; color = 'bg-green-600' }
  if (score >= 5) { label = 'Excelente'; color = 'bg-moxinexa-teal' }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between text-sm mb-3">
        <span className="text-gray-700 font-medium">Força da senha:</span>
        <span className="font-semibold text-gray-800">{label}</span>
      </div>
      <div className="flex gap-1 mb-4" aria-hidden>
        {[0,1,2,3,4].map((i) => (
          <div key={i} className={`h-2 flex-1 rounded-full transition-all ${
            i < score ? color : 'bg-gray-200'
          }`}></div>
        ))}
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
        {rules.map((r, idx) => (
          <li key={idx} className={`flex items-center gap-2 ${
            r.ok ? 'text-green-600' : 'text-gray-500'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              r.ok ? 'bg-green-500' : 'bg-gray-300'
            }`} />
            {r.msg}
          </li>
        ))}
      </ul>
    </div>
  );
}
