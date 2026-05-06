"use client";

import { FormEvent, KeyboardEvent, useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import {
  BookOpen,
  Users,
  Calendar,
  ChevronLeft,
  CheckCircle2,
  Clock,
  Plus,
  Loader2,
  UserCircle,
  AlertTriangle,
  MessageSquare,
  FileText,
  Paperclip,
  Send,
  Trash2,
  Award
} from "lucide-react";
import { toast } from "@/lib/toast";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type Aula = {
  id: string;
  data: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  conteudo_previsto: string | null;
  conteudo_realizado: string | null;
  horas_ministradas: number;
  status: "agendada" | "realizada" | "adiada" | "cancelada";
  formador_user_id: string | null;
};

type EvaluationAgenda = {
  id: string;
  titulo: string;
  descricao: string | null;
  data: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  local: string | null;
  modulo_id: string | null;
  nota_maxima: number;
  peso: number;
  formacao_cohort_modulos?: {
    titulo: string;
    ordem: number;
  };
};

type Material = {
  id: string;
  titulo: string;
  descricao: string | null;
  file_url: string;
  file_type: string | null;
  modulo_id: string | null;
  created_at: string;
  formacao_cohort_modulos?: {
    titulo: string;
    ordem: number;
  };
};

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

type Formando = {
  user_id: string;
  inscricao_id: string;
  nome: string;
  email: string | null;
  academic_status: string;
  recomendado_certificacao?: boolean;
};

type CohortDetail = {
  id: string;
  codigo: string;
  nome: string;
  curso_nome: string;
  data_inicio: string;
  data_fim: string;
  relatorio_pedagogico?: string | null;
  modulos: Array<{
    id: string;
    titulo: string;
    ordem: number;
  }>;
};

type Aviso = {
  id: string;
  titulo: string;
  conteudo: string;
  created_at: string;
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

function getTodayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Luanda",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getAulaFormDefaults(aula?: Aula | null) {
  return {
    id: aula?.id ?? "",
    data: aula?.data ?? getTodayKey(),
    hora_inicio: aula?.hora_inicio?.slice(0, 5) || "08:00",
    hora_fim: aula?.hora_fim?.slice(0, 5) || "12:00",
    conteudo_previsto: aula?.conteudo_previsto || "",
    conteudo_realizado: aula?.conteudo_realizado || "",
    horas_ministradas: String(aula?.horas_ministradas ?? 4),
    status: aula?.status ?? ("realizada" as Aula["status"]),
  };
}

export default function FormadorCohortJournal({ cohortId }: { cohortId: string }) {
  const searchParams = useSearchParams();
  const [cohort, setCohort] = useState<CohortDetail | null>(null);
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationRow[]>([]);
  const [progressData, setProgressData] = useState<ProgressRow[]>([]);
  const [agenda, setAgenda] = useState<EvaluationAgenda[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [formandos, setFormandos] = useState<Formando[]>([]);
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"sumario" | "pauta" | "agenda" | "materiais" | "formandos" | "comunicacao">("sumario");

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
  });

  const [showAgendaModal, setShowAgendaModal] = useState(false);
  const [agendaForm, setAgendaForm] = useState({
    id: "",
    titulo: "",
    descricao: "",
    data: new Date().toISOString().split("T")[0],
    hora_inicio: "08:00",
    hora_fim: "10:00",
    local: "Sala Virtual",
    modulo_id: "",
    nota_maxima: "20",
    peso: "1",
  });

  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [materialForm, setMaterialForm] = useState({
    id: "",
    titulo: "",
    descricao: "",
    file_url: "",
    modulo_id: "",
  });

  const [showAvisoModal, setShowAvisoModal] = useState(false);
  const [avisoForm, setAvisoForm] = useState({
    titulo: "",
    conteudo: "",
  });

  const [relatorio, setRelatorio] = useState("");
  const [savingRelatorio, setSavingRelatorio] = useState(false);

  const [showPresencaModal, setShowPresencaModal] = useState(false);
  const [activeAula, setActiveAula] = useState<Aula | null>(null);
  const [presencas, setPresencas] = useState<PresencaRow[]>([]);
  const [loadingPresencas, setLoadingPresencas] = useState(false);
  const [savingEvaluations, setSavingEvaluations] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [uploading, setUploading] = useState(false);
  const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const deepLinkHandled = useRef(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [resCohort, resAulas, resEval, resProg, resAgenda, resMat, resAvisos] = await Promise.all([
        fetch(`/api/formacao/backoffice/cohorts/${cohortId}`),
        fetch(`/api/formacao/backoffice/cohorts/${cohortId}/aulas`),
        fetch(`/api/formacao/backoffice/cohorts/${cohortId}/avaliacoes?type=grid`),
        fetch(`/api/formacao/backoffice/cohorts/${cohortId}/avaliacoes?type=progress`),
        fetch(`/api/formacao/backoffice/cohorts/${cohortId}/avaliacoes/agenda`),
        fetch(`/api/formacao/backoffice/cohorts/${cohortId}/materiais`),
        fetch(`/api/formacao/backoffice/cohorts/${cohortId}/avisos`)
      ]);

      const jsonCohort = await resCohort.json();
      const jsonAulas = await resAulas.json();
      const jsonEval = await resEval.json();
      const jsonProg = await resProg.json();
      const jsonAgenda = await resAgenda.json();
      const jsonMat = await resMat.json();
      const jsonAvisos = await resAvisos.json();

      if (jsonCohort.ok) {
        setCohort({
          id: jsonCohort.cohort.id,
          codigo: jsonCohort.cohort.codigo,
          nome: jsonCohort.cohort.nome,
          curso_nome: jsonCohort.cohort.curso_nome,
          data_inicio: jsonCohort.cohort.data_inicio,
          data_fim: jsonCohort.cohort.data_fim,
          relatorio_pedagogico: jsonCohort.cohort.relatorio_pedagogico,
          modulos: jsonCohort.tabs.modulos
        });
        setFormandos(jsonCohort.tabs.formandos);
        setRelatorio(jsonCohort.cohort.relatorio_pedagogico || "");
      }
      if (jsonAulas.ok) setAulas(jsonAulas.items);
      if (jsonEval.ok) setEvaluations(jsonEval.items);
      if (jsonProg.ok) setProgressData(jsonProg.items);
      if (jsonAgenda.ok) setAgenda(jsonAgenda.items);
      if (jsonMat.ok) setMateriais(jsonMat.items);
      if (jsonAvisos.ok) setAvisos(jsonAvisos.items);

    } catch (err) {
      toast({ title: "Erro", description: "Falha ao carregar dados da turma.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [cohortId]);

  const saveAula = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/formacao/backoffice/cohorts/${cohortId}/aulas`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(aulaForm),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);

      setShowAulaModal(false);
      loadData();
      toast({ title: "Sucesso", description: "Aula registada com sucesso." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const saveAgenda = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/formacao/backoffice/cohorts/${cohortId}/avaliacoes/agenda`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...agendaForm,
          modulo_id: agendaForm.modulo_id || null,
          nota_maxima: Number(agendaForm.nota_maxima),
          peso: Number(agendaForm.peso),
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);

      setShowAgendaModal(false);
      loadData();
      toast({ title: "Sucesso", description: "Evento de avaliação agendado." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const saveMaterial = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setUploading(true);
      let finalUrl = materialForm.file_url;
      const file = fileInputRef.current?.files?.[0];

      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${cohortId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('formacao-assets')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('formacao-assets')
          .getPublicUrl(filePath);

        finalUrl = publicUrl;
      }

      if (!finalUrl) throw new Error("Ficheiro ou link é obrigatório");

      const res = await fetch(`/api/formacao/backoffice/cohorts/${cohortId}/materiais`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...materialForm,
          file_url: finalUrl,
          modulo_id: materialForm.modulo_id || null,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);

      setShowMaterialModal(false);
      loadData();
      toast({ title: "Sucesso", description: "Material de apoio adicionado." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const deleteAgenda = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este agendamento?")) return;
    try {
      const res = await fetch(`/api/formacao/backoffice/cohorts/${cohortId}/avaliacoes/agenda?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      loadData();
      toast({ title: "Sucesso", description: "Agendamento removido." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const deleteMaterial = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este material?")) return;
    try {
      const res = await fetch(`/api/formacao/backoffice/cohorts/${cohortId}/materiais?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      loadData();
      toast({ title: "Sucesso", description: "Material removido." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const saveAviso = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/formacao/backoffice/cohorts/${cohortId}/avisos`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(avisoForm),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);

      setShowAvisoModal(false);
      setAvisoForm({ titulo: "", conteudo: "" });
      loadData();
      toast({ title: "Sucesso", description: "Aviso enviado para a turma." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const deleteAviso = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este aviso?")) return;
    try {
      const res = await fetch(`/api/formacao/backoffice/cohorts/${cohortId}/avisos?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      loadData();
      toast({ title: "Sucesso", description: "Aviso removido." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const toggleRecomendacao = async (userId: string, current: boolean) => {
    try {
      const res = await fetch(`/api/formacao/backoffice/cohorts/${cohortId}/formandos/${userId}/recomendacao`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recomendado_certificacao: !current }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);

      setFormandos(prev => prev.map(f => f.user_id === userId ? { ...f, recomendado_certificacao: !current } : f));
      toast({ title: "Sucesso", description: "Recomendação actualizada." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const saveRelatorio = async () => {
    setSavingRelatorio(true);
    try {
      const res = await fetch(`/api/formacao/backoffice/cohorts/${cohortId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ relatorio_pedagogico: relatorio }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);

      toast({ title: "Sucesso", description: "Relatório pedagógico guardado." });
      loadData();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSavingRelatorio(false);
    }
  };

  const openPresencaModal = async (aula: Aula) => {
    setActiveAula(aula);
    setShowPresencaModal(true);
    setLoadingPresencas(true);
    try {
      const res = await fetch(`/api/formacao/backoffice/cohorts/${cohortId}/aulas/${aula.id}/presencas`);
      const json = await res.json();
      if (json.ok) setPresencas(json.items);
    } catch (err) {
      toast({ title: "Erro", description: "Falha ao carregar presenças.", variant: "destructive" });
    } finally {
      setLoadingPresencas(false);
    }
  };

  const openAulaEditor = (aula?: Aula | null) => {
    setAulaForm(getAulaFormDefaults(aula));
    setShowAulaModal(true);
  };

  useEffect(() => {
    if (deepLinkHandled.current || loading) return;

    const action = searchParams.get("acao");
    const tab = searchParams.get("tab");
    const aulaId = searchParams.get("aula");

    if (action === "material") {
      deepLinkHandled.current = true;
      setActiveTab("materiais");
      setMaterialForm({ id: "", titulo: "", descricao: "", file_url: "", modulo_id: "" });
      setShowMaterialModal(true);
      return;
    }

    if (action === "aviso") {
      deepLinkHandled.current = true;
      setActiveTab("comunicacao");
      setAvisoForm({ titulo: "", conteudo: "" });
      setShowAvisoModal(true);
      return;
    }

    if (tab === "pauta" || tab === "materiais" || tab === "formandos" || tab === "comunicacao") {
      deepLinkHandled.current = true;
      setActiveTab(tab);
      return;
    }

    if (!aulaId) return;
    if (aulas.length === 0) return;

    const aula = aulas.find((item) => item.id === aulaId);
    if (!aula) return;

    deepLinkHandled.current = true;
    setActiveTab("sumario");

    if (action === "presencas") {
      openPresencaModal(aula);
      return;
    }

    openAulaEditor(aula);
  }, [aulas, loading, searchParams]);

  const savePresencas = async () => {
    if (!activeAula) return;
    setLoadingPresencas(true);
    try {
      const res = await fetch(`/api/formacao/backoffice/cohorts/${cohortId}/aulas/${activeAula.id}/presencas`, {
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
      if (!json.ok) throw new Error(json.error);

      setShowPresencaModal(false);
      toast({ title: "Sucesso", description: "Presenças guardadas com sucesso." });
      loadData();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoadingPresencas(false);
    }
  };

  const updateEvaluation = (
    inscricaoId: string,
    moduloId: string,
    data: Partial<Omit<EvaluationRow, 'inscricao_id' | 'modulo_id'>>
  ) => {
    setHasChanges(true);
    setEvaluations((prev) => {
      const existing = prev.find(e => e.inscricao_id === inscricaoId && e.modulo_id === moduloId);
      if (existing) {
        return prev.map(e => (e.inscricao_id === inscricaoId && e.modulo_id === moduloId ? { ...e, ...data } : e));
      }
      return [...prev, { inscricao_id: inscricaoId, modulo_id: moduloId, conceito: 'em_progresso', ...data }];
    });
  };

  const saveEvaluations = async (dataToSave = evaluations) => {
    if (dataToSave.length === 0) return;
    setSavingEvaluations(true);
    try {
      const res = await fetch(`/api/formacao/backoffice/cohorts/${cohortId}/avaliacoes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ evaluations: dataToSave }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);

      setLastSaved(new Date());
      setHasChanges(false);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSavingEvaluations(false);
    }
  };

  useEffect(() => {
    if (!hasChanges) return;
    const timer = setTimeout(() => {
      saveEvaluations();
    }, 1500); // 1.5s debounce
    return () => clearTimeout(timer);
  }, [evaluations, hasChanges]);

  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
    let targetRow = rowIndex;
    let targetCol = colIndex;

    if (e.key === "ArrowDown" || e.key === "Enter") targetRow++;
    else if (e.key === "ArrowUp") targetRow--;
    else if (e.key === "ArrowRight") targetCol++;
    else if (e.key === "ArrowLeft") targetCol--;
    else return;

    e.preventDefault();
    const nextRef = inputRefs.current[`${targetRow}-${targetCol}`];
    if (nextRef) {
      nextRef.focus();
      nextRef.select();
    }
  };

  const todayKey = getTodayKey();
  const todaysAula = aulas.find((aula) => aula.data === todayKey) ?? null;
  const latestAula = todaysAula ?? aulas.find((aula) => aula.status !== "cancelada") ?? null;
  const presentesCount = presencas.filter((p) => p.presente).length;
  const faltasCount = Math.max(presencas.length - presentesCount, 0);
  const studentsAtRisk = progressData.filter(p => p.percentual_presenca < 75);

  if (loading && !cohort) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        <p className="font-bold">A carregar diário...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <header className="rounded-[2rem] border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
        <Link href="/agenda" className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-[#1F6B3B] mb-6 transition-colors">
          <ChevronLeft size={16} /> Voltar para Agenda
        </Link>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1F6B3B]/10 text-[#1F6B3B]">
                <BookOpen size={24} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">diário de turma</p>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 leading-tight">
              {cohort?.curso_nome}
            </h1>
            <p className="mt-2 text-sm text-slate-500 font-medium">
              {cohort?.nome} ({cohort?.codigo}) · {cohort?.data_inicio} → {cohort?.data_fim}
            </p>
          </div>

          <button
            onClick={() => openAulaEditor()}
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-[#1F6B3B] px-6 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-[#1F6B3B]/20 transition-all hover:brightness-110 active:scale-95"
          >
            <Plus size={18} /> Registar Aula
          </button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-4">
        <button
          type="button"
          onClick={() => latestAula ? openPresencaModal(latestAula) : openAulaEditor()}
          className="flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-xl bg-[#1F6B3B] px-3 text-center text-xs font-black uppercase tracking-[0.1em] text-white active:scale-[0.98]"
        >
          <CheckCircle2 size={20} />
          Presença
        </button>
        <button
          type="button"
          onClick={() => openAulaEditor(latestAula)}
          className="flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-xl bg-slate-50 px-3 text-center text-xs font-black uppercase tracking-[0.1em] text-slate-700 active:scale-[0.98]"
        >
          <BookOpen size={20} />
          Sumário
        </button>
        <button
          type="button"
          onClick={() => {
            setMaterialForm({ id: "", titulo: "", descricao: "", file_url: "", modulo_id: "" });
            setShowMaterialModal(true);
          }}
          className="flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-xl bg-slate-50 px-3 text-center text-xs font-black uppercase tracking-[0.1em] text-slate-700 active:scale-[0.98]"
        >
          <FileText size={20} />
          Material
        </button>
        <button
          type="button"
          onClick={() => {
            setAvisoForm({ titulo: "", conteudo: "" });
            setShowAvisoModal(true);
          }}
          className="flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-xl bg-slate-50 px-3 text-center text-xs font-black uppercase tracking-[0.1em] text-slate-700 active:scale-[0.98]"
        >
          <Send size={20} />
          Aviso
        </button>
      </section>

      <nav className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl overflow-x-auto">
        {[
          { id: "sumario", label: "Sumário", icon: BookOpen },
          { id: "pauta", label: "Pauta", icon: CheckCircle2 },
          { id: "agenda", label: "Agenda Aval.", icon: Calendar },
          { id: "materiais", label: "Materiais", icon: FileText },
          { id: "formandos", label: "Estudantes", icon: Users },
          { id: "comunicacao", label: "Comunicação", icon: Send },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-white text-[#1F6B3B] shadow-sm"
                : "text-slate-500 hover:bg-white/50"
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="space-y-4">
        {activeTab === "sumario" && (
          <div className="grid gap-3">
            {aulas.map((aula) => (
              <article key={aula.id} className="group relative flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-[2.2rem] border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-lg">
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center rounded-2xl bg-slate-50 px-4 py-3 text-center border border-slate-100 group-hover:bg-[#1F6B3B] group-hover:text-white transition-colors">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
                      {new Date(aula.data).toLocaleDateString("pt-AO", { month: "short" })}
                    </span>
                    <span className="text-2xl font-black">
                      {new Date(aula.data).getDate()}
                    </span>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${
                        aula.status === "realizada" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                        aula.status === "cancelada" ? "bg-rose-50 text-rose-600 border border-rose-100" :
                        "bg-amber-50 text-amber-600 border border-amber-100"
                      }`}>
                        {aula.status}
                      </span>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <Clock size={12} /> {aula.hora_inicio?.slice(0, 5)} - {aula.hora_fim?.slice(0, 5)} · {aula.horas_ministradas}h
                      </span>
                    </div>
                    <h4 className="font-black text-slate-900 leading-tight">
                      {aula.conteudo_realizado || aula.conteudo_previsto || "Sem conteúdo registado"}
                    </h4>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => openPresencaModal(aula)}
                    className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border border-[#1F6B3B]/10 bg-[#1F6B3B]/10 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-[#1F6B3B] transition-colors hover:bg-[#1F6B3B]/15 md:flex-none"
                  >
                    Presenças
                  </button>
                  <button
                    onClick={() => openAulaEditor(aula)}
                    className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-600 transition-colors hover:bg-slate-100 md:flex-none"
                  >
                    Editar
                  </button>
                </div>
              </article>
            ))}

            {aulas.length === 0 && (
              <div className="py-20 text-center rounded-[2.2rem] bg-white border border-dashed border-slate-200">
                <Calendar size={48} className="mx-auto text-slate-200 mb-4" />
                <p className="text-slate-400 font-bold">Nenhuma aula registada no diário.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "pauta" && (
          <div className="space-y-4">
            {studentsAtRisk.length > 0 && (
              <div className="rounded-[2rem] border border-rose-200 bg-rose-50 p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500 text-white shadow-lg shadow-rose-500/20">
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <h3 className="font-black text-rose-900">Alunos em Risco</h3>
                    <p className="text-sm text-rose-700 font-medium">Existem {studentsAtRisk.length} estudantes com assiduidade abaixo de 75%.</p>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4 mb-6">
                <h3 className="font-black text-slate-900">Pauta de Avaliações</h3>
                <div className="flex items-center gap-4">
                  {savingEvaluations ? (
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                      <Loader2 className="h-3 w-3 animate-spin" /> A guardar...
                    </div>
                  ) : lastSaved ? (
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-500">
                      <CheckCircle2 className="h-3 w-3" /> Sincronizado ({lastSaved.toLocaleTimeString()})
                    </div>
                  ) : (
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Auto-save activo
                    </span>
                  )}
                  <button
                    onClick={() => saveEvaluations()}
                    disabled={savingEvaluations || !hasChanges}
                    className="px-6 py-2.5 rounded-xl bg-[#1F6B3B] text-white font-black text-[10px] uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all shadow-lg shadow-[#1F6B3B]/20"
                  >
                    Guardar Agora
                  </button>
                </div>
              </div>

              <div className="grid gap-3 md:hidden">
                {formandos.map((f, rowIndex) => {
                  const prog = progressData.find(p => p.inscricao_id === f.inscricao_id);
                  const isAtRisk = prog && prog.percentual_presenca < 75;
                  return (
                    <article
                      key={f.user_id}
                      className={`rounded-2xl border p-4 ${
                        isAtRisk ? "border-rose-200 bg-rose-50/60" : "border-slate-100 bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className={`truncate text-sm font-black ${isAtRisk ? "text-rose-800" : "text-slate-900"}`}>
                            {f.nome}
                          </h4>
                          <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                            Assiduidade {prog ? `${Math.round(prog.percentual_presenca)}%` : "—"}
                          </p>
                        </div>
                        {isAtRisk ? <AlertTriangle className="h-5 w-5 shrink-0 text-rose-500" /> : null}
                      </div>

                      <div className="mt-4 grid gap-3">
                        {cohort?.modulos.map((m, colIndex) => {
                          const evalItem = evaluations.find(ev => ev.inscricao_id === f.inscricao_id && ev.modulo_id === m.id);
                          return (
                            <div key={m.id} className="rounded-xl border border-white bg-white p-3">
                              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                                M{m.ordem} · {m.titulo}
                              </p>
                              <div className="mt-2 grid grid-cols-[0.8fr_1.2fr] gap-2">
                                <input
                                  ref={(el) => { inputRefs.current[`${rowIndex}-${colIndex}`] = el }}
                                  type="number"
                                  min={0}
                                  max={20}
                                  step="0.5"
                                  value={evalItem?.nota ?? ""}
                                  onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                                  onChange={(e) => updateEvaluation(f.inscricao_id, m.id, { nota: e.target.value ? Number(e.target.value) : null })}
                                  className="min-h-[46px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-sm font-black outline-none transition-all focus:border-[#1F6B3B] focus:ring-4 focus:ring-[#1F6B3B]/10"
                                  placeholder="Nota"
                                />
                                <select
                                  value={evalItem?.conceito || "em_progresso"}
                                  onChange={(e) => updateEvaluation(f.inscricao_id, m.id, { conceito: e.target.value as any })}
                                  className={`min-h-[46px] rounded-xl border border-slate-200 px-3 py-2 text-xs font-black outline-none transition-all focus:border-[#1F6B3B] ${
                                    evalItem?.conceito === 'apto' ? 'bg-emerald-50 text-emerald-700' :
                                    evalItem?.conceito === 'nao_apto' ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-500'
                                  }`}
                                >
                                  <option value="em_progresso">Em progresso</option>
                                  <option value="apto">Apto</option>
                                  <option value="nao_apto">Não apto</option>
                                  <option value="isento">Isento</option>
                                </select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="-mx-6 hidden overflow-x-auto px-6 md:block">
                <table className="w-full text-sm border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <th className="pb-2 text-left px-2">Formando</th>
                      {cohort?.modulos.map(m => (
                        <th key={m.id} className="pb-2 text-center px-2" title={m.titulo}>M{m.ordem}</th>
                      ))}
                      <th className="pb-2 text-center px-2">Assiduidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formandos.map((f, rowIndex) => {
                      const prog = progressData.find(p => p.inscricao_id === f.inscricao_id);
                      const isAtRisk = prog && prog.percentual_presenca < 75;
                      return (
                        <tr key={f.user_id} className={`group transition-all ${isAtRisk ? 'bg-rose-50/50' : 'bg-slate-50 hover:bg-white'}`}>
                          <td className={`py-4 px-4 rounded-l-2xl border-y border-l border-transparent group-hover:border-slate-100 font-bold ${isAtRisk ? 'text-rose-700' : 'text-slate-700'}`}>
                            <div className="flex items-center gap-2">
                              {isAtRisk && <AlertTriangle size={14} className="text-rose-500" />}
                              <span className="truncate max-w-[150px]">{f.nome}</span>
                            </div>
                          </td>
                          {cohort?.modulos.map((m, colIndex) => {
                            const evalItem = evaluations.find(ev => ev.inscricao_id === f.inscricao_id && ev.modulo_id === m.id);
                            return (
                              <td key={m.id} className="py-4 px-2 border-y border-transparent group-hover:border-slate-100">
                                <div className="flex flex-col items-center gap-1.5">
                                  <div className="flex items-center gap-1">
                                    <input
                                      ref={(el) => { inputRefs.current[`${rowIndex}-${colIndex}`] = el }}
                                      type="number"
                                      min={0}
                                      max={20}
                                      step="0.5"
                                      value={evalItem?.nota ?? ""}
                                      onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                                      onChange={(e) => updateEvaluation(f.inscricao_id, m.id, { nota: e.target.value ? Number(e.target.value) : null })}
                                      className="w-11 h-8 rounded-lg border border-slate-200 bg-white px-1 py-1 text-center text-[10px] font-black outline-none focus:ring-4 focus:ring-[#1F6B3B]/10 focus:border-[#1F6B3B] transition-all"
                                      placeholder="—"
                                    />
                                    <select
                                      value={evalItem?.conceito || "em_progresso"}
                                      onChange={(e) => updateEvaluation(f.inscricao_id, m.id, { conceito: e.target.value as any })}
                                      className={`rounded-lg border border-slate-200 px-1 py-1 text-[10px] font-black outline-none focus:border-[#1F6B3B] transition-all ${
                                        evalItem?.conceito === 'apto' ? 'text-emerald-600 bg-emerald-50' :
                                        evalItem?.conceito === 'nao_apto' ? 'text-rose-600 bg-rose-50' : 'text-slate-400'
                                      }`}
                                    >
                                      <option value="em_progresso">—</option>
                                      <option value="apto">A</option>
                                      <option value="nao_apto">N</option>
                                      <option value="isento">I</option>
                                    </select>
                                  </div>
                                </div>
                              </td>
                            );
                          })}
                          <td className="py-4 px-4 rounded-r-2xl border-y border-r border-transparent group-hover:border-slate-100 text-center">
                            <span className={`font-black text-xs ${isAtRisk ? "text-rose-500" : "text-emerald-500"}`}>
                              {prog ? `${Math.round(prog.percentual_presenca)}%` : "—"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="font-black text-slate-900">Relatório Pedagógico Final</h3>
                  <p className="text-xs text-slate-500 font-medium">Balanço final da turma para a secretaria.</p>
                </div>
                <button
                  onClick={saveRelatorio}
                  disabled={savingRelatorio}
                  className="px-6 py-2.5 rounded-xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all"
                >
                  {savingRelatorio ? "A guardar..." : "Guardar Relatório"}
                </button>
              </div>
              <textarea
                value={relatorio}
                onChange={(e) => setRelatorio(e.target.value)}
                className="w-full min-h-[150px] rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm font-medium outline-none focus:bg-white focus:ring-8 focus:ring-slate-900/5 focus:border-slate-900 transition-all"
                placeholder="Escreva aqui o balanço pedagógico da turma..."
              />
            </div>
          </div>
        )}

        {activeTab === "agenda" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setAgendaForm({
                    id: "",
                    titulo: "",
                    descricao: "",
                    data: new Date().toISOString().split("T")[0],
                    hora_inicio: "08:00",
                    hora_fim: "10:00",
                    local: "Sala Virtual",
                    modulo_id: "",
                    nota_maxima: "20",
                    peso: "1",
                  });
                  setShowAgendaModal(true);
                }}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 text-white font-black text-xs uppercase tracking-widest shadow-lg hover:brightness-110 active:scale-95 transition-all"
              >
                <Plus size={16} /> Agendar Avaliação
              </button>
            </div>
            <div className="grid gap-3">
              {agenda.map((item) => (
                <article key={item.id} className="group relative flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-[2.2rem] border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-lg">
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center rounded-2xl bg-slate-50 px-4 py-3 text-center border border-slate-100 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
                        {new Date(item.data).toLocaleDateString("pt-AO", { month: "short" })}
                      </span>
                      <span className="text-2xl font-black">
                        {new Date(item.data).getDate()}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-slate-100 text-slate-600 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border border-slate-200">
                          {item.formacao_cohort_modulos?.titulo || "Geral"}
                        </span>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                          <Clock size={12} /> {item.hora_inicio?.slice(0, 5)} - {item.hora_fim?.slice(0, 5)}
                        </span>
                      </div>
                      <h4 className="font-black text-slate-900 leading-tight">{item.titulo}</h4>
                      <p className="text-xs text-slate-500 font-medium mt-1">{item.local} · Nota Máx: {item.nota_maxima}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => deleteAgenda(item.id)}
                      className="p-3 rounded-xl border border-rose-100 bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors"
                    >
                      Remover
                    </button>
                  </div>
                </article>
              ))}
              {agenda.length === 0 && (
                <div className="py-20 text-center rounded-[2.2rem] bg-white border border-dashed border-slate-200">
                  <Calendar size={48} className="mx-auto text-slate-200 mb-4" />
                  <p className="text-slate-400 font-bold">Nenhuma avaliação agendada.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "materiais" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setMaterialForm({
                    id: "",
                    titulo: "",
                    descricao: "",
                    file_url: "",
                    modulo_id: "",
                  });
                  setShowMaterialModal(true);
                }}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 text-white font-black text-xs uppercase tracking-widest shadow-lg hover:brightness-110 active:scale-95 transition-all"
              >
                <Plus size={16} /> Adicionar Material
              </button>
            </div>
            <div className="grid gap-3">
              {materiais.map((mat) => (
                <article key={mat.id} className="group relative flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-[2.2rem] border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-lg">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 group-hover:bg-[#1F6B3B] group-hover:text-white transition-all">
                      <FileText size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                          {mat.formacao_cohort_modulos?.titulo || "Geral"}
                        </span>
                      </div>
                      <h4 className="font-black text-slate-900 leading-tight">{mat.titulo}</h4>
                      <p className="text-xs text-slate-500 font-medium truncate max-w-[200px]">{mat.file_url}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={mat.file_url}
                      target="_blank"
                      className="px-4 py-2.5 rounded-xl border border-slate-100 bg-slate-50 text-slate-600 font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-colors"
                    >
                      Download
                    </a>
                    <button
                      onClick={() => deleteMaterial(mat.id)}
                      className="p-3 rounded-xl border border-rose-100 bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors"
                    >
                      Remover
                    </button>
                  </div>
                </article>
              ))}
              {materiais.length === 0 && (
                <div className="py-20 text-center rounded-[2.2rem] bg-white border border-dashed border-slate-200">
                  <FileText size={48} className="mx-auto text-slate-200 mb-4" />
                  <p className="text-slate-400 font-bold">Nenhum material de apoio disponível.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "formandos" && (
          <div className="grid gap-3">
            {studentsAtRisk.length > 0 && (
              <div className="rounded-[2.2rem] border border-rose-200 bg-rose-50 p-6 flex items-center gap-4 mb-4">
                <AlertTriangle className="text-rose-500 h-8 w-8" />
                <p className="text-sm font-bold text-rose-900">Atenção: {studentsAtRisk.length} alunos estão com baixa assiduidade.</p>
              </div>
            )}
            {formandos.map((f) => {
              const prog = progressData.find(p => p.inscricao_id === f.inscricao_id);
              const isAtRisk = prog && prog.percentual_presenca < 75;
              return (
                <article key={f.user_id} className={`flex items-center justify-between gap-4 rounded-[2.2rem] border p-6 shadow-sm transition-all ${isAtRisk ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${isAtRisk ? 'bg-rose-100 text-rose-500' : 'bg-slate-50 text-slate-400'}`}>
                      {isAtRisk ? <AlertTriangle size={24} /> : <UserCircle size={24} />}
                    </div>
                    <div>
                      <h4 className={`font-black leading-tight ${isAtRisk ? 'text-rose-900' : 'text-slate-900'}`}>{f.nome}</h4>
                      <p className="text-xs font-bold text-slate-400 lowercase">{f.email || "Sem email"}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Recomendar Certificação</span>
                      <button
                        onClick={() => toggleRecomendacao(f.user_id, !!f.recomendado_certificacao)}
                        className={`p-1.5 rounded-lg border transition-all ${
                          f.recomendado_certificacao
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "bg-white border-slate-200 text-slate-200 hover:text-slate-400"
                        }`}
                        title={f.recomendado_certificacao ? "Recomendado" : "Recomendar"}
                      >
                        <Award size={16} />
                      </button>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Assiduidade</span>
                      <span className={`text-lg font-black ${isAtRisk ? "text-rose-500" : "text-emerald-500"}`}>
                        {prog ? `${Math.round(prog.percentual_presenca)}%` : "—"}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {activeTab === "comunicacao" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setAvisoForm({ titulo: "", conteudo: "" });
                  setShowAvisoModal(true);
                }}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#1F6B3B] text-white font-black text-xs uppercase tracking-widest shadow-lg hover:brightness-110 active:scale-95 transition-all"
              >
                <Plus size={16} /> Novo Aviso
              </button>
            </div>
            <div className="grid gap-3">
              {avisos.map((aviso) => (
                <article key={aviso.id} className="group relative flex flex-col gap-4 rounded-[2.2rem] border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-lg">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1F6B3B]/10 text-[#1F6B3B]">
                        <MessageSquare size={24} />
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          {new Date(aviso.created_at).toLocaleString("pt-AO")}
                        </span>
                        <h4 className="font-black text-slate-900 leading-tight">{aviso.titulo}</h4>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteAviso(aviso.id)}
                      className="p-2 rounded-xl text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <div className="pl-16">
                    <p className="text-sm text-slate-600 font-medium whitespace-pre-wrap">{aviso.conteudo}</p>
                  </div>
                </article>
              ))}
              {avisos.length === 0 && (
                <div className="py-20 text-center rounded-[2.2rem] bg-white border border-dashed border-slate-200">
                  <Send size={48} className="mx-auto text-slate-200 mb-4" />
                  <p className="text-slate-400 font-bold">Nenhum aviso enviado para esta turma.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modal de Aviso */}
      {showAvisoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-black text-slate-900 mb-6">Novo Aviso</h2>
            <form onSubmit={saveAviso} className="space-y-4">
              <label className="grid gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Título</span>
                <input
                  type="text"
                  value={avisoForm.titulo}
                  onChange={(e) => setAvisoForm(p => ({ ...p, titulo: e.target.value }))}
                  className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-3 text-sm font-semibold outline-none focus:bg-white focus:ring-8 focus:ring-[#1F6B3B]/5 focus:border-[#1F6B3B] transition-all"
                  placeholder="Ex: Próxima aula adiada"
                  required
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Mensagem</span>
                <textarea
                  value={avisoForm.conteudo}
                  onChange={(e) => setAvisoForm(p => ({ ...p, conteudo: e.target.value }))}
                  className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-3 text-sm font-semibold outline-none focus:bg-white focus:ring-8 focus:ring-[#1F6B3B]/5 focus:border-[#1F6B3B] transition-all min-h-[150px]"
                  placeholder="Escreva a mensagem para todos os alunos..."
                  required
                />
              </label>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAvisoModal(false)}
                  className="flex-1 px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-slate-400 font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-2 px-10 py-4 rounded-2xl bg-[#1F6B3B] text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-[#1F6B3B]/20 hover:brightness-110 active:scale-95 transition-all"
                >
                  Enviar Aviso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Aula */}
      {showAulaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-black text-slate-900 mb-6">Registo de Aula</h2>
            <form onSubmit={saveAula} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Data</span>
                  <input
                    type="date"
                    value={aulaForm.data}
                    onChange={(e) => setAulaForm(p => ({ ...p, data: e.target.value }))}
                    className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-3 text-sm font-semibold outline-none focus:bg-white focus:ring-8 focus:ring-[#1F6B3B]/5 focus:border-[#1F6B3B] transition-all"
                    required
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Duração (h)</span>
                  <input
                    type="number"
                    value={aulaForm.horas_ministradas}
                    onChange={(e) => setAulaForm(p => ({ ...p, horas_ministradas: e.target.value }))}
                    className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-3 text-sm font-semibold outline-none focus:bg-white focus:ring-8 focus:ring-[#1F6B3B]/5 focus:border-[#1F6B3B] transition-all"
                    required
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Início</span>
                  <input
                    type="time"
                    value={aulaForm.hora_inicio}
                    onChange={(e) => setAulaForm(p => ({ ...p, hora_inicio: e.target.value }))}
                    className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-3 text-sm font-semibold outline-none focus:bg-white focus:ring-8 focus:ring-[#1F6B3B]/5 focus:border-[#1F6B3B] transition-all"
                    required
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Fim</span>
                  <input
                    type="time"
                    value={aulaForm.hora_fim}
                    onChange={(e) => setAulaForm(p => ({ ...p, hora_fim: e.target.value }))}
                    className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-3 text-sm font-semibold outline-none focus:bg-white focus:ring-8 focus:ring-[#1F6B3B]/5 focus:border-[#1F6B3B] transition-all"
                    required
                  />
                </label>
              </div>

              <label className="grid gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Conteúdo Realizado</span>
                <textarea
                  value={aulaForm.conteudo_realizado}
                  onChange={(e) => setAulaForm(p => ({ ...p, conteudo_realizado: e.target.value }))}
                  className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-3 text-sm font-semibold outline-none focus:bg-white focus:ring-8 focus:ring-[#1F6B3B]/5 focus:border-[#1F6B3B] transition-all min-h-[100px]"
                  placeholder="Descreva o que foi leccionado..."
                  required
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Status</span>
                <select
                  value={aulaForm.status}
                  onChange={(e) => setAulaForm(p => ({ ...p, status: e.target.value as any }))}
                  className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-3 text-sm font-semibold outline-none focus:bg-white focus:ring-8 focus:ring-[#1F6B3B]/5 focus:border-[#1F6B3B] transition-all"
                >
                  <option value="agendada">Agendada</option>
                  <option value="realizada">Realizada</option>
                  <option value="adiada">Adiada</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </label>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAulaModal(false)}
                  className="flex-1 px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-slate-400 font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-2 px-10 py-4 rounded-2xl bg-[#1F6B3B] text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-[#1F6B3B]/20 hover:brightness-110 active:scale-95 transition-all"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Agenda */}
      {showAgendaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-black text-slate-900 mb-6">Agendar Avaliação</h2>
            <form onSubmit={saveAgenda} className="space-y-4">
              <label className="grid gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Título do Evento</span>
                <input
                  type="text"
                  value={agendaForm.titulo}
                  onChange={(e) => setAgendaForm(p => ({ ...p, titulo: e.target.value }))}
                  className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-3 text-sm font-semibold outline-none focus:bg-white focus:ring-8 focus:ring-slate-900/5 focus:border-slate-900 transition-all"
                  placeholder="Ex: Teste Prático I"
                  required
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Módulo Associado</span>
                <select
                  value={agendaForm.modulo_id}
                  onChange={(e) => setAgendaForm(p => ({ ...p, modulo_id: e.target.value }))}
                  className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-3 text-sm font-semibold outline-none focus:bg-white focus:ring-8 focus:ring-slate-900/5 focus:border-slate-900 transition-all"
                >
                  <option value="">Geral / Sem módulo</option>
                  {cohort?.modulos.map(m => (
                    <option key={m.id} value={m.id}>M{m.ordem}: {m.titulo}</option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Data</span>
                  <input
                    type="date"
                    value={agendaForm.data}
                    onChange={(e) => setAgendaForm(p => ({ ...p, data: e.target.value }))}
                    className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-3 text-sm font-semibold outline-none focus:bg-white focus:ring-8 focus:ring-slate-900/5 focus:border-slate-900 transition-all"
                    required
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Local</span>
                  <input
                    type="text"
                    value={agendaForm.local}
                    onChange={(e) => setAgendaForm(p => ({ ...p, local: e.target.value }))}
                    className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-3 text-sm font-semibold outline-none focus:bg-white focus:ring-8 focus:ring-slate-900/5 focus:border-slate-900 transition-all"
                  />
                </label>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAgendaModal(false)}
                  className="flex-1 px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-slate-400 font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-2 px-10 py-4 rounded-2xl bg-slate-900 text-white font-black text-xs uppercase tracking-widest shadow-xl hover:brightness-110 active:scale-95 transition-all"
                >
                  Agendar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Material */}
      {showMaterialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-black text-slate-900 mb-6">Adicionar Material</h2>
            <form onSubmit={saveMaterial} className="space-y-4">
              <label className="grid gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Título do Material</span>
                <input
                  type="text"
                  value={materialForm.titulo}
                  onChange={(e) => setMaterialForm(p => ({ ...p, titulo: e.target.value }))}
                  className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-3 text-sm font-semibold outline-none focus:bg-white focus:ring-8 focus:ring-slate-900/5 focus:border-slate-900 transition-all"
                  placeholder="Ex: Slides da Aula 01"
                  required
                />
              </label>

              <div className="grid gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Ficheiro (PDF/Imagem)</span>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-100 bg-slate-50 p-6 cursor-pointer hover:bg-slate-100 transition-all"
                >
                  <Paperclip className="text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Clique para seleccionar</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                  />
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-slate-100"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-2 text-[10px] font-black uppercase tracking-widest text-slate-300">Ou use um link</span>
                </div>
              </div>

              <label className="grid gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Link do Ficheiro</span>
                <input
                  type="url"
                  value={materialForm.file_url}
                  onChange={(e) => setMaterialForm(p => ({ ...p, file_url: e.target.value }))}
                  className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-3 text-sm font-semibold outline-none focus:bg-white focus:ring-8 focus:ring-slate-900/5 focus:border-slate-900 transition-all"
                  placeholder="https://drive.google.com/..."
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Módulo Associado</span>
                <select
                  value={materialForm.modulo_id}
                  onChange={(e) => setMaterialForm(p => ({ ...p, modulo_id: e.target.value }))}
                  className="rounded-2xl border border-slate-100 bg-slate-50 px-5 py-3 text-sm font-semibold outline-none focus:bg-white focus:ring-8 focus:ring-slate-900/5 focus:border-slate-900 transition-all"
                >
                  <option value="">Geral / Sem módulo</option>
                  {cohort?.modulos.map(m => (
                    <option key={m.id} value={m.id}>M{m.ordem}: {m.titulo}</option>
                  ))}
                </select>
              </label>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowMaterialModal(false)}
                  className="flex-1 px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-slate-400 font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-2 px-10 py-4 rounded-2xl bg-slate-900 text-white font-black text-xs uppercase tracking-widest shadow-xl hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                >
                  {uploading ? "A carregar..." : "Adicionar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Presenças */}
      {showPresencaModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="flex h-[92vh] w-full max-w-lg flex-col rounded-t-2xl bg-white p-4 shadow-2xl animate-in slide-in-from-bottom-4 duration-200 sm:h-auto sm:max-h-[90vh] sm:rounded-[2rem] sm:p-8">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Controlo de Presenças</h2>
                <p className="text-sm font-medium text-slate-400 uppercase tracking-widest mt-1">
                  {activeAula ? new Date(activeAula.data).toLocaleDateString("pt-AO") : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPresencas(prev => prev.map(p => ({ ...p, presente: true })))}
                className="min-h-[44px] rounded-xl bg-emerald-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-600 transition-colors hover:bg-emerald-100"
              >
                Todos
              </button>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-600">Presentes</p>
                <p className="text-xl font-black text-emerald-700">{presentesCount}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Faltas</p>
                <p className="text-xl font-black text-slate-700">{faltasCount}</p>
              </div>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto pr-1">
              {loadingPresencas ? (
                <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-slate-300" /></div>
              ) : (
                <div className="grid gap-2">
                  {presencas.map((p) => (
                    <div
                      key={p.inscricao_id}
                      className={`rounded-2xl border-2 p-4 transition-all ${
                        p.presente
                          ? "bg-emerald-50 border-emerald-100 text-emerald-900"
                          : "bg-slate-50 border-slate-100 text-slate-400"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-black ${p.presente ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                          {p.formacao_inscricoes.nome_snapshot.charAt(0)}
                        </div>
                        <span className="min-w-0 flex-1 text-left text-sm font-black">{p.formacao_inscricoes.nome_snapshot}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setPresencas(prev => prev.map(item => item.inscricao_id === p.inscricao_id ? { ...item, presente: true } : item))}
                          className={`min-h-[48px] rounded-xl text-xs font-black uppercase tracking-[0.12em] transition-all active:scale-[0.98] ${
                            p.presente ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "bg-white text-slate-400"
                          }`}
                        >
                          Presente
                        </button>
                        <button
                          type="button"
                          onClick={() => setPresencas(prev => prev.map(item => item.inscricao_id === p.inscricao_id ? { ...item, presente: false } : item))}
                          className={`min-h-[48px] rounded-xl text-xs font-black uppercase tracking-[0.12em] transition-all active:scale-[0.98] ${
                            !p.presente ? "bg-slate-700 text-white shadow-lg shadow-slate-700/20" : "bg-white text-slate-400"
                          }`}
                        >
                          Falta
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="-mx-4 mt-4 flex gap-3 border-t border-slate-100 bg-white px-4 pt-3 sm:-mx-8 sm:px-8">
              <button
                type="button"
                onClick={() => setShowPresencaModal(false)}
                className="min-h-[56px] flex-1 rounded-2xl border border-slate-100 bg-slate-50 px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400 transition-all hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={savePresencas}
                disabled={loadingPresencas}
                className="min-h-[56px] flex-[1.3] rounded-2xl bg-[#1F6B3B] px-6 py-4 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-[#1F6B3B]/20 transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
              >
                {loadingPresencas ? "A guardar..." : "Guardar Presenças"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
