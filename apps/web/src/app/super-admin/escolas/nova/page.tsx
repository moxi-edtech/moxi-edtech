"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import RequireSuperAdmin from "@/app/(guards)/RequireSuperAdmin";
import Button from "@/components/ui/Button";
import {
  BuildingLibraryIcon,
  UserPlusIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowLeftIcon,
  SparklesIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";

export default function NovaEscolaPage() {
  return (
    <RequireSuperAdmin>
      <CriarEscolaForm />
    </RequireSuperAdmin>
  );
}

function CriarEscolaForm() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    nome: "",
    nif: "",
    endereco: "",
    adminEmail: "",
    adminTelefone: "",
    adminNome: "",
  });

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<null | { type: "ok" | "err"; text: string }>(null);
  const [creationResult, setCreationResult] = useState<
    | {
        escolaId: string | null;
        adminEmail?: string | null;
        adminPassword?: string | null;
        adminUserCreated?: boolean | null;
        adminNumero?: number | null;
        mensagemAdmin?: string | null;
      }
    | null
  >(null);
  const [currentStep, setCurrentStep] = useState(1);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
          admin: {
            email: formData.adminEmail.trim(),
            telefone: formData.adminTelefone || null,
            nome: formData.adminNome.trim(),
          },
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Erro desconhecido ao criar escola.");
      }

      const escolaId = data.escolaId || data.escola_id || null;
      const adminEmail = data.adminEmail || formData.adminEmail.trim();

      setCreationResult({
        escolaId,
        adminEmail,
        adminPassword: data.adminPassword ?? null,
        adminUserCreated: data.adminUserCreated ?? null,
        adminNumero: data.adminNumero ?? null,
        mensagemAdmin: data.mensagemAdmin ?? null,
      });

      const adminNumero = data.adminNumero ? ` Admin nº ${data.adminNumero}.` : "";
      const extra = data.mensagemAdmin ? ` ${data.mensagemAdmin}` : "";
      const senhaInfo = data.adminPassword ? " Anote as credenciais abaixo." : "";
      setMsg({
        type: "ok",
        text: `Escola "${formData.nome}" criada com sucesso!${adminNumero}${extra}${senhaInfo}`,
      });
    } catch (err: any) {
      setMsg({ type: "err", text: err.message || String(err) });
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (currentStep === 1 && formData.nome && formData.nif) {
      setCurrentStep(2);
    } else if (currentStep === 2 && formData.adminNome && formData.adminEmail) {
      setCurrentStep(3);
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(1, prev - 1));
  };

  const canProceedToNextStep = () => {
    if (currentStep === 1) return formData.nome.trim() && formData.nif.trim();
    if (currentStep === 2) return formData.adminNome.trim() && formData.adminEmail.trim();
    return true;
  };

  const isNifValid = formData.nif.length === 0 || formData.nif.length === 9;

  return (
    <div className="min-h-screen bg-gradient-to-br from-moxinexa-light to-blue-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-moxinexa-teal rounded-full mb-4">
            <BuildingLibraryIcon className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-moxinexa-dark mb-2">
            Criar Nova Escola
          </h1>
          <p className="text-moxinexa-gray text-lg">
            Adicione uma nova escola ao sistema e configure o administrador
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
                  {step === 1 && "Escola"}
                  {step === 2 && "Administrador"}
                  {step === 3 && "Confirmação"}
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
          {/* Step 1: School Information */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h2 className="text-xl font-semibold text-moxinexa-dark mb-2">
                  Informações da Escola
                </h2>
                <p className="text-moxinexa-gray text-sm">
                  Insira os dados básicos da nova escola
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-moxinexa-dark">
                    Nome da Escola *
                  </label>
                  <input
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all"
                    placeholder="Ex: Colégio Horizonte"
                    value={formData.nome}
                    onChange={(e) => handleInputChange('nome', e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-moxinexa-dark">
                    NIF *
                  </label>
                  <input
                    className={`w-full border rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all ${
                      !isNifValid ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="9 dígitos (apenas números)"
                    value={formData.nif}
                    onChange={(e) => handleInputChange('nif', e.target.value.replace(/\D/g, ''))}
                    maxLength={9}
                    disabled={loading}
                  />
                  <div className="flex items-center gap-2">
                    {formData.nif && (
                      <div className={`text-xs ${isNifValid ? 'text-green-600' : 'text-red-600'}`}>
                        {isNifValid ? '✓ Formato válido' : '⚠️ Deve ter 9 dígitos'}
                      </div>
                    )}
                    <div className="text-xs text-gray-500">
                      {formData.nif.length}/9 caracteres
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-moxinexa-dark">
                    Endereço Completo
                  </label>
                  <input
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all"
                    placeholder="Rua, número, bairro, cidade"
                    value={formData.endereco}
                    onChange={(e) => handleInputChange('endereco', e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Administrator Information */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h2 className="text-xl font-semibold text-moxinexa-dark mb-2">
                  Administrador da Escola
                </h2>
                <p className="text-moxinexa-gray text-sm">
                  Configure o usuário administrador responsável pela escola
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2">
                  <InformationCircleIcon className="w-5 h-5 text-blue-600" />
                  <span className="text-blue-800 text-sm font-medium">
                    O administrador terá acesso total à escola e receberá credenciais de acesso
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-moxinexa-dark">
                    Nome do Administrador *
                  </label>
                  <input
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all"
                    placeholder="Nome completo do administrador"
                    value={formData.adminNome}
                    onChange={(e) => handleInputChange('adminNome', e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-moxinexa-dark">
                    Email do Administrador *
                  </label>
                  <input
                    type="email"
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all"
                    placeholder="email@escola.com"
                    value={formData.adminEmail}
                    onChange={(e) => handleInputChange('adminEmail', e.target.value)}
                    required
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-500">
                    Será usado para login e recuperação de senha
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-moxinexa-dark">
                    Telefone do Administrador
                  </label>
                  <input
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all"
                    placeholder="9XXXXXXXX (ex: 923456789)"
                    value={formData.adminTelefone}
                    onChange={(e) => handleInputChange('adminTelefone', e.target.value.replace(/\D/g, ''))}
                    maxLength={9}
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Review and Confirm */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h2 className="text-xl font-semibold text-moxinexa-dark mb-2">
                  Confirmação
                </h2>
                <p className="text-moxinexa-gray text-sm">
                  Revise os dados antes de criar a escola
                </p>
              </div>

              {/* School Summary */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-moxinexa-dark mb-4 flex items-center gap-2">
                  <BuildingLibraryIcon className="w-5 h-5" />
                  Resumo da Escola
                </h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Nome:</span>
                    <p className="font-medium">{formData.nome}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">NIF:</span>
                    <p className="font-medium font-mono">{formData.nif || "Não informado"}</p>
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-gray-600">Endereço:</span>
                    <p className="font-medium">{formData.endereco || "Não informado"}</p>
                  </div>
                </div>
              </div>

              {/* Admin Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="font-semibold text-blue-900 mb-4 flex items-center gap-2">
                  <UserPlusIcon className="w-5 h-5" />
                  Administrador
                </h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-blue-700">Nome:</span>
                    <p className="font-medium text-blue-900">{formData.adminNome}</p>
                  </div>
                  <div>
                    <span className="text-blue-700">Email:</span>
                    <p className="font-medium text-blue-900">{formData.adminEmail}</p>
                  </div>
                  <div>
                    <span className="text-blue-700">Telefone:</span>
                    <p className="font-medium text-blue-900">{formData.adminTelefone || "Não informado"}</p>
                  </div>
                </div>
              </div>

              {/* Auto-generation Info */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <SparklesIcon className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-green-900">Será gerado automaticamente:</span>
                </div>
                <ul className="text-green-800 text-sm mt-2 space-y-1">
                  <li>• Número de login único para o administrador</li>
                  <li>• Senha temporária de acesso</li>
                  <li>• Ambiente dedicado para a escola</li>
                  <li>• Processo de onboarding personalizado</li>
                </ul>
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
              className="flex items-center gap-2"
            >
              <ArrowLeftIcon className="w-4 h-4" />
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
                className="px-8 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Criando Escola...
                  </>
                ) : (
                  <>
                    <BuildingLibraryIcon className="w-5 h-5" />
                    Criar Escola
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

          {creationResult && (
            <div className="mt-4 space-y-3">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-moxinexa-dark mb-3">Credenciais do administrador</h4>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Email de login</p>
                    <p className="font-semibold text-moxinexa-dark break-all">{creationResult.adminEmail || "Não informado"}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Senha temporária</p>
                    <p className="font-semibold text-moxinexa-dark break-all">
                      {creationResult.adminPassword || "Usuário já existia; nenhuma senha nova foi gerada."}
                    </p>
                    {creationResult.adminUserCreated === false && (
                      <p className="text-xs text-gray-600 mt-1">
                        Solicite redefinição de senha caso o administrador não lembre a atual.
                      </p>
                    )}
                  </div>
                </div>

                {creationResult.escolaId && (
                  <div className="flex flex-wrap gap-3 mt-4">
                    <Button
                      type="button"
                      tone="teal"
                      onClick={() => router.push(`/escola/${creationResult.escolaId}/admin`)}
                    >
                      Ir para painel da escola
                    </Button>
                    <Button
                      type="button"
                      tone="blue"
                      variant="outline"
                      onClick={() => router.push(`/escola/${creationResult.escolaId}/onboarding`)}
                    >
                      Abrir onboarding
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </form>

        {/* Quick Tips */}
        <div className="mt-8 bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <h3 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
            <InformationCircleIcon className="w-5 h-5" />
            Informações Importantes
          </h3>
          <ul className="text-amber-800 text-sm space-y-2">
            <li>• O NIF é obrigatório e deve ser único no sistema</li>
            <li>• O administrador receberá credenciais de acesso por email e nesta tela</li>
            <li>• Após a criação, copie as credenciais e acesse o onboarding quando preferir</li>
            <li>• Você pode configurar planos e recursos adicionais posteriormente</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
