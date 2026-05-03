"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { InscricaoBalcaoModal } from "./InscricaoBalcaoModal";

type Cohort = {
  id: string;
  codigo: string;
  nome: string;
  curso_nome: string;
  carga_horaria_total: number;
  vagas: number;
  data_inicio: string;
  data_fim: string;
  status: string;
  visivel_na_landing: boolean;
  created_at: string;
  valor_referencia?: number | null;
  curso_id?: string | null;
  turno?: string | null;
};

type FormadorOption = {
  user_id: string;
  nome: string;
  email: string | null;
  papel?: string;
};

type CursoCatalogo = {
  id: string;
  codigo: string;
  nome: string;
  area: string | null;
  modalidade: "presencial" | "online" | "hibrido";
  carga_horaria: number | null;
  status: string;
  preco_tabela: number;
  desconto_ativo: boolean;
  desconto_percentual: number;
  parceria_b2b_ativa: boolean;
  modulos: Array<{
    ordem: number;
    titulo: string;
    carga_horaria: number | null;
    descricao: string | null;
  }>;
};

type CohortDetail = {
  cohort: Cohort;
  summary: {
    formandos: number;
    sessoes: number;
    materiais: number;
    certificados: number;
    modulos: number;
  };
  tabs: {
    formandos: Array<{
      user_id: string;
      inscricao_id: string | null;
      nome: string;
      email: string | null;
      telefone: string | null;
      presenca_percentual: number | null;
      status_pagamento: string;
      academic_status: string;
      access_blocked: boolean;
      valor_total: number;
      descricao: string;
      parcelas: Array<{
        item_id: string;
        descricao: string;
        status: "pago" | "pendente" | "atrasado";
        valor: number;
      }>;
    }>;
    sessoes: Array<{
      id: string;
      formador_user_id: string;
      formador_nome: string;
      competencia: string;
      horas_ministradas: number;
      valor_hora: number;
      status: string;
    }>;
    materiais: Array<{
      id: string;
      titulo: string;
      tipo: string;
      status: string;
      updated_at: string;
    }>;
    certificados: Array<{
      id: string;
      numero_documento: string;
      emitido_em: string;
      formando_user_id: string;
      formando_nome: string;
      template_id: string | null;
    }>;
    formadores: Array<{
      id: string;
      user_id: string;
      nome: string;
      email: string | null;
      percentual_honorario: number;
      created_at: string;
    }>;
    modulos: Array<{
      id: string;
      titulo: string;
      ordem: number;
      carga_horaria: number | null;
    }>;
  };
  finance: {
    mode: "b2b" | "b2c";
    recebido: number;
    pendente: number;
    atualizado_em: string;
    b2c: {
      parcelas: string[];
    };
    b2b: {
      cliente: {
        id: string;
        nome_fantasia: string;
        razao_social: string | null;
      };
      fatura: {
        id: string;
        referencia: string;
        vencimento_em: string;
        total_liquido: number;
        status: string;
      };
      colaboradores_cobertos: Array<{
        user_id: string;
        nome: string;
        email: string | null;
      }>;
    } | null;
  };
};

type StatusFilter = "todos" | "rascunho" | "aberta" | "em curso" | "concluída" | "cancelada";
type DetailTab = "formandos" | "formadores" | "sessoes" | "materiais" | "certificados" | "diario" | "avaliacoes";

type EvaluationRow = {
  id?: string;
  inscricao_id: string;
  modulo_id: string;
  nota?: number | null;
  conceito: "apto" | "nao_apto" | "em_progresso" | "isento";
  observacoes?: string | null;
};

type ProgressRow = {
  inscricao_id: string;
  percentual_presenca: number;
  total_aulas_realizadas: number;
  total_modulos: number;
  modulos_aprovados: number;
  elegivel_certificacao: boolean;
};

type Aula = {
  id: string;
  data: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  conteudo_previsto: string | null;
  conteudo_realizado: string | null;
  horas_ministradas: number;
  status: "agendada" | "realizada" | "adiada" | "cancelada";
  observacoes: string | null;
  formador_user_id: string | null;
};

type PresencaRow = {
  id: string;
  inscricao_id: string;
  presente: boolean;
  justificativa: string | null;
  formacao_inscricoes: {
    formando_user_id: string;
    nome_snapshot: string;
  };
};
type MetodoPagamento = "tpa" | "transferencia" | "numerario";

function normalizeStatus(raw: string): Exclude<StatusFilter, "todos"> {
  const status = String(raw).trim().toLowerCase();
  if (status === "planeada" || status === "rascunho") return "rascunho";
  if (status === "aberta") return "aberta";
  if (status === "em_andamento" || status === "em curso") return "em curso";
  if (status === "concluida" || status === "concluída") return "concluída";
  if (status === "cancelada") return "cancelada";
  return "rascunho";
}

function toApiStatus(status: Exclude<StatusFilter, "todos">) {
  if (status === "rascunho") return "planeada";
  if (status === "em curso") return "em_andamento";
  if (status === "concluída") return "concluida";
  return status;
}

function statusPillClass(status: Exclude<StatusFilter, "todos">) {
  if (status === "rascunho") return "bg-slate-100 text-slate-700 border-slate-200";
  if (status === "aberta") return "bg-blue-100 text-blue-700 border-blue-200";
  if (status === "em curso") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (status === "concluída") return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-rose-100 text-rose-700 border-rose-200";
}

function paymentPillClass(status: string) {
  const value = status.toLowerCase();
  if (value.includes("pago")) return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (value.includes("atras")) return "bg-rose-100 text-rose-700 border-rose-200";
  return "bg-amber-100 text-amber-700 border-amber-200";
}

function academicStatusPillClass(status: string) {
  const value = String(status ?? "").trim().toLowerCase();
  if (value === "apto") return "bg-green-100 text-green-700 border-green-200";
  if (value === "desistente" || value === "não apto" || value === "nao_apto") return "bg-red-100 text-red-700 border-red-200";
  if (value === "cursando") return "bg-slate-100 text-slate-700 border-slate-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function normalizeAcademicStatus(status: string) {
  const value = String(status ?? "").trim().toLowerCase();
  if (value === "nao_apto" || value === "não apto") return "nao_apto";
  if (value === "desistente") return "desistente";
  if (value === "apto") return "apto";
  return "cursando";
}

function academicStatusLabel(status: string) {
  const value = normalizeAcademicStatus(status);
  if (value === "nao_apto") return "Não apto";
  if (value === "desistente") return "Desistente";
  if (value === "apto") return "Apto";
  return "Cursando";
}

function renderPaymentCell(
  status: string,
  itemId: string,
  formandoNome: string,
  parcela: string,
  valor: number,
  onRegister: (itemId: string, formingoNome: string, parcela: string, valor: number) => void
) {
  const normalized = String(status ?? "").toLowerCase();
  const isLateOrPending = normalized.includes("atras") || normalized.includes("pendente");
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${paymentPillClass(status)}`}>
        {status}
      </span>
      {isLateOrPending ? (
        <button
          type="button"
          onClick={() => onRegister(itemId, formandoNome, parcela, valor)}
          className="inline-flex items-center gap-1 rounded-md border border-[#E4EBE6] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#4A6352] hover:bg-[#F7F9F7]"
        >
          + Registar Pagamento
        </button>
      ) : null}
    </div>
  );
}

export default function CohortsPage() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [formandoSearch, setFormandoSearch] = useState("");
  const [formandoAcademicFilter, setFormandoAcademicFilter] = useState<"todos" | "cursando" | "desistente" | "apto" | "nao_apto">("todos");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState<StatusFilter>("todos");
  const [activeTab, setActiveTab] = useState<DetailTab>("formandos");

  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<CohortDetail | null>(null);
  const [financeView, setFinanceView] = useState<"b2c" | "b2b">("b2c");
  const [showPagamentoModal, setShowPagamentoModal] = useState(false);
  const [showInscricaoModal, setShowInscricaoModal] = useState(false);
  const [pagamentoTarget, setPagamentoTarget] = useState<{ itemId: string; formandoNome: string; parcela: string } | null>(null);
  const [pagamentoForm, setPagamentoForm] = useState({
    valor: "",
    metodo: "transferencia" as MetodoPagamento,
    comprovativo: "",
  });
  const [formandoBusy, setFormandoBusy] = useState<Record<string, boolean>>({});
  const [statusEditorTarget, setStatusEditorTarget] = useState<{ user_id: string; nome: string; status: "cursando" | "desistente" | "apto" | "nao_apto" } | null>(null);
  const [formadorBusy, setFormadorBusy] = useState(false);
  const [formadorAssignmentForm, setFormadorAssignmentForm] = useState({
    formador_user_id: "",
    percentual_honorario: "100",
    turno: "",
  });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState<"selector" | "form">("selector");
  const [showRescueModal, setShowRescueModal] = useState(false);
  const [rescueTarget, setRescueTarget] = useState<Cohort | null>(null);

  const [aulas, setAulas] = useState<Aula[]>([]);
  const [loadingAulas, setLoadingAulas] = useState(false);
  const [showAulaModal, setShowAulaModal] = useState(false);
  const [aulaForm, setAulaForm] = useState({
    id: "",
    data: new Date().toISOString().split("T")[0],
    hora_inicio: "08:00",
    hora_fim: "12:00",
    conteudo_previsto: "",
    conteudo_realizado: "",
    horas_ministradas: "4",
    status: "agendada" as Aula["status"],
    formador_user_id: "",
  });

  const [showPresencaModal, setShowPresencaModal] = useState(false);
  const [activeAula, setActiveAula] = useState<Aula | null>(null);
  const [presencas, setPresencas] = useState<PresencaRow[]>([]);
  const [loadingPresencas, setLoadingPresencas] = useState(false);

  const [evaluations, setEvaluations] = useState<EvaluationRow[]>([]);
  const [progressData, setProgressData] = useState<ProgressRow[]>([]);
  const [loadingEvaluations, setLoadingEvaluations] = useState(false);
  const [savingEvaluations, setSavingEvaluations] = useState(false);

  const [formadores, setFormadores] = useState<FormadorOption[]>([]);
  useEffect(() => {
    if (selectedId && (activeTab === "avaliacoes" || activeTab === "certificados")) {
      loadEvaluations();
    }
  }, [selectedId, activeTab]);

  const loadEvaluations = async () => {
    if (!selectedId) return;
    try {
      setLoadingEvaluations(true);
      
      const [resGrid, resProgress] = await Promise.all([
        fetch(`/api/formacao/backoffice/cohorts/${selectedId}/avaliacoes?type=grid`),
        fetch(`/api/formacao/backoffice/cohorts/${selectedId}/avaliacoes?type=progress`)
      ]);

      const jsonGrid = await resGrid.json();
      const jsonProgress = await resProgress.json();

      if (jsonGrid.ok) setEvaluations(jsonGrid.items);
      if (jsonProgress.ok) setProgressData(jsonProgress.items);
    } catch (err) {
      console.error("Erro ao carregar avaliações:", err);
    } finally {
      setLoadingEvaluations(false);
    }
  };

  const updateEvaluation = (inscricaoId: string, moduloId: string, conceito: EvaluationRow["conceito"]) => {
    setEvaluations((prev) => {
      const existing = prev.find(e => e.inscricao_id === inscricaoId && e.modulo_id === moduloId);
      if (existing) {
        return prev.map(e => (e.inscricao_id === inscricaoId && e.modulo_id === moduloId ? { ...e, conceito } : e));
      }
      return [...prev, { inscricao_id: inscricaoId, modulo_id: moduloId, conceito }];
    });
  };

  const saveEvaluations = async () => {
    if (!selectedId) return;
    setSavingEvaluations(true);
    try {
      const res = await fetch(`/api/formacao/backoffice/cohorts/${selectedId}/avaliacoes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ evaluations }),
      });
      const json = await res.json();
      if (json.ok) {
        setInfo("Avaliações guardadas com sucesso!");
        loadEvaluations();
      } else {
        setError(json.error || "Erro ao guardar avaliações");
      }
    } catch (err) {
      console.error("Erro ao guardar avaliações:", err);
    } finally {
      setSavingEvaluations(false);
    }
  };
  const [catalogoCursos, setCatalogoCursos] = useState<CursoCatalogo[]>([]);
  const [form, setForm] = useState({
    codigo: "",
    nome: "",
    curso_id: "",
    curso_nome: "",
    carga_horaria_total: "",
    vagas: "",
    data_inicio: "",
    data_fim: "",
    status: "aberta" as Exclude<StatusFilter, "todos">,
    visivel_na_landing: true,
    formador_user_id: "",
    percentual_honorario: "100",
    valor_referencia: "",
    turno: "",
  });

  const loadCohorts = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/formacao/backoffice/cohorts", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as
        | { ok: boolean; error?: string; items?: Cohort[] }
        | null;

      if (!res.ok || !json?.ok || !Array.isArray(json.items)) {
        throw new Error(json?.error || "Falha ao carregar turmas");
      }

      const nextItems = json.items;
      setItems(nextItems);
      if (nextItems.length > 0) {
        setSelectedId((prev) => prev ?? nextItems[0].id);
      } else {
        setSelectedId(null);
        setDetail(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  const loadFormadores = async () => {
    try {
      const res = await fetch("/api/formacao/backoffice/cohorts/options", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as
        | { ok: boolean; formadores?: FormadorOption[] }
        | null;

      if (!res.ok || !json?.ok || !Array.isArray(json.formadores)) return;
      setFormadores(json.formadores);
    } catch {
      setFormadores([]);
    }
  };

  const loadCatalogoCursos = async () => {
    try {
      const res = await fetch("/api/formacao/backoffice/cursos", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as
        | { ok: boolean; items?: CursoCatalogo[] }
        | null;
      if (!res.ok || !json?.ok || !Array.isArray(json.items)) return;
      setCatalogoCursos(json.items.filter((item) => String(item.status).toLowerCase().includes("ativo")));
    } catch {
      setCatalogoCursos([]);
    }
  };

  const loadDetail = async (id: string) => {
    try {
      setDetailLoading(true);
      const res = await fetch(`/api/formacao/backoffice/cohorts/${id}`, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as
        | {
            ok: boolean;
            error?: string;
            cohort?: Cohort;
            summary?: CohortDetail["summary"];
            tabs?: CohortDetail["tabs"];
            finance?: CohortDetail["finance"];
          }
        | null;

      if (!res.ok || !json?.ok || !json?.cohort || !json.tabs || !json.summary || !json.finance) {
        throw new Error(json?.error || "Falha ao carregar detalhe da turma");
      }

      setDetail({ cohort: json.cohort, tabs: json.tabs, summary: json.summary, finance: json.finance });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    loadCohorts();
    loadFormadores();
    loadCatalogoCursos();
  }, []);

  useEffect(() => {
    const shouldOpenCreate = searchParams.get("openCreate") === "1";
    const focusTarget = searchParams.get("focus");
    const prefillCursoId = searchParams.get("curso_id");

    if (shouldOpenCreate) {
      setShowCreateModal(true);
      if (prefillCursoId) {
        onSelectCurso(prefillCursoId);
        setCreateStep("form");
      } else {
        setCreateStep("selector");
      }
    }

    if (!shouldOpenCreate) return;

    if (focusTarget === "formador") {
      const timer = setTimeout(() => {
        const el = document.getElementById("cohort-formador-user-id");
        el?.focus();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [searchParams, catalogoCursos]);

  useEffect(() => {
    if (!selectedId) return;
    loadDetail(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (selectedId && activeTab === "diario") {
      loadAulas();
    }
  }, [selectedId, activeTab]);

  const loadAulas = async () => {
    if (!selectedId) return;
    try {
      setLoadingAulas(true);
      const res = await fetch(`/api/formacao/backoffice/cohorts/${selectedId}/aulas`);
      const json = await res.json();
      if (json.ok) setAulas(json.items);
    } catch (err) {
      console.error("Erro ao carregar aulas:", err);
    } finally {
      setLoadingAulas(false);
    }
  };

  const saveAula = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setError(null);

    const res = await fetch(`/api/formacao/backoffice/cohorts/${selectedId}/aulas`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(aulaForm),
    });

    const json = await res.json();
    if (!json.ok) {
      setError(json.error || "Erro ao salvar aula");
      return;
    }

    setShowAulaModal(false);
    loadAulas();
    setInfo("Aula registada com sucesso!");
  };

  const openPresencaModal = async (aula: Aula) => {
    setActiveAula(aula);
    setShowPresencaModal(true);
    setLoadingPresencas(true);
    try {
      const res = await fetch(`/api/formacao/backoffice/cohorts/${selectedId}/aulas/${aula.id}/presencas`);
      const json = await res.json();
      if (json.ok) setPresencas(json.items);
    } catch (err) {
      console.error("Erro ao carregar presenças:", err);
    } finally {
      setLoadingPresencas(false);
    }
  };

  const updatePresenca = (inscricaoId: string, presente: boolean) => {
    setPresencas((prev) =>
      prev.map((p) => (p.inscricao_id === inscricaoId ? { ...p, presente } : p))
    );
  };

  const savePresencas = async () => {
    if (!selectedId || !activeAula) return;
    setLoadingPresencas(true);
    try {
      const res = await fetch(`/api/formacao/backoffice/cohorts/${selectedId}/aulas/${activeAula.id}/presencas`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          presencas: presencas.map((p) => ({
            inscricao_id: p.inscricao_id,
            presente: p.presente,
            justificativa: p.justificativa,
          })),
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setShowPresencaModal(false);
        setInfo("Presenças guardadas com sucesso!");
      } else {
        setError(json.error || "Erro ao guardar presenças");
      }
    } catch (err) {
      console.error("Erro ao guardar presenças:", err);
    } finally {
      setLoadingPresencas(false);
    }
  };

  const statusCounts = useMemo(() => {
    const base = {
      todos: items.length,
      rascunho: 0,
      aberta: 0,
      "em curso": 0,
      concluída: 0,
      cancelada: 0,
    } as Record<StatusFilter, number>;

    for (const item of items) {
      const normalized = normalizeStatus(item.status);
      base[normalized] += 1;
    }

    return base;
  }, [items]);

  const visibleItems = useMemo(() => {
    if (activeStatus === "todos") return items;
    return items.filter((item) => normalizeStatus(item.status) === activeStatus);
  }, [activeStatus, items]);

  const createCohort = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!form.curso_id) {
      setError("A vinculação a um curso é obrigatória.");
      return;
    }

    const payload = {
      codigo: form.codigo,
      nome: form.nome,
      curso_id: form.curso_id,
      curso_nome: form.curso_nome,
      carga_horaria_total: Number(form.carga_horaria_total),
      vagas: Number(form.vagas),
      data_inicio: form.data_inicio,
      data_fim: form.data_fim,
      status: toApiStatus(form.status),
      visivel_na_landing: form.visivel_na_landing,
      formador_user_id: form.formador_user_id || undefined,
      percentual_honorario: form.formador_user_id ? Number(form.percentual_honorario) : undefined,
      valor_referencia: form.valor_referencia ? Number(form.valor_referencia) : undefined,
      turno: form.turno || undefined,
    };

    const res = await fetch("/api/formacao/backoffice/cohorts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string; item?: Cohort } | null;
    if (!res.ok || !json?.ok || !json.item) {
      setError(json?.error || "Falha ao criar turma");
      return;
    }

    setShowCreateModal(false);
    setCreateStep("selector");
    setForm({
      codigo: "",
      nome: "",
      curso_id: "",
      curso_nome: "",
      carga_horaria_total: "",
      vagas: "",
      data_inicio: "",
      data_fim: "",
      status: "aberta",
      visivel_na_landing: true,
      formador_user_id: "",
      percentual_honorario: "100",
      valor_referencia: "",
      turno: "",
    });

    await loadCohorts();
    setSelectedId(json.item.id);
  };

  const orphans = useMemo(() => items.filter((item) => !item.curso_id), [items]);

  const rescueCohort = async (event: FormEvent) => {
    event.preventDefault();
    if (!rescueTarget || !form.curso_id) return;

    setError(null);
    const res = await fetch("/api/formacao/backoffice/cohorts", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: rescueTarget.id,
        curso_id: form.curso_id,
        turno: form.turno,
      }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      setError(json?.error || "Falha ao vincular curso");
      return;
    }

    setShowRescueModal(false);
    setRescueTarget(null);
    setForm((prev) => ({ ...prev, curso_id: "", turno: "" }));
    await loadCohorts();
    setInfo("Turma vinculada com sucesso! Módulos e materiais foram herdados do catálogo.");
  };

  const onSelectCurso = (cursoId: string) => {
    const curso = catalogoCursos.find((item) => item.id === cursoId);
    if (!curso) {
      setForm((prev) => ({
        ...prev,
        curso_id: "",
        curso_nome: "",
        carga_horaria_total: "",
        valor_referencia: "",
      }));
      return;
    }
    setForm((prev) => ({
      ...prev,
      curso_id: curso.id,
      curso_nome: curso.nome,
      carga_horaria_total: String(curso.carga_horaria ?? ""),
      valor_referencia: String(curso.preco_tabela ?? 0),
    }));
  };

  const changeStatus = async (id: string, status: Exclude<StatusFilter, "todos">) => {
    setError(null);
    setInfo(null);
    const res = await fetch("/api/formacao/backoffice/cohorts", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status: toApiStatus(status) }),
    });

    const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;
    if (!res.ok || !json?.ok) {
      setError(json?.error || "Falha ao atualizar status da turma");
      return;
    }

    await loadCohorts();
    if (selectedId === id) await loadDetail(id);
  };

  const removeItem = async (id: string) => {
    setError(null);
    setInfo(null);

    const res = await fetch(`/api/formacao/backoffice/cohorts?id=${id}`, {
      method: "DELETE",
    });

    const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;
    if (!res.ok || !json?.ok) {
      setError(json?.error || "Falha ao remover turma");
      return;
    }

    await loadCohorts();
  };

  const toggleVisibility = async (id: string, current: boolean) => {
    setError(null);
    const res = await fetch("/api/formacao/backoffice/cohorts", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, visivel_na_landing: !current }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      setError(json?.error || "Falha ao atualizar visibilidade");
      return;
    }
    await loadCohorts();
    if (selectedId === id) await loadDetail(id);
  };

  const openPagamentoModal = (itemId: string, formandoNome: string, parcela: string, valor: number) => {
    setPagamentoTarget({ itemId, formandoNome, parcela });
    setPagamentoForm({
      valor: String(Number(valor || 0)),
      metodo: "transferencia",
      comprovativo: "",
    });
    setShowPagamentoModal(true);
  };

  const registrarPagamentoRapido = async (event: FormEvent) => {
    event.preventDefault();
    if (!pagamentoTarget) return;

    setError(null);
    setInfo(null);
    const res = await fetch("/api/formacao/financeiro/faturacao-b2c", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: pagamentoTarget.itemId, status_pagamento: "pago" }),
    });
    const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;
    if (!res.ok || !json?.ok) {
      setError(json?.error || "Falha ao registar pagamento");
      return;
    }

    setShowPagamentoModal(false);
    setPagamentoTarget(null);
    setPagamentoForm({ valor: "", metodo: "transferencia", comprovativo: "" });
    if (selectedId) await loadDetail(selectedId);
  };

  const runFormandoAction = async (
    formandoUserId: string,
    payload:
      | { action: "resend_access" }
      | { action: "set_access_block"; blocked: boolean }
      | { action: "set_academic_status"; status: "cursando" | "desistente" | "apto" | "nao_apto" }
  ) => {
    if (!detail) return;
    setError(null);
    setInfo(null);
    setFormandoBusy((prev) => ({ ...prev, [formandoUserId]: true }));
    try {
      const res = await fetch(`/api/formacao/backoffice/cohorts/${detail.cohort.id}/formandos/${formandoUserId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string; message?: string } | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Falha ao executar ação do formando");
      }
      await loadDetail(detail.cohort.id);
      setInfo(json?.message || "Ação aplicada com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setFormandoBusy((prev) => ({ ...prev, [formandoUserId]: false }));
    }
  };

  const assignFormadorToCohort = async (event: FormEvent) => {
    event.preventDefault();
    if (!detail) return;

    setError(null);
    setInfo(null);
    setFormadorBusy(true);

    try {
      const res = await fetch(`/api/formacao/backoffice/cohorts/${detail.cohort.id}/formadores`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          formador_user_id: formadorAssignmentForm.formador_user_id,
          percentual_honorario: Number(formadorAssignmentForm.percentual_honorario || 100),
        }),
      });
      const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Falha ao atribuir formador");
      }

      setFormadorAssignmentForm({ formador_user_id: "", percentual_honorario: "100", turno: "" });
      await loadDetail(detail.cohort.id);
      setInfo("Formador atribuído à edição.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setFormadorBusy(false);
    }
  };

  const removeFormadorFromCohort = async (assignmentId: string) => {
    if (!detail) return;

    setError(null);
    setInfo(null);
    setFormadorBusy(true);

    try {
      const res = await fetch(
        `/api/formacao/backoffice/cohorts/${detail.cohort.id}/formadores?assignment_id=${encodeURIComponent(assignmentId)}`,
        { method: "DELETE" }
      );
      const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Falha ao remover formador");
      }

      await loadDetail(detail.cohort.id);
      setInfo("Formador removido da edição.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setFormadorBusy(false);
    }
  };

  const visibleFormandos = useMemo(() => {
    const all = detail?.tabs.formandos ?? [];
    const query = formandoSearch.trim().toLowerCase();
    return all.filter((formando) => {
      const normalizedAcademic = normalizeAcademicStatus(formando.academic_status);
      const academicMatch = formandoAcademicFilter === "todos" || normalizedAcademic === formandoAcademicFilter;
      if (!academicMatch) return false;
      if (!query) return true;
      const name = String(formando.nome ?? "").toLowerCase();
      const email = String(formando.email ?? "").toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [detail?.tabs.formandos, formandoAcademicFilter, formandoSearch]);

  const availableFormadores = useMemo(() => {
    const assigned = new Set((detail?.tabs.formadores ?? []).map((item) => item.user_id));
    return formadores.filter((item) => !assigned.has(item.user_id));
  }, [detail?.tabs.formadores, formadores]);

  return (
    <div className="grid gap-5">
      <header className="rounded-2xl border border-[#E4EBE6] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8A9E8F]">académico</p>
            <h1 className="mt-1 text-3xl font-semibold text-[#111811]">Turmas</h1>
            <p className="mt-1 text-sm text-[#4A6352]">
              Gestão de turmas com detalhe por formandos, sessões, materiais e certificados.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setCreateStep("selector");
              setShowCreateModal(true);
            }}
            className="rounded-xl border border-klasse-gold bg-klasse-gold px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
          >
            + Nova turma
          </button>
        </div>

        {orphans.length > 0 ? (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-bold text-amber-900">Detetor de Órfãos</p>
                <p className="text-xs text-amber-700">Existem {orphans.length} turmas sem vínculo ao catálogo de cursos.</p>
              </div>
            </div>
            <div className="flex gap-2">
              {orphans.slice(0, 2).map(o => (
                <button
                  key={o.id}
                  onClick={() => {
                    setRescueTarget(o);
                    setShowRescueModal(true);
                  }}
                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
                >
                  Vincular {o.nome}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {(["todos", "rascunho", "aberta", "em curso", "concluída", "cancelada"] as StatusFilter[]).map(
            (filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveStatus(filter)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  activeStatus === filter
                    ? "border-klasse-gold bg-klasse-gold/10 text-klasse-gold"
                    : "border-[#E4EBE6] bg-white text-[#4A6352] hover:bg-[#F7F9F7]"
                }`}
              >
                {filter} · {statusCounts[filter]}
              </button>
            )
          )}
        </div>
      </header>

      {error ? <p className="m-0 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {info ? <p className="m-0 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{info}</p> : null}

      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-[#E4EBE6] bg-white p-3 shadow-sm">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#8A9E8F]">lista de turmas</p>

          {loading ? <p className="px-2 py-4 text-sm text-[#4A6352]">Carregando turmas...</p> : null}

          <div className="grid max-h-[66vh] gap-2 overflow-auto pr-1">
            {visibleItems.map((item) => {
              const normalizedStatus = normalizeStatus(item.status);
              const active = selectedId === item.id;

              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    active
                      ? "border-klasse-gold bg-klasse-gold/5"
                      : "border-[#E4EBE6] bg-white hover:border-[#C9D8CF] hover:bg-[#FAFCFA]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-[#111811]">{item.nome}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusPillClass(normalizedStatus)}`}>
                      {normalizedStatus}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-col gap-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-klasse-gold">
                      {item.curso_nome}
                    </p>
                    <p className="text-[11px] text-[#4A6352] font-medium">
                      Código: {item.codigo}
                    </p>
                  </div>
                  <p className="mt-2 text-[10px] text-[#8A9E8F] font-bold italic">{item.data_inicio} → {item.data_fim}</p>
                </button>
              );
            })}

            {!loading && visibleItems.length === 0 ? (
              <p className="px-2 py-4 text-sm text-[#4A6352]">Nenhuma turma neste filtro.</p>
            ) : null}
          </div>
        </aside>

        <section className="rounded-2xl border border-[#E4EBE6] bg-white p-4 shadow-sm">
          {!selectedId ? (
            <p className="text-sm text-[#4A6352]">Selecione uma turma para ver detalhes.</p>
          ) : detailLoading ? (
            <p className="text-sm text-[#4A6352]">Carregando detalhe da turma...</p>
          ) : !detail ? (
            <p className="text-sm text-[#4A6352]">Não foi possível carregar o detalhe.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E4EBE6] pb-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#8A9E8F]">{detail.cohort.codigo}</p>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-semibold text-[#111811]">{detail.cohort.nome}</h2>
                    {!detail.cohort.curso_id && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                        Não vinculada
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleVisibility(detail.cohort.id, detail.cohort.visivel_na_landing)}
                      title={detail.cohort.visivel_na_landing ? "Visível na Landing Page" : "Oculto na Landing Page"}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase transition ${
                        detail.cohort.visivel_na_landing
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {detail.cohort.visivel_na_landing ? "Público" : "Privado"}
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-[#4A6352] flex items-center gap-2">
                    <span className="font-bold text-[#111811]">Curso:</span> {detail.cohort.curso_nome}
                    <span className="text-slate-300">|</span>
                    <span className="font-bold text-[#111811]">Período:</span> {detail.cohort.data_inicio} → {detail.cohort.data_fim}
                  </p>
                  <p className="text-xs text-[#8A9E8F]">
                    Valor referência: {formatMoney(Number(detail.cohort.valor_referencia ?? 0))}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-lg border border-[#E4EBE6] bg-[#F7F9F7] px-3 py-2 text-xs text-[#4A6352]">Formandos: {detail.summary.formandos}</span>
                  <span className="rounded-lg border border-[#E4EBE6] bg-[#F7F9F7] px-3 py-2 text-xs text-[#4A6352]">Sessões: {detail.summary.sessoes}</span>
                  <span className="rounded-lg border border-[#E4EBE6] bg-[#F7F9F7] px-3 py-2 text-xs text-[#4A6352]">Materiais: {detail.summary.materiais}</span>
                  <span className="rounded-lg border border-[#E4EBE6] bg-[#F7F9F7] px-3 py-2 text-xs text-[#4A6352]">Certificados: {detail.summary.certificados}</span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {(["formandos", "formadores", "diario", "avaliacoes", "sessoes", "materiais", "certificados"] as DetailTab[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition ${
                      activeTab === tab
                        ? "border-klasse-gold bg-klasse-gold/10 text-klasse-gold"
                        : "border-[#E4EBE6] bg-white text-[#4A6352] hover:bg-[#F7F9F7]"
                    }`}
                  >
                    {tab === "diario" ? "Diário de Classe" : tab === "avaliacoes" ? "Avaliações" : tab}
                  </button>
                ))}

                <div className="ml-auto flex flex-wrap gap-1.5">
                  {(["rascunho", "aberta", "em curso", "concluída", "cancelada"] as Exclude<StatusFilter, "todos">[]).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => changeStatus(detail.cohort.id, status)}
                      className="rounded-md border border-[#E4EBE6] px-2.5 py-1 text-xs text-[#4A6352] hover:bg-[#F7F9F7]"
                    >
                      {status}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => removeItem(detail.cohort.id)}
                    className="rounded-md border border-rose-200 px-2.5 py-1 text-xs text-rose-700 hover:bg-rose-50"
                  >
                    apagar
                  </button>
                </div>
              </div>

              {activeTab === "formadores" ? (
                <div className="mt-3 grid gap-3">
                  <article className="rounded-2xl border border-[#E4EBE6] bg-[#F7F9F7] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8A9E8F]">
                          equipa pedagógica
                        </p>
                        <h3 className="mt-1 text-xl font-semibold text-[#111811]">
                          Atribuir formador à edição
                        </h3>
                        <p className="mt-1 text-sm text-[#4A6352]">
                          Selecione um formador já cadastrado no centro e defina o percentual de honorário para esta turma.
                        </p>
                      </div>
                      <Link
                        href="/admin/equipa"
                        className="rounded-lg border border-klasse-gold bg-white px-3 py-2 text-xs font-semibold text-klasse-gold hover:bg-klasse-gold/10"
                      >
                        Cadastrar formador
                      </Link>
                    </div>

                    <form onSubmit={assignFormadorToCohort} className="mt-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_180px_auto]">
                      <label className="grid gap-1 text-sm text-[#4A6352]">
                        <span>Formador</span>
                        <select
                          value={formadorAssignmentForm.formador_user_id}
                          onChange={(event) =>
                            setFormadorAssignmentForm((prev) => ({
                              ...prev,
                              formador_user_id: event.target.value,
                            }))
                          }
                          className="rounded-lg border border-[#E4EBE6] bg-white px-3 py-2 text-sm outline-none focus:border-klasse-gold"
                          required
                        >
                          <option value="">Selecionar formador</option>
                          {availableFormadores.map((item) => (
                            <option key={item.user_id} value={item.user_id}>
                              {item.nome}
                              {item.papel && item.papel !== "formador" ? ` (${item.papel.replace("formacao_", "")})` : ""}
                              {item.email ? ` · ${item.email}` : ""}
                            </option>
                          ))}
                        </select>                      </label>

                      <Input
                        label="% honorário"
                        type="number"
                        min={1}
                        max={100}
                        value={formadorAssignmentForm.percentual_honorario}
                        onChange={(value) =>
                          setFormadorAssignmentForm((prev) => ({
                            ...prev,
                            percentual_honorario: value,
                          }))
                        }
                        required
                      />

                      <button
                        type="submit"
                        disabled={formadorBusy || availableFormadores.length === 0}
                        className="self-end rounded-lg border border-[#8A5A12] bg-[#A86F18] px-4 py-2 text-sm font-black text-white shadow-sm shadow-[#A86F18]/20 hover:bg-[#8A5A12] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
                      >
                        {formadorBusy ? "Atribuindo..." : "Atribuir"}
                      </button>
                    </form>

                    {availableFormadores.length === 0 ? (
                      <p className="mt-3 text-xs text-[#8A9E8F]">
                        Todos os formadores cadastrados já estão atribuídos a esta edição ou ainda não há formadores no centro.
                      </p>
                    ) : null}
                  </article>

                  <section className="grid gap-2 md:grid-cols-2">
                    {detail.tabs.formadores.map((formador) => (
                      <article key={formador.id} className="rounded-2xl border border-[#E4EBE6] bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[#111811]">{formador.nome}</p>
                            <p className="mt-0.5 text-xs text-[#4A6352]">{formador.email ?? "sem email"}</p>
                            <p className="mt-2 text-xs font-semibold text-[#8A9E8F]">
                              Honorário: {Number(formador.percentual_honorario ?? 0)}%
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={formadorBusy}
                            onClick={() => removeFormadorFromCohort(formador.id)}
                            className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Remover
                          </button>
                        </div>
                      </article>
                    ))}

                    {detail.tabs.formadores.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[#C9D8CF] bg-[#FAFCFA] px-4 py-8 text-sm text-[#4A6352]">
                        Nenhum formador atribuído a esta edição.
                      </div>
                    ) : null}
                  </section>
                </div>
              ) : null}

              {activeTab === "formandos" ? (
                <div className="mt-3 grid gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-[#8A9E8F]">Gestão Financeira da Turma</p>
                      <h3 className="text-xl font-semibold text-[#111811]">Painel de pagamentos</h3>
                    </div>
                    <div className="inline-flex rounded-xl border border-[#E4EBE6] bg-[#F7F9F7] p-1">
                      <button
                        type="button"
                        onClick={() => setFinanceView("b2c")}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          financeView === "b2c" ? "bg-white text-[#1F6B3B] shadow-sm" : "text-[#4A6352] hover:bg-white/70"
                        }`}
                      >
                        Visão B2C (Particulares)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFinanceView("b2b")}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          financeView === "b2b" ? "bg-white text-[#1F6B3B] shadow-sm" : "text-[#4A6352] hover:bg-white/70"
                        }`}
                      >
                        Visão B2B (Corporativo)
                      </button>
                    </div>
                  </div>

                  {financeView === "b2c" ? (
                    <>
                      <div className="space-y-2 md:hidden">
                        {visibleFormandos.map((formando) => (
                          <article key={formando.user_id} className="rounded-xl border border-[#E4EBE6] bg-white p-3 shadow-sm">
                            <p className="text-sm font-semibold text-[#111811]">{formando.nome}</p>
                            <div className="mt-2 grid gap-2">
                              {(formando.parcelas ?? []).slice(0, 3).map((parcela) => (
                                <div key={parcela.item_id} className="flex items-center justify-between gap-2">
                                  <span className="text-xs text-[#4A6352]">{parcela.descricao}</span>
                                  {renderPaymentCell(parcela.status, parcela.item_id, formando.nome, parcela.descricao, parcela.valor, openPagamentoModal)}
                                </div>
                              ))}
                            </div>
                          </article>
                        ))}
                      </div>

                      <div className="hidden overflow-x-auto rounded-xl border border-[#E4EBE6] md:block">
                        <table className="min-w-[760px] w-full border-collapse text-sm">
                          <thead className="bg-[#F7F9F7] text-[#4A6352]">
                            <tr>
                              <Th>Nome do Formando</Th>
                              <Th>Inscrição</Th>
                              <Th>Módulo 1</Th>
                              <Th>Módulo 2</Th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleFormandos.map((formando) => (
                              <tr key={formando.user_id}>
                                <Td>{formando.nome}</Td>
                                <Td>
                                  {formando.parcelas?.[0]
                                    ? renderPaymentCell(
                                        formando.parcelas[0].status,
                                        formando.parcelas[0].item_id,
                                        formando.nome,
                                        formando.parcelas[0].descricao,
                                        formando.parcelas[0].valor,
                                        openPagamentoModal
                                      )
                                    : "—"}
                                </Td>
                                <Td>
                                  {formando.parcelas?.[1]
                                    ? renderPaymentCell(
                                        formando.parcelas[1].status,
                                        formando.parcelas[1].item_id,
                                        formando.nome,
                                        formando.parcelas[1].descricao,
                                        formando.parcelas[1].valor,
                                        openPagamentoModal
                                      )
                                    : "—"}
                                </Td>
                                <Td>
                                  {formando.parcelas?.[2]
                                    ? renderPaymentCell(
                                        formando.parcelas[2].status,
                                        formando.parcelas[2].item_id,
                                        formando.nome,
                                        formando.parcelas[2].descricao,
                                        formando.parcelas[2].valor,
                                        openPagamentoModal
                                      )
                                    : "—"}
                                </Td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="rounded-2xl border border-[#E4EBE6] bg-[#F7F9F7] p-3">
                        <div className="mb-2">
                          <p className="text-xs uppercase tracking-[0.16em] text-[#8A9E8F]">Operação de Acesso e Estado</p>
                          <h4 className="text-sm font-semibold text-[#111811]">Gestão de acessos e estado académico</h4>
                        </div>

                        <div className="mb-3 grid gap-2 rounded-xl border border-[#E4EBE6] bg-white p-3 md:grid-cols-[1fr_220px_auto]">
                          <input
                            value={formandoSearch}
                            onChange={(event) => setFormandoSearch(event.target.value)}
                            placeholder="Pesquisar por nome ou email..."
                            className="rounded-xl border border-[#E4EBE6] px-3 py-2 text-sm text-[#111811] outline-none focus:border-klasse-gold"
                          />
                          <select
                            value={formandoAcademicFilter}
                            onChange={(event) =>
                              setFormandoAcademicFilter(
                                event.target.value as "todos" | "cursando" | "desistente" | "apto" | "nao_apto"
                              )
                            }
                            className="rounded-xl border border-[#E4EBE6] px-3 py-2 text-sm text-[#111811] outline-none focus:border-klasse-gold"
                          >
                            <option value="todos">Todos os estados</option>
                            <option value="cursando">Cursando</option>
                            <option value="desistente">Desistente</option>
                            <option value="apto">Apto</option>
                            <option value="nao_apto">Não apto</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => setShowInscricaoModal(true)}
                            className="rounded-xl bg-klasse-gold px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
                          >
                            Adicionar Formando
                          </button>
                        </div>

                        <div className="space-y-2 md:hidden">
                          {visibleFormandos.map((formando) => {
                            const busy = Boolean(formandoBusy[formando.user_id]);
                            return (
                              <article key={formando.user_id} className="rounded-xl border border-[#E4EBE6] bg-white p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="text-sm font-semibold text-[#111811]">{formando.nome}</p>
                                    <p className="text-xs text-[#4A6352] underline underline-offset-2 decoration-dotted">{formando.email ?? "sem email"}</p>
                                  </div>
                                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${academicStatusPillClass(formando.academic_status)}`}>
                                    {academicStatusLabel(formando.academic_status)}
                                  </span>
                                </div>

                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    role="switch"
                                    aria-checked={!formando.access_blocked}
                                    disabled={busy}
                                    onClick={() =>
                                      runFormandoAction(formando.user_id, {
                                        action: "set_access_block",
                                        blocked: !formando.access_blocked,
                                      })
                                    }
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                                      formando.access_blocked ? "bg-slate-300" : "bg-emerald-500"
                                    } disabled:opacity-60`}
                                  >
                                    <span
                                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                                        formando.access_blocked ? "translate-x-1" : "translate-x-5"
                                      }`}
                                    />
                                  </button>
                                  <span className="text-xs text-[#4A6352]">
                                    {formando.access_blocked ? "Acesso bloqueado" : "Acesso ativo"}
                                  </span>

                                  <details className="relative">
                                    <summary className="list-none cursor-pointer rounded-md border border-[#E4EBE6] bg-white p-1.5 text-xs text-[#4A6352]">
                                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                                        <circle cx="5" cy="12" r="1.8" />
                                        <circle cx="12" cy="12" r="1.8" />
                                        <circle cx="19" cy="12" r="1.8" />
                                      </svg>
                                    </summary>
                                    <div className="absolute right-0 z-20 mt-1 w-52 rounded-lg border border-[#E4EBE6] bg-white p-1 shadow-lg">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setInfo(
                                            `Perfil: ${formando.nome} · ${formando.email ?? "sem email"} · ${formando.telefone ?? "sem telefone"}`
                                          )
                                        }
                                        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs text-[#111811] hover:bg-[#F7F9F7]"
                                      >
                                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
                                          <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" stroke="currentColor" strokeWidth="1.8" />
                                          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                                        </svg>
                                        Visualizar Perfil
                                      </button>
                                      {formando.inscricao_id ? (
                                        <a
                                          href={`/api/formacao/inscricoes/${formando.inscricao_id}/comprovativo`}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs text-[#111811] hover:bg-[#F7F9F7]"
                                        >
                                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
                                            <path d="M12 4v10m0 0 4-4m-4 4-4-4M5 18h14" stroke="currentColor" strokeWidth="1.8" />
                                          </svg>
                                          Descarregar Comprovativo
                                        </a>
                                      ) : null}
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setStatusEditorTarget({
                                            user_id: formando.user_id,
                                            nome: formando.nome,
                                            status: normalizeAcademicStatus(formando.academic_status),
                                          })
                                        }
                                        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs text-[#111811] hover:bg-[#F7F9F7]"
                                      >
                                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
                                          <path d="m4 20 4.5-1 9-9-3.5-3.5-9 9L4 20Z" stroke="currentColor" strokeWidth="1.8" />
                                          <path d="m12.8 7.2 3.5 3.5" stroke="currentColor" strokeWidth="1.8" />
                                        </svg>
                                        Editar Estado Académico
                                      </button>
                                      <div className="my-1 h-px bg-[#E4EBE6]" />
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => runFormandoAction(formando.user_id, { action: "resend_access" })}
                                        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs text-[#111811] hover:bg-[#F7F9F7] disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
                                          <path d="M3 6h18v12H3V6Z" stroke="currentColor" strokeWidth="1.8" />
                                          <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.8" />
                                        </svg>
                                        Reenviar acesso
                                      </button>
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() =>
                                          runFormandoAction(formando.user_id, {
                                            action: "set_academic_status",
                                            status: "desistente",
                                          })
                                        }
                                        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
                                          <path d="M4 7h16M9.5 7V5h5v2M8 7l.7 12h6.6L16 7" stroke="currentColor" strokeWidth="1.8" />
                                        </svg>
                                        Remover da Turma
                                      </button>
                                    </div>
                                  </details>
                                </div>
                              </article>
                            );
                          })}
                          {visibleFormandos.length === 0 ? (
                            <div className="rounded-xl border border-[#E4EBE6] bg-white px-3 py-4 text-sm text-[#4A6352]">
                              Nenhum formando encontrado para os filtros atuais.
                            </div>
                          ) : null}
                        </div>

                        <div className="hidden overflow-x-auto rounded-xl border border-[#E4EBE6] bg-white md:block">
                          <table className="min-w-[980px] w-full border-collapse text-sm">
                            <thead className="bg-[#FAFCFA] text-[#4A6352]">
                              <tr>
                                <Th>Formando</Th>
                                <Th>Acesso ao Portal</Th>
                                <Th>Status Académico</Th>
                                <Th>Ações</Th>
                              </tr>
                            </thead>
                            <tbody>
                              {visibleFormandos.map((formando) => {
                                const busy = Boolean(formandoBusy[formando.user_id]);
                                return (
                                  <tr key={formando.user_id}>
                                    <Td>
                                      <div className="grid gap-0.5">
                                        <span className="font-semibold">{formando.nome}</span>
                                        <span className="text-xs text-[#8A9E8F] underline underline-offset-2 decoration-dotted">{formando.email ?? "sem email"}</span>
                                      </div>
                                    </Td>
                                    <Td>
                                      <button
                                        type="button"
                                        role="switch"
                                        aria-checked={!formando.access_blocked}
                                        disabled={busy}
                                        onClick={() =>
                                          runFormandoAction(formando.user_id, {
                                            action: "set_access_block",
                                            blocked: !formando.access_blocked,
                                          })
                                        }
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                                          formando.access_blocked ? "bg-slate-300" : "bg-emerald-500"
                                        } disabled:opacity-60`}
                                      >
                                        <span
                                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                                            formando.access_blocked ? "translate-x-1" : "translate-x-5"
                                          }`}
                                        />
                                      </button>
                                    </Td>
                                    <Td>
                                      <div className="flex items-center gap-2">
                                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${academicStatusPillClass(formando.academic_status)}`}>
                                          {academicStatusLabel(formando.academic_status)}
                                        </span>
                                      </div>
                                    </Td>
                                    <Td>
                                      <div className="flex items-center gap-2">
                                        <details className="relative">
                                          <summary className="list-none cursor-pointer rounded-md border border-[#E4EBE6] bg-white p-1.5 text-xs text-[#4A6352]">
                                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                                              <circle cx="5" cy="12" r="1.8" />
                                              <circle cx="12" cy="12" r="1.8" />
                                              <circle cx="19" cy="12" r="1.8" />
                                            </svg>
                                          </summary>
                                          <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-[#E4EBE6] bg-white p-1 shadow-lg">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setInfo(
                                                  `Perfil: ${formando.nome} · ${formando.email ?? "sem email"} · ${formando.telefone ?? "sem telefone"}`
                                                )
                                              }
                                              className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs text-[#111811] hover:bg-[#F7F9F7]"
                                            >
                                              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
                                                <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" stroke="currentColor" strokeWidth="1.8" />
                                                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                                              </svg>
                                              Visualizar Perfil
                                            </button>
                                            {formando.inscricao_id ? (
                                              <a
                                                href={`/api/formacao/inscricoes/${formando.inscricao_id}/comprovativo`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs text-[#111811] hover:bg-[#F7F9F7]"
                                              >
                                                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
                                                  <path d="M12 4v10m0 0 4-4m-4 4-4-4M5 18h14" stroke="currentColor" strokeWidth="1.8" />
                                                </svg>
                                                Descarregar Comprovativo
                                              </a>
                                            ) : null}
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setStatusEditorTarget({
                                                  user_id: formando.user_id,
                                                  nome: formando.nome,
                                                  status: normalizeAcademicStatus(formando.academic_status),
                                                })
                                              }
                                              className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs text-[#111811] hover:bg-[#F7F9F7]"
                                            >
                                              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
                                                <path d="m4 20 4.5-1 9-9-3.5-3.5-9 9L4 20Z" stroke="currentColor" strokeWidth="1.8" />
                                                <path d="m12.8 7.2 3.5 3.5" stroke="currentColor" strokeWidth="1.8" />
                                              </svg>
                                              Editar Estado Académico
                                            </button>
                                            <div className="my-1 h-px bg-[#E4EBE6]" />
                                            <button
                                              type="button"
                                              disabled={busy}
                                              onClick={() => runFormandoAction(formando.user_id, { action: "resend_access" })}
                                              className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs text-[#111811] hover:bg-[#F7F9F7] disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
                                                <path d="M3 6h18v12H3V6Z" stroke="currentColor" strokeWidth="1.8" />
                                                <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.8" />
                                              </svg>
                                              Reenviar acesso
                                            </button>
                                            <button
                                              type="button"
                                              disabled={busy}
                                              onClick={() =>
                                                runFormandoAction(formando.user_id, {
                                                  action: "set_academic_status",
                                                  status: "desistente",
                                                })
                                              }
                                              className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
                                                <path d="M4 7h16M9.5 7V5h5v2M8 7l.7 12h6.6L16 7" stroke="currentColor" strokeWidth="1.8" />
                                              </svg>
                                              Remover da Turma
                                            </button>
                                          </div>
                                        </details>
                                      </div>
                                    </Td>
                                  </tr>
                                );
                              })}
                              {visibleFormandos.length === 0 ? (
                                <tr>
                                  <Td colSpan={4}>Nenhum formando encontrado para os filtros atuais.</Td>
                                </tr>
                              ) : null}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="grid gap-3">
                      <article className="rounded-2xl border border-[#E4EBE6] bg-white p-5 shadow-sm">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8A9E8F]">Cliente corporativo</p>
                        <h3 className="mt-1 text-2xl font-semibold text-[#111811]">{detail.finance.b2b?.cliente.nome_fantasia ?? "Sem cliente vinculado"}</h3>
                        <p className="mt-1 text-sm text-[#4A6352]">Valor total da faturação: {detail.finance.b2b ? formatMoney(detail.finance.b2b.fatura.total_liquido) : "—"}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${paymentPillClass(detail.finance.b2b?.fatura.status ?? "pendente")}`}>
                            {detail.finance.b2b?.fatura.status ?? "pendente"}
                          </span>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-md border border-klasse-gold bg-klasse-gold px-2.5 py-1.5 text-xs font-semibold text-white hover:brightness-95"
                          >
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
                              <path d="M12 4v10m0 0 4-4m-4 4-4-4M5 18h14" stroke="currentColor" strokeWidth="1.8" />
                            </svg>
                            Descarregar Fatura Proforma
                          </button>
                        </div>
                      </article>

                      <article className="rounded-xl border border-[#E4EBE6] bg-[#F7F9F7] p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8A9E8F]">Funcionários cobertos no contrato</p>
                        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-[#111811]">
                          {(detail.finance.b2b?.colaboradores_cobertos ?? []).map((colaborador) => (
                            <li key={colaborador.user_id}>{colaborador.nome}</li>
                          ))}
                        </ul>
                      </article>
                    </div>
                  )}
                </div>
              ) : null}

              {activeTab === "diario" ? (
                <div className="mt-3 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E4EBE6] bg-[#F7F9F7] p-4">
                    <div>
                      <h3 className="text-lg font-semibold text-[#111811]">Aulas e Frequência</h3>
                      <p className="text-sm text-[#4A6352]">Controle de aulas realizadas, conteúdo ministrado e presenças.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAulaForm({
                          id: "",
                          data: new Date().toISOString().split("T")[0],
                          hora_inicio: "08:00",
                          hora_fim: "12:00",
                          conteudo_previsto: "",
                          conteudo_realizado: "",
                          horas_ministradas: "4",
                          status: "agendada",
                          formador_user_id: detail.tabs.formadores[0]?.user_id || "",
                        });
                        setShowAulaModal(true);
                      }}
                      className="rounded-lg border border-klasse-gold bg-klasse-gold px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
                    >
                      + Lançar Aula
                    </button>
                  </div>

                  <div className="grid gap-3">
                    {aulas.map((aula) => (
                      <article key={aula.id} className="rounded-2xl border border-[#E4EBE6] bg-white p-4 shadow-sm transition hover:shadow-md">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex items-start gap-4">
                            <div className="flex flex-col items-center rounded-xl bg-[#F7F9F7] px-3 py-2 text-center border border-[#E4EBE6]">
                              <span className="text-[10px] font-bold uppercase text-[#8A9E8F]">{new Date(aula.data).toLocaleDateString("pt-AO", { month: "short" })}</span>
                              <span className="text-xl font-black text-[#111811]">{new Date(aula.data).getDate()}</span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                                  aula.status === "realizada" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                                  aula.status === "cancelada" ? "bg-rose-100 text-rose-700 border-rose-200" :
                                  "bg-slate-100 text-slate-700 border-slate-200"
                                }`}>
                                  {aula.status}
                                </span>
                                <span className="text-xs font-semibold text-[#4A6352]">
                                  {aula.hora_inicio?.slice(0, 5)} → {aula.hora_fim?.slice(0, 5)} · {aula.horas_ministradas}h
                                </span>
                              </div>
                              <h4 className="mt-1 font-semibold text-[#111811]">
                                {aula.conteudo_realizado || aula.conteudo_previsto || "Sem conteúdo registado"}
                              </h4>
                              <p className="mt-1 text-xs text-[#8A9E8F]">
                                Formador: {detail.tabs.formadores.find(f => f.user_id === aula.formador_user_id)?.nome || "Não atribuído"}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => openPresencaModal(aula)}
                              className="rounded-lg border border-[#E4EBE6] px-3 py-2 text-xs font-semibold text-[#4A6352] hover:bg-[#F7F9F7]"
                            >
                              Presenças
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAulaForm({
                                  id: aula.id,
                                  data: aula.data,
                                  hora_inicio: aula.hora_inicio?.slice(0, 5) || "08:00",
                                  hora_fim: aula.hora_fim?.slice(0, 5) || "12:00",
                                  conteudo_previsto: aula.conteudo_previsto || "",
                                  conteudo_realizado: aula.conteudo_realizado || "",
                                  horas_ministradas: String(aula.horas_ministradas),
                                  status: aula.status,
                                  formador_user_id: aula.formador_user_id || "",
                                });
                                setShowAulaModal(true);
                              }}
                              className="rounded-lg border border-[#E4EBE6] px-3 py-2 text-xs font-semibold text-[#4A6352] hover:bg-[#F7F9F7]"
                            >
                              Editar
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}

                    {aulas.length === 0 && !loadingAulas ? (
                      <div className="rounded-2xl border border-dashed border-[#C9D8CF] bg-[#FAFCFA] px-4 py-12 text-center text-sm text-[#4A6352]">
                        Nenhuma aula registada no diário desta turma.
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {activeTab === "avaliacoes" ? (
                <div className="mt-3 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E4EBE6] bg-[#F7F9F7] p-4">
                    <div>
                      <h3 className="text-lg font-semibold text-[#111811]">Lançamento de Notas e Conceitos</h3>
                      <p className="text-sm text-[#4A6352]">Avaliação individual por competência em cada módulo do curso.</p>
                    </div>
                    <button
                      type="button"
                      onClick={saveEvaluations}
                      disabled={savingEvaluations}
                      className="rounded-lg border border-klasse-gold bg-klasse-gold px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50"
                    >
                      {savingEvaluations ? "A guardar..." : "Guardar Avaliações"}
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-[#E4EBE6] bg-white">
                    <table className="min-w-full border-collapse text-sm">
                      <thead className="bg-[#F7F9F7] text-[#4A6352]">
                        <tr>
                          <Th>Formando</Th>
                          {detail.tabs.modulos.map(m => (
                            <Th key={m.id} title={m.titulo}>M{m.ordem}</Th>
                          ))}
                          <Th>Presença</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E4EBE6]">
                        {detail.tabs.formandos.map((f) => {
                          const prog = progressData.find(p => p.inscricao_id === f.inscricao_id);
                          return (
                            <tr key={f.user_id}>
                              <Td className="font-medium whitespace-nowrap">{f.nome}</Td>
                              {detail.tabs.modulos.map(m => {
                                const evalItem = evaluations.find(ev => ev.inscricao_id === f.inscricao_id && ev.modulo_id === m.id);
                                return (
                                  <Td key={m.id}>
                                    <select
                                      value={evalItem?.conceito || "em_progresso"}
                                      onChange={(e) => updateEvaluation(f.inscricao_id!, m.id, e.target.value as any)}
                                      className={`rounded border border-[#E4EBE6] px-1 py-0.5 text-[10px] font-bold outline-none focus:border-klasse-gold ${
                                        evalItem?.conceito === 'apto' ? 'text-emerald-700 bg-emerald-50' : 
                                        evalItem?.conceito === 'nao_apto' ? 'text-rose-700 bg-rose-50' : ''
                                      }`}
                                    >
                                      <option value="em_progresso">—</option>
                                      <option value="apto">APTO</option>
                                      <option value="nao_apto">N. APTO</option>
                                      <option value="isento">ISENTO</option>
                                    </select>
                                  </Td>
                                );
                              })}
                              <Td>
                                <span className={`font-bold ${prog && prog.percentual_presenca < 75 ? "text-rose-600" : "text-emerald-600"}`}>
                                  {prog ? `${Math.round(prog.percentual_presenca)}%` : "—"}
                                </span>
                              </Td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {activeTab === "sessoes" ? (
                <>
                  <div className="mt-3 space-y-2 md:hidden">
                    {detail.tabs.sessoes.map((row) => (
                      <article key={row.id} className="rounded-xl border border-[#E4EBE6] bg-white p-3 shadow-sm">
                        <p className="text-sm font-semibold text-[#111811]">{row.competencia}</p>
                        <p className="mt-0.5 text-xs text-[#4A6352]">Formador: {row.formador_nome}</p>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs text-[#4A6352]">Horas: {row.horas_ministradas}</span>
                          <span className="text-xs font-semibold text-[#111811]">{formatMoney(row.valor_hora)}</span>
                        </div>
                        <p className="mt-1 text-xs text-[#8A9E8F]">Status: {row.status}</p>
                      </article>
                    ))}
                    {detail.tabs.sessoes.length === 0 ? (
                      <div className="rounded-xl border border-[#E4EBE6] bg-white px-3 py-4 text-sm text-[#4A6352]">
                        Sem sessões lançadas para esta turma.
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3 hidden overflow-x-auto rounded-xl border border-[#E4EBE6] md:block">
                    <table className="min-w-[760px] w-full border-collapse text-sm">
                      <thead className="bg-[#F7F9F7] text-[#4A6352]">
                        <tr>
                          <Th>Competência</Th>
                          <Th>Formador</Th>
                          <Th>Horas</Th>
                          <Th>Valor hora</Th>
                          <Th>Status</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.tabs.sessoes.map((row) => (
                          <tr key={row.id}>
                            <Td>{row.competencia}</Td>
                            <Td>{row.formador_nome}</Td>
                            <Td>{row.horas_ministradas}</Td>
                            <Td>{formatMoney(row.valor_hora)}</Td>
                            <Td>{row.status}</Td>
                          </tr>
                        ))}
                        {detail.tabs.sessoes.length === 0 ? (
                          <tr>
                            <Td colSpan={5}>Sem sessões lançadas para esta turma.</Td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              {activeTab === "materiais" ? (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {detail.tabs.materiais.map((row) => (
                    <article key={row.id} className="rounded-xl border border-[#E4EBE6] bg-[#F7F9F7] p-3">
                      <p className="text-sm font-semibold text-[#111811]">{row.titulo}</p>
                      <p className="mt-1 text-xs text-[#4A6352]">Tipo: {row.tipo}</p>
                      <p className="text-xs text-[#8A9E8F]">Atualizado em: {row.updated_at}</p>
                    </article>
                  ))}
                  {detail.tabs.materiais.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-[#C9D8CF] bg-[#FAFCFA] px-3 py-6 text-sm text-[#4A6352]">
                      Sem materiais cadastrados para esta turma.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {activeTab === "certificados" ? (
                <div className="mt-3 space-y-6">
                  <article className="rounded-2xl border border-[#E4EBE6] bg-[#F7F9F7] p-4">
                    <h3 className="text-lg font-semibold text-[#111811]">Elegibilidade para Certificação</h3>
                    <p className="text-sm text-[#4A6352]">
                      Regra: Mínimo de 75% de presença e aproveitamento (APTO/ISENTO) em todos os {detail.summary.modulos} módulos.
                    </p>

                    <div className="mt-4 overflow-x-auto rounded-xl border border-[#E4EBE6] bg-white">
                      <table className="w-full text-sm">
                        <thead className="bg-[#F7F9F7] text-[#4A6352]">
                          <tr>
                            <Th>Formando</Th>
                            <Th>Presença</Th>
                            <Th>Módulos</Th>
                            <Th>Estado</Th>
                            <Th>Ação</Th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E4EBE6]">
                          {detail.tabs.formandos.map((f) => {
                            const prog = progressData.find(p => p.inscricao_id === f.inscricao_id);
                            const hasCert = detail.tabs.certificados.some(c => c.formando_user_id === f.user_id);
                            
                            return (
                              <tr key={f.user_id}>
                                <Td className="font-medium">{f.nome}</Td>
                                <Td>
                                  <span className={`font-bold ${prog && prog.percentual_presenca < 75 ? "text-rose-600" : "text-emerald-600"}`}>
                                    {prog ? `${Math.round(prog.percentual_presenca)}%` : "—"}
                                  </span>
                                </Td>
                                <Td>
                                  <span className="font-semibold text-[#111811]">
                                    {prog ? `${prog.modulos_aprovados} / ${prog.total_modulos}` : "—"}
                                  </span>
                                </Td>
                                <Td>
                                  {hasCert ? (
                                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">Emitido</span>
                                  ) : prog?.elegivel_certificacao ? (
                                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-700">Elegível</span>
                                  ) : (
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">Incompleto</span>
                                  )}
                                </Td>
                                <Td>
                                  {!hasCert && prog?.elegivel_certificacao && (
                                    <button className="text-xs font-bold text-klasse-gold underline underline-offset-2">Emitir Agora</button>
                                  )}
                                  {!hasCert && !prog?.elegivel_certificacao && (
                                    <span className="text-[10px] text-[#8A9E8F] italic">Pendente requisitos</span>
                                  )}
                                </Td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </article>

                  <div>
                    <h3 className="text-lg font-semibold text-[#111811]">Certificados Emitidos</h3>
                    <div className="mt-3 space-y-2 md:hidden">
                      {detail.tabs.certificados.map((row) => (
                        <article key={row.id} className="rounded-xl border border-[#E4EBE6] bg-white p-3 shadow-sm">
                          <p className="text-sm font-semibold text-[#111811]">{row.numero_documento}</p>
                          <p className="mt-0.5 text-xs text-[#4A6352]">Formando: {row.formando_nome}</p>
                          <p className="mt-0.5 text-xs text-[#4A6352]">Emitido em: {row.emitido_em}</p>
                          <p className="mt-0.5 text-xs text-[#8A9E8F]">Template: {row.template_id ?? "-"}</p>
                        </article>
                      ))}
                    </div>

                    <div className="mt-3 hidden overflow-x-auto rounded-xl border border-[#E4EBE6] md:block">
                      <table className="min-w-[720px] w-full border-collapse text-sm">
                        <thead className="bg-[#F7F9F7] text-[#4A6352]">
                          <tr>
                            <Th>Número</Th>
                            <Th>Formando</Th>
                            <Th>Emitido em</Th>
                            <Th>Template</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.tabs.certificados.map((row) => (
                            <tr key={row.id}>
                              <Td>{row.numero_documento}</Td>
                              <Td>{row.formando_nome}</Td>
                              <Td>{row.emitido_em}</Td>
                              <Td>{row.template_id ?? "-"}</Td>
                            </tr>
                          ))}
                          {detail.tabs.certificados.length === 0 ? (
                            <tr>
                              <Td colSpan={4}>Sem certificados emitidos para esta turma.</Td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-[#E4EBE6] bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#8A9E8F]">nova turma</p>
                <h3 className="text-xl font-semibold text-[#111811]">
                  {createStep === "selector" ? "Para que curso deseja abrir esta turma?" : "Configuração da turma"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-md border border-[#E4EBE6] px-2 py-1 text-xs text-[#4A6352]"
              >
                fechar
              </button>
            </div>

            {createStep === "selector" ? (
              <div className="mt-6">
                <p className="text-sm text-[#4A6352] mb-4">Escolha um curso do catálogo para herdar automaticamente módulos, preços e materiais.</p>
                <div className="grid gap-3 max-h-[50vh] overflow-auto pr-1">
                  {catalogoCursos.map((curso) => (
                    <button
                      key={curso.id}
                      type="button"
                      onClick={() => {
                        onSelectCurso(curso.id);
                        setCreateStep("form");
                      }}
                      className="flex items-center justify-between rounded-xl border border-[#E4EBE6] p-4 text-left transition hover:border-klasse-gold hover:bg-klasse-gold/5"
                    >
                      <div>
                        <p className="font-bold text-[#111811]">{curso.nome}</p>
                        <p className="text-xs text-[#8A9E8F]">{curso.codigo} · {curso.modalidade} · {curso.carga_horaria}h</p>
                      </div>
                      <span className="text-xs font-bold text-klasse-gold">Selecionar →</span>
                    </button>
                  ))}
                  {catalogoCursos.length === 0 && (
                    <p className="py-8 text-center text-sm text-[#8A9E8F]">Nenhum curso ativo no catálogo.</p>
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={createCohort}>
                <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  <div className="md:col-span-2 xl:col-span-3 rounded-lg bg-emerald-50 border border-emerald-100 p-3 mb-2 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-800">Curso Selecionado</p>
                      <p className="text-sm font-bold text-emerald-900">{form.curso_nome}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCreateStep("selector")}
                      className="text-xs font-bold text-emerald-700 underline underline-offset-4"
                    >
                      Alterar curso
                    </button>
                  </div>

                  <Input label="Código" value={form.codigo} onChange={(value) => setForm((prev) => ({ ...prev, codigo: value }))} placeholder="COH-2026-01" required />
                  <Input label="Nome" value={form.nome} onChange={(value) => setForm((prev) => ({ ...prev, nome: value }))} placeholder="Turma Manhã" required />

                  <Input label="Carga horária (herdada)" type="number" min={1} value={form.carga_horaria_total} onChange={(value) => setForm((prev) => ({ ...prev, carga_horaria_total: value }))} placeholder="120" required />
                  <Input label="Vagas" type="number" min={1} value={form.vagas} onChange={(value) => setForm((prev) => ({ ...prev, vagas: value }))} placeholder="30" required />
                  <Input label="Valor (herdado)" type="number" min={0} value={form.valor_referencia} onChange={(value) => setForm((prev) => ({ ...prev, valor_referencia: value }))} placeholder="50000" />

                  <label className="grid gap-1 text-sm text-[#4A6352]">
                    <span>Turno / Período</span>
                    <select
                      value={form.turno}
                      onChange={(e) => setForm((prev) => ({ ...prev, turno: e.target.value }))}
                      className="rounded-lg border border-[#E4EBE6] px-3 py-2 text-sm outline-none focus:border-klasse-gold"
                      required
                    >
                      <option value="">Selecionar turno</option>
                      <option value="manha">Manhã</option>
                      <option value="tarde">Tarde</option>
                      <option value="noite">Noite</option>
                      <option value="integral">Integral</option>
                      <option value="fim_de_semana">Fim de Semana</option>
                      <option value="pos_laboral">Pós-Laboral</option>
                    </select>
                  </label>

                  <Input label="Data início" type="date" value={form.data_inicio} onChange={(value) => setForm((prev) => ({ ...prev, data_inicio: value }))} required />
                  <Input label="Data fim" type="date" value={form.data_fim} onChange={(value) => setForm((prev) => ({ ...prev, data_fim: value }))} required />

                  <label className="grid gap-1 text-sm text-[#4A6352]">
                    <span>Status</span>
                    <select
                      value={form.status}
                      onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as Exclude<StatusFilter, "todos"> }))}
                      className="rounded-lg border border-[#E4EBE6] px-3 py-2 text-sm outline-none focus:border-klasse-gold"
                    >
                      <option value="rascunho">rascunho</option>
                      <option value="aberta">aberta</option>
                      <option value="em curso">em curso</option>
                      <option value="concluída">concluída</option>
                      <option value="cancelada">cancelada</option>
                    </select>
                  </label>

                  <label className="grid gap-1 text-sm text-[#4A6352]">
                    <span>Formador atribuído</span>
                    <select
                      id="cohort-formador-user-id"
                      value={form.formador_user_id}
                      onChange={(e) => setForm((prev) => ({ ...prev, formador_user_id: e.target.value }))}
                      className="rounded-lg border border-[#E4EBE6] px-3 py-2 text-sm outline-none focus:border-klasse-gold"
                    >
                      <option value="">Selecionar depois</option>
                      {formadores.map((item) => (
                        <option key={item.user_id} value={item.user_id}>
                          {item.nome}
                          {item.papel && item.papel !== "formador" ? ` (${item.papel.replace("formacao_", "")})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <Input
                    label="% honorário"
                    type="number"
                    min={1}
                    max={100}
                    value={form.percentual_honorario}
                    onChange={(value) => setForm((prev) => ({ ...prev, percentual_honorario: value }))}
                    placeholder="100"
                    disabled={!form.formador_user_id}
                  />

                  <label className="flex items-center gap-2 text-sm text-[#4A6352] md:col-span-2 xl:col-span-3">
                    <input
                      type="checkbox"
                      checked={form.visivel_na_landing}
                      onChange={(e) => setForm((prev) => ({ ...prev, visivel_na_landing: e.target.checked }))}
                      className="rounded border-[#E4EBE6] text-klasse-gold focus:ring-klasse-gold"
                    />
                    <span>Exibir esta turma na Landing Page pública</span>
                  </label>
                </div>

                <div className="mt-6 flex justify-end gap-2 border-t border-[#E4EBE6] pt-4">
                  <button
                    type="button"
                    onClick={() => setCreateStep("selector")}
                    className="rounded-lg border border-[#E4EBE6] px-3 py-2 text-sm text-[#4A6352]"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg border border-klasse-gold bg-klasse-gold px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
                  >
                    Confirmar e Abrir Turma
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {showPagamentoModal && pagamentoTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <form onSubmit={registrarPagamentoRapido} className="w-full max-w-md rounded-2xl border border-[#E4EBE6] bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#8A9E8F]">registo rápido</p>
                <h3 className="text-lg font-semibold text-[#111811]">Registar pagamento</h3>
                <p className="text-xs text-[#4A6352]">
                  {pagamentoTarget.formandoNome} · {pagamentoTarget.parcela}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPagamentoModal(false)}
                className="rounded-md border border-[#E4EBE6] px-2 py-1 text-xs text-[#4A6352]"
              >
                fechar
              </button>
            </div>

            <div className="mt-4 grid gap-2">
              <Input
                label="Valor pago"
                type="number"
                min={0}
                value={pagamentoForm.valor}
                onChange={(value) => setPagamentoForm((prev) => ({ ...prev, valor: value }))}
                required
              />

              <label className="grid gap-1 text-sm text-[#4A6352]">
                <span>Método</span>
                <select
                  value={pagamentoForm.metodo}
                  onChange={(event) =>
                    setPagamentoForm((prev) => ({ ...prev, metodo: event.target.value as MetodoPagamento }))
                  }
                  className="rounded-lg border border-[#E4EBE6] px-3 py-2 text-sm outline-none focus:border-klasse-gold"
                >
                  <option value="tpa">TPA</option>
                  <option value="transferencia">Transferência</option>
                  <option value="numerario">Numerário</option>
                </select>
              </label>

              <Input
                label="Comprovativo (URL / referência)"
                value={pagamentoForm.comprovativo}
                onChange={(value) => setPagamentoForm((prev) => ({ ...prev, comprovativo: value }))}
                placeholder="Opcional nesta versão"
              />
            </div>

            <p className="mt-3 text-xs text-[#8A9E8F]">
              Nesta versão o registo rápido muda o estado da parcela para pago e mantém os detalhes operacionais no fluxo financeiro.
            </p>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPagamentoModal(false)}
                className="rounded-lg border border-[#E4EBE6] px-3 py-2 text-sm text-[#4A6352]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-lg border border-klasse-gold bg-klasse-gold px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
              >
                Aprovar pagamento
              </button>
            </div>
          </form>
        </div>
      )}

      {statusEditorTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#E4EBE6] bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#8A9E8F]">estado académico</p>
                <h3 className="text-lg font-semibold text-[#111811]">Editar estado</h3>
                <p className="text-xs text-[#4A6352]">{statusEditorTarget.nome}</p>
              </div>
              <button
                type="button"
                onClick={() => setStatusEditorTarget(null)}
                className="rounded-md border border-[#E4EBE6] px-2 py-1 text-xs text-[#4A6352]"
              >
                fechar
              </button>
            </div>

            <div className="mt-4 grid gap-2">
              <select
                value={statusEditorTarget.status}
                onChange={(event) =>
                  setStatusEditorTarget((prev) =>
                    prev
                      ? {
                          ...prev,
                          status: event.target.value as "cursando" | "desistente" | "apto" | "nao_apto",
                        }
                      : null
                  )
                }
                className="rounded-xl border border-[#E4EBE6] px-3 py-2 text-sm text-[#111811] outline-none focus:border-klasse-gold"
              >
                <option value="cursando">Cursando</option>
                <option value="desistente">Desistente</option>
                <option value="apto">Apto</option>
                <option value="nao_apto">Não apto</option>
              </select>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStatusEditorTarget(null)}
                className="rounded-lg border border-[#E4EBE6] px-3 py-2 text-sm text-[#4A6352]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = statusEditorTarget;
                  if (!target) return;
                  await runFormandoAction(target.user_id, {
                    action: "set_academic_status",
                    status: target.status,
                  });
                  setStatusEditorTarget(null);
                }}
                className="rounded-lg border border-klasse-gold bg-klasse-gold px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {showAulaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <form onSubmit={saveAula} className="w-full max-w-2xl rounded-2xl border border-[#E4EBE6] bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#8A9E8F]">diário de classe</p>
                <h3 className="text-xl font-semibold text-[#111811]">
                  {aulaForm.id ? "Editar Aula" : "Lançar Nova Aula"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAulaModal(false)}
                className="rounded-md border border-[#E4EBE6] px-2 py-1 text-xs text-[#4A6352]"
              >
                fechar
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Input label="Data" type="date" value={aulaForm.data} onChange={(v) => setAulaForm(p => ({ ...p, data: v }))} required />
              <label className="grid gap-1 text-sm text-[#4A6352]">
                <span>Status da Aula</span>
                <select
                  value={aulaForm.status}
                  onChange={(e) => setAulaForm(p => ({ ...p, status: e.target.value as Aula["status"] }))}
                  className="rounded-lg border border-[#E4EBE6] px-3 py-2 text-sm outline-none focus:border-klasse-gold"
                >
                  <option value="agendada">Agendada</option>
                  <option value="realizada">Realizada</option>
                  <option value="adiada">Adiada</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </label>

              <Input label="Início" type="time" value={aulaForm.hora_inicio} onChange={(v) => setAulaForm(p => ({ ...p, hora_inicio: v }))} />
              <Input label="Fim" type="time" value={aulaForm.hora_fim} onChange={(v) => setAulaForm(p => ({ ...p, hora_fim: v }))} />
              <Input label="Horas Ministradas" type="number" step="0.5" value={aulaForm.horas_ministradas} onChange={(v) => setAulaForm(p => ({ ...p, horas_ministradas: v }))} />

              <label className="grid gap-1 text-sm text-[#4A6352]">
                <span>Formador Responsável</span>
                <select
                  value={aulaForm.formador_user_id}
                  onChange={(e) => setAulaForm(p => ({ ...p, formador_user_id: e.target.value }))}
                  className="rounded-lg border border-[#E4EBE6] px-3 py-2 text-sm outline-none focus:border-klasse-gold"
                >
                  <option value="">Selecionar formador</option>
                  {detail?.tabs.formadores.map(f => (
                    <option key={f.user_id} value={f.user_id}>{f.nome}</option>
                  ))}
                </select>
              </label>

              <div className="md:col-span-2 space-y-3">
                <label className="grid gap-1 text-sm text-[#4A6352]">
                  <span>Conteúdo Programático (Ministrado)</span>
                  <textarea
                    value={aulaForm.conteudo_realizado}
                    onChange={(e) => setAulaForm(p => ({ ...p, conteudo_realizado: e.target.value }))}
                    placeholder="Ex: Introdução ao Excel, Fórmulas Básicas..."
                    className="h-24 rounded-lg border border-[#E4EBE6] p-3 text-sm outline-none focus:border-klasse-gold"
                  />
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-[#E4EBE6] pt-4">
              <button
                type="button"
                onClick={() => setShowAulaModal(false)}
                className="rounded-lg border border-[#E4EBE6] px-3 py-2 text-sm text-[#4A6352]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-lg border border-klasse-gold bg-klasse-gold px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
              >
                Guardar Aula
              </button>
            </div>
          </form>
        </div>
      )}

      {showPresencaModal && activeAula && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-[#E4EBE6] bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#8A9E8F]">controlo de frequência</p>
                <h3 className="text-xl font-semibold text-[#111811]">Presenças: {new Date(activeAula.data).toLocaleDateString("pt-AO")}</h3>
                <p className="text-sm text-[#4A6352]">{activeAula.conteudo_realizado || "Sem conteúdo"}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPresencaModal(false)}
                className="rounded-md border border-[#E4EBE6] px-2 py-1 text-xs text-[#4A6352]"
              >
                fechar
              </button>
            </div>

            <div className="mt-6 max-h-[50vh] overflow-auto border rounded-xl border-[#E4EBE6]">
              {loadingPresencas ? (
                <div className="p-8 text-center text-sm text-[#4A6352]">A carregar lista de formandos...</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[#F7F9F7] text-[#4A6352]">
                    <tr>
                      <th className="px-4 py-2 text-left">Formando</th>
                      <th className="px-4 py-2 text-center">Presente?</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4EBE6]">
                    {presencas.map((p) => (
                      <tr key={p.inscricao_id} className={p.presente ? "bg-white" : "bg-rose-50/30"}>
                        <td className="px-4 py-3 font-medium text-[#111811]">{p.formacao_inscricoes.nome_snapshot}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => updatePresenca(p.inscricao_id, !p.presente)}
                            className={`rounded-lg px-3 py-1 text-[10px] font-black uppercase transition ${
                              p.presente ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                            }`}
                          >
                            {p.presente ? "SIM" : "FALTA"}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {presencas.length === 0 && (
                      <tr>
                        <td colSpan={2} className="px-4 py-8 text-center text-slate-500 italic">
                          Nenhum formando inscrito nesta turma para registar presença.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPresencaModal(false)}
                className="rounded-lg border border-[#E4EBE6] px-3 py-2 text-sm text-[#4A6352]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={savePresencas}
                disabled={loadingPresencas || presencas.length === 0}
                className="rounded-lg border border-klasse-gold bg-klasse-gold px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50"
              >
                {loadingPresencas ? "A guardar..." : "Guardar Presenças"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRescueModal && rescueTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <form onSubmit={rescueCohort} className="w-full max-w-md rounded-2xl border border-[#E4EBE6] bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#8A9E8F]">Resgate de Turma</p>
                <h3 className="text-lg font-semibold text-[#111811]">Vincular ao Catálogo</h3>
                <p className="text-xs text-[#4A6352]">Turma: {rescueTarget.nome} ({rescueTarget.curso_nome})</p>
              </div>
              <button
                type="button"
                onClick={() => setShowRescueModal(false)}
                className="rounded-md border border-[#E4EBE6] px-2 py-1 text-xs text-[#4A6352]"
              >
                fechar
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <p className="text-sm text-[#4A6352]">
                Ao vincular esta turma a um curso oficial, o sistema irá importar automaticamente o programa académico (módulos) e materiais de apoio.
              </p>

              <label className="grid gap-1 text-sm text-[#4A6352]">
                <span>Escolher Curso Correspondente</span>
                <select
                  value={form.curso_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, curso_id: e.target.value }))}
                  className="rounded-lg border border-[#E4EBE6] px-3 py-2 text-sm outline-none focus:border-klasse-gold"
                  required
                >
                  <option value="">Selecionar curso</option>
                  {catalogoCursos.map((curso) => (
                    <option key={curso.id} value={curso.id}>
                      {curso.nome}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm text-[#4A6352]">
                <span>Turno / Período</span>
                <select
                  value={form.turno}
                  onChange={(e) => setForm((prev) => ({ ...prev, turno: e.target.value }))}
                  className="rounded-lg border border-[#E4EBE6] px-3 py-2 text-sm outline-none focus:border-klasse-gold"
                  required
                >
                  <option value="">Selecionar turno</option>
                  <option value="manha">Manhã</option>
                  <option value="tarde">Tarde</option>
                  <option value="noite">Noite</option>
                  <option value="integral">Integral</option>
                  <option value="fim_de_semana">Fim de Semana</option>
                  <option value="pos_laboral">Pós-Laboral</option>
                </select>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRescueModal(false)}
                className="rounded-lg border border-[#E4EBE6] px-3 py-2 text-sm text-[#4A6352]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!form.curso_id}
                className="rounded-lg border border-klasse-gold bg-klasse-gold px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50"
              >
                Vincular em um Clique
              </button>
            </div>
          </form>
        </div>
      )}

      {detail && (
        <InscricaoBalcaoModal
          open={showInscricaoModal}
          onClose={() => setShowInscricaoModal(false)}
          cohortId={detail.cohort.id}
          cohortNome={detail.cohort.nome}
          onSuccess={() => loadDetail(detail.cohort.id)}
        />
      )}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
  min,
  max,
  step,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  min?: number;
  max?: number;
  step?: string;
  disabled?: boolean;
}) {
  return (
    <label className="grid gap-1 text-sm text-[#4A6352]">
      <span>{label}</span>
      <input
        type={type}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="rounded-lg border border-[#E4EBE6] px-3 py-2 text-sm outline-none focus:border-klasse-gold disabled:cursor-not-allowed disabled:bg-[#F7F9F7]"
      />
    </label>
  );
}

function Th({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <th title={title} className="border-b border-[#E4EBE6] px-2.5 py-2 text-left font-medium">
      {children}
    </th>
  );
}

function Td({ children, colSpan, className }: { children: React.ReactNode; colSpan?: number; className?: string }) {
  return (
    <td colSpan={colSpan} className={`border-b border-[#E4EBE6] px-2.5 py-2 text-[#111811] ${className || ""}`}>
      {children}
    </td>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-AO", {
    style: "currency",
    currency: "AOA",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-AO", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
