"use client";

import { useState } from "react";
import { Calendar, BookOpen, Users, GraduationCap, CheckCircle2 } from "lucide-react";

// Importar os componentes - ajuste os caminhos conforme sua estrutura
import SessaoAcademicaStep from "./SessaoAcademicaStep";
import PeriodosAcademicosStep from "./PeriodosAcademicosStep";
import CursosStep from "./CursosStep";
import ClassesStep from "./ClassesStep";
import DisciplinasStep from "./DisciplinasStep";

// Usar SEUS tipos
import type { AcademicSession, Semester, Course, Class, Discipline } from "@/types/academico.types";

type Props = {
  escolaId: string;
  // Dados carregados da sua página atual
  sessoes: AcademicSession[];
  sessaoAtiva: AcademicSession | null;
  periodos: Semester[];
  cursos: Course[];
  classes: Class[];
  disciplinas: Discipline[];
  // Callbacks para atualizar estado na página pai
  onSessaoAtualizada: (sessao: AcademicSession | null) => void;
  onSessoesAtualizadas: (sessoes: AcademicSession[]) => void;
  onPeriodosAtualizados: (periodos: Semester[]) => void;
  onCursosAtualizados: (cursos: Course[]) => void;
  onClassesAtualizadas: (classes: Class[]) => void;
  onDisciplinasAtualizadas: (disciplinas: Discipline[]) => void;
  onComplete?: () => void;
  onClose?: () => void;
};

export default function AcademicSetupWizard({
  escolaId,
  sessoes,
  sessaoAtiva,
  periodos,
  cursos,
  classes,
  disciplinas,
  onSessaoAtualizada,
  onSessoesAtualizadas,
  onPeriodosAtualizados,
  onCursosAtualizados,
  onClassesAtualizadas,
  onDisciplinasAtualizadas,
  onComplete,
  onClose
}: Props) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const totalSteps = 5;

  const handleCompleteSetup = async () => {
    setIsSubmitting(true);

    try {
      // Finaliza onboarding no backend (marca onboarding_finalizado = true)
      const res = await fetch(`/api/escolas/${escolaId}/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Campos são opcionais no schema; enviamos apenas o necessário
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || 'Falha ao finalizar onboarding.');
      }

      // Opcionalmente poderíamos redirecionar para dashboard usando nextPath do backend
      // mas aqui mantemos o fluxo da página pai e apenas sinalizamos conclusão.
      if (onComplete) onComplete();
    } catch (error) {
      console.error('Erro ao finalizar configuração:', error);
      // Mantemos o estado do wizard e deixamos o usuário tentar novamente
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Navegar para qualquer passo
  const jumpToStep = (step: number) => {
    if (step >= 1 && step <= totalSteps) {
      setCurrentStep(step);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Verificar se pode avançar
  const canProceed = () => {
    switch (currentStep) {
      case 1: return !!sessaoAtiva;
      case 2: return periodos.length > 0;
      case 3: return true; // Cursos são opcionais
      case 4: return classes.length > 0;
      // No passo 5 (Disciplinas), permitir concluir mesmo sem disciplinas,
      // desde que as classes (passo anterior, obrigatório) estejam configuradas.
      // Disciplinas podem ser adicionadas depois.
      case 5: return disciplinas.length > 0 || classes.length > 0;
      default: return false;
    }
  };

  // Verificar se um passo está completo
  const isStepComplete = (step: number) => {
    switch (step) {
      case 1: return !!sessaoAtiva;
      case 2: return periodos.length > 0;
      case 3: return cursos.length > 0; // Opcional, mas marcamos como completo se tiver cursos
      case 4: return classes.length > 0;
      case 5: return disciplinas.length > 0;
      default: return false;
    }
  };

  // Barra de progresso
  const ProgressBar = () => (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm font-medium text-gray-700">
          Passo {currentStep} de {totalSteps}
        </span>
        <span className="text-xs text-emerald-600 font-medium">
          {currentStep === 1 && "Sessão Acadêmica"}
          {currentStep === 2 && "Períodos Acadêmicos"}
          {currentStep === 3 && "Cursos (Opcional)"}
          {currentStep === 4 && "Classes"}
          {currentStep === 5 && "Disciplinas"}
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

  // Navegação rápida entre passos
  const StepNavigation = () => (
    <div className="flex justify-between mb-8">
      {[1, 2, 3, 4, 5].map((step) => (
        <button
          key={step}
          onClick={() => jumpToStep(step)}
          className={`flex flex-col items-center flex-1 mx-1 p-3 rounded-lg border transition-all duration-200 ${
            step === currentStep 
              ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
              : isStepComplete(step)
              ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
              : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'
          }`}
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium mb-2 ${
            step === currentStep 
              ? 'bg-emerald-600 text-white' 
              : isStepComplete(step)
              ? 'bg-green-500 text-white'
              : 'bg-gray-300 text-gray-600'
          }`}>
            {isStepComplete(step) ? <CheckCircle2 className="w-4 h-4" /> : step}
          </div>
          <span className="text-xs font-medium text-center">
            {step === 1 && 'Sessão\nAcadêmica'}
            {step === 2 && 'Períodos\nAcadêmicos'}
            {step === 3 && 'Cursos\n(Opcional)'}
            {step === 4 && 'Classes'}
            {step === 5 && 'Disciplinas'}
          </span>
        </button>
      ))}
    </div>
  );

  // Resumo do progresso atual
  const ProgressSummary = () => (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <h4 className="font-medium text-blue-900 mb-3">Progresso da Configuração</h4>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
        <div className={`text-center p-2 rounded ${
          isStepComplete(1) ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
        }`}>
          <Calendar className="w-4 h-4 mx-auto mb-1" />
          <div>Sessão</div>
          <div className="text-xs">{sessaoAtiva ? '✓' : '⏳'}</div>
        </div>
        
        <div className={`text-center p-2 rounded ${
          isStepComplete(2) ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
        }`}>
          <BookOpen className="w-4 h-4 mx-auto mb-1" />
          <div>Períodos</div>
          <div className="text-xs">{periodos.length > 0 ? `${periodos.length}✓` : '⏳'}</div>
        </div>
        
        <div className={`text-center p-2 rounded ${
          isStepComplete(3) ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
        }`}>
          <GraduationCap className="w-4 h-4 mx-auto mb-1" />
          <div>Cursos</div>
          <div className="text-xs">{cursos.length > 0 ? `${cursos.length}✓` : '⚡'}</div>
        </div>
        
        <div className={`text-center p-2 rounded ${
          isStepComplete(4) ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
        }`}>
          <Users className="w-4 h-4 mx-auto mb-1" />
          <div>Classes</div>
          <div className="text-xs">{classes.length > 0 ? `${classes.length}✓` : '⏳'}</div>
        </div>
        
        <div className={`text-center p-2 rounded ${
          isStepComplete(5) ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
        }`}>
          <CheckCircle2 className="w-4 h-4 mx-auto mb-1" />
          <div>Disciplinas</div>
          <div className="text-xs">{disciplinas.length > 0 ? `${disciplinas.length}✓` : '⏳'}</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-lg border shadow-sm">
      {/* Header */}
      <div className="flex justify-between items-center p-6 border-b bg-gradient-to-r from-blue-50 to-emerald-50">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Configuração Acadêmica Guiada</h2>
          <p className="text-gray-600 mt-1">
            Siga os passos para configurar toda a estrutura acadêmica da sua escola
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-full hover:bg-white"
            title="Fechar configuração guiada"
          >
            ✕
          </button>
        )}
      </div>
      
      {/* Conteúdo */}
      <div className="p-6">
        <ProgressBar />
        <StepNavigation />
        <ProgressSummary />

        <div className="animate-fade-in">
          {/* Passo 1: Sessão Acadêmica */}
          {currentStep === 1 && (
            <div>
              <div className="flex items-center gap-3 mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <Calendar className="w-6 h-6 text-blue-600" />
                <div>
                  <h3 className="font-semibold text-blue-900">Sessão Acadêmica</h3>
                  <p className="text-sm text-blue-700">
                    Configure o ano letivo atual da sua escola
                  </p>
                </div>
              </div>
              
              <SessaoAcademicaStep
                escolaId={escolaId}
                sessoes={sessoes}
                sessaoAtiva={sessaoAtiva}
                onSessaoAtualizada={onSessaoAtualizada}
                onSessoesAtualizadas={onSessoesAtualizadas}
              />
            </div>
          )}

          {/* Passo 2: Períodos Acadêmicos */}
          {currentStep === 2 && (
            <div>
              <div className="flex items-center gap-3 mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
                <BookOpen className="w-6 h-6 text-green-600" />
                <div>
                  <h3 className="font-semibold text-green-900">Períodos Acadêmicos</h3>
                  <p className="text-sm text-green-700">
                    Divida o ano letivo em trimestres, bimestres ou semestres
                  </p>
                </div>
              </div>

              <PeriodosAcademicosStep
                escolaId={escolaId}
                sessaoAtiva={sessaoAtiva}
                periodos={periodos}
                onPeriodosAtualizados={onPeriodosAtualizados}
              />
            </div>
          )}

          {/* Passo 3: Cursos */}
          {currentStep === 3 && (
            <div>
              <div className="flex items-center gap-3 mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                <GraduationCap className="w-6 h-6 text-purple-600" />
                <div>
                  <h3 className="font-semibold text-purple-900">Cursos (Opcional)</h3>
                  <p className="text-sm text-purple-700">
                    Configure cursos específicos para o 2º ciclo do ensino secundário
                  </p>
                </div>
              </div>

              <CursosStep
                escolaId={escolaId}
                sessaoAtiva={sessaoAtiva}
                cursos={cursos}
                onCursosAtualizados={onCursosAtualizados}
              />
            </div>
          )}

          {/* Passo 4: Classes */}
          {currentStep === 4 && (
            <div>
              <div className="flex items-center gap-3 mb-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
                <Users className="w-6 h-6 text-orange-600" />
                <div>
                  <h3 className="font-semibold text-orange-900">Classes</h3>
                  <p className="text-sm text-orange-700">
                    Crie as classes/turmas da sua escola de acordo com o sistema angolano
                  </p>
                </div>
              </div>

              <ClassesStep
                escolaId={escolaId}
                classes={classes}
                onClassesAtualizadas={onClassesAtualizadas}
              />
            </div>
          )}

          {/* Passo 5: Disciplinas */}
          {currentStep === 5 && (
            <div>
              <div className="flex items-center gap-3 mb-6 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                <div>
                  <h3 className="font-semibold text-emerald-900">Disciplinas</h3>
                  <p className="text-sm text-emerald-700">
                    Cadastre as disciplinas oferecidas em cada classe
                  </p>
                </div>
              </div>

              <DisciplinasStep
                escolaId={escolaId}
                cursos={cursos}
                classes={classes}
                disciplinas={disciplinas}
                onDisciplinasAtualizadas={onDisciplinasAtualizadas}
              />
            </div>
          )}
        </div>

        {/* Navegação entre passos */}
        <div className="flex justify-between items-center pt-8 border-t mt-8">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={prevStep}
              disabled={currentStep === 1}
              className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                currentStep === 1 
                  ? "text-gray-400 cursor-not-allowed" 
                  : "text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-300"
              }`}
            >
              ← Voltar
            </button>

            {/* Indicador de passo atual */}
            <span className="text-sm text-gray-500">
              Passo {currentStep} de {totalSteps}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Pular configuração (apenas se não for o último passo) */}
            {currentStep < totalSteps && (
              <button
                type="button"
                onClick={nextStep}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm transition-colors"
              >
                Pular este passo →
              </button>
            )}

            {currentStep < totalSteps ? (
              <button
                type="button"
                onClick={nextStep}
                disabled={!canProceed()}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all duration-200 flex items-center gap-2"
              >
                Próximo Passo
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCompleteSetup}
                disabled={isSubmitting || !canProceed()}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all duration-200 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Finalizando...
                  </>
                ) : (
                  <>
                    Concluir Configuração
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Ajuda rápida */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
          <p className="text-sm text-gray-600 text-center">
            💡 <strong>Dica:</strong> Você pode navegar livremente entre os passos usando os botões acima. 
            Seu progresso é salvo automaticamente.
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
