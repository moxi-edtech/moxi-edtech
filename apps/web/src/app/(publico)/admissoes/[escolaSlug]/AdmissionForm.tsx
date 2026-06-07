"use client";

import { useCallback, useEffect, useState } from "react";
import {
  User,
  GraduationCap,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  School,
  Clock,
  MessageCircle,
  ShieldCheck,
  FileText,
  Search,
  AlertCircle
} from "lucide-react";
import Link from "next/link";

import { PublicHero } from "./components/PublicHero";
import { CourseCatalog } from "./components/CourseCatalog";
import { DocumentUpload } from "./DocumentUpload";
import { formatTurmaDisplayName, formatTurnoDisplay } from "@/utils/formatters";
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
      documentos_obrigatorios?: string[];
      documentos_admissao_catalogo?: Array<{
        id: string;
        label: string;
      }>;
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
  const [draftId, setDraftId] = useState(() => uuidv4());
  const [hasDraft, setHasDraft] = useState(false);

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
    hp_field: "",
    documentos: {} as Record<string, string>,
    campos_extras: {} as Record<string, string>,
  });

  type DraftPayload = {
    draftId?: string;
    formData?: typeof formData;
  };

  const draftStorageKey = `klasse_admission_draft_${config.escola.id}`;

  const parseDraftPayload = useCallback((saved: string): DraftPayload | null => {
    const parsed = JSON.parse(saved) as DraftPayload | typeof formData;
    if (parsed && typeof parsed === "object" && "formData" in parsed) return parsed as DraftPayload;
    return { formData: parsed as typeof formData };
  }, []);

  // Draft Load
  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftStorageKey);
      if (saved) {
        const parsed = parseDraftPayload(saved);
        const savedFormData = parsed?.formData;
        if (savedFormData?.nome_completo || savedFormData?.responsavel_nome || savedFormData?.curso_id) {
          setHasDraft(true);
        }
      }
    } catch {
      // ignore
    }
  }, [draftStorageKey, parseDraftPayload]);

  // Draft Save
  useEffect(() => {
    if (formData.nome_completo || formData.responsavel_nome || formData.curso_id) {
      localStorage.setItem(draftStorageKey, JSON.stringify({ draftId, formData }));
    }
  }, [draftId, draftStorageKey, formData]);

  const handleRestoreDraft = () => {
    try {
      const saved = localStorage.getItem(draftStorageKey);
      if (saved) {
        const parsed = parseDraftPayload(saved);
        if (parsed?.draftId) setDraftId(parsed.draftId);
        if (parsed?.formData) setFormData(parsed.formData);
        setHasDraft(false);
        setStep(1);
        document.getElementById("admissao-formulario")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch {
      // ignore
    }
  };

  const primaryColor = config.escola.cor_primaria || "#1F6B3B";
  const TOTAL_STEPS = 4;

  const whatsappNumber = config.escola.config_portal?.whatsapp_suporte;
  const disponibilidadeLabel: Record<NonNullable<AdmissionConfig["turmas"][number]["disponibilidade"]>, string> = {
    disponivel: "Disponível",
    ultimas_vagas: "Últimas vagas",
    lista_espera: "Lista de espera",
  };

  // Grouped options for the dropdown: Grade + Shift
  const groupedTurmas = formData.curso_id
    ? (() => {
        const map: Record<string, { id: string, label: string }> = {};
        config.turmas
          .filter(t => t.curso_id === formData.curso_id)
          .forEach(t => {
            const gradeName = formatTurmaDisplayName(t);
            const publicTurno = formatTurnoDisplay(t.turno);
            const disponibilidade = disponibilidadeLabel[t.disponibilidade ?? "disponivel"];
            const key = `${gradeName}|${publicTurno}`;
            if (!map[key]) {
              map[key] = {
                id: t.id,
                label: `${gradeName} - ${publicTurno} - ${disponibilidade}`
              };
            }
          });
        return Object.values(map);
      })()
    : [];

  const isDocumentNumberRequired = !["Folha de 25 linhas", "Outro"].includes(formData.tipo_documento);
  const configuredDocumentCatalog = config.escola.config_portal?.documentos_admissao_catalogo ?? [];
  const documentDescriptions: Record<string, string> = {
    bi_aluno: "Cópia legível do documento de identidade.",
    bi_candidato: "Cópia legível do documento de identidade.",
    foto_candidato: "Fotografia recente do candidato.",
    certificado_habilitacoes: "Certificado de habilitações ou declaração de notas.",
    notas: "Certificado de habilitações ou declaração de notas.",
    bi_encarregado: "Cópia legível do documento do encarregado.",
    folha_25_linhas: "Documento complementar solicitado pela secretaria.",
    outro_documento: "Anexe qualquer outro documento exigido pela escola.",
  };
  const requiredDocumentIds = new Set(config.escola.config_portal?.documentos_obrigatorios ?? []);
  const documentCatalog = (() => {
    const catalog = configuredDocumentCatalog.length > 0
      ? configuredDocumentCatalog.map((doc) => ({
          id: doc.id,
          label: doc.label,
          description: documentDescriptions[doc.id] ?? "Documento solicitado pela secretaria.",
        }))
      : [
          { id: "bi_aluno", label: "BI ou Cédula do Aluno", description: "Cópia legível do documento de identidade." },
          { id: "notas", label: "Certificado ou Declaração", description: "Certificado de habilitações ou declaração de notas." },
          { id: "folha_25_linhas", label: "Folha de 25 linhas", description: "Documento complementar solicitado pela secretaria." },
          { id: "outro_documento", label: "Outro documento", description: "Anexe qualquer outro documento exigido pela escola." },
        ];
    const byId = new Map(catalog.map((doc) => [doc.id, doc]));
    for (const id of requiredDocumentIds) {
      if (!byId.has(id)) {
        byId.set(id, {
          id,
          label: id.replace(/_/g, " "),
          description: "Documento obrigatório solicitado pela secretaria.",
        });
      }
    }
    return Array.from(byId.values());
  })();
  const missingRequiredDocuments = Array.from(requiredDocumentIds).filter((id) => !formData.documentos[id]);

  const step1Validation = () => {
    if (!formData.curso_id) return "Selecione o nível de ensino pretendido.";
    if (!formData.turma_preferencial_id) return "Selecione a classe pretendida.";
    if (formData.nome_completo.trim().length < 5) return "Informe o nome completo do estudante.";
    if (!formData.tipo_documento) return "Selecione o tipo de documento.";
    if (isDocumentNumberRequired && formData.numero_documento.trim().length < 3) {
      return "Informe o número do documento.";
    }
    if (!formData.data_nascimento) return "Informe a data de nascimento.";
    if (formData.telefone.trim().length < 7) return "Informe o telefone de contacto do estudante.";
    if (!formData.sexo) return "Selecione o gênero do estudante.";

    const missingExtra = config.escola.config_portal?.campos_extras?.find(
      (campo) => campo.required && !String(formData.campos_extras[campo.id] ?? "").trim()
    );
    if (missingExtra) return `Informe ${missingExtra.label}.`;

    return null;
  };

  const nextStep = () => {
    setStep((s) => s + 1);
    document.getElementById("admissao-formulario")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const prevStep = () => {
    setStep((s) => s - 1);
    document.getElementById("admissao-formulario")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleStep1Next = () => {
    const validationError = step1Validation();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    nextStep();
  };

  const step2Validation = () => {
    if (formData.responsavel_nome.trim().length < 5) return "Informe o nome do responsável.";
    if (formData.responsavel_contato.trim().length < 7) return "Informe o contacto do responsável.";
    return null;
  };

  const handleStep2Next = () => {
    const validationError = step2Validation();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    nextStep();
  };

  const handleStep3Next = () => {
    if (missingRequiredDocuments.length > 0) {
      setError(`Por favor, anexe os documentos obrigatórios: ${missingRequiredDocuments.map(id => id.replace('_', ' ')).join(', ')}.`);
      return;
    }
    setError(null);
    nextStep();
  };

  const selectCourseFromLanding = (cursoId: string) => {
    setFormData((prev) => ({
      ...prev,
      curso_id: cursoId,
      turma_preferencial_id: "",
      turno: "",
    }));
    setError(null);
    setStep(1);
    document.getElementById("admissao-formulario")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name === "turma_preferencial_id") {
      const selectedTurma = config.turmas.find(t => t.id === value);
      if (selectedTurma) {
        setFormData(prev => ({
          ...prev,
          turma_preferencial_id: value,
          turno: selectedTurma.turno
        }));
      } else {
        setFormData(prev => ({ ...prev, [name]: value }));
      }
    } else if (name === "curso_id") {
      setFormData(prev => ({
        ...prev,
        curso_id: value,
        turma_preferencial_id: "",
        turno: ""
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
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
          draftId,
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

      try {
        localStorage.removeItem(draftStorageKey);
      } catch {}
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao processar inscrição");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center animate-klasse-fade-up px-4">
        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-green-100 text-green-600">
          <CheckCircle2 size={48} />
        </div>
        <h1 className="text-3xl font-black text-slate-900">Inscrição Enviada!</h1>
        {submissionStatus === "lista_espera" ? (
          <p className="mt-4 max-w-md text-lg text-slate-600 leading-relaxed">
            Obrigado, <span className="font-bold">{formData.nome_completo}</span>. A classe selecionada está lotada no momento, mas sua candidatura entrou para a <b>Lista de Espera</b>.
          </p>
        ) : (
          <p className="mt-4 max-w-md text-lg text-slate-600 leading-relaxed">
            Obrigado, <span className="font-bold">{formData.nome_completo}</span>. Sua intenção de matrícula foi registrada com sucesso.
          </p>
        )}

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm max-w-sm w-full mx-auto">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Protocolo de Referência</p>
          <p className="mt-1 text-4xl font-black tracking-tight text-slate-900 font-mono">{protocolo}</p>
          <div className="mt-6 pt-6 border-t border-slate-100">
            <Link
              href={`/admissoes/${config.escola.slug}/consultar`}
              className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-4 text-sm font-black text-white hover:bg-slate-800 transition"
            >
              <ShieldCheck size={18} />
              Área da Candidatura
            </Link>
            <p className="mt-4 text-[11px] text-slate-500 leading-relaxed italic">
              * Guarde este código para acompanhar o status da sua vaga.
            </p>
          </div>
        </div>

        <div className="mt-10 space-y-4 max-w-md mx-auto">
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 text-left flex gap-3">
            <Clock className="text-blue-500 shrink-0" size={20} />
            <div>
              <p className="text-sm font-bold text-blue-900">O que acontece agora?</p>
              <p className="text-xs text-blue-700 mt-1">
                A secretaria analisará seus dados. Se aprovado, você receberá uma <b>Reserva de Vaga</b> e poderá enviar o comprovativo de pagamento diretamente por aqui.
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
      <PublicHero config={config} />

      <CourseCatalog
        config={config}
        onSelectCourse={selectCourseFromLanding}
      />

      <div id="admissao-formulario" className="overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-200/60 border border-slate-100 max-w-4xl mx-auto">
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
                <p className="text-xs font-black uppercase tracking-widest text-white/60">Formulário de Candidatura</p>
                <h2 className="text-2xl font-black tracking-tight">Insira seus dados</h2>
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
            Passo {step} de {TOTAL_STEPS} para garantir sua vaga no ano letivo <span className="text-white font-bold">{config.ano_letivo?.ano || "vigente"}</span>.
          </p>

          {/* Progress Bar */}
          <div className="absolute bottom-0 left-0 h-1.5 bg-white/10 w-full">
             <div
               className="h-full transition-all duration-500 ease-in-out"
               style={{ width: `${(step / TOTAL_STEPS) * 100}%`, backgroundColor: primaryColor }}
             />
          </div>
        </div>

        {hasDraft && step === 1 && (
          <div className="bg-amber-50 px-8 py-4 border-b border-amber-100 flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm text-amber-800 font-medium">Você possui uma inscrição iniciada não concluída.</p>
            <button
              type="button"
              onClick={handleRestoreDraft}
              className="text-xs font-bold text-amber-900 bg-amber-200/50 hover:bg-amber-200 px-4 py-2 rounded-lg transition"
            >
              Continuar de onde parei
            </button>
          </div>
        )}

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

          {/* NOVO PASSO 1: VAGA + ALUNO */}
          {step === 1 && (
            <div className="space-y-10 animate-klasse-fade-in">
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                    <GraduationCap size={20} />
                  </div>
                  <h3 className="text-lg font-black text-slate-900">O que pretende estudar?</h3>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <label>
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">
                      Nível de ensino <span className="text-red-500">*</span>
                    </span>
                    <select
                      required
                      name="curso_id"
                      value={formData.curso_id}
                      onChange={handleInputChange}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-900 transition"
                    >
                      <option value="">Selecionar...</option>
                      {config.cursos.map((c) => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">
                      Classe pretendida <span className="text-red-500">*</span>
                    </span>
                    <select
                      required
                      name="turma_preferencial_id"
                      value={formData.turma_preferencial_id}
                      onChange={handleInputChange}
                      disabled={!formData.curso_id}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-900 transition disabled:opacity-50"
                    >
                      <option value="">Selecionar...</option>
                      {groupedTurmas.map((t) => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                    <User size={20} />
                  </div>
                  <h3 className="text-lg font-black text-slate-900">Identificação do Aluno</h3>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <label className="col-span-full">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">
                      Nome Completo <span className="text-red-500">*</span>
                    </span>
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
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">
                      Documento de Identificação {isDocumentNumberRequired && <span className="text-red-500">*</span>}
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <select
                        name="tipo_documento"
                        value={formData.tipo_documento}
                        onChange={handleInputChange}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-900 transition"
                      >
                        <option value="BI">BI</option>
                        <option value="Cédula Pessoal">Cédula</option>
                        <option value="Passaporte">Passaporte</option>
                        <option value="Outro">Outro</option>
                      </select>
                      <input
                        required={isDocumentNumberRequired}
                        type="text"
                        name="numero_documento"
                        value={formData.numero_documento}
                        onChange={handleInputChange}
                        className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-900 transition font-mono uppercase"
                        placeholder={isDocumentNumberRequired ? "Número" : "Número (se houver)"}
                      />
                    </div>
                  </label>

                  <label>
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">
                      Data de Nascimento <span className="text-red-500">*</span>
                    </span>
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
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">
                      Gênero <span className="text-red-500">*</span>
                    </span>
                    <select
                      required
                      name="sexo"
                      value={formData.sexo}
                      onChange={handleInputChange}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-900 transition"
                    >
                      <option value="">Selecionar...</option>
                      <option value="M">Masculino</option>
                      <option value="F">Feminino</option>
                      <option value="O">Outro</option>
                    </select>
                  </label>

                  <label>
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">
                      Telefone <span className="text-red-500">*</span>
                    </span>
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
                </div>
              </div>

              <div className="pt-6 flex justify-end">
                <button
                  type="button"
                  onClick={handleStep1Next}
                  className="flex items-center gap-2 rounded-2xl bg-slate-900 px-10 py-4 text-sm font-black text-white hover:bg-slate-800 transition"
                >
                  Próximo Passo
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* NOVO PASSO 2: RESPONSÁVEL */}
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
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">
                    Nome do Pai/Mãe ou Encarregado <span className="text-red-500">*</span>
                  </span>
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
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">
                    Telefone de Contacto <span className="text-red-500">*</span>
                  </span>
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

                <label>
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Nome do Pai (opcional)</span>
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
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Nome da Mãe (opcional)</span>
                  <input
                    type="text"
                    name="mae_nome"
                    value={formData.mae_nome}
                    onChange={handleInputChange}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-900 transition"
                    placeholder="Nome completo da mãe"
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
                  onClick={handleStep2Next}
                  className="flex items-center gap-2 rounded-2xl bg-slate-900 px-8 py-4 text-sm font-black text-white hover:bg-slate-800 transition"
                >
                  Próximo Passo
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* NOVO PASSO 3: DOCUMENTAÇÃO */}
          {step === 3 && (
            <div className="space-y-6 animate-klasse-fade-in">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                  <FileText size={20} />
                </div>
                <h3 className="text-lg font-black text-slate-900">
                  Documentação {requiredDocumentIds.size > 0 ? '' : '(Opcional)'}
                </h3>
              </div>

              <p className="text-sm text-slate-500">
                {requiredDocumentIds.size > 0
                  ? "Por favor, anexe os documentos obrigatórios para prosseguir."
                  : "Anexar documentos agora ajuda a agilizar a análise da sua inscrição."
                }
              </p>

              <div className="grid gap-4">
                {documentCatalog.map((doc) => (
                  <DocumentUpload
                    key={doc.id}
                    label={`${doc.label}${requiredDocumentIds.has(doc.id) ? " *" : ""}`}
                    description={doc.description}
                    escolaId={config.escola.id}
                    candidaturaId={draftId}
                    initialPath={formData.documentos[doc.id]}
                    onUploadSuccess={(path) => setFormData(p => ({ ...p, documentos: { ...p.documentos, [doc.id]: path } }))}
                    onRemove={async () => {
                      setFormData((prev) => {
                        const documentos = { ...prev.documentos };
                        delete documentos[doc.id];
                        return { ...prev, documentos };
                      });
                    }}
                  />
                ))}
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
                  onClick={handleStep3Next}
                  className="flex items-center gap-2 rounded-2xl bg-slate-900 px-8 py-4 text-sm font-black text-white hover:bg-slate-800 transition"
                >
                  Revisar Inscrição
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* NOVO PASSO 4: RESUMO */}
          {step === 4 && (
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
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Nível de ensino</p>
                    <p className="text-sm font-black text-slate-900">
                      {config.cursos.find(c => c.id === formData.curso_id)?.nome}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Classe / Turno</p>
                    <p className="text-sm font-black text-slate-900">
                      {formData.turma_preferencial_id
                        ? (() => {
                            const selectedTurma = config.turmas.find(t => t.id === formData.turma_preferencial_id);
                            return selectedTurma ? formatTurmaDisplayName(selectedTurma) : "Sem preferência";
                          })()
                        : "Sem preferência"}
                      {formData.turno ? ` (${formatTurnoDisplay(formData.turno)})` : ""}
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
                <p>Ao clicar em finalizar, sua intenção de matrícula será enviada para a escola. Você receberá um número de protocolo para acompanhamento.</p>
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
                  className="flex items-center gap-2 rounded-2xl px-10 py-4 text-sm font-black text-white hover:opacity-90 transition disabled:opacity-50 shadow-lg"
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
            {whatsappNumber ? (
              <div className="text-center md:text-left">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Precisa de ajuda?</p>
                <p className="text-sm text-slate-600">Fale diretamente com nossa secretaria</p>
              </div>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-3">
               {whatsappNumber && (
                 <>
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
                 </>
               )}
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
