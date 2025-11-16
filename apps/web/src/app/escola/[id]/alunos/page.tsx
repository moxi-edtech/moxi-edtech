"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

export default function AlunosPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"add" | "list">("add");
  const [fileName, setFileName] = useState<string>("Nenhum ficheiro selecionado");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFileName(e.target.files[0].name);
      // Feedback visual
      const label = e.target.parentElement;
      if (label) {
        label.classList.add("border-emerald-500", "bg-emerald-50");
        setTimeout(() => {
          label.classList.remove("border-emerald-500", "bg-emerald-50");
        }, 1000);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulação de envio
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsSubmitting(false);
    setSubmitSuccess(true);
    
    // Reset após 3 segundos
    setTimeout(() => {
      setSubmitSuccess(false);
      setCurrentStep(1);
    }, 3000);
  };

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  // Indicador de progresso
  const ProgressBar = () => (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700">
          Passo {currentStep} de {totalSteps}
        </span>
        <span className="text-xs text-emerald-600 font-medium">
          {currentStep === 1 && "Informações Pessoais"}
          {currentStep === 2 && "Contactos"}
          {currentStep === 3 && "Encarregado"}
          {currentStep === 4 && "Informações Académicas"}
          {currentStep === 5 && "Acesso"}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-emerald-600 h-2 rounded-full transition-all duration-500 ease-in-out"
          style={{ width: `${(currentStep / totalSteps) * 100}%` }}
        ></div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-emerald-600 transition-colors duration-200"
          >
            ← Voltar
          </button>
          <h1 className="text-2xl font-bold text-[#0B2C45]">
            Gestão de Estudantes
          </h1>
        </div>
        <div className="text-sm text-gray-500">
          Início <span className="mx-1">/</span>{" "}
          <span className="text-emerald-600 font-medium">Estudantes</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          className={`px-4 py-2 text-sm font-medium transition-colors duration-200 ${
            activeTab === "add"
              ? "text-emerald-600 border-b-2 border-emerald-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("add")}
        >
          Adicionar Estudante
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium transition-colors duration-200 ${
            activeTab === "list"
              ? "text-emerald-600 border-b-2 border-emerald-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("list")}
        >
          Lista de Estudantes
        </button>
      </div>

      {/* Conteúdo */}
      {activeTab === "add" && (
        <div className="bg-white rounded-lg shadow p-6 transition-all duration-300">
          <h2 className="text-lg font-semibold text-[#0B2C45] mb-4">
            Adicionar Novo Estudante
          </h2>
          
          {/* Alert de sucesso */}
          {submitSuccess && (
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3 animate-fade-in">
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-emerald-800">Estudante adicionado com sucesso!</p>
                <p className="text-sm text-emerald-600">Os dados foram guardados no sistema.</p>
              </div>
            </div>
          )}

          <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 text-sm text-gray-700 mb-6 rounded">
            <p className="font-medium">💡 Lembre-se</p>
            <p>Crie a <strong>Turma</strong> e a <strong>Seção</strong> antes de cadastrar o estudante.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <ProgressBar />

            {/* Passo 1: Informações Pessoais */}
            {currentStep === 1 && (
              <div className="animate-fade-in">
                <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full text-sm flex items-center justify-center">1</span>
                  Informações Pessoais
                </h3>
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Primeiro Nome*</label>
                      <input
                        type="text"
                        placeholder="Manuel"
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Sobrenome*</label>
                      <input
                        type="text"
                        placeholder="José"
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Data de Nascimento*</label>
                      <input
                        type="date"
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Género*</label>
                      <div className="flex gap-6 mt-2 text-sm">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="gender" value="M" className="text-emerald-600 focus:ring-emerald-500" required />
                          <span>Masculino</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="gender" value="F" className="text-emerald-600 focus:ring-emerald-500" required />
                          <span>Feminino</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Nº do Bilhete de Identidade*</label>
                    <input
                      type="text"
                      placeholder="004568923LA049"
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Foto</label>
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-8 cursor-pointer transition-all duration-200 hover:border-emerald-400 hover:bg-emerald-25">
                      <svg className="w-8 h-8 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <p className="text-sm text-gray-600 text-center">
                        Clique para enviar ou arraste e solte
                        <br />
                        <span className="text-xs text-gray-500">PNG, JPG até 5MB</span>
                      </p>
                      <p className="text-xs text-emerald-600 font-medium mt-2">{fileName}</p>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Passo 2: Contactos */}
            {currentStep === 2 && (
              <div className="animate-fade-in">
                <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full text-sm flex items-center justify-center">2</span>
                  Contactos
                </h3>
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Email*</label>
                      <input
                        type="email"
                        placeholder="manuel.jose@escola.co.ao"
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Telefone*</label>
                      <input
                        type="tel"
                        placeholder="+244 923 456 789"
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Endereço*</label>
                    <input
                      type="text"
                      placeholder="Rua da Independência, nº 45 - Cazenga, Luanda"
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Passo 3: Encarregado */}
            {currentStep === 3 && (
              <div className="animate-fade-in">
                <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full text-sm flex items-center justify-center">3</span>
                  Encarregado de Educação
                </h3>
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Nome do Encarregado*</label>
                      <input
                        type="text"
                        placeholder="António Manuel"
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Contacto do Encarregado*</label>
                      <input
                        type="tel"
                        placeholder="+244 912 123 456"
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Email do Encarregado</label>
                    <input
                      type="email"
                      placeholder="encarregado@exemplo.co.ao"
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Passo 4: Académico */}
            {currentStep === 4 && (
              <div className="animate-fade-in">
                <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full text-sm flex items-center justify-center">4</span>
                  Informações Académicas
                </h3>
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Atribuir à Turma*</label>
                      <select className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" required>
                        <option value="">Selecione...</option>
                        <option>10ª A</option>
                        <option>11ª B</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Atribuir à Seção*</label>
                      <select className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" required>
                        <option value="">Selecione...</option>
                        <option>Seção A</option>
                        <option>Seção B</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Número de Matrícula*</label>
                    <input
                      type="text"
                      placeholder="2025-000123"
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Passo 5: Acesso */}
            {currentStep === 5 && (
              <div className="animate-fade-in">
                <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full text-sm flex items-center justify-center">5</span>
                  Acesso à Plataforma
                </h3>
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Senha*</label>
                      <input
                        type="password"
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Confirmar Senha*</label>
                      <input
                        type="password"
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        required
                      />
                    </div>
                  </div>
                  <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                    <p className="text-sm text-blue-700">
                      <strong>Dica:</strong> A senha deve ter pelo menos 8 caracteres, incluindo letras e números.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Navegação entre passos */}
            <div className="flex justify-between pt-6 border-t">
              <Button type="button" onClick={prevStep} disabled={currentStep === 1} variant="outline" tone="gray" size="sm">
                ← Anterior
              </Button>

              {currentStep < totalSteps ? (
                <Button type="button" onClick={nextStep} tone="emerald" size="sm" className="gap-2">
                  Próximo
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Button>
              ) : (
                <Button type="submit" disabled={isSubmitting} tone="emerald" size="sm" className="gap-2">
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      A processar...
                    </>
                  ) : (
                    <>
                      Adicionar Estudante
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </>
                  )}
                </Button>
              )}
            </div>
          </form>
        </div>
      )}

      {activeTab === "list" && (
        <div className="bg-white rounded-lg shadow p-6 transition-all duration-300">
          <h2 className="text-lg font-semibold text-[#0B2C45] mb-4">
            Lista de Estudantes
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 text-[#0B2C45]">
                  <th className="px-4 py-3 text-left font-semibold">Nº Documento</th>
                  <th className="px-4 py-3 text-left font-semibold">Nome</th>
                  <th className="px-4 py-3 text-left font-semibold">Email</th>
                  <th className="px-4 py-3 text-left font-semibold">Telefone</th>
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-gray-50 transition-colors duration-150">
                  <td className="px-4 py-3 border-t">004568923LA049</td>
                  <td className="px-4 py-3 border-t">Manuel José</td>
                  <td className="px-4 py-3 border-t">manuel.jose@escola.co.ao</td>
                  <td className="px-4 py-3 border-t">+244 923 456 789</td>
                </tr>
                <tr className="hover:bg-gray-50 transition-colors duration-150">
                  <td className="px-4 py-3 border-t">004568923LA050</td>
                  <td className="px-4 py-3 border-t">Maria António</td>
                  <td className="px-4 py-3 border-t">maria.antonio@escola.co.ao</td>
                  <td className="px-4 py-3 border-t">+244 912 123 456</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-gray-500 text-xs mt-10 border-t pt-4">
        Moxi Nexa • Criamos sistemas que escalam • © 2025
      </div>

      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {x
          animation: fade-in 0.3s ease-out;
        }
        .hover\:bg-emerald-25:hover {
          background-color: rgb(240 253 250);
        }
      `}</style>
    </div>
  );
}
