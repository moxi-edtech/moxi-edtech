"use client";

import React, { useEffect, useMemo, useReducer, useState } from "react";

// ------------------------------------------------------
// Moxi – Configuração de Avaliações (React + Tailwind)
// - Sistema de multi-passos com 5 etapas
// - Animações suaves e feedback visual aprimorado
// - Design consistente com SVG e estados interativos
// ------------------------------------------------------

// Tipos
type Escala = { tipo: "10" | "20" | "custom"; max: number; aprov: number; dec: 0 | 1 | 2 };
type Regra = { ini: number; fim: number; conceito?: string; pontos?: number };
type Pesos = { prova: number; trabalho: number; part: number; exame: number };
type Aplicacao = { nivel: string; turma: string; disc: string; periodo: string; escala: string; aprov: number };
type Sistema = { id: string; nome: string; escala: string; aprov: number; regras: number; vinculos: number; criado: string };

type State = {
  escala: Escala;
  regras: Regra[];
  pesos: Pesos;
  aplicacoes: Aplicacao[];
  sistemas: Sistema[];
};

const initialState: State = {
  escala: { tipo: "20", max: 20, aprov: 10, dec: 1 },
  regras: [],
  pesos: { prova: 70, trabalho: 20, part: 10, exame: 0 },
  aplicacoes: [],
  sistemas: [],
};

type Action =
  | { type: "SET_ESCALA"; payload: Escala }
  | { type: "ADD_REGRA"; payload: Regra }
  | { type: "UPDATE_REGRA"; index: number; payload: Partial<Regra> }
  | { type: "REMOVE_REGRA"; index: number }
  | { type: "SET_PESOS"; payload: Pesos }
  | { type: "ADD_APLICACAO"; payload: Aplicacao }
  | { type: "REMOVE_APLICACAO"; index: number }
  | { type: "ADD_SISTEMA"; payload: Sistema }
  | { type: "REMOVE_SISTEMA"; id: string }
  | { type: "HYDRATE"; payload: Partial<State> };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_ESCALA":
      return { ...state, escala: action.payload };
    case "ADD_REGRA":
      return { ...state, regras: [...state.regras, action.payload] };
    case "UPDATE_REGRA": {
      const regras = [...state.regras];
      regras[action.index] = { ...regras[action.index], ...action.payload };
      return { ...state, regras };
    }
    case "REMOVE_REGRA": {
      const regras = state.regras.filter((_, i) => i !== action.index);
      return { ...state, regras };
    }
    case "SET_PESOS":
      return { ...state, pesos: action.payload };
    case "ADD_APLICACAO":
      return { ...state, aplicacoes: [...state.aplicacoes, action.payload] };
    case "REMOVE_APLICACAO": {
      const aplicacoes = state.aplicacoes.filter((_, i) => i !== action.index);
      return { ...state, aplicacoes };
    }
    case "ADD_SISTEMA":
      return { ...state, sistemas: [action.payload, ...state.sistemas] };
    case "REMOVE_SISTEMA":
      return { ...state, sistemas: state.sistemas.filter(s => s.id !== action.id) };
    case "HYDRATE":
      return { ...state, ...action.payload } as State;
    default:
      return state;
  }
}

// Toast simples
type Toast = { id: string; title: string; desc?: string; tone?: "success" | "error" | "info" };

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = (t: Omit<Toast, "id">) => {
    const toast = { ...t, id: crypto.randomUUID() };
    setToasts(prev => [...prev, toast]);
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== toast.id)), 3500);
  };
  const remove = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));
  return { toasts, push, remove };
}

// Utils
const fmtPct = (n: number) => `${n}%`;
const badge = "rounded-full text-xs px-2.5 py-1 font-medium";

// SVG Icons para substituir Font Awesome
const SvgIcons = {
  plus: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1V15M1 8H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  trash: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2 4H14M5 4V3C5 2.44772 5.44772 2 6 2H10C10.5523 2 11 2.44772 11 3V4M13 4V13C13 13.5523 12.5523 14 12 14H4C3.44772 14 3 13.5523 3 13V4H13Z" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
  check: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M13 4L6 12L3 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  clone: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M11 1H3C2.44772 1 2 1.44772 2 2V10C2 10.5523 2.44772 11 3 11H11C11.5523 11 12 10.5523 12 10V2C12 1.44772 11.5523 1 11 1Z" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M5 5H13C13.5523 5 14 5.44772 14 6V14C14 14.5523 13.5523 15 13 15H5C4.44772 15 4 14.5523 4 14V6C4 5.44772 4.44772 5 5 5Z" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
  arrowLeft: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  arrowRight: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  checkCircle: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18Z" stroke="currentColor" strokeWidth="2"/>
      <path d="M7 10L9 12L13 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  info: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18Z" stroke="currentColor" strokeWidth="2"/>
      <path d="M10 14V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M10 6H10.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  error: () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18Z" stroke="currentColor" strokeWidth="2"/>
      <path d="M10 6V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M10 14H10.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  close: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  loading: () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="animate-spin">
      <path d="M8 1.5V4M8 12V14.5M3.5 8H1.5M14.5 8H12M12.8038 3.19617L11.0962 4.90383M4.90383 11.0962L3.19617 12.8038M12.8038 12.8038L11.0962 11.0962M4.90383 4.90383L3.19617 3.19617" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
};

// Shared UI Components
const Card: React.FC<React.PropsWithChildren<{ title: string; subtitle?: string; className?: string }>> = ({ title, subtitle, children, className }) => (
  <section className={`bg-white rounded-2xl shadow-[0_8px_30px_rgba(16,24,40,.08)] p-5 transition-all duration-300 hover:shadow-[0_12px_40px_rgba(16,24,40,.12)] ${className || ''}`}>
    <h2 className="text-base font-semibold mb-1 text-moxinexa-dark">{title}</h2>
    {subtitle && <p className="text-sm text-moxinexa-gray mb-3">{subtitle}</p>}
    {children}
  </section>
);

// Progress Bar Component
const ProgressBar: React.FC<{ currentStep: number; totalSteps: number }> = ({ currentStep, totalSteps }) => {
  const progress = (currentStep / totalSteps) * 100;
  
  return (
    <div className="w-full bg-slate-100 rounded-full h-2 mb-6 overflow-hidden">
      <div 
        className="bg-moxinexa-teal h-full rounded-full transition-all duration-500 ease-out"
        style={{ width: `${progress}%` }}
      ></div>
    </div>
  );
};

// Step Navigation Buttons
const StepNavigation: React.FC<{
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onBack: () => void;
  onSubmit?: () => void;
  isSubmitting?: boolean;
  isValid?: boolean;
}> = ({ currentStep, totalSteps, onNext, onBack, onSubmit, isSubmitting = false, isValid = true }) => {
  const isLastStep = currentStep === totalSteps;
  
  return (
    <div className="flex justify-between mt-8 pt-6 border-t border-slate-100">
      <button
        onClick={onBack}
        disabled={currentStep === 1}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-200 ${
          currentStep === 1 
            ? 'border-slate-200 text-slate-400 cursor-not-allowed' 
            : 'border-moxinexa-navy/20 text-moxinexa-navy hover:bg-moxinexa-navy/5 hover:border-moxinexa-navy/30'
        }`}
      >
        <SvgIcons.arrowLeft />
        <span>Voltar</span>
      </button>
      
      {isLastStep ? (
        <button
          onClick={onSubmit}
          disabled={!isValid || isSubmitting}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all duration-200 ${
            !isValid || isSubmitting
              ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
              : 'bg-moxinexa-teal text-white hover:bg-moxinexa-teal/90 shadow-md hover:shadow-lg'
          }`}
        >
          {isSubmitting ? (
            <>
              <SvgIcons.loading />
              <span>Salvando...</span>
            </>
          ) : (
            <>
              <SvgIcons.check />
              <span>Salvar Sistema</span>
            </>
          )}
        </button>
      ) : (
        <button
          onClick={onNext}
          disabled={!isValid}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all duration-200 ${
            !isValid
              ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
              : 'bg-moxinexa-navy text-white hover:bg-moxinexa-navy/90 shadow-md hover:shadow-lg'
          }`}
        >
          <span>Avançar</span>
          <SvgIcons.arrowRight />
        </button>
      )}
    </div>
  );
};

export default function MoxiConfiguracaoAvaliacoes() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { toasts, push, remove } = useToasts();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    escala: initialState.escala,
    regras: initialState.regras,
    pesos: initialState.pesos,
    aplicacoes: initialState.aplicacoes
  });

  // Persistência local
  useEffect(() => {
    try {
      const raw = localStorage.getItem("moxi_avaliacoes_state");
      if (raw) {
        const savedState = JSON.parse(raw);
        dispatch({ type: "HYDRATE", payload: savedState });
        setFormData({
          escala: savedState.escala || initialState.escala,
          regras: savedState.regras || initialState.regras,
          pesos: savedState.pesos || initialState.pesos,
          aplicacoes: savedState.aplicacoes || initialState.aplicacoes
        });
      }
    } catch {}
  }, []);
  
  useEffect(() => {
    try {
      localStorage.setItem("moxi_avaliacoes_state", JSON.stringify(state));
    } catch {}
  }, [state]);

  // Validações
  const somaPesos = formData.pesos.prova + formData.pesos.trabalho + formData.pesos.part + formData.pesos.exame;
  const pesosValidos = somaPesos === 100;
  
  // Validação por etapa
  const stepValidations = {
    1: true, // Escala sempre válida (valores padrão)
    2: true, // Regras são opcionais
    3: pesosValidos,
    4: formData.aplicacoes.length > 0, // Pelo menos uma aplicação
    5: true  // Resumo sempre válido
  };

  // Ações
  function salvarEscala(tipo: Escala["tipo"], max?: number | string, aprov?: number | string, dec?: 0 | 1 | 2) {
    const parsedMax = tipo === "custom" ? Number(max || 0) : Number(tipo);
    const parsedAprov = Number(aprov ?? formData.escala.aprov);
    const decimals = dec ?? formData.escala.dec;
    
    if (!parsedMax || parsedMax <= 0) {
      push({ tone: "error", title: "Informe o máximo da escala." });
      return false;
    }
    
    if (parsedAprov < 0 || parsedAprov > parsedMax) {
      push({ tone: "error", title: "Nota mínima de aprovação inválida." });
      return false;
    }
    
    const nova: Escala = { tipo, max: parsedMax, aprov: parsedAprov, dec: decimals };
    setFormData(prev => ({ ...prev, escala: nova }));
    return true;
  }

  function adicionarRegra() {
    const regra: Regra = { 
      ini: Math.max(0, formData.escala.max - 2), 
      fim: formData.escala.max, 
      conceito: "A+", 
      pontos: 4.0 
    };
    setFormData(prev => ({ ...prev, regras: [...prev.regras, regra] }));
  }

  function atualizarRegra(index: number, updates: Partial<Regra>) {
    const regras = [...formData.regras];
    regras[index] = { ...regras[index], ...updates };
    setFormData(prev => ({ ...prev, regras }));
  }

  function removerRegra(index: number) {
    setFormData(prev => ({ 
      ...prev, 
      regras: prev.regras.filter((_, i) => i !== index) 
    }));
  }

  function validarESalvarPesos(next: Partial<Pesos>) {
    const p = { ...formData.pesos, ...next } as Pesos;
    const sum = p.prova + p.trabalho + p.part + p.exame;
    
    if (sum !== 100) {
      push({ tone: "error", title: `A soma deve ser 100% (atual: ${sum}%).` });
      return false;
    }
    
    setFormData(prev => ({ ...prev, pesos: p }));
    return true;
  }

  function aplicarSistema(nivel: string, turma: string, disc: string, periodo: string) {
    const apl: Aplicacao = { 
      nivel, 
      turma, 
      disc, 
      periodo, 
      escala: `0–${formData.escala.max}`, 
      aprov: formData.escala.aprov 
    };
    setFormData(prev => ({ ...prev, aplicacoes: [...prev.aplicacoes, apl] }));
    push({ tone: "success", title: "Sistema aplicado." });
  }

  function removerAplicacao(index: number) {
    setFormData(prev => ({ 
      ...prev, 
      aplicacoes: prev.aplicacoes.filter((_, i) => i !== index) 
    }));
  }

  async function criarSistema(nome?: string) {
    setIsSubmitting(true);
    
    // Simular processamento
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const n = (nome ?? "").trim() || `Sistema ${new Date().toLocaleDateString("pt-BR")}`;
    const sys: Sistema = {
      id: crypto.randomUUID(),
      nome: n,
      escala: `0–${formData.escala.max}`,
      aprov: formData.escala.aprov,
      regras: formData.regras.length,
      vinculos: formData.aplicacoes.length,
      criado: new Date().toLocaleString("pt-BR"),
    };
    
    dispatch({ type: "ADD_SISTEMA", payload: sys });
    push({ tone: "success", title: "Sistema criado", desc: n });
    setIsSubmitting(false);
    
    // Reset após sucesso
    setTimeout(() => {
      setFormData({
        escala: initialState.escala,
        regras: initialState.regras,
        pesos: initialState.pesos,
        aplicacoes: initialState.aplicacoes
      });
      setCurrentStep(1);
    }, 1000);
  }

  // Navegação entre passos
  const nextStep = () => {
    if (currentStep < 5) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = () => {
    // Aplicar todos os dados do formulário ao estado global
    dispatch({ type: "SET_ESCALA", payload: formData.escala });
    formData.regras.forEach(regra => dispatch({ type: "ADD_REGRA", payload: regra }));
    dispatch({ type: "SET_PESOS", payload: formData.pesos });
    formData.aplicacoes.forEach(apl => dispatch({ type: "ADD_APLICACAO", payload: apl }));
    
    // Criar o sistema
    criarSistema();
  };

  // UI helpers
  const Label: React.FC<React.PropsWithChildren<{ required?: boolean }>> = ({ children, required }) => (
    <label className="text-sm font-semibold mb-1 block text-moxinexa-dark">
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
  
  const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { valid?: boolean }> = ({ valid = true, ...props }) => (
    <input 
      {...props} 
      className={`w-full rounded-xl border px-3 py-2.5 outline-none transition-all duration-200 ${
        valid 
          ? 'border-slate-200 focus:border-moxinexa-teal focus:ring-4 focus:ring-moxinexa-teal/10' 
          : 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
      } ${props.className || ''}`} 
    />
  );
  
  const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { valid?: boolean }> = ({ valid = true, ...props }) => (
    <select 
      {...props} 
      className={`w-full rounded-xl border px-3 py-2.5 outline-none transition-all duration-200 ${
        valid 
          ? 'border-slate-200 focus:border-moxinexa-teal focus:ring-4 focus:ring-moxinexa-teal/10' 
          : 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
      } ${props.className || ''}`} 
    />
  );

  // Componentes de cada passo
  const Step1Escala = () => (
    <Card title="1) Escala da Escola" subtitle="Defina a escala base. Pode ser 0–10, 0–20 ou personalizada.">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label required>Tipo de Escala</Label>
          <Select
            value={formData.escala.tipo}
            onChange={(e) => salvarEscala(e.target.value as Escala["tipo"], formData.escala.max, formData.escala.aprov, formData.escala.dec)}
          >
            <option value="10">0 – 10</option>
            <option value="20">0 – 20</option>
            <option value="custom">Personalizada…</option>
          </Select>
        </div>
        {formData.escala.tipo === "custom" && (
          <div>
            <Label required>Máximo da Escala (custom)</Label>
            <Input 
              type="number" 
              min={1} 
              step={1} 
              placeholder="Ex.: 100" 
              defaultValue={formData.escala.max}
              onBlur={(e) => salvarEscala("custom", e.target.value, formData.escala.aprov, formData.escala.dec)} 
            />
          </div>
        )}
        <div>
          <Label required>Nota mínima de aprovação</Label>
          <Input 
            type="number" 
            step="0.1" 
            placeholder={formData.escala.tipo === "20" ? "Ex.: 10 (0–20)" : "Ex.: 5 (0–10)"}
            defaultValue={formData.escala.aprov}
            onBlur={(e) => salvarEscala(formData.escala.tipo, formData.escala.max, e.target.value, formData.escala.dec)} 
          />
        </div>
        <div>
          <Label>Casas decimais</Label>
          <Select 
            value={formData.escala.dec} 
            onChange={(e) => salvarEscala(formData.escala.tipo, formData.escala.max, formData.escala.aprov, Number(e.target.value) as 0|1|2)}
          >
            <option value={0}>0</option>
            <option value={1}>1</option>
            <option value={2}>2</option>
          </Select>
        </div>
      </div>
      <div className="h-px bg-slate-100 my-4" />
      <div className="flex items-center gap-3 text-sm text-moxinexa-gray">
        <span className={`${badge} bg-slate-100 text-moxinexa-dark border`}>Configurado</span> 
        Escala 0–{formData.escala.max} • Aprovação {formData.escala.aprov} • {formData.escala.dec} casa(s) decimal(is)
      </div>
    </Card>
  );

  const Step2Regras = () => (
    <Card title="2) Regras de Conversão (opcional)" subtitle="Mapeie intervalos numéricos para conceitos/letras e pontos (GPA).">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <span className="rounded-full text-xs px-3 py-1 bg-moxinexa-teal/10 text-moxinexa-teal border border-moxinexa-teal/20">Ex.: 18–20 → A+ (4.0)</span>
        <button 
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-moxinexa-navy/20 text-moxinexa-navy bg-white hover:bg-moxinexa-navy/5 transition-all duration-200"
          onClick={adicionarRegra}
        >
          <SvgIcons.plus />
          Nova regra
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-moxinexa-gray bg-slate-50">
              <th className="text-left p-3">Início</th>
              <th className="text-left p-3">Fim</th>
              <th className="text-left p-3">Conceito</th>
              <th className="text-left p-3">Pontos</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {formData.regras.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-sm text-moxinexa-gray text-center">
                  Nenhuma regra adicionada. Clique em "Nova regra" para adicionar.
                </td>
              </tr>
            )}
            {formData.regras.map((r, i) => (
              <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="p-3">
                  <Input 
                    type="number" 
                    defaultValue={r.ini} 
                    onBlur={(e) => atualizarRegra(i, { ini: Number(e.target.value) })} 
                  />
                </td>
                <td className="p-3">
                  <Input 
                    type="number" 
                    defaultValue={r.fim} 
                    onBlur={(e) => atualizarRegra(i, { fim: Number(e.target.value) })} 
                  />
                </td>
                <td className="p-3">
                  <Input 
                    type="text" 
                    placeholder="Ex: A+" 
                    defaultValue={r.conceito} 
                    onBlur={(e) => atualizarRegra(i, { conceito: e.target.value })} 
                  />
                </td>
                <td className="p-3">
                  <Input 
                    type="number" 
                    step="0.1" 
                    placeholder="Ex: 4.0" 
                    defaultValue={r.pontos} 
                    onBlur={(e) => atualizarRegra(i, { pontos: Number(e.target.value) })} 
                  />
                </td>
                <td className="p-3">
                  <button 
                    className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                    onClick={() => removerRegra(i)}
                  >
                    <SvgIcons.trash />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );

  const Step3Pesos = () => (
    <Card title="3) Pesos por Tipo de Avaliação" subtitle="Configure pesos globais. Você poderá ajustar por disciplina se quiser.">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label required>Provas (%)</Label>
          <Input 
            type="number" 
            min={0} 
            max={100} 
            defaultValue={formData.pesos.prova} 
            valid={pesosValidos}
            onBlur={(e) => validarESalvarPesos({ prova: Number(e.target.value) })} 
          />
        </div>
        <div>
          <Label required>Trabalhos (%)</Label>
          <Input 
            type="number" 
            min={0} 
            max={100} 
            defaultValue={formData.pesos.trabalho} 
            valid={pesosValidos}
            onBlur={(e) => validarESalvarPesos({ trabalho: Number(e.target.value) })} 
          />
        </div>
        <div>
          <Label required>Participação (%)</Label>
          <Input 
            type="number" 
            min={0} 
            max={100} 
            defaultValue={formData.pesos.part} 
            valid={pesosValidos}
            onBlur={(e) => validarESalvarPesos({ part: Number(e.target.value) })} 
          />
        </div>
        <div>
          <Label required>Exame Final (%)</Label>
          <Input 
            type="number" 
            min={0} 
            max={100} 
            defaultValue={formData.pesos.exame} 
            valid={pesosValidos}
            onBlur={(e) => validarESalvarPesos({ exame: Number(e.target.value) })} 
          />
        </div>
      </div>
      <div className="h-px bg-slate-100 my-4" />
      <div className={`text-sm font-medium ${pesosValidos ? 'text-green-600' : 'text-red-600'}`}>
        Soma atual: {fmtPct(somaPesos)} — {pesosValidos ? '✓ Válido' : '✗ Deve ser 100%'}
      </div>
    </Card>
  );

  const Step4Aplicacao = () => {
    const [nivel, setNivel] = useState("Primário");
    const [turma, setTurma] = useState("7ª A");
    const [disc, setDisc] = useState("— Todas —");
    const [periodo, setPeriodo] = useState("Trimestral");

    return (
      <Card title="4) Aplicar a Níveis, Turmas e Disciplinas" subtitle="Vincule esta configuração às séries/níveis. Pode haver múltiplos sistemas por escola.">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label required>Nível</Label>
            <Select 
              value={nivel} 
              onChange={(e) => setNivel(e.target.value)}
            >
              <option>Primário</option>
              <option>Secundário I</option>
              <option>Secundário II</option>
              <option>Técnico/Profissional</option>
            </Select>
          </div>
          <div>
            <Label required>Turma</Label>
            <Select 
              value={turma} 
              onChange={(e) => setTurma(e.target.value)}
            >
              <option>7ª A</option>
              <option>9ª B</option>
              <option>12ª C</option>
            </Select>
          </div>
          <div>
            <Label>Disciplina (opcional)</Label>
            <Select 
              value={disc} 
              onChange={(e) => setDisc(e.target.value)}
            >
              <option>— Todas —</option>
              <option>Matemática</option>
              <option>Português</option>
              <option>Física</option>
            </Select>
          </div>
          <div>
            <Label required>Período</Label>
            <Select 
              value={periodo} 
              onChange={(e) => setPeriodo(e.target.value)}
            >
              <option>Trimestral</option>
              <option>Semestral</option>
              <option>Anual</option>
            </Select>
          </div>
        </div>
        <div className="h-px bg-slate-100 my-4" />
        <div className="flex items-center gap-3">
          <button 
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-moxinexa-teal text-white hover:bg-moxinexa-teal/90 transition-colors"
            onClick={() => aplicarSistema(nivel, turma, disc, periodo)}
          >
            <SvgIcons.check />
            Aplicar sistema
          </button>
          <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 transition-colors">
            <SvgIcons.clone />
            Duplicar para outra série
          </button>
          <span className="text-sm text-moxinexa-gray">Escala atual: 0–{formData.escala.max} • Aprovação {formData.escala.aprov}</span>
        </div>
        
        {formData.aplicacoes.length > 0 && (
          <>
            <div className="h-px bg-slate-100 my-4" />
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-moxinexa-gray bg-slate-50">
                    <th className="text-left p-3">Nível</th>
                    <th className="text-left p-3">Turma</th>
                    <th className="text-left p-3">Disciplina</th>
                    <th className="text-left p-3">Período</th>
                    <th className="text-left p-3">Escala</th>
                    <th className="text-left p-3">Aprovação</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {formData.aplicacoes.map((x, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-3">{x.nivel}</td>
                      <td className="p-3">{x.turma}</td>
                      <td className="p-3">{x.disc}</td>
                      <td className="p-3">{x.periodo}</td>
                      <td className="p-3">{x.escala}</td>
                      <td className="p-3">{x.aprov}</td>
                      <td className="p-3">
                        <button 
                          className="w-9 h-9 grid place-items-center rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                          onClick={() => removerAplicacao(i)}
                        >
                          <SvgIcons.trash />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    );
  };

  const Step5Resumo = () => (
    <Card title="5) Resumo e Confirmação" subtitle="Revise as configurações antes de salvar o sistema de avaliação.">
      <div className="space-y-6">
        <div className="bg-slate-50 rounded-xl p-4">
          <h3 className="font-semibold text-moxinexa-dark mb-2 flex items-center gap-2">
            <SvgIcons.info />
            Configuração da Escala
          </h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-moxinexa-gray">Tipo:</span> {formData.escala.tipo === 'custom' ? 'Personalizada' : `0–${formData.escala.tipo}`}</div>
            <div><span className="text-moxinexa-gray">Máximo:</span> {formData.escala.max}</div>
            <div><span className="text-moxinexa-gray">Aprovação:</span> {formData.escala.aprov}</div>
            <div><span className="text-moxinexa-gray">Decimais:</span> {formData.escala.dec}</div>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-4">
          <h3 className="font-semibold text-moxinexa-dark mb-2 flex items-center gap-2">
            <SvgIcons.info />
            Regras de Conversão
          </h3>
          {formData.regras.length === 0 ? (
            <p className="text-sm text-moxinexa-gray">Nenhuma regra definida</p>
          ) : (
            <div className="space-y-2">
              {formData.regras.map((r, i) => (
                <div key={i} className="text-sm">
                  <span className="font-medium">{r.ini}–{r.fim}</span> → {r.conceito || '—'} ({r.pontos || '—'} pts)
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-50 rounded-xl p-4">
          <h3 className="font-semibold text-moxinexa-dark mb-2 flex items-center gap-2">
            <SvgIcons.info />
            Pesos das Avaliações
          </h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-moxinexa-gray">Provas:</span> {formData.pesos.prova}%</div>
            <div><span className="text-moxinexa-gray">Trabalhos:</span> {formData.pesos.trabalho}%</div>
            <div><span className="text-moxinexa-gray">Participação:</span> {formData.pesos.part}%</div>
            <div><span className="text-moxinexa-gray">Exame Final:</span> {formData.pesos.exame}%</div>
          </div>
          <div className={`mt-2 text-sm font-medium ${pesosValidos ? 'text-green-600' : 'text-red-600'}`}>
            Soma: {fmtPct(somaPesos)} — {pesosValidos ? '✓ Válido' : '✗ Inválido'}
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-4">
          <h3 className="font-semibold text-moxinexa-dark mb-2 flex items-center gap-2">
            <SvgIcons.info />
            Aplicações Configuradas
          </h3>
          {formData.aplicacoes.length === 0 ? (
            <p className="text-sm text-moxinexa-gray">Nenhuma aplicação definida</p>
          ) : (
            <div className="space-y-2">
              {formData.aplicacoes.map((a, i) => (
                <div key={i} className="text-sm">
                  <span className="font-medium">{a.nivel}</span> • {a.turma} • {a.disc} • {a.periodo}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );

  // Renderização condicional do passo atual
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1: return <Step1Escala />;
      case 2: return <Step2Regras />;
      case 3: return <Step3Pesos />;
      case 4: return <Step4Aplicacao />;
      case 5: return <Step5Resumo />;
      default: return <Step1Escala />;
    }
  };

  return (
    <div className="min-h-screen bg-moxinexa-light text-moxinexa-dark flex">
      {/* Main */}
      <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-moxinexa-dark">Configuração de Avaliações</h1>
            <p className="text-sm text-moxinexa-gray">Flexível por escola, nível, turma ou disciplina</p>
          </div>
          <span className={`${badge} bg-moxinexa-navy/10 text-moxinexa-navy border border-moxinexa-navy/20`}>
            Escola: Escola Modelo • Ano 2025
          </span>
        </header>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {[1, 2, 3, 4, 5].map(step => (
              <div key={step} className="text-center flex-1">
                <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  step === currentStep 
                    ? 'bg-moxinexa-teal text-white' 
                    : step < currentStep 
                    ? 'bg-green-100 text-green-600' 
                    : 'bg-slate-100 text-slate-500'
                }`}>
                  {step < currentStep ? <SvgIcons.check /> : step}
                </div>
                <div className="text-xs mt-1 text-slate-600">
                  {['Escala', 'Regras', 'Pesos', 'Aplicação', 'Resumo'][step-1]}
                </div>
              </div>
            ))}
          </div>
          <ProgressBar currentStep={currentStep} totalSteps={5} />
        </div>

        {/* Step Content */}
        <div className={`transition-all duration-300 ${currentStep === 5 ? 'max-w-3xl' : ''}`}>
          {renderCurrentStep()}
        </div>

        {/* Step Navigation */}
        <StepNavigation
          currentStep={currentStep}
          totalSteps={5}
          onNext={nextStep}
          onBack={prevStep}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          isValid={stepValidations[currentStep as keyof typeof stepValidations]}
        />

        {/* Toasts */}
        <div className="fixed bottom-4 right-4 space-y-2 z-50">
          {toasts.map(t => (
            <div 
              key={t.id} 
              className={`min-w-[260px] max-w-sm rounded-xl px-4 py-3 shadow-lg border text-sm bg-white animate-in slide-in-from-right-full duration-300 ${
                t.tone === "success" 
                  ? "border-green-200" 
                  : t.tone === "error" 
                  ? "border-red-200" 
                  : "border-blue-200"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 w-5 h-5 grid place-items-center rounded ${
                  t.tone === "success" 
                    ? "bg-green-600 text-white" 
                    : t.tone === "error" 
                    ? "bg-red-600 text-white" 
                    : "bg-blue-600 text-white"
                }`}>
                  {t.tone === "success" ? <SvgIcons.check /> : t.tone === "error" ? "!" : "i"}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{t.title}</div>
                  {t.desc && <div className="text-slate-600 mt-0.5">{t.desc}</div>}
                </div>
                <button 
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                  onClick={() => remove(t.id)}
                >
                  <SvgIcons.close />
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}