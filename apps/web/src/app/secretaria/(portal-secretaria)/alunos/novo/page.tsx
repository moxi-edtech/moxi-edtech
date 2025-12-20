"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import {
  UserPlusIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  ArrowLeftIcon,
  AcademicCapIcon,
} from "@heroicons/react/24/outline";

export default function AlunosPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"add" | "list">("add");
  const [fileName, setFileName] = useState<string>("Nenhum ficheiro selecionado");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  // Neste fluxo (cadastro), não geramos nem exibimos credenciais
  const [currentStep, setCurrentStep] = useState(1);
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    birthDate: "",
    gender: "",
    idNumber: "",
    nif: "",
    email: "",
    phone: "",
    address: "",
    guardianName: "",
    guardianPhone: "",
    guardianEmail: "",
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Copia BI para NIF quando o usuário não preenche manualmente
  React.useEffect(() => {
    if (!formData.nif && formData.idNumber) {
      setFormData((prev) => ({ ...prev, nif: prev.idNumber }));
    }
  }, [formData.idNumber, formData.nif]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFileName(e.target.files[0].name);
    }
  };

  const [createdAlunoId, setCreatedAlunoId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setCreatedAlunoId(null);

    try {
      const payload: any = {
        primeiro_nome: formData.firstName.trim(),
        sobrenome: formData.lastName.trim(),
        nome: `${formData.firstName} ${formData.lastName}`.trim(),
        email: formData.email.trim(),
        telefone: formData.phone.trim(),
        data_nascimento: formData.birthDate || null,
        sexo: (formData.gender as any) || null,
        bi_numero: formData.idNumber || null,
        nif: formData.nif || formData.idNumber || null,
        responsavel_nome: formData.guardianName || null,
        responsavel_contato: formData.guardianPhone || null,
        encarregado_email: formData.guardianEmail || null,
      };

      const res = await fetch('/api/secretaria/alunos/novo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao criar aluno');

      // Fluxo de cadastro não deve exibir/retornar credenciais
      if (json?.id) setCreatedAlunoId(String(json.id));

      setSubmitSuccess(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = () => {
    if (currentStep < 3) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const canProceedToNextStep = () => {
    switch (currentStep) {
      case 1:
        return formData.firstName.trim() && formData.lastName.trim() && formData.birthDate && formData.gender && formData.idNumber.trim();
      case 2:
        return formData.email.trim() && formData.phone.trim() && formData.address.trim();
      case 3:
        return formData.guardianName.trim() && formData.guardianPhone.trim();
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-moxinexa-light to-blue-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back to Dashboard */}
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

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-moxinexa-teal rounded-full mb-4">
            <AcademicCapIcon className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-moxinexa-dark mb-2">
            Gestão de Estudantes
          </h1>
          <p className="text-moxinexa-gray text-lg">
            Gerencie estudantes e suas informações acadêmicas
          </p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-2xl shadow-sm p-2 border border-gray-200">
            <div className="flex space-x-1">
              <button
                className={`px-6 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  activeTab === "add"
                    ? "bg-moxinexa-teal text-white shadow-md"
                    : "text-gray-600 hover:text-moxinexa-teal"
                }`}
                onClick={() => setActiveTab("add")}
              >
                Adicionar Estudante
              </button>
              <button
                className={`px-6 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  activeTab === "list"
                    ? "bg-moxinexa-teal text-white shadow-md"
                    : "text-gray-600 hover:text-moxinexa-teal"
                }`}
                onClick={() => setActiveTab("list")}
              >
                Lista de Estudantes
              </button>
            </div>
          </div>
        </div>

        {/* Conteúdo */}
        {activeTab === "add" && (
          <div className="space-y-8">
            {/* Progress Steps */}
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
              <div className="mb-8">
                <div className="flex items-center justify-between max-w-2xl mx-auto">
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
                        className={`text-xs mt-2 font-medium text-center ${
                          step === currentStep ? "text-moxinexa-teal" : "text-gray-500"
                        }`}
                      >
                        {step === 1 && "Pessoal"}
                        {step === 2 && "Contactos"}
                        {step === 3 && "Encarregado"}
                        
                      </span>
                    </div>
                  ))}
                </div>
                <div className="relative max-w-2xl mx-auto -mt-5">
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-200 -z-10">
                    <div
                      className="h-full bg-moxinexa-teal transition-all duration-300"
                      style={{ width: `${((currentStep - 1) / 2) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Alert de sucesso */}
                {submitSuccess && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3 animate-fadeIn">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircleIcon className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-green-800">Estudante adicionado com sucesso!</p>
                      <p className="text-sm text-green-600">Os dados foram guardados no sistema.</p>
                      {/* Não exibir qualquer número de login ou senha temporária neste passo */}
                      {createdAlunoId && (
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => router.push(`/secretaria/matriculas/nova?alunoId=${encodeURIComponent(createdAlunoId!)}`)}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
                          >
                            Matricular agora
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Lembrete */}
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
                  <p className="text-sm text-blue-700 flex items-center gap-2">
                    <InformationCircleIcon className="w-5 h-5" />
                    <span>
                      <strong>Fluxo:</strong> Cadastro rápido de dados pessoais agora, e <strong>Matrícula</strong> depois pelo botão "Matricular".
                    </span>
                  </p>
                </div>

                {/* Passo 1: Informações Pessoais */}
                {currentStep === 1 && (
                  <div className="space-y-6 animate-fadeIn">
                    <div>
                      <h2 className="text-xl font-semibold text-moxinexa-dark mb-2">
                        Informações Pessoais
                      </h2>
                      <p className="text-moxinexa-gray text-sm">
                        Dados fundamentais do estudante
                      </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-moxinexa-dark">
                          Primeiro Nome *
                        </label>
                        <input
                          type="text"
                          placeholder="Manuel"
                          className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all"
                          value={formData.firstName}
                          onChange={(e) => handleInputChange('firstName', e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-moxinexa-dark">
                          Sobrenome *
                        </label>
                        <input
                          type="text"
                          placeholder="José"
                          className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all"
                          value={formData.lastName}
                          onChange={(e) => handleInputChange('lastName', e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-moxinexa-dark">
                          Data de Nascimento *
                        </label>
                        <input
                          type="date"
                          className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all"
                          value={formData.birthDate}
                          onChange={(e) => handleInputChange('birthDate', e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-moxinexa-dark">
                          Género *
                        </label>
                        <div className="flex gap-6 mt-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="radio" 
                              name="gender" 
                              value="M" 
                              className="text-moxinexa-teal focus:ring-moxinexa-teal" 
                              checked={formData.gender === 'M'}
                              onChange={(e) => handleInputChange('gender', e.target.value)}
                              required 
                            />
                            <span>Masculino</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="radio" 
                              name="gender" 
                              value="F" 
                              className="text-moxinexa-teal focus:ring-moxinexa-teal" 
                              checked={formData.gender === 'F'}
                              onChange={(e) => handleInputChange('gender', e.target.value)}
                              required 
                            />
                            <span>Feminino</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-moxinexa-dark">
                        Nº do Bilhete de Identidade *
                      </label>
                      <input
                        type="text"
                        placeholder="004568923LA049"
                        className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all"
                        value={formData.idNumber}
                        onChange={(e) => handleInputChange('idNumber', e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-moxinexa-dark">
                        NIF (copiamos o BI se vazio)
                      </label>
                      <input
                        type="text"
                        placeholder="Repete o BI para menores"
                        className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all"
                        value={formData.nif}
                        onChange={(e) => handleInputChange('nif', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-moxinexa-dark">
                        Foto
                      </label>
                      <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-8 cursor-pointer transition-all duration-200 hover:border-moxinexa-teal hover:bg-blue-25">
                        <AcademicCapIcon className="w-8 h-8 text-gray-400 mb-3" />
                        <p className="text-sm text-gray-600 text-center">
                          Clique para enviar ou arraste e solte
                          <br />
                          <span className="text-xs text-gray-500">PNG, JPG até 5MB</span>
                        </p>
                        <p className="text-xs text-moxinexa-teal font-medium mt-2">{fileName}</p>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleFileUpload}
                        />
                      </label>
                    </div>
                  </div>
                )}

                {/* Passo 2: Contactos */}
                {currentStep === 2 && (
                  <div className="space-y-6 animate-fadeIn">
                    <div>
                      <h2 className="text-xl font-semibold text-moxinexa-dark mb-2">
                        Contactos
                      </h2>
                      <p className="text-moxinexa-gray text-sm">
                        Informações de contacto do estudante
                      </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-moxinexa-dark">
                          Email *
                        </label>
                        <input
                          type="email"
                          placeholder="manuel.jose@escola.co.ao"
                          className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all"
                          value={formData.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-moxinexa-dark">
                          Telefone *
                        </label>
                        <input
                          type="tel"
                          placeholder="+244 923 456 789"
                          className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all"
                          value={formData.phone}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-moxinexa-dark">
                        Endereço *
                      </label>
                      <input
                        type="text"
                        placeholder="Rua da Independência, nº 45 - Cazenga, Luanda"
                        className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all"
                        value={formData.address}
                        onChange={(e) => handleInputChange('address', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Passo 3: Encarregado */}
                {currentStep === 3 && (
                  <div className="space-y-6 animate-fadeIn">
                    <div>
                      <h2 className="text-xl font-semibold text-moxinexa-dark mb-2">
                        Encarregado de Educação
                      </h2>
                      <p className="text-moxinexa-gray text-sm">
                        Informações do responsável pelo estudante
                      </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-moxinexa-dark">
                          Nome do Encarregado *
                        </label>
                        <input
                          type="text"
                          placeholder="António Manuel"
                          className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all"
                          value={formData.guardianName}
                          onChange={(e) => handleInputChange('guardianName', e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-moxinexa-dark">
                          Contacto do Encarregado *
                        </label>
                        <input
                          type="tel"
                          placeholder="+244 912 123 456"
                          className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all"
                          value={formData.guardianPhone}
                          onChange={(e) => handleInputChange('guardianPhone', e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-moxinexa-dark">
                        Email do Encarregado
                      </label>
                      <input
                        type="email"
                        placeholder="encarregado@exemplo.co.ao"
                        className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all"
                        value={formData.guardianEmail}
                        onChange={(e) => handleInputChange('guardianEmail', e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Passos Acadêmicos e Acesso removidos deste fluxo (fazem parte da Matrícula) */}

                {/* Navigation Buttons */}
                <div className="flex justify-between pt-6 border-t border-gray-200">
                  <Button
                    type="button"
                    onClick={prevStep}
                    disabled={currentStep === 1 || isSubmitting}
                    variant="outline"
                    tone="gray"
                  >
                    Voltar
                  </Button>

                  {currentStep < 3 ? (
                    <Button
                      type="button"
                      onClick={nextStep}
                      disabled={!canProceedToNextStep() || isSubmitting}
                      tone="teal"
                    >
                      Continuar
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      disabled={isSubmitting || !canProceedToNextStep()}
                      tone="green"
                      size="lg"
                      className="px-8"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Adicionando Estudante...
                        </>
                      ) : (
                        <>
                          <UserPlusIcon className="w-5 h-5" />
                          Adicionar Estudante
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </form>
            </div>

            {/* Quick Tips */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
              <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <InformationCircleIcon className="w-5 h-5" />
                Dicas Rápidas
              </h3>
              <ul className="text-blue-800 text-sm space-y-2">
                <li>• Certifique-se que todas as informações estão correctas antes de submeter</li>
                <li>• Dados pessoais e do encarregado são permanentes</li>
                <li>• A matrícula é feita depois, com número gerado automaticamente</li>
                <li>• O estudante receberá as credenciais de acesso por email após a matrícula</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === "list" && (
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-moxinexa-dark">
                  Lista de Estudantes
                </h2>
                <p className="text-moxinexa-gray text-sm">
                  Todos os estudantes cadastrados no sistema
                </p>
              </div>
              <Button tone="teal" size="sm">
                <UserPlusIcon className="w-4 h-4" />
                Exportar Lista
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-moxinexa-dark">
                    <th className="px-4 py-3 text-left font-semibold rounded-l-lg">Nº Documento</th>
                    <th className="px-4 py-3 text-left font-semibold">Nome</th>
                    <th className="px-4 py-3 text-left font-semibold">Email</th>
                    <th className="px-4 py-3 text-left font-semibold rounded-r-lg">Telefone</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-4 py-3">004568923LA049</td>
                    <td className="px-4 py-3 font-medium">Manuel José</td>
                    <td className="px-4 py-3">manuel.jose@escola.co.ao</td>
                    <td className="px-4 py-3">+244 923 456 789</td>
                  </tr>
                  <tr className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-4 py-3">004568923LA050</td>
                    <td className="px-4 py-3 font-medium">Maria António</td>
                    <td className="px-4 py-3">maria.antonio@escola.co.ao</td>
                    <td className="px-4 py-3">+244 912 123 456</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-gray-500 text-xs mt-10 pt-4 border-t border-gray-200">
          Moxi Nexa • Criamos sistemas que escalam • © 2025
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        .hover\:bg-blue-25:hover {
          background-color: rgb(240 249 255);
        }
      `}</style>
    </div>
  );
}
