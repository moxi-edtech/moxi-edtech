"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RequireSuperAdmin from "@/app/(guards)/RequireSuperAdmin";
import { Button } from "@/components/ui/Button";
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
  ArrowRightIcon,
  AcademicCapIcon,
  BuildingLibraryIcon,
  KeyIcon,
} from "@heroicons/react/24/outline";

// Types
interface Escola {
  id: string;
  nome: string;
}

interface FormData {
  nome: string;
  email: string;
  telefone: string;
  tempPassword: string;
  papel: string;
  escolaId: string;
}

interface Message {
  type: "success" | "error";
  text: string;
}

// Constants
const ROLE_MAP: Record<string, Database["public"]["Enums"]["user_role"]> = {
  admin_escola: "admin",
  admin: "admin",
  staff_admin: "admin",
  financeiro: "financeiro",
  secretaria: "secretaria",
  professor: "professor",
  aluno: "aluno",
};

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  admin_escola: "Diretor",
  admin: "Administrador",
  financeiro: "Financeiro",
  secretaria: "Secretário",
  professor: "Professor",
  aluno: "Aluno",
};

const STEP_CONFIG = [
  { number: 1, title: "Informações", icon: UserPlusIcon },
  { number: 2, title: "Escola", icon: BuildingLibraryIcon },
  { number: 3, title: "Senha", icon: KeyIcon },
];

export default function Page() {
  return (
    <RequireSuperAdmin>
      <CriarUsuarioForm />
    </RequireSuperAdmin>
  );
}

function CriarUsuarioForm() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({
    nome: "",
    email: "",
    telefone: "",
    tempPassword: "",
    papel: "admin_escola",
    escolaId: "",
  });
  const [generatedNumeroLogin, setGeneratedNumeroLogin] = useState<string | null>(null);
  const [escolas, setEscolas] = useState<Escola[]>([]);
  const [loading, setLoading] = useState(false);
  const [escolasLoading, setEscolasLoading] = useState(true);
  const [escolasError, setEscolasError] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [isGeneratingLogin, setIsGeneratingLogin] = useState(false);

  // Fetch escolas with error handling and retry
  const fetchEscolas = useCallback(async () => {
    setEscolasLoading(true);
    setEscolasError(null);
    
    try {
      const res = await fetch('/api/super-admin/escolas/list', {
        method: 'GET',
        headers: { 
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const json = await res.json();
      
      if (!json?.ok) {
        throw new Error(json?.error || 'Resposta inválida do servidor');
      }

      const items = (json.items || []) as Array<{ id: string; nome: string | null }>;
      const formattedEscolas = items
        .filter(e => e.id && e.nome)
        .map((e) => ({ 
          id: String(e.id), 
          nome: e.nome ?? 'Sem nome' 
        }));

      setEscolas(formattedEscolas);
      
      if (formattedEscolas.length === 0) {
        setEscolasError('Nenhuma escola cadastrada');
      }
    } catch (error) {
      console.error('Erro ao carregar escolas:', error);
      setEscolasError(
        error instanceof Error 
          ? error.message 
          : 'Erro inesperado ao carregar escolas'
      );
    } finally {
      setEscolasLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEscolas();
  }, [fetchEscolas]);

  // Debounced login number generation
  useEffect(() => {
    const fetchNumeroLogin = async () => {
      if (!formData.escolaId || !formData.papel) {
        setGeneratedNumeroLogin(null);
        return;
      }

      setIsGeneratingLogin(true);
      try {
        const roleEnum = ROLE_MAP[formData.papel];
        const params = new URLSearchParams({
          escolaId: formData.escolaId,
          role: roleEnum,
        });

        const res = await fetch(`/api/super-admin/users/generate-login-number?${params}`);
        
        if (!res.ok) throw new Error('Falha na requisição');
        
        const json = await res.json();
        
        if (json.ok && json.numeroLogin) {
          setGeneratedNumeroLogin(json.numeroLogin);
        } else {
          throw new Error(json.error || 'Número de login não gerado');
        }
      } catch (error) {
        console.error("Erro ao gerar número de login:", error);
        setGeneratedNumeroLogin(null);
      } finally {
        setIsGeneratingLogin(false);
      }
    };

    const timeoutId = setTimeout(fetchNumeroLogin, 300);
    return () => clearTimeout(timeoutId);
  }, [formData.escolaId, formData.papel]);

  // Handlers
  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear messages when user starts typing
    if (message) setMessage(null);
  };

  const validateForm = (): string | null => {
    if (!formData.nome.trim()) return "Informe o nome completo";
    if (!formData.email.trim()) return "Informe o email";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) return "Email inválido";
    if (!formData.escolaId) return "Selecione uma escola";
    
    if (formData.tempPassword) {
      const passwordError = validatePassword(formData.tempPassword);
      if (passwordError) return `Senha temporária: ${passwordError}`;
    }
    
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const error = validateForm();
    if (error) {
      setMessage({ type: "error", text: error });
      return;
    }

    setLoading(true);
    
    try {
      const roleEnum = ROLE_MAP[formData.papel];
      const payload = {
        nome: formData.nome.trim(),
        email: formData.email.trim().toLowerCase(),
        telefone: formData.telefone.trim(),
        papel: formData.papel,
        escolaId: formData.escolaId,
        roleEnum,
        tempPassword: formData.tempPassword || null,
      };

      const res = await fetch("/api/super-admin/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Falha ao criar usuário");
      }

      const tempPasswordText = json.tempPassword 
        ? json.tempPassword
        : '(usuário existente - senha mantida)';
      
      setMessage({
        type: "success",
        text: `✅ Usuário criado com sucesso! Senha temporária: ${tempPasswordText}. Número de Login: ${json.numeroLogin || generatedNumeroLogin || '(não gerado)'}`,
      });

      // Reset form on success
      setFormData({
        nome: "",
        email: "",
        telefone: "",
        tempPassword: "",
        papel: "admin_escola",
        escolaId: "",
      });
      setGeneratedNumeroLogin(null);
      setCurrentStep(1);

    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      setMessage({ type: "error", text: `Erro: ${message}` });
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (currentStep < 3) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(1, prev - 1));
  };

  const canProceedToNextStep = (): boolean => {
    switch (currentStep) {
      case 1:
        return formData.nome.trim().length >= 2 && 
               /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
      case 2:
        return !!formData.escolaId;
      default:
        return true;
    }
  };

  const getSelectedEscolaName = (): string => {
    return escolas.find(e => e.id === formData.escolaId)?.nome || '';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-moxinexa-light to-blue-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            type="button"
            onClick={() => router.push('/super-admin')}
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-moxinexa-teal transition-colors mb-6"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Voltar ao Dashboard
          </button>

          <div className="text-center">
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
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-md mx-auto">
            {STEP_CONFIG.map(({ number, title, icon: Icon }) => (
              <div key={number} className="flex flex-col items-center flex-1">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all ${
                    number === currentStep
                      ? "bg-moxinexa-teal text-white border-moxinexa-teal shadow-lg scale-110"
                      : number < currentStep
                      ? "bg-green-500 text-white border-green-500 shadow-md"
                      : "bg-white text-gray-400 border-gray-300"
                  }`}
                >
                  {number < currentStep ? (
                    <CheckCircleIcon className="w-6 h-6" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <span
                  className={`text-xs mt-2 font-medium text-center ${
                    number === currentStep ? "text-moxinexa-teal font-semibold" : "text-gray-500"
                  }`}
                >
                  {title}
                </span>
              </div>
            ))}
          </div>
          <div className="relative max-w-md mx-auto -mt-7">
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-200 -z-10 rounded-full">
              <div
                className="h-full bg-moxinexa-teal transition-all duration-500 ease-out rounded-full"
                style={{ width: `${((currentStep - 1) / (STEP_CONFIG.length - 1)) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-xl p-8 space-y-8 border border-gray-100"
        >
          {/* Step 1: Basic Information */}
          {currentStep === 1 && (
            <Step1 
              formData={formData}
              loading={loading}
              onInputChange={handleInputChange}
            />
          )}

          {/* Step 2: School and Role */}
          {currentStep === 2 && (
            <Step2
              formData={formData}
              loading={loading}
              escolas={escolas}
              escolasLoading={escolasLoading}
              escolasError={escolasError}
              generatedNumeroLogin={generatedNumeroLogin}
              isGeneratingLogin={isGeneratingLogin}
              onInputChange={handleInputChange}
              onRetryEscolas={fetchEscolas}
            />
          )}

          {/* Step 3: Password and Review */}
          {currentStep === 3 && (
            <Step3
              formData={formData}
              loading={loading}
              generatedNumeroLogin={generatedNumeroLogin}
              selectedEscolaName={getSelectedEscolaName()}
              showPassword={showPassword}
              onInputChange={handleInputChange}
              onTogglePassword={() => setShowPassword(!showPassword)}
            />
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-8 border-t border-gray-200">
            <Button
              type="button"
              onClick={prevStep}
              disabled={currentStep === 1 || loading}
              variant="outline"
              tone="gray"
              className="min-w-[100px]"
            >
              Voltar
            </Button>

            {currentStep < STEP_CONFIG.length ? (
              <Button
                type="button"
                onClick={nextStep}
                disabled={!canProceedToNextStep() || loading}
                tone="teal"
                className="min-w-[120px]"
              >
                <span>Continuar</span>
                <ArrowRightIcon className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={loading}
                tone="green"
                size="lg"
                className="min-w-[160px] px-8"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Criando...</span>
                  </>
                ) : (
                  <>
                    <UserPlusIcon className="w-5 h-5" />
                    <span>Criar Usuário</span>
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Status Message */}
          {message && (
            <MessageAlert type={message.type} text={message.text} />
          )}
        </form>

        {/* Quick Tips */}
        <QuickTips />
      </div>
    </div>
  );
}

// Step Components
function Step1({ 
  formData, 
  loading, 
  onInputChange 
}: { 
  formData: FormData;
  loading: boolean;
  onInputChange: (field: keyof FormData, value: string) => void;
}) {
  return (
    <div className="space-y-6 animate-fadeIn">
      <StepHeader
        title="Informações Básicas"
        description="Insira os dados fundamentais do usuário"
        icon={UserPlusIcon}
      />

      <div className="grid md:grid-cols-2 gap-6">
        <FormField
          label="Nome Completo *"
          value={formData.nome}
          onChange={(value) => onInputChange('nome', value)}
          disabled={loading}
          placeholder="Ex: João Silva"
          required
        />

        <FormField
          label="Email *"
          type="email"
          value={formData.email}
          onChange={(value) => onInputChange('email', value)}
          disabled={loading}
          placeholder="Ex: joao@escola.com"
          required
        />
      </div>

      <FormField
        label="Telefone"
        value={formData.telefone}
        onChange={(value) => onInputChange('telefone', value)}
        disabled={loading}
        placeholder="Ex: (11) 99999-9999"
      />
    </div>
  );
}

function Step2({
  formData,
  loading,
  escolas,
  escolasLoading,
  escolasError,
  generatedNumeroLogin,
  isGeneratingLogin,
  onInputChange,
  onRetryEscolas,
}: {
  formData: FormData;
  loading: boolean;
  escolas: Escola[];
  escolasLoading: boolean;
  escolasError: string | null;
  generatedNumeroLogin: string | null;
  isGeneratingLogin: boolean;
  onInputChange: (field: keyof FormData, value: string) => void;
  onRetryEscolas: () => void;
}) {
  return (
    <div className="space-y-6 animate-fadeIn">
      <StepHeader
        title="Escola e Função"
        description="Defina a escola e o papel do usuário no sistema"
        icon={BuildingLibraryIcon}
      />

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-moxinexa-dark">
            Escola *
          </label>
          <select
            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
            value={formData.escolaId}
            onChange={(e) => onInputChange('escolaId', e.target.value)}
            disabled={loading || escolasLoading}
            required
          >
            <option value="">
              {escolasLoading ? 'Carregando escolas...' : 'Selecione uma escola...'}
            </option>
            {escolas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
          
          {!escolasLoading && !escolasError && escolas.length === 0 && (
            <p className="text-sm text-amber-600 mt-1 flex items-center gap-1">
              <InformationCircleIcon className="w-4 h-4" />
              Nenhuma escola encontrada
            </p>
          )}
          
          {escolasError && (
            <div className="text-sm text-red-600 mt-1 flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1">
                <ExclamationTriangleIcon className="w-4 h-4" />
                {escolasError}
              </span>
              <button
                type="button"
                onClick={onRetryEscolas}
                className="text-red-600 underline decoration-dotted hover:text-red-700 text-sm"
              >
                Tentar novamente
              </button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-moxinexa-dark">
            Papel *
          </label>
          <select
            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all disabled:bg-gray-50"
            value={formData.papel}
            onChange={(e) => onInputChange('papel', e.target.value)}
            disabled={loading}
          >
            {Object.entries(ROLE_DISPLAY_NAMES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
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
          className="w-full bg-white border border-blue-300 rounded-lg p-3 text-blue-900 font-mono text-sm disabled:bg-blue-50 disabled:cursor-not-allowed"
          value={generatedNumeroLogin || 'Selecione escola e papel para gerar...'}
          disabled
        />
        <p className="text-blue-700 text-xs mt-2">
          Gerado automaticamente com base na escola e papel selecionados
        </p>
      </div>
    </div>
  );
}

function Step3({
  formData,
  loading,
  generatedNumeroLogin,
  selectedEscolaName,
  showPassword,
  onInputChange,
  onTogglePassword,
}: {
  formData: FormData;
  loading: boolean;
  generatedNumeroLogin: string | null;
  selectedEscolaName: string;
  showPassword: boolean;
  onInputChange: (field: keyof FormData, value: string) => void;
  onTogglePassword: () => void;
}) {
  return (
    <div className="space-y-6 animate-fadeIn">
      <StepHeader
        title="Senha e Confirmação"
        description="Defina uma senha temporária e revise os dados"
        icon={KeyIcon}
      />

      {/* Review Card */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-moxinexa-dark mb-4 flex items-center gap-2">
          <CheckCircleIcon className="w-5 h-5 text-green-500" />
          Resumo do Usuário
        </h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <ReviewItem label="Nome" value={formData.nome} />
          <ReviewItem label="Email" value={formData.email} />
          <ReviewItem label="Telefone" value={formData.telefone || "Não informado"} />
          <ReviewItem 
            label="Papel" 
            value={ROLE_DISPLAY_NAMES[formData.papel] || formData.papel} 
          />
          <ReviewItem label="Escola" value={selectedEscolaName} />
          <ReviewItem 
            label="Número de Login" 
            value={generatedNumeroLogin || "Não gerado"} 
            mono
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-moxinexa-dark">
            Senha temporária (opcional)
          </label>
          <button
            type="button"
            onClick={onTogglePassword}
            className="text-gray-500 hover:text-moxinexa-teal transition-colors p-1"
            disabled={loading}
          >
            {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
          </button>
        </div>
        
        <FormField
          type={showPassword ? "text" : "password"}
          value={formData.tempPassword}
          onChange={(value) => onInputChange('tempPassword', value)}
          disabled={loading}
          placeholder="Deixe em branco para gerar automaticamente"
        />
        
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <InformationCircleIcon className="w-4 h-4 flex-shrink-0" />
          <span>Mín. 8 caracteres, com maiúscula, minúscula, número e caractere especial</span>
        </div>

        {formData.tempPassword && (
          <div className="mt-4">
            <PasswordStrength password={formData.tempPassword} />
          </div>
        )}
      </div>
    </div>
  );
}

// Helper Components
function StepHeader({ 
  title, 
  description, 
  icon: Icon 
}: { 
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-moxinexa-dark mb-2 flex items-center gap-2">
        <Icon className="w-5 h-5" />
        {title}
      </h2>
      <p className="text-moxinexa-gray text-sm">
        {description}
      </p>
    </div>
  );
}

function FormField({
  label,
  type = "text",
  value,
  onChange,
  disabled,
  placeholder,
  required,
}: {
  label?: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-moxinexa-dark">
          {label}
        </label>
      )}
      <input
        type={type}
        className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all disabled:bg-gray-50 disabled:cursor-not-allowed"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}

function ReviewItem({ 
  label, 
  value, 
  mono = false 
}: { 
  label: string; 
  value: string; 
  mono?: boolean;
}) {
  return (
    <div>
      <span className="text-gray-600 text-xs uppercase tracking-wide">{label}:</span>
      <p className={`font-medium ${mono ? 'font-mono text-sm' : ''}`}>
        {value}
      </p>
    </div>
  );
}

function MessageAlert({ type, text }: Message) {
  return (
    <div
      className={`p-4 rounded-lg border flex items-center gap-3 animate-fadeIn ${
        type === "success"
          ? "bg-green-50 text-green-800 border-green-200"
          : "bg-red-50 text-red-800 border-red-200"
      }`}
    >
      {type === "success" ? (
        <CheckCircleIcon className="w-5 h-5 flex-shrink-0" />
      ) : (
        <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />
      )}
      <span className="text-sm">{text}</span>
    </div>
  );
}

function QuickTips() {
  return (
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
  );
}

// Password Strength Component (Improved)
function passwordRules(password: string) {
  return [
    { ok: password.length >= 8, msg: 'Pelo menos 8 caracteres' },
    { ok: /[A-Z]/.test(password), msg: '1 letra maiúscula' },
    { ok: /[a-z]/.test(password), msg: '1 letra minúscula' },
    { ok: /\d/.test(password), msg: '1 número' },
    { ok: /[^A-Za-z0-9]/.test(password), msg: '1 caractere especial' },
  ];
}

function validatePassword(password: string): string | null {
  const failedRule = passwordRules(password).find(rule => !rule.ok);
  return failedRule?.msg || null;
}

function PasswordStrength({ password }: { password: string }) {
  const rules = passwordRules(password);
  const score = rules.filter(rule => rule.ok).length;
  
  const strengthConfig = {
    0: { label: 'Muito fraca', color: 'bg-red-500' },
    1: { label: 'Muito fraca', color: 'bg-red-500' },
    2: { label: 'Fraca', color: 'bg-amber-500' },
    3: { label: 'Média', color: 'bg-yellow-500' },
    4: { label: 'Forte', color: 'bg-green-500' },
    5: { label: 'Excelente', color: 'bg-moxinexa-teal' },
  };

  const { label, color } = strengthConfig[score as keyof typeof strengthConfig] || strengthConfig[0];

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between text-sm mb-3">
        <span className="text-gray-700 font-medium">Força da senha:</span>
        <span className="font-semibold text-gray-800">{label}</span>
      </div>
      
      <div className="flex gap-1 mb-4" aria-hidden>
        {[0, 1, 2, 3, 4].map((index) => (
          <div
            key={index}
            className={`h-2 flex-1 rounded-full transition-all duration-300 ${
              index < score ? color : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
        {rules.map((rule, index) => (
          <li
            key={index}
            className={`flex items-center gap-2 ${
              rule.ok ? 'text-green-600' : 'text-gray-500'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full transition-colors ${
                rule.ok ? 'bg-green-500' : 'bg-gray-300'
              }`}
            />
            {rule.msg}
          </li>
        ))}
      </ul>
    </div>
  );
}
