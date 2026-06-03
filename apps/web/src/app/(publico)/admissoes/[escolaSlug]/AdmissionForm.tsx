"use client";

import { useState } from "react";
import { 
  User, 
  GraduationCap, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  Loader2,
  Calendar,
  Phone,
  Mail,
  School,
  Clock,
  MessageCircle,
  ExternalLink,
  ShieldCheck,
  FileText,
  Search,
  AlertCircle
} from "lucide-react";
import Link from "next/link";

import { DocumentUpload } from "./DocumentUpload";
import { v4 as uuidv4 } from "uuid";

export type AdmissionConfig = {
  escola: {
    id: string;
    nome: string;
    logo_url: string | null;
    cor_primaria: string | null;
    slug: string;
    config_portal?: {
      whatsapp_suporte?: string;
      documentos_obrigatorios?: string[]; // IDs como 'bi_aluno', 'notas', etc.
      campos_extras?: Array<{
        id: string;
        label: string;
        tipo: "text" | "select" | "number";
        required: boolean;
        options?: string[];
      }>;
    };
  };
  ano_letivo: {
    id: string;
    ano: number;
  } | null;
  cursos: Array<{ id: string; nome: string }>;
  turmas: Array<{
    id: string;
    nome: string;
    turno: string;
    curso_id: string;
    disponibilidade?: "disponivel" | "ultimas_vagas" | "lista_espera";
  }>;
};

export function AdmissionForm({ config }: { config: AdmissionConfig }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [protocolo, setProtocolo] = useState("");
  const [submissionStatus, setSubmissionStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftId] = useState(() => uuidv4());

  const [formData, setFormData] = useState({
    nome_completo: "",
    tipo_documento: "BI",
    numero_documento: "",
    email: "",
    telefone: "",
    data_nascimento: "",
    sexo: "" as "M" | "F" | "O" | "N" | "",
    pai_nome: "",
    mae_nome: "",
    responsavel_nome: "",
    responsavel_contato: "",
    curso_id: "",
    turma_preferencial_id: "",
    turno: "",
    hp_field: "", // Honeypot
    documentos: {} as Record<string, string>,
    campos_extras: {} as Record<string, string>,
  });

  const primaryColor = config.escola.cor_primaria || "#1F6B3B";
  const TOTAL_STEPS = 5;

  const whatsappNumber = config.escola.config_portal?.whatsapp_suporte || "244923000000";
  const disponibilidadeLabel: Record<NonNullable<AdmissionConfig["turmas"][number]["disponibilidade"]>, string> = {
    disponivel: "Disponível",
    ultimas_vagas: "Últimas vagas",
    lista_espera: "Lista de espera aberta",
  };
  const disponibilidadeStyle: Record<
    NonNullable<AdmissionConfig["turmas"][number]["disponibilidade"]>,
    string
  > = {
    disponivel: "bg-emerald-50 text-emerald-700 border-emerald-100",
    ultimas_vagas: "bg-amber-50 text-amber-700 border-amber-100",
    lista_espera: "bg-slate-100 text-slate-700 border-slate-200",
  };
  const selectedTurma = config.turmas.find((turma) => turma.id === formData.turma_preferencial_id) ?? null;
  const selectedDisponibilidade = selectedTurma?.disponibilidade ?? "disponivel";
  const visibleTurmas = config.turmas.slice(0, 8);

  const isDocumentNumberRequired = !["Folha de 25 linhas", "Outro"].includes(formData.tipo_documento);

  const step1Validation = () => {
    if (formData.nome_completo.trim().length < 5) return "Informe o nome completo do estudante.";
    if (!formData.tipo_documento) return "Selecione o tipo de documento.";
    if (isDocumentNumberRequired && formData.numero_documento.trim().length < 3) {
      return "Informe o número do documento.";
    }
    if (!formData.data_nascimento) return "Informe a data de nascimento.";
    if (formData.telefone.replace(/\D/g, "").length < 7) return "Informe um telefone válido.";

    const missingExtra = config.escola.config_portal?.campos_extras?.find(
      (campo) => campo.required && !String(formData.campos_extras[campo.id] ?? "").trim()
    );
    if (missingExtra) return `Informe ${missingExtra.label}.`;

    return null;
  };

  const canProceedStep1 = step1Validation() === null;
  const nextStep = () => setStep((s) => s + 1);
  const handleStep1Next = () => {
    const validationError = step1Validation();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    nextStep();
  };
  const prevStep = () => setStep((s) => s - 1);

  const selectTurmaFromLanding = (turma: AdmissionConfig["turmas"][number]) => {
    setFormData((prev) => ({
      ...prev,
      curso_id: turma.curso_id,
      turma_preferencial_id: turma.id,
      turno: turma.turno,
    }));
    setError(null);
    document.getElementById("admissao-formulario")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Auto-fill turno when turma is selected
    if (name === "turma_preferencial_id") {
      const selectedTurma = config.turmas.find(t => t.id === value);
      if (selectedTurma) {
        setFormData(prev => ({ ...prev, turno: selectedTurma.turno, turma_preferencial_id: value }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/public/admissoes/${config.escola.slug}/candidatar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          draftId, // Envia o ID usado para os arquivos
          ano_letivo: config.ano_letivo?.ano || new Date().getFullYear(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao processar inscrição");
      }

      setProtocolo(data.protocolo);
      setSubmissionStatus(typeof data.status === "string" ? data.status : null);
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao processar inscrição");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center animate-klasse-fade-up">
        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-green-100 text-green-600">
          <CheckCircle2 size={48} />
        </div>
        <h1 className="text-3xl font-black text-slate-900">Inscrição Enviada!</h1>
        {submissionStatus === "lista_espera" ? (
          <p className="mt-4 max-w-md text-lg text-slate-600">
            Obrigado, <span className="font-bold">{formData.nome_completo}</span>. A turma está lotada no momento, mas a escola ainda pode contactar candidatos caso surjam novas vagas.
          </p>
        ) : (
          <p className="mt-4 max-w-md text-lg text-slate-600">
            Obrigado, <span className="font-bold">{formData.nome_completo}</span>. Sua intenção de matrícula foi registrada com sucesso.
          </p>
        )}
        
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm max-w-sm w-full">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Protocolo de Referência</p>
          <p className="mt-1 text-4xl font-black tracking-tight text-slate-900">{protocolo}</p>
          <div className="mt-6 pt-6 border-t border-slate-100">
            <Link
              href={`/admissoes/${config.escola.slug}/consultar`}
              className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-4 text-sm font-black text-white hover:bg-slate-800 transition"
            >
              <ShieldCheck size={18} />
              Acessar Cofre Agora
            </Link>
            <p className="mt-4 text-[11px] text-slate-500 leading-relaxed italic">
              * Você precisará confirmar o telefone do encarregado (<span className="font-bold">{formData.responsavel_contato}</span>) para acessar o cofre.
            </p>
          </div>
        </div>

        <div className="mt-10 space-y-4 max-w-md">
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 text-left flex gap-3">
            <Clock className="text-blue-500 shrink-0" size={20} />
            <div>
              <p className="text-sm font-bold text-blue-900">O que acontece agora?</p>
              <p className="text-xs text-blue-700 mt-1">
                A secretaria analisará seus dados. Se aprovado, você receberá uma <b>Reserva de Vaga de 48h</b> e poderá enviar o comprovativo de pagamento diretamente pelo cofre.
              </p>
            </div>
          </div>
        </div>
        
        <button 
          onClick={() => window.location.reload()}
          className="mt-12 text-sm font-bold text-slate-400 hover:text-slate-600 underline underline-offset-4"
        >
          Realizar outra inscrição
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-600">
            <GraduationCap size={14} />
            Ano letivo {config.ano_letivo?.ano || "vigente"}
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-black tracking-tight text-slate-950 md:text-5xl">
              Admissão online
              <span className="block" style={{ color: primaryColor }}>{config.escola.nome}</span>
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-600">
              Escolha a turma pretendida, preencha os dados do estudante e acompanhe a candidatura pelo protocolo.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-slate-600">
            <span className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
              <ShieldCheck size={16} className="text-emerald-600" />
              Protocolo de consulta
            </span>
            <span className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
              <MessageCircle size={16} className="text-emerald-600" />
              Apoio da secretaria
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-950 p-5 text-white">
          <p className="text-xs font-black uppercase tracking-widest text-white/50">Consultar candidatura</p>
          <p className="mt-2 text-sm leading-6 text-white/75">
            Já submeteu uma candidatura? Use o protocolo para ver o estado e documentos pendentes.
          </p>
          <Link
            href={`/admissoes/${config.escola.slug}/consultar`}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-100"
          >
            <Search size={16} />
            Consultar protocolo
          </Link>
        </div>
      </section>

      {visibleTurmas.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Turmas abertas</p>
              <h2 className="text-xl font-black text-slate-950">Selecione uma opção para iniciar</h2>
            </div>
            <p className="max-w-md text-sm text-slate-500">
              A escola avalia cada candidatura antes de confirmar a matrícula.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {visibleTurmas.map((turma) => {
              const disponibilidade = turma.disponibilidade ?? "disponivel";
              const curso = config.cursos.find((item) => item.id === turma.curso_id);
              const isWaitlist = disponibilidade === "lista_espera";

              return (
                <button
                  key={turma.id}
                  type="button"
                  onClick={() => selectTurmaFromLanding(turma)}
                  className="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-black text-slate-950">{turma.nome}</p>
                      <p className="mt-1 text-sm text-slate-500">{curso?.nome || "Curso"} · {turma.turno || "Turno a confirmar"}</p>
                    </div>
                    <span className={`shrink-0 rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${disponibilidadeStyle[disponibilidade]}`}>
                      {disponibilidadeLabel[disponibilidade]}
                    </span>
                  </div>
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-black" style={{ color: primaryColor }}>
                    {isWaitlist ? "Entrar na lista de espera" : "Inscrever nesta turma"}
                    <ArrowRight size={16} />
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

    <div id="admissao-formulario" className="overflow-hidden rounded-lg bg-white shadow-xl shadow-slate-200/60 border border-slate-100">
      {/* Header */}
      <div className="bg-slate-900 px-8 py-10 text-white relative">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            {config.escola.logo_url ? (
              <img src={config.escola.logo_url} alt={config.escola.nome} className="h-16 w-16 rounded-2xl bg-white p-2 object-contain" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
                <School size={32} />
              </div>
            )}
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-white/60">Portal de Admissão</p>
              <h2 className="text-2xl font-black tracking-tight">{config.escola.nome}</h2>
            </div>
          </div>
          
          <Link 
            href={`/admissoes/${config.escola.slug}/consultar`}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold hover:bg-white/20 transition shrink-0"
          >
            <Search size={14} />
            Consultar Inscrição
          </Link>
        </div>
        <p className="mt-4 text-white/70 max-w-lg relative z-10">
          Seja bem-vindo ao nosso processo de admissão para o ano letivo <span className="text-white font-bold">{config.ano_letivo?.ano || "vigente"}</span>.
        </p>
        
        {/* Progress Bar */}
        <div className="absolute bottom-0 left-0 h-1 bg-white/10 w-full">
           <div 
             className="h-full transition-all duration-500 ease-in-out" 
             style={{ width: `${(step / TOTAL_STEPS) * 100}%`, backgroundColor: primaryColor }}
           />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-8">
        {/* Honeypot Anti-spam */}
        <div style={{ position: 'absolute', left: '-9999px', top: '0' }} aria-hidden="true">
          <input
            type="text"
            name="hp_field"
            tabIndex={-1}
            autoComplete="off"
            value={formData.hp_field}
            onChange={handleInputChange}
          />
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-600 border border-red-100">
            {error}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6 animate-klasse-fade-in">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                <User size={20} />
              </div>
              <h3 className="text-lg font-black text-slate-900">Dados do Aluno</h3>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <label className="col-span-full">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Nome Completo</span>
                <input
                  required
                  type="text"
                  name="nome_completo"
                  value={formData.nome_completo}
                  onChange={handleInputChange}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-900 transition"
                  placeholder="Nome completo do estudante"
                  />
                  </label>

                  <label className="col-span-full">
                 <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Documento de Identificação</span>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                   <select
                     name="tipo_documento"
                     value={formData.tipo_documento}
                     onChange={handleInputChange}
                     className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-900 transition"
                   >
                     <option value="BI">Bilhete de Identidade (BI)</option>
                     <option value="Cédula Pessoal">Cédula Pessoal</option>
                     <option value="Passaporte">Passaporte</option>
                     <option value="Cartão de Residente">Cartão de Residente</option>
                     <option value="Folha de 25 linhas">Folha de 25 linhas</option>
                     <option value="Outro">Outro</option>
                   </select>
                   <input
                     required={isDocumentNumberRequired}
                     type="text"
                     name="numero_documento"
                     value={formData.numero_documento}
                     onChange={handleInputChange}
                     className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-900 transition font-mono uppercase"
                     placeholder={isDocumentNumberRequired ? "Número do documento" : "Número (se houver)"}
                   />
                 </div>
               </label>

                  <label>
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Data de Nascimento</span>
                  <input
                  required
                  type="date"
                  name="data_nascimento"
                  value={formData.data_nascimento}
                  onChange={handleInputChange}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-900 transition"
                  />
                  </label>

              <label>
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Gênero</span>
                <select
                  name="sexo"
                  value={formData.sexo}
                  onChange={handleInputChange}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-900 transition"
                >
                  <option value="">Selecionar...</option>
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                  <option value="O">Outro</option>
                  <option value="N">Não informar</option>
                </select>
              </label>

              <label>
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Email (Opcional)</span>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-900 transition"
                  placeholder="email@exemplo.com"
                />
              </label>

              <label>
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Telefone</span>
                <input
                  required
                  type="tel"
                  name="telefone"
                  value={formData.telefone}
                  onChange={handleInputChange}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-900 transition"
                  placeholder="9xx xxx xxx"
                />
              </label>

              <label>
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Nome do Pai</span>
                <input
                  type="text"
                  name="pai_nome"
                  value={formData.pai_nome}
                  onChange={handleInputChange}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-900 transition"
                  placeholder="Nome completo do pai"
                />
              </label>

              <label>
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Nome da Mãe</span>
                <input
                  type="text"
                  name="mae_nome"
                  value={formData.mae_nome}
                  onChange={handleInputChange}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-900 transition"
                  placeholder="Nome completo da mãe"
                />
              </label>

              {/* Dynamic Extra Fields */}
              {config.escola.config_portal?.campos_extras?.map((campo) => (
                <label key={campo.id} className={campo.tipo === 'text' ? 'col-span-full' : ''}>
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">
                    {campo.label} {campo.required && <span className="text-red-500">*</span>}
                  </span>
                  {campo.tipo === 'select' ? (
                    <select
                      required={campo.required}
                      value={formData.campos_extras[campo.id] || ""}
                      onChange={(e) => setFormData(p => ({ ...p, campos_extras: { ...p.campos_extras, [campo.id]: e.target.value } }))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-900 transition"
                    >
                      <option value="">Selecionar...</option>
                      {campo.options?.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      required={campo.required}
                      type={campo.tipo}
                      value={formData.campos_extras[campo.id] || ""}
                      onChange={(e) => setFormData(p => ({ ...p, campos_extras: { ...p.campos_extras, [campo.id]: e.target.value } }))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-900 transition"
                      placeholder={`Informe ${campo.label.toLowerCase()}`}
                    />
                  )}
                </label>
              ))}
            </div>
            
            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={handleStep1Next}
                disabled={!canProceedStep1}
                className="flex items-center gap-2 rounded-2xl bg-slate-900 px-8 py-4 text-sm font-black text-white hover:bg-slate-800 transition disabled:opacity-50"
              >
                Próximo Passo
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-klasse-fade-in">
             <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                <User size={20} />
              </div>
              <h3 className="text-lg font-black text-slate-900">Dados do Responsável</h3>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <label className="col-span-full">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Nome do Pai/Mãe ou Encarregado</span>
                <input
                  required
                  type="text"
                  name="responsavel_nome"
                  value={formData.responsavel_nome}
                  onChange={handleInputChange}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-900 transition"
                  placeholder="Nome completo do responsável"
                />
              </label>

              <label className="col-span-full">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Telefone de Contacto</span>
                <input
                  required
                  type="tel"
                  name="responsavel_contato"
                  value={formData.responsavel_contato}
                  onChange={handleInputChange}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-900 transition"
                  placeholder="9xx xxx xxx"
                />
              </label>
            </div>

            <div className="pt-4 flex justify-between">
              <button
                type="button"
                onClick={prevStep}
                className="flex items-center gap-2 rounded-2xl border border-slate-200 px-6 py-4 text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                <ArrowLeft size={18} />
                Voltar
              </button>
              <button
                type="button"
                onClick={nextStep}
                disabled={!formData.responsavel_nome || !formData.responsavel_contato}
                className="flex items-center gap-2 rounded-2xl bg-slate-900 px-8 py-4 text-sm font-black text-white hover:bg-slate-800 transition disabled:opacity-50"
              >
                Próximo Passo
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-klasse-fade-in">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                <GraduationCap size={20} />
              </div>
              <h3 className="text-lg font-black text-slate-900">Curso e Turma</h3>
            </div>

            <div className="grid gap-6">
              <label>
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Curso Pretendido</span>
                <select
                  required
                  name="curso_id"
                  value={formData.curso_id}
                  onChange={handleInputChange}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-900 transition"
                >
                  <option value="">Selecionar curso...</option>
                  {config.cursos.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </label>

              <label>
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Turma Preferencial (Opcional)</span>
                <select
                  name="turma_preferencial_id"
                  value={formData.turma_preferencial_id}
                  onChange={handleInputChange}
                  disabled={!formData.curso_id}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-900 transition disabled:opacity-50"
                >
                  <option value="">Sem preferência de turma</option>
                  {config.turmas
                    .filter(t => t.curso_id === formData.curso_id)
                    .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome} ({t.turno}) - {disponibilidadeLabel[t.disponibilidade ?? "disponivel"]}
                    </option>
                  ))}
                </select>
              </label>

              {formData.turma_preferencial_id &&
                config.turmas.find(t => t.id === formData.turma_preferencial_id)?.disponibilidade === "lista_espera" && (
                  <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>A turma está lotada no momento, mas a escola ainda pode contactar candidatos caso surjam novas vagas.</span>
                  </div>
                )}

              {formData.turno && (
                <div className="flex items-center gap-2 rounded-xl bg-blue-50 p-4 text-sm text-blue-700">
                  <Clock size={16} />
                  <span>Turno selecionado: <span className="font-bold">{formData.turno}</span></span>
                </div>
              )}
            </div>

            <div className="pt-4 flex justify-between">
              <button
                type="button"
                onClick={prevStep}
                className="flex items-center gap-2 rounded-2xl border border-slate-200 px-6 py-4 text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                <ArrowLeft size={18} />
                Voltar
              </button>
              <button
                type="button"
                onClick={nextStep}
                disabled={!formData.curso_id}
                className="flex items-center gap-2 rounded-2xl bg-slate-900 px-8 py-4 text-sm font-black text-white hover:bg-slate-800 transition disabled:opacity-50"
              >
                Próximo Passo
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6 animate-klasse-fade-in">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                <FileText size={20} />
              </div>
              <h3 className="text-lg font-black text-slate-900">
                Documentação {config.escola.config_portal?.documentos_obrigatorios?.length ? '' : '(Opcional)'}
              </h3>
            </div>

            <p className="text-sm text-slate-500">
              {config.escola.config_portal?.documentos_obrigatorios?.length 
                ? "Por favor, anexe os documentos obrigatórios para prosseguir com sua inscrição."
                : "Anexar documentos ajuda a agilizar a análise da sua inscrição. Você pode pular este passo e entregar na secretaria depois."
              }
            </p>

            <div className="grid gap-4">
              <DocumentUpload
                label={`BI ou Cédula do Aluno ${config.escola.config_portal?.documentos_obrigatorios?.includes('bi_aluno') ? '*' : ''}`}
                description="Cópia legível do documento de identidade."
                escolaId={config.escola.id}
                candidaturaId={draftId}
                onUploadSuccess={(path) => setFormData(p => ({ ...p, documentos: { ...p.documentos, bi_aluno: path } }))}
              />
              <DocumentUpload
                label={`Certificado ou Declaração ${config.escola.config_portal?.documentos_obrigatorios?.includes('notas') ? '*' : ''}`}
                description="Certificado de habilitações ou declaração de notas."
                escolaId={config.escola.id}
                candidaturaId={draftId}
                onUploadSuccess={(path) => setFormData(p => ({ ...p, documentos: { ...p.documentos, notas: path } }))}
              />
              <DocumentUpload
                label={`Folha de 25 linhas ${config.escola.config_portal?.documentos_obrigatorios?.includes('folha_25_linhas') ? '*' : ''}`}
                description="Documento complementar solicitado pela secretaria."
                escolaId={config.escola.id}
                candidaturaId={draftId}
                onUploadSuccess={(path) => setFormData(p => ({ ...p, documentos: { ...p.documentos, folha_25_linhas: path } }))}
              />
              <DocumentUpload
                label="Outro documento"
                description="Anexe qualquer outro documento exigido pela escola."
                escolaId={config.escola.id}
                candidaturaId={draftId}
                onUploadSuccess={(path) => setFormData(p => ({ ...p, documentos: { ...p.documentos, outro_documento: path } }))}
              />
            </div>

            <div className="pt-4 flex justify-between">
              <button
                type="button"
                onClick={prevStep}
                className="flex items-center gap-2 rounded-2xl border border-slate-200 px-6 py-4 text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                <ArrowLeft size={18} />
                Voltar
              </button>
              <button
                type="button"
                onClick={nextStep}
                disabled={
                  config.escola.config_portal?.documentos_obrigatorios?.some(
                    id => !formData.documentos[id]
                  )
                }
                className="flex items-center gap-2 rounded-2xl bg-slate-900 px-8 py-4 text-sm font-black text-white hover:bg-slate-800 transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Revisar Dados
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6 animate-klasse-fade-in">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                <ShieldCheck size={20} />
              </div>
              <h3 className="text-lg font-black text-slate-900">Resumo da Inscrição</h3>
            </div>

            <div className="grid gap-4 rounded-2xl bg-slate-50 p-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Aluno</p>
                  <p className="text-sm font-black text-slate-900">{formData.nome_completo}</p>
                  <p className="text-xs text-slate-500">{formData.email || "Sem e-mail"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Responsável</p>
                  <p className="text-sm font-black text-slate-900">{formData.responsavel_nome}</p>
                  <p className="text-xs text-slate-500">{formData.responsavel_contato}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Filiação</p>
                  <p className="text-sm font-black text-slate-900">{formData.pai_nome || "Pai não informado"}</p>
                  <p className="text-xs text-slate-500">{formData.mae_nome || "Mãe não informada"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Curso</p>
                  <p className="text-sm font-black text-slate-900">
                    {config.cursos.find(c => c.id === formData.curso_id)?.nome}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Turma / Turno</p>
                  <p className="text-sm font-black text-slate-900">
                    {formData.turma_preferencial_id 
                      ? config.turmas.find(t => t.id === formData.turma_preferencial_id)?.nome 
                      : "Sem preferência"}
                    {formData.turno ? ` (${formData.turno})` : ""}
                  </p>
                </div>
                <div className="col-span-full">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Documentos Anexados</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {Object.keys(formData.documentos).length > 0 ? (
                      Object.keys(formData.documentos).map(k => (
                        <span key={k} className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-[10px] font-bold text-green-700 border border-green-100 uppercase">
                          <ShieldCheck size={10} />
                          {k.replace('_', ' ')}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic">Nenhum documento anexado</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-blue-50 p-4 text-xs text-blue-700 flex items-start gap-3">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <p>Ao clicar em finalizar, sua intenção de matrícula será enviada para a secretaria da escola. Você receberá um número de protocolo para acompanhar o status.</p>
            </div>

            <div className="pt-4 flex justify-between">
              <button
                type="button"
                onClick={prevStep}
                className="flex items-center gap-2 rounded-2xl border border-slate-200 px-6 py-4 text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                <ArrowLeft size={18} />
                Corrigir Dados
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 rounded-2xl px-10 py-4 text-sm font-black text-white hover:opacity-90 transition disabled:opacity-50"
                style={{ backgroundColor: primaryColor }}
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    Finalizar e Enviar
                    <CheckCircle2 size={18} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </form>
      
      {/* Footer & Support */}
      <div className="bg-slate-50 p-8 border-t border-slate-100">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Precisa de ajuda?</p>
            <p className="text-sm text-slate-600">Fale diretamente com nossa secretaria</p>
          </div>
          
          <div className="flex items-center gap-3">
             <a 
               href={`https://wa.me/${whatsappNumber.replace(/\D/g, '')}?text=Olá, estou no portal de admissão da escola ${config.escola.nome} e preciso de ajuda.`}
               target="_blank"
               rel="noopener noreferrer"
               className="flex items-center gap-2 rounded-xl bg-green-500 px-6 py-3 text-sm font-bold text-white hover:bg-green-600 transition shadow-lg shadow-green-200"
             >
               <MessageCircle size={18} />
               WhatsApp
             </a>
             <div className="h-10 w-px bg-slate-200 hidden md:block" />
             <div className="text-center md:text-left">
               <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Tecnologia por</p>
               <p className="text-[10px] font-black text-slate-900 uppercase tracking-tighter">Plataforma Klasse</p>
             </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
