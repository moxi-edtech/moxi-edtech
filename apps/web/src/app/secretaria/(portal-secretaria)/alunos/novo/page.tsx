"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import {
  UserPlusIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  ArrowLeftIcon,
  AcademicCapIcon,
  BanknotesIcon,
} from "@heroicons/react/24/outline";

type Curso = { id: string; nome: string };
type Classe = { id: string; nome: string };
type Session = { id: string; nome: string; ano_letivo?: number | null; status?: string | null };
type TurmaItem = {
  id: string;
  nome?: string | null;
  turno?: string | null;
  ano_letivo?: number | string | null;
  ano?: number | string | null;
  curso_id?: string | null;
  classe_id?: string | null;
  curso?: { id?: string | null } | null;
  classe?: { id?: string | null } | null;
  capacidade_maxima?: number | null;
  vagas?: number | null;
  capacidade?: number | null;
  lotacao?: number | null;
  ocupacao_atual?: number | null;
  matriculados_count?: number | null;
  ocupacao?: number | null;
  codigo?: string | null;
  turma_codigo?: string | null;
  codigo_interno?: string | null;
  codigo_siga?: string | null;
};
type AlunoListItem = {
  id: string;
  nome: string;
  email?: string | null;
  responsavel?: string | null;
  telefone_responsavel?: string | null;
  status?: string | null;
  created_at: string;
  numero_processo?: string | null;
  bi_numero?: string | null;
  origem?: "aluno" | "candidatura" | null;
  candidatura_id?: string | null;
  aluno_id?: string | null;
};

export default function AlunosPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"add" | "list">("add");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [classes, setClasses] = useState<Classe[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [turmasDisponiveis, setTurmasDisponiveis] = useState<TurmaItem[]>([]);
  const [loadingTurmas, setLoadingTurmas] = useState(false);
  const [createdCandidaturaId, setCreatedCandidaturaId] = useState<string | null>(null);
  const [cacheReady, setCacheReady] = useState(false);
  const [listStatus, setListStatus] = useState<"pendente" | "ativo">("pendente");
  const [listQuery, setListQuery] = useState("");
  const [listItems, setListItems] = useState<AlunoListItem[]>([]);
  const [listLoading, setListLoading] = useState(false);

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
    cursoId: "",
    classeId: "",
    anoLetivo: new Date().getFullYear().toString(),
    turno: "",
    turmaPreferencialId: "",
    paymentMethod: "",
    paymentReference: "",
    paymentReceiptUrl: "",
  });

  const CACHE_KEY = "secretaria_novo_aluno_form";
  const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 horas

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) || {};
        if (!parsed.exp || parsed.exp > Date.now()) {
          if (parsed.formData) setFormData((prev) => ({ ...prev, ...parsed.formData }));
          if (parsed.currentStep) setCurrentStep(parsed.currentStep);
          if (parsed.activeTab) setActiveTab(parsed.activeTab);
        } else {
          localStorage.removeItem(CACHE_KEY);
        }
      }
    } catch (_) {
      /* ignore */
    } finally {
      setCacheReady(true);
    }
  }, []);

  useEffect(() => {
    if (!cacheReady) return;
    const payload = {
      formData,
      currentStep,
      activeTab,
      exp: Date.now() + CACHE_TTL_MS,
    };

    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    } catch (_) {
      /* ignore */
    }
  }, [formData, currentStep, activeTab, cacheReady, CACHE_TTL_MS]);

  useEffect(() => {
    if (activeTab !== "list") return;
    let cancelled = false;

    async function loadLista() {
      setListLoading(true);
      try {
        const params = new URLSearchParams({
          status: listStatus,
          page: "1",
          pageSize: "50",
        });
        if (listQuery.trim()) params.set("q", listQuery.trim());

        const res = await fetch(`/api/secretaria/alunos?${params.toString()}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao carregar lista");
        if (!cancelled) setListItems(json.items || []);
      } catch (_) {
        if (!cancelled) setListItems([]);
      } finally {
        if (!cancelled) setListLoading(false);
      }
    }

    loadLista();

    return () => {
      cancelled = true;
    };
  }, [activeTab, listStatus, listQuery]);

  useEffect(() => {
    if (!formData.nif && formData.idNumber) {
      setFormData((prev) => ({ ...prev, nif: prev.idNumber }));
    }
  }, [formData.idNumber, formData.nif]);

  useEffect(() => {
    async function loadCursos() {
      try {
        const [resCursos, resSessions] = await Promise.all([
          fetch("/api/secretaria/cursos"),
          fetch("/api/secretaria/school-sessions"),
        ]);

        const jsonCursos = await resCursos.json().catch(() => ({}));
        if (jsonCursos?.ok) {
          const items = Array.isArray(jsonCursos.items)
            ? jsonCursos.items
            : Array.isArray(jsonCursos.data)
            ? jsonCursos.data
            : [];
          setCursos(items);
        }

        if (resSessions.ok) {
          const json = await resSessions.json().catch(() => ({}));
          const items = (json?.data || json?.items || []) as Session[];
          setSessions(items);
          const anoAtual = Number(formData.anoLetivo);
          const ativa = items.find((s) => s.status === "ativa");
          const mesmaBase = items.find((s) => Number(s.ano_letivo) === anoAtual);
          const sugestao = mesmaBase || ativa || items[0];
          if (sugestao?.ano_letivo && sugestao.ano_letivo !== anoAtual) {
            setFormData((prev) => ({ ...prev, anoLetivo: String(sugestao.ano_letivo) }));
          }
        }
      } catch (_) {
        setCursos([]);
      }
    }
    loadCursos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!formData.cursoId) {
      setClasses([]);
      return;
    }

    const controller = new AbortController();
    fetch(`/api/secretaria/classes?curso_id=${formData.cursoId}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        if (json?.ok) setClasses(json.items || []);
      })
      .catch(() => setClasses([]));

    return () => controller.abort();
  }, [formData.cursoId]);

  useEffect(() => {
    let cancelled = false;

    async function buscarTurmasCompativeis() {
      if (!formData.cursoId || !formData.classeId) {
        setTurmasDisponiveis([]);
        return;
      }

      setLoadingTurmas(true);
      try {
        const ano = Number(formData.anoLetivo);
        const sessionId = sessions.find((s) => Number(s.ano_letivo) === ano)?.id;
        const params = new URLSearchParams();
        if (sessionId) params.append("session_id", sessionId);

        let turmas: TurmaItem[] = [];

        if (sessionId) {
          const res = await fetch(`/api/secretaria/turmas-simples?${params.toString()}`);
          const json = await res.json().catch(() => ({}));
          turmas = (json?.items || json?.data || []) as TurmaItem[];
        }

        if (!sessionId || turmas.length === 0) {
          const res = await fetch(`/api/secretaria/turmas`);
          const json = await res.json().catch(() => ({}));
          turmas = (json?.items || []) as TurmaItem[];
        }

        if (cancelled) return;

        const turnoFiltro = formData.turno.trim().toLowerCase();
        const filtradas = turmas.filter((turma) => {
          const cursoId = turma.curso_id || turma?.curso?.id;
          const classeId = turma.classe_id || turma?.classe?.id;
          const anoTurma = Number(turma.ano_letivo ?? turma.ano);
          const turnoTurma = (turma.turno || "").toString().toLowerCase();

          const matchCurso = !formData.cursoId || cursoId === formData.cursoId;
          const matchClasse = !formData.classeId || classeId === formData.classeId;
          const matchAno = !ano || !Number.isFinite(anoTurma) || anoTurma === ano;
          const matchTurno = !turnoFiltro || turnoTurma === turnoFiltro || turnoTurma.startsWith(turnoFiltro);

          return matchCurso && matchClasse && matchAno && matchTurno;
        });

        setTurmasDisponiveis(filtradas);
      } catch (_) {
        if (!cancelled) setTurmasDisponiveis([]);
      } finally {
        if (!cancelled) setLoadingTurmas(false);
      }
    }

    buscarTurmasCompativeis();

    return () => {
      cancelled = true;
    };
  }, [formData.cursoId, formData.classeId, formData.turno, formData.anoLetivo, sessions]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => {
      if (field === "cursoId") {
        return { ...prev, cursoId: value, classeId: "", turno: "", turmaPreferencialId: "" };
      }
      if (field === "classeId") {
        return { ...prev, classeId: value, turmaPreferencialId: "" };
      }
      if (field === "turno") {
        return { ...prev, turno: value, turmaPreferencialId: "" };
      }
      return { ...prev, [field]: value };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitSuccess(false);
    setCreatedCandidaturaId(null);

    try {
      const payload: Record<string, unknown> = {
        primeiro_nome: formData.firstName.trim(),
        sobrenome: formData.lastName.trim(),
        nome: `${formData.firstName} ${formData.lastName}`.trim(),
        email: formData.email.trim() || null,
        telefone: formData.phone.trim() || null,
        endereco: formData.address.trim() || null,
        data_nascimento: formData.birthDate || null,
        sexo: formData.gender || null,
        bi_numero: formData.idNumber || null,
        nif: formData.nif || formData.idNumber || null,
        responsavel_nome: formData.guardianName || null,
        responsavel_contato: formData.guardianPhone || null,
        encarregado_email: formData.guardianEmail || null,
        curso_id: formData.cursoId,
        classe_id: formData.classeId || null,
        ano_letivo: parseInt(formData.anoLetivo, 10),
      turno: formData.turno || null,
      turma_preferencial_id: formData.turmaPreferencialId || null,
      pagamento_metodo: formData.paymentMethod || null,
      pagamento_referencia: formData.paymentReference || null,
      pagamento_comprovativo_url: formData.paymentReceiptUrl || null,
    };

      const res = await fetch("/api/secretaria/alunos/novo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao criar candidatura");

      if (json?.candidatura_id || json?.id) {
        setCreatedCandidaturaId(String(json.candidatura_id || json.id));
      }
      setSubmitSuccess(true);
      try {
        localStorage.removeItem(CACHE_KEY);
      } catch (_) {
        /* ignore */
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = () => {
    if (currentStep < 4) setCurrentStep((prev) => prev + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep((prev) => prev - 1);
  };

  const canProceedToNextStep = () => {
    switch (currentStep) {
      case 1:
        return (
          formData.firstName.trim() &&
          formData.lastName.trim() &&
          formData.birthDate &&
          formData.gender &&
          formData.idNumber.trim()
        );
      case 2:
        return formData.email.trim() && formData.phone.trim() && formData.address.trim();
      case 3:
        return formData.guardianName.trim() && formData.guardianPhone.trim();
      case 4:
        return Boolean(formData.cursoId && formData.classeId);
      default:
        return false;
    }
  };

  const turnoOptions = Array.from(
    new Set(
      ["Manhã", "Tarde", "Noite", "Integral"].concat(
        turmasDisponiveis.map((t) => (t.turno || "").toString()).filter(Boolean)
      )
    )
  ).filter(Boolean);

  const vagasRestantes = (turma: TurmaItem) => {
    const capacidadeRaw = Number(
      turma.capacidade_maxima ?? turma.vagas ?? turma.capacidade ?? turma.lotacao
    );
    const ocupacaoRaw = Number(turma.ocupacao_atual ?? turma.matriculados_count ?? turma.ocupacao ?? 0);

    const capacidade = Number.isFinite(capacidadeRaw) ? capacidadeRaw : 0;
    const ocupacao = Number.isFinite(ocupacaoRaw) ? ocupacaoRaw : 0;
    return Math.max(capacidade - ocupacao, 0);
  };

  const turmaCodigo = (turma: TurmaItem) =>
    turma.codigo || turma.turma_codigo || turma.codigo_interno || turma.codigo_siga || "";

  const pendenciasAluno = (item: AlunoListItem) => {
    const pendencias = [] as string[];
    if (!item.bi_numero) pendencias.push("BI");
    if (!item.responsavel) pendencias.push("Responsável");
    if (!item.telefone_responsavel) pendencias.push("Contacto");
    if (!item.email) pendencias.push("Email");
    return pendencias;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeftIcon className="w-4 h-4" /> Voltar
          </button>
        </div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-moxinexa-teal rounded-full mb-4">
            <AcademicCapIcon className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-moxinexa-dark mb-2">Gestão de Estudantes</h1>
          <p className="text-moxinexa-gray text-lg">Cadastro de candidatos separado da matrícula</p>
        </div>

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

        {activeTab === "add" && (
          <div className="space-y-8">
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
              <div className="mb-8">
                <div className="flex items-center justify-between max-w-3xl mx-auto">
                  {[1, 2, 3, 4].map((step) => (
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
                        {step === 4 && "Académico"}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="relative max-w-3xl mx-auto -mt-5">
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-200 -z-10">
                    <div
                      className="h-full bg-moxinexa-teal transition-all duration-300"
                      style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {submitSuccess && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3 animate-fadeIn">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircleIcon className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-green-800">Candidatura criada!</p>
                      <p className="text-sm text-green-600">
                        O número de processo foi gerado automaticamente. A matrícula será feita após a confirmação financeira.
                      </p>
                      {createdCandidaturaId && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              router.push(
                                `/secretaria/admissoes/nova?candidaturaId=${encodeURIComponent(createdCandidaturaId!)}`
                              )
                            }
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 text-sm"
                          >
                            Abrir fluxo de matrícula
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
                  <p className="text-sm text-blue-700 flex items-center gap-2">
                    <InformationCircleIcon className="w-5 h-5" />
                    <span>
                      <strong>Fluxo:</strong> Cadastro rápido cria a candidatura com número de processo. A matrícula e o login só nascem após a confirmação financeira.
                    </span>
                  </p>
                </div>

                {currentStep === 1 && (
                  <div className="space-y-6 animate-fadeIn">
                    <div>
                      <h2 className="text-xl font-semibold text-moxinexa-dark mb-2">Informações Pessoais</h2>
                      <p className="text-moxinexa-gray text-sm">Dados fundamentais do estudante</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-moxinexa-dark">Primeiro Nome *</label>
                        <input
                          type="text"
                          placeholder="Manuel"
                          className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all"
                          value={formData.firstName}
                          onChange={(e) => handleInputChange("firstName", e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-moxinexa-dark">Sobrenome *</label>
                        <input
                          type="text"
                          placeholder="José"
                          className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all"
                          value={formData.lastName}
                          onChange={(e) => handleInputChange("lastName", e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-moxinexa-dark">Data de Nascimento *</label>
                        <input
                          type="date"
                          className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all"
                          value={formData.birthDate}
                          onChange={(e) => handleInputChange("birthDate", e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-moxinexa-dark">Género *</label>
                        <div className="flex gap-6 mt-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="gender"
                              value="M"
                              className="text-moxinexa-teal focus:ring-moxinexa-teal"
                              checked={formData.gender === "M"}
                              onChange={(e) => handleInputChange("gender", e.target.value)}
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
                              checked={formData.gender === "F"}
                              onChange={(e) => handleInputChange("gender", e.target.value)}
                              required
                            />
                            <span>Feminino</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-moxinexa-dark">Nº do Bilhete de Identidade *</label>
                      <input
                        type="text"
                        placeholder="004568923LA049"
                        className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all"
                        value={formData.idNumber}
                        onChange={(e) => handleInputChange("idNumber", e.target.value)}
                        required
                      />
                    </div>
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="space-y-6 animate-fadeIn">
                    <div>
                      <h2 className="text-xl font-semibold text-moxinexa-dark mb-2">Contactos</h2>
                      <p className="text-moxinexa-gray text-sm">Como entraremos em contacto</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-moxinexa-dark">Email *</label>
                        <input
                          type="email"
                          placeholder="manuel.jose@escola.co.ao"
                          className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all"
                          value={formData.email}
                          onChange={(e) => handleInputChange("email", e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-moxinexa-dark">Telefone *</label>
                        <input
                          type="tel"
                          placeholder="+244 923 456 789"
                          className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all"
                          value={formData.phone}
                          onChange={(e) => handleInputChange("phone", e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-moxinexa-dark">Endereço *</label>
                      <input
                        type="text"
                        placeholder="Rua da Independência, nº 45 - Cazenga, Luanda"
                        className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all"
                        value={formData.address}
                        onChange={(e) => handleInputChange("address", e.target.value)}
                        required
                      />
                    </div>
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="space-y-6 animate-fadeIn">
                    <div>
                      <h2 className="text-xl font-semibold text-moxinexa-dark mb-2">Encarregado de Educação</h2>
                      <p className="text-moxinexa-gray text-sm">Responsável pelo estudante</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-moxinexa-dark">Nome do Encarregado *</label>
                        <input
                          type="text"
                          placeholder="António Manuel"
                          className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all"
                          value={formData.guardianName}
                          onChange={(e) => handleInputChange("guardianName", e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-moxinexa-dark">Contacto do Encarregado *</label>
                        <input
                          type="tel"
                          placeholder="+244 912 123 456"
                          className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all"
                          value={formData.guardianPhone}
                          onChange={(e) => handleInputChange("guardianPhone", e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-moxinexa-dark">Email do Encarregado</label>
                      <input
                        type="email"
                        placeholder="encarregado@exemplo.co.ao"
                        className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all"
                        value={formData.guardianEmail}
                        onChange={(e) => handleInputChange("guardianEmail", e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {currentStep === 4 && (
                  <div className="space-y-6 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">Interesse Académico</h2>
                        <p className="text-gray-500 text-sm">
                          Escolha Curso → Classe → Turno para sugerir uma turma preferencial do ano letivo.
                        </p>
                      </div>
                      <BanknotesIcon className="w-8 h-8 text-amber-500" />
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium">Curso Pretendido *</label>
                        <select
                          className="w-full border p-3 rounded-lg"
                          value={formData.cursoId}
                          onChange={(e) => handleInputChange("cursoId", e.target.value)}
                          required
                        >
                          <option value="">Selecione um curso...</option>
                          {cursos.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nome}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-medium">Classe Pretendida *</label>
                        <select
                          className="w-full border p-3 rounded-lg"
                          value={formData.classeId}
                          onChange={(e) => handleInputChange("classeId", e.target.value)}
                          disabled={!formData.cursoId}
                          required
                        >
                          <option value="">{formData.cursoId ? "Selecione a classe..." : "Escolha um curso primeiro"}</option>
                          {classes.map((cls) => (
                            <option key={cls.id} value={cls.id}>
                              {cls.nome}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-medium">Turno desejado</label>
                        <select
                          className="w-full border p-3 rounded-lg"
                          value={formData.turno}
                          onChange={(e) => handleInputChange("turno", e.target.value)}
                          disabled={!formData.classeId}
                        >
                          <option value="">Indiferente / Disponível</option>
                          {turnoOptions.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500">Filtre pelas turmas que encaixam no turno desejado.</p>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-medium">Ano Letivo</label>
                        <input
                          type="number"
                          className="w-full border p-3 rounded-lg bg-gray-100"
                          value={formData.anoLetivo}
                          disabled
                        />
                        <p className="text-xs text-gray-500">Usamos o ano ativo para sugerir as turmas.</p>
                      </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex gap-3">
                      <BanknotesIcon className="w-6 h-6 text-amber-600" />
                      <div className="text-sm text-amber-800">
                        <strong>Atenção:</strong> Este fluxo cria somente a candidatura e o número de processo. A matrícula e o login nascem na confirmação financeira.
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <label className="block text-sm font-medium text-gray-700">Turma preferencial (opcional)</label>
                        <span className="text-xs text-gray-500">Listamos turmas ativas do ano letivo selecionado.</span>
                      </div>

                      {loadingTurmas ? (
                        <div className="flex items-center gap-3 text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg p-4">
                          <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                          A carregar turmas compatíveis...
                        </div>
                      ) : turmasDisponiveis.length === 0 ? (
                        <div className="text-sm text-gray-500 italic border border-dashed border-gray-300 rounded-lg p-4">
                          {formData.classeId
                            ? "Nenhuma turma ativa encontrada para esta combinação. O aluno ficará em lista de espera."
                            : "Selecione Curso, Classe e Turno (se quiser) para ver as turmas."}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-3">
                          {turmasDisponiveis.map((turma) => (
                            <label
                              key={turma.id}
                              className={`
                                flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all
                                ${formData.turmaPreferencialId === turma.id
                                  ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500"
                                  : "border-gray-200 hover:border-emerald-200 hover:bg-gray-50"}
                              `}
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="radio"
                                  name="turma_pref"
                                  value={turma.id}
                                  checked={formData.turmaPreferencialId === turma.id}
                                  onChange={() => handleInputChange("turmaPreferencialId", turma.id)}
                                  className="text-emerald-600 focus:ring-emerald-500"
                                />
                                <div>
                                  <p className="font-bold text-gray-900">
                                    {turma.nome} ({turmaCodigo(turma)})
                                  </p>
                                  <p className="text-xs text-gray-500 flex gap-2">
                                    <span>Turno: {turma.turno || "N/D"}</span>
                                    <span className="text-gray-300">•</span>
                                    <span>Ano: {turma.ano_letivo ?? turma.ano ?? formData.anoLetivo}</span>
                                  </p>
                                </div>
                              </div>

                              <div className="text-right">
                                <span
                                  className={`text-xs font-bold px-2 py-1 rounded-full ${
                                    vagasRestantes(turma) > 0
                                      ? "bg-green-100 text-green-700"
                                      : "bg-red-100 text-red-700"
                                  }`}
                                >
                                  {vagasRestantes(turma)} vagas rest.
                                </span>
                              </div>
                            </label>
                          ))}

                          <label className="flex items-center gap-3 p-3 text-sm text-gray-500 cursor-pointer">
                            <input
                              type="radio"
                              name="turma_pref"
                              checked={!formData.turmaPreferencialId}
                              onChange={() => handleInputChange("turmaPreferencialId", "")}
                            />
                            <span>Prefiro alocar a turma depois (após pagamento)</span>
                          </label>
                        </div>
                      )}
                    </div>

                    <div className="border border-dashed border-gray-200 rounded-lg p-4 bg-gray-50">
                      <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <BanknotesIcon className="w-5 h-5" /> Pagamento da Matrícula
                      </h4>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">Método</label>
                          <select
                            value={formData.paymentMethod}
                            onChange={(e) => handleInputChange("paymentMethod", e.target.value)}
                            className="w-full rounded-lg border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
                          >
                            <option value="">Selecione (financeiro)</option>
                            <option value="cartao_multicaixa">Cartão Multicaixa</option>
                            <option value="multicaixa_express">Multicaixa Express</option>
                            <option value="transferencia_bancaria">Transferência Bancária</option>
                            <option value="dinheiro">Dinheiro em espécie</option>
                            <option value="outro">Outro / a compensar</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">Referência / Observação</label>
                          <input
                            type="text"
                            value={formData.paymentReference}
                            onChange={(e) => handleInputChange("paymentReference", e.target.value)}
                            placeholder="Ex: comprovativo #123, operação, terminal"
                            className="w-full rounded-lg border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
                          />
                        </div>
                      </div>
                      <div className="space-y-2 mt-3">
                        <label className="block text-sm font-medium text-gray-700">URL do comprovativo (opcional)</label>
                        <input
                          type="url"
                          value={formData.paymentReceiptUrl}
                          onChange={(e) => handleInputChange("paymentReceiptUrl", e.target.value)}
                          placeholder="Link para comprovativo / upload"
                          className="w-full rounded-lg border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
                        />
                        <p className="text-xs text-gray-500">Essas informações ficam registradas na candidatura para o Financeiro compensar.</p>
                      </div>
                    </div>
                  </div>
                )}

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

                  {currentStep < 4 ? (
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
                          Finalizando Candidatura...
                        </>
                      ) : (
                        <>
                          <UserPlusIcon className="w-5 h-5" />
                          Finalizar Candidatura
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </form>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
              <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <InformationCircleIcon className="w-5 h-5" />
                Dicas Rápidas
              </h3>
              <ul className="text-blue-800 text-sm space-y-2">
                <li>• Cadastro gera número de processo automático.</li>
                <li>• Matrícula oficial e login só após confirmação financeira.</li>
                <li>• Preencha curso pretendido para direcionar a candidatura.</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === "list" && (
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-moxinexa-dark">Lista de Estudantes</h2>
                <p className="text-moxinexa-gray text-sm">Todos os estudantes cadastrados no sistema</p>
              </div>
              <Button tone="teal" size="sm">
                <UserPlusIcon className="w-4 h-4" />
                Exportar Lista
              </Button>
            </div>

            <div className="flex flex-col gap-3 mb-4 md:flex-row md:items-center md:justify-between">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setListStatus("pendente")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                    listStatus === "pendente"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-white text-gray-500 border-gray-200"
                  }`}
                >
                  Leads
                </button>
                <button
                  type="button"
                  onClick={() => setListStatus("ativo")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                    listStatus === "ativo"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-white text-gray-500 border-gray-200"
                  }`}
                >
                  Matriculados
                </button>
              </div>
              <div className="w-full md:max-w-sm">
                <input
                  type="text"
                  placeholder="Buscar por nome ou processo"
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent"
                  value={listQuery}
                  onChange={(e) => setListQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-moxinexa-dark">
                    <th className="px-4 py-3 text-left font-semibold rounded-l-lg">Nº Processo/BI</th>
                    <th className="px-4 py-3 text-left font-semibold">Nome</th>
                    <th className="px-4 py-3 text-left font-semibold">Email</th>
                    <th className="px-4 py-3 text-left font-semibold">Telefone</th>
                    <th className="px-4 py-3 text-left font-semibold">Pendências</th>
                    <th className="px-4 py-3 text-left font-semibold rounded-r-lg">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {listLoading && (
                    <tr>
                      <td className="px-4 py-4 text-gray-500" colSpan={6}>
                        Carregando lista...
                      </td>
                    </tr>
                  )}
                  {!listLoading && listItems.length === 0 && (
                    <tr>
                      <td className="px-4 py-4 text-gray-500" colSpan={6}>
                        Nenhum estudante encontrado.
                      </td>
                    </tr>
                  )}
                  {listItems.map((item) => {
                    const pendencias = pendenciasAluno(item);
                    const contato = item.telefone_responsavel || "—";
                    const documento = item.numero_processo || item.bi_numero || "—";
                    const actionHref = item.aluno_id
                      ? `/secretaria/alunos/${item.aluno_id}/editar`
                      : item.origem === "aluno"
                      ? `/secretaria/alunos/${item.id}/editar`
                      : item.candidatura_id || item.id
                      ? `/secretaria/candidaturas/${item.candidatura_id || item.id}/editar`
                      : null;
                    return (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors duration-150">
                        <td className="px-4 py-3 text-xs text-gray-700 font-mono">{documento}</td>
                        <td className="px-4 py-3 font-medium">{item.nome}</td>
                        <td className="px-4 py-3">{item.email || "—"}</td>
                        <td className="px-4 py-3">{contato}</td>
                        <td className="px-4 py-3">
                          {pendencias.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {pendencias.map((p) => (
                                <span
                                  key={p}
                                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200"
                                >
                                  {p}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-emerald-600 font-semibold">Completo</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {actionHref ? (
                            <button
                              type="button"
                              onClick={() => router.push(actionHref)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-moxinexa-teal text-white hover:bg-teal-600"
                            >
                              Resolver
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

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
      `}</style>
    </div>
  );
}
