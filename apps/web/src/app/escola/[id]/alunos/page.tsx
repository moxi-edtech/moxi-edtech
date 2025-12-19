"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  UserPlus, 
  Users, 
  Search, 
  Filter, 
  Download, 
  Camera, 
  Check, 
  ChevronRight, 
  ChevronLeft,
  Mail,
  Phone,
  MapPin,
  GraduationCap,
  Lock,
  User,
  Shield,
  Loader2
} from "lucide-react";

// --- SUB-COMPONENTES VISUAIS ---

// 1. O Stepper (Barra de Progresso)
const Stepper = ({ current, total, steps }: { current: number, total: number, steps: string[] }) => (
  <div className="mb-8">
    {/* Mobile: Barra Simples */}
    <div className="md:hidden">
      <div className="flex justify-between text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">
        <span>Passo {current} de {total}</span>
        <span className="text-teal-600">{steps[current - 1]}</span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-teal-500 transition-all duration-500 ease-out" style={{ width: `${(current / total) * 100}%` }} />
      </div>
    </div>

    {/* Desktop: Indicadores Visuais */}
    <div className="hidden md:flex justify-between relative">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -z-10 -translate-y-1/2" />
        {steps.map((label, idx) => {
            const stepNum = idx + 1;
            const isActive = stepNum === current;
            const isDone = stepNum < current;
            
            return (
                <div key={idx} className="flex flex-col items-center gap-2 bg-white px-2">
                    <div className={`
                        w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 border-2
                        ${isActive ? "border-teal-500 bg-teal-50 text-teal-700 scale-110" : ""}
                        ${isDone ? "border-teal-500 bg-teal-500 text-white" : ""}
                        ${!isActive && !isDone ? "border-slate-200 bg-white text-slate-400" : ""}
                    `}>
                        {isDone ? <Check size={14} strokeWidth={3}/> : stepNum}
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wide ${isActive ? "text-teal-700" : "text-slate-400"}`}>{label}</span>
                </div>
            )
        })}
    </div>
  </div>
);

// 2. Input Field (Reutilizável e Bonito)
const InputGroup = ({ label, icon: Icon, ...props }: any) => (
  <div className="space-y-1.5">
    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-2">
        {Icon && <Icon size={14} className="text-slate-400"/>} {label}
    </label>
    <div className="relative group">
        <input 
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all placeholder:text-slate-400 group-hover:bg-white"
            {...props} 
        />
    </div>
  </div>
);

// 3. Select Field
const SelectGroup = ({ label, icon: Icon, children, ...props }: any) => (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-2">
          {Icon && <Icon size={14} className="text-slate-400"/>} {label}
      </label>
      <div className="relative">
          <select 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all appearance-none cursor-pointer hover:bg-white"
              {...props} 
          >
            {children}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
      </div>
    </div>
  );

// --- COMPONENTE PRINCIPAL ---

export default function AlunosPage() {
  const router = useRouter();
  const [view, setView] = useState<"list" | "form">("list"); // Controla a vista
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    primeiro_nome: '',
    sobrenome: '',
    data_nascimento: '',
    genero: 'Masculino',
    bi: '',
    nif: '',
    numero_processo: '',
    email: '',
    telefone: '',
    endereco: '',
    encarregado_nome: '',
    encarregado_telefone: '',
    encarregado_email: '',
    parentesco: 'Pai / Mãe',
    classe_id: '',
    turma_id: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBIChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setFormData(prev => ({ ...prev, bi: value, nif: value }));
  };
  
  const STEPS_LABELS = ["Pessoal", "Contactos", "Encarregado", "Académico"];
  const TOTAL_STEPS = STEPS_LABELS.length;

  // --- ACTIONS ---
  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < TOTAL_STEPS) setStep(s => s + 1);
    else handleSubmit();
  };

  const handleBack = () => {
    if (step > 1) setStep(s => s - 1);
    else setView("list");
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    // Simulação API
    await new Promise(r => setTimeout(r, 2000));
    setIsSubmitting(false);
    alert("Aluno criado com sucesso! 🎓");
    setView("list");
    setStep(1);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900 pb-20">
      
      {/* HEADER DE NAVEGAÇÃO */}
      <div className="max-w-6xl mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <button 
                onClick={() => view === 'form' ? setView('list') : router.back()}
                className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors mb-2"
            >
                <ArrowLeft size={14}/> {view === 'form' ? 'Cancelar registo' : 'Voltar ao Dashboard'}
            </button>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                {view === 'list' ? 'Gestão de Alunos' : 'Novo Aluno'}
            </h1>
        </div>

        {view === 'list' && (
            <div className="flex gap-3">
                <button className="hidden md:flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 transition">
                    <Download size={16}/> Exportar
                </button>
                <button 
                    onClick={() => setView('form')}
                    className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-slate-900/20 hover:-translate-y-0.5 transition-all"
                >
                    <UserPlus size={18}/> <span className="hidden sm:inline">Adicionar Aluno</span>
                </button>
            </div>
        )}
      </div>

      {/* --- VISTA: LISTA --- */}
      {view === 'list' && (
        <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Filtros e Pesquisa */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                    <input 
                        type="text" 
                        placeholder="Pesquisar por nome, BI ou matrícula..." 
                        className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-500/50 transition-all"
                    />
                </div>
                <div className="flex gap-2">
                    <select className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 outline-none cursor-pointer hover:border-slate-300">
                        <option>Todas as Turmas</option>
                        <option>10ª A</option>
                        <option>11ª B</option>
                    </select>
                    <button className="p-2.5 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-700">
                        <Filter size={18}/>
                    </button>
                </div>
            </div>

            {/* Tabela Premium */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4">Estudante</th>
                                <th className="px-6 py-4">Matrícula</th>
                                <th className="px-6 py-4">Turma</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {[1, 2, 3].map((_, i) => (
                                <tr key={i} className="hover:bg-slate-50 transition-colors group cursor-pointer">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs">
                                                MJ
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800">Manuel José</p>
                                                <p className="text-xs text-slate-400">manuel.jose@escola.ao</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-slate-500 text-xs">2025-00123</td>
                                    <td className="px-6 py-4">
                                        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold border border-slate-200">10ª Classe A</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-bold border border-emerald-100">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"/> Ativo
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-slate-400 hover:text-teal-600 transition-colors">
                                            <ChevronRight size={18}/>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      )}

      {/* --- VISTA: FORMULÁRIO (WIZARD) --- */}
      {view === 'form' && (
        <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-500">
            
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
                
                {/* Header do Form */}
                <div className="bg-slate-50 border-b border-slate-200 px-8 py-6">
                    <Stepper current={step} total={TOTAL_STEPS} steps={STEPS_LABELS} />
                    <h2 className="text-xl font-bold text-slate-800 mt-6">{STEPS_LABELS[step-1]}</h2>
                    <p className="text-sm text-slate-500">Preencha os dados obrigatórios para avançar.</p>
                </div>

                <form onSubmit={handleNext} className="p-8">
                    
                    {/* PASSO 1: PESSOAL */}
                    {step === 1 && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="flex justify-center mb-6">
                                <label className="group relative w-32 h-32 rounded-full bg-slate-50 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-teal-500 hover:bg-teal-50/10 transition-all">
                                    <Camera className="w-8 h-8 text-slate-400 group-hover:text-teal-500 mb-2 transition-colors"/>
                                    <span className="text-[10px] font-bold text-slate-400 group-hover:text-teal-600 uppercase">Foto</span>
                                    <input type="file" className="hidden" accept="image/*"/>
                                </label>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <InputGroup label="Primeiro Nome" name="primeiro_nome" value={formData.primeiro_nome} onChange={handleInputChange} icon={User} placeholder="Ex: Manuel" required />
                                <InputGroup label="Sobrenome" name="sobrenome" value={formData.sobrenome} onChange={handleInputChange} placeholder="Ex: José" required />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <InputGroup label="Data Nascimento" name="data_nascimento" value={formData.data_nascimento} onChange={handleInputChange} type="date" required />
                                <SelectGroup label="Género" name="genero" value={formData.genero} onChange={handleInputChange}>
                                    <option>Masculino</option>
                                    <option>Feminino</option>
                                </SelectGroup>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <InputGroup label="Nº BI" name="bi" value={formData.bi} onChange={handleBIChange} icon={Shield} placeholder="00XXXXXXLAXXX" required />
                              <InputGroup label="NIF" name="nif" value={formData.nif} onChange={handleInputChange} icon={Shield} placeholder="Copia do BI" />
                            </div>
                            <InputGroup label="Nº de Processo" name="numero_processo" value={formData.numero_processo} onChange={handleInputChange} placeholder="Automático" />
                        </div>
                    )}

                    {/* PASSO 2: CONTACTOS */}
                    {step === 2 && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <InputGroup label="Email Pessoal" name="email" value={formData.email} onChange={handleInputChange} icon={Mail} type="email" placeholder="aluno@email.com" />
                            <InputGroup label="Telefone" name="telefone" value={formData.telefone} onChange={handleInputChange} icon={Phone} type="tel" placeholder="+244 9XX XXX XXX" required />
                            <InputGroup label="Endereço Residencial" name="endereco" value={formData.endereco} onChange={handleInputChange} icon={MapPin} placeholder="Rua, Bairro, Nº Casa" />
                        </div>
                    )}

                    {/* PASSO 3: ENCARREGADO */}
                    {step === 3 && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700 mb-4">
                                💡 Estes dados são usados para comunicações financeiras e emergências.
                            </div>
                            <InputGroup label="Nome Completo" name="encarregado_nome" value={formData.encarregado_nome} onChange={handleInputChange} icon={Users} placeholder="Nome do Pai/Mãe/Tutor" required />
                            <div className="grid grid-cols-2 gap-4">
                                <InputGroup label="Telefone Principal" name="encarregado_telefone" value={formData.encarregado_telefone} onChange={handleInputChange} icon={Phone} required />
                                <InputGroup label="Email" name="encarregado_email" value={formData.encarregado_email} onChange={handleInputChange} icon={Mail} required />
                            </div>
                            <SelectGroup label="Grau de Parentesco" name="parentesco" value={formData.parentesco} onChange={handleInputChange}>
                                <option>Pai / Mãe</option>
                                <option>Tio(a)</option>
                                <option>Avô(ó)</option>
                                <option>Outro</option>
                            </SelectGroup>
                        </div>
                    )}

                    {/* PASSO 4: ACADÉMICO */}
                    {step === 4 && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="grid grid-cols-2 gap-4">
                                <SelectGroup label="Classe" name="classe_id" value={formData.classe_id} onChange={handleInputChange} icon={GraduationCap}>
                                    <option>10ª Classe</option>
                                    <option>11ª Classe</option>
                                    <option>12ª Classe</option>
                                </SelectGroup>
                                <SelectGroup label="Turma" name="turma_id" value={formData.turma_id} onChange={handleInputChange}>
                                    <option>Turma A (Manhã)</option>
                                    <option>Turma B (Tarde)</option>
                                </SelectGroup>
                            </div>
                            <InputGroup label="Número de Matrícula" value="2025-AUTO-001" readOnly className="bg-slate-100 text-slate-500 cursor-not-allowed" />
                            <p className="text-[10px] text-slate-400 text-right">*Gerado automaticamente</p>
                        </div>
                    )}

                    {/* PASSO 5: ACESSO - REMOVIDO */}

                    {/* FOOTER DO FORM (Ações) */}
                    <div className="flex items-center justify-between pt-8 mt-8 border-t border-slate-100">
                        <button 
                            type="button" 
                            onClick={handleBack}
                            className="text-slate-400 hover:text-slate-600 text-sm font-bold px-4 py-2 rounded-lg transition-colors"
                        >
                            {step === 1 ? 'Cancelar' : 'Voltar'}
                        </button>

                        <button 
                            type="submit"
                            disabled={isSubmitting}
                            className={`
                                flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold text-white shadow-lg transition-all
                                ${isSubmitting ? 'bg-slate-400 cursor-wait' : 'bg-slate-900 hover:bg-slate-800 hover:-translate-y-1 shadow-slate-900/20'}
                            `}
                        >
                            {isSubmitting ? (
                                <><Loader2 className="animate-spin" size={16}/> Processando...</>
                            ) : (
                                step === TOTAL_STEPS ? 'Finalizar Matrícula' : <>Próximo <ChevronRight size={16}/></>
                            )}
                        </button>
                    </div>

                </form>
            </div>
        </div>
      )}

    </div>
  );
}