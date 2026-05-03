"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { 
  Users, 
  Target, 
  TrendingUp, 
  Plus, 
  MessageCircle, 
  Copy, 
  Sparkles,
  ChevronRight,
  Calendar,
  Settings,
  MoreVertical,
  AlertCircle,
  Trash2,
  Calculator,
  Info,
  FileText,
  Globe,
  CheckCircle2,
  Loader2,
  Image as ImageIcon
} from "lucide-react";

type CursoModulo = {
  ordem: number;
  titulo: string;
  carga_horaria: number | null;
  descricao: string | null;
};

type CursoMaterial = {
  id?: string;
  titulo: string;
  url: string;
  tipo: string;
};

type Course = {
  id: string;
  codigo: string;
  nome: string;
  area: string | null;
  modalidade: string;
  carga_horaria: number | null;
  status: string;
  preco_tabela?: number;
  custo_hora_estimado?: number;
  desconto_ativo?: boolean;
  desconto_percentual?: number;
  parceria_b2b_ativa?: boolean;
  modulos: CursoModulo[];
  materiais: CursoMaterial[];
};

type Lead = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  origem: string;
  created_at: string;
};

type Cohort = {
  id: string;
  codigo: string;
  nome: string;
  vagas: number;
  data_inicio: string;
  data_fim: string;
  status: string;
  curso_id: string;
};

type Metrics = {
  total_leads: number;
  total_turmas: number;
  ocupacao_media: number;
  receita_estimada: number;
};

type ReadinessItem = {
  id: string;
  codigo: string;
  nome: string;
  curso_nome: string;
  status: string;
  vagas: number;
  vagas_ocupadas: number;
  valor_referencia: number;
  moeda: string;
  pronto: boolean;
  checks: {
    curso_ativo: boolean;
    turma_aberta: boolean;
    preco_configurado: boolean;
    vagas_disponiveis: boolean;
    recebimentos_ativos: boolean;
  };
};

type Props = {
  courseId: string;
};

export default function CourseCockpitClient({ courseId }: Props) {
  const [course, setCourse] = useState<Course | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [readiness, setReadiness] = useState<ReadinessItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<"turmas" | "leads" | "metricas" | "configuracoes">("turmas");
  const [configSubTab, setConfigSubTab] = useState<"geral" | "comercial" | "programa" | "materiais" | "visual">("geral");

  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    nome: "",
    codigo: "",
    modalidade: "",
    carga_horaria: "",
    area: "",
    preco_tabela: "",
    custo_hora_estimado: "",
    desconto_ativo: false,
    desconto_percentual: "",
    parceria_b2b_ativa: false,
    thumbnail_url: "",
    video_url: "",
    slug: "",
    seo_title: "",
    seo_description: "",
  });
  const [modulos, setModulos] = useState<CursoModulo[]>([]);
  const [materiais, setMateriais] = useState<CursoMaterial[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [courseRes, leadsRes, cohortsRes, metricsRes, pubRes] = await Promise.all([
          fetch(`/api/formacao/backoffice/cursos`),
          fetch(`/api/formacao/backoffice/cursos/${courseId}/leads`),
          fetch(`/api/formacao/backoffice/cohorts?curso_id=${courseId}`),
          fetch(`/api/formacao/backoffice/cursos/${courseId}/metrics`),
          fetch(`/api/formacao/admin/publicacao`)
        ]);

        const courseData = await courseRes.json();
        const leadsData = await leadsRes.json();
        const cohortsData = await cohortsRes.json();
        const metricsData = await metricsRes.json();
        const pubData = await pubRes.json();

        const currentCourse = courseData.items?.find((c: Course) => c.id === courseId);
        setCourse(currentCourse || null);
        if (currentCourse) {
          setEditForm({
            nome: currentCourse.nome,
            codigo: currentCourse.codigo,
            modalidade: currentCourse.modalidade,
            carga_horaria: String(currentCourse.carga_horaria ?? ""),
            area: currentCourse.area ?? "",
            preco_tabela: String(currentCourse.preco_tabela ?? 0),
            custo_hora_estimado: String(currentCourse.custo_hora_estimado ?? 0),
            desconto_ativo: Boolean(currentCourse.desconto_ativo),
            desconto_percentual: String(currentCourse.desconto_percentual ?? 0),
            parceria_b2b_ativa: Boolean(currentCourse.parceria_b2b_ativa),
            thumbnail_url: currentCourse.thumbnail_url ?? "",
            video_url: currentCourse.video_url ?? "",
            slug: currentCourse.slug ?? "",
            seo_title: (currentCourse as any).seo_config?.title ?? "",
            seo_description: (currentCourse as any).seo_config?.description ?? "",
          });
          setModulos(currentCourse.modulos || []);
          setMateriais(currentCourse.materiais || []);
        }
        setLeads(leadsData.items || []);
        setCohorts(cohortsData.items || []);
        setMetrics(metricsData.metrics || null);

        if (pubData.ok && currentCourse) {
           const courseReadiness = (pubData.readiness as ReadinessItem[]).filter(r => r.curso_nome === currentCourse.nome);
           setReadiness(courseReadiness);
        }
      } catch (err) {
        console.error("Error fetching cockpit data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [courseId]);

  const loadCohorts = async () => {
     const res = await fetch(`/api/formacao/backoffice/cohorts?curso_id=${courseId}`);
     const data = await res.json();
     if (data.ok) setCohorts(data.items);
  };

  const handleMoxiAI = async () => {
    if (!confirm("O Moxi AI irá gerar sugestões de Objetivos, Requisitos e Módulos para este curso. Deseja continuar?")) return;
    
    alert("Moxi AI: Sugestões geradas com base no título do curso. (Simulação)");
    // In a real scenario, this would call an API and update the course state
  };

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "thumbnail");

      const res = await fetch("/api/formacao/backoffice/cursos/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Erro no upload");

      setEditForm((prev) => ({ ...prev, thumbnail_url: json.url }));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro no upload");
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateCourse = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/formacao/backoffice/cursos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: courseId,
          ...editForm,
          carga_horaria: Number(editForm.carga_horaria),
          preco_tabela: Number(editForm.preco_tabela),
          custo_hora_estimado: Number(editForm.custo_hora_estimado),
          desconto_percentual: Number(editForm.desconto_percentual),
          modulos,
          materiais,
          seo_config: {
            title: editForm.seo_title,
            description: editForm.seo_description
          }
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Falha ao atualizar");
      
      alert("Configurações salvas com sucesso!");
      setCourse(prev => prev ? { 
        ...prev, 
        ...editForm, 
        carga_horaria: Number(editForm.carga_horaria),
        modulos,
        materiais
      } : null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao atualizar curso");
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicateCohort = async (cohort: Cohort) => {
    if (!confirm(`Deseja duplicar a turma "${cohort.nome}"?`)) return;

    try {
      const res = await fetch(`/api/formacao/backoffice/cohorts/${cohort.id}/duplicate`, {
        method: "POST"
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Falha ao duplicar");
      
      alert("Turma duplicada com sucesso! Verifique a nova turma em estado Planeada.");
      await loadCohorts();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao duplicar turma");
    }
  };

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA" }).format(val);
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Carregando Cockpit...</div>;
  if (!course) return <div className="p-8 text-center text-red-500">Curso não encontrado.</div>;

  const isPublic = readiness.some(r => r.pronto);

  return (
    <div className="space-y-6">
      {/* Lead Notification Alert (Pillar 3) */}
      {leads.length > 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-blue-100 bg-blue-50/50 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <MessageCircle size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">
                Você tem {leads.length} {leads.length === 1 ? 'lead interessado' : 'leads interessados'} neste curso.
              </p>
              <p className="text-xs text-slate-600">
                Deseja enviar um convite para a próxima turma via WhatsApp ou E-mail?
              </p>
            </div>
          </div>
          <button className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-colors">
             Notificar Todos
          </button>
        </div>
      )}

      {/* Header / Meta */}
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                {course.codigo}
              </span>
              <span className="text-xs font-medium text-slate-400">{course.area}</span>
              {isPublic ? (
                <span className="ml-2 flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-600 ring-1 ring-emerald-100">
                  <Globe size={10} /> Ativo na Landing
                </span>
              ) : (
                <span className="ml-2 flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-slate-400 ring-1 ring-slate-100">
                  Oculto na Landing
                </span>
              )}
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">{course.nome}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {course.modalidade} · {course.carga_horaria}h de carga horária total
            </p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleMoxiAI}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <Sparkles size={16} className="text-klasse-gold" /> Moxi AI: Sugerir Conteúdo
            </button>
            <Link 
              href={`/secretaria/turmas?openCreate=1&curso_id=${courseId}`}
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
            >
              <Plus size={16} /> Nova Turma
            </Link>
          </div>
        </div>

        {/* Quick Metrics (Pillar 1) */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <MetricCard 
            icon={<Target className="text-blue-600" />} 
            label="Leads em Espera" 
            value={metrics?.total_leads ?? 0} 
            sub="Interessados via landing"
          />
          <MetricCard 
            icon={<Users className="text-emerald-600" />} 
            label="Ocupação Média" 
            value={`${((metrics?.ocupacao_media ?? 0) * 100).toFixed(0)}%`}
            sub="Saúde das turmas"
          />
          <MetricCard 
            icon={<TrendingUp className="text-amber-600" />} 
            label="Receita Estimada" 
            value={formatMoney(metrics?.receita_estimada ?? 0)}
            sub="Total gerado pelo curso"
          />
          <MetricCard 
            icon={<Calendar className="text-purple-600" />} 
            label="Turmas Totais" 
            value={metrics?.total_turmas ?? 0}
            sub="Edições deste produto"
          />
        </div>
      </header>

      {/* Tabs */}
      <nav className="flex gap-1 border-b border-slate-200">
        <TabButton active={activeTab === "turmas"} onClick={() => setActiveTab("turmas")} label="Gestão de Turmas" />
        <TabButton active={activeTab === "leads"} onClick={() => setActiveTab("leads")} label="Lista de Espera" />
        <TabButton active={activeTab === "metricas"} onClick={() => setActiveTab("metricas")} label="Análise & Insights" />
        <TabButton active={activeTab === "configuracoes"} onClick={() => setActiveTab("configuracoes")} label="Configurações do Curso" />
      </nav>

      {/* Content */}
      <main>
        {activeTab === "configuracoes" && (
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div className="flex border-b border-slate-100 bg-slate-50/50 overflow-x-auto">
               <button 
                 onClick={() => setConfigSubTab("geral")}
                 className={`px-6 py-4 text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all ${configSubTab === 'geral' ? 'bg-white text-slate-900 border-r border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
               >Geral</button>
               <button 
                 onClick={() => setConfigSubTab("comercial")}
                 className={`px-6 py-4 text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all ${configSubTab === 'comercial' ? 'bg-white text-slate-900 border-x border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
               >Comercial</button>
               <button 
                 onClick={() => setConfigSubTab("programa")}
                 className={`px-6 py-4 text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all ${configSubTab === 'programa' ? 'bg-white text-slate-900 border-x border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
               >Programa</button>
               <button 
                 onClick={() => setConfigSubTab("materiais")}
                 className={`px-6 py-4 text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all ${configSubTab === 'materiais' ? 'bg-white text-slate-900 border-x border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
               >Materiais</button>
               <button 
                 onClick={() => setConfigSubTab("visual")}
                 className={`px-6 py-4 text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all ${configSubTab === 'visual' ? 'bg-white text-slate-900 border-l border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
               >Visual & Landing</button>
            </div>

            <div className="p-8">
              {configSubTab === "geral" && (
                <form onSubmit={handleUpdateCourse} className="grid gap-6 md:grid-cols-2 max-w-3xl">
                  <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Nome do Curso</label>
                      <input 
                        type="text" 
                        value={editForm.nome} 
                        onChange={e => setEditForm(p => ({ ...p, nome: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-900"
                      />
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Código</label>
                      <input 
                        type="text" 
                        value={editForm.codigo} 
                        onChange={e => setEditForm(p => ({ ...p, codigo: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-900"
                      />
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Área / Categoria</label>
                      <input 
                        type="text" 
                        value={editForm.area} 
                        onChange={e => setEditForm(p => ({ ...p, area: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-900"
                      />
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Carga Horária (h)</label>
                      <input 
                        type="number" 
                        value={editForm.carga_horaria} 
                        onChange={e => setEditForm(p => ({ ...p, carga_horaria: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-900"
                      />
                  </div>
                  <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Modalidade</label>
                      <select 
                        value={editForm.modalidade} 
                        onChange={e => setEditForm(p => ({ ...p, modalidade: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-900"
                      >
                        <option value="presencial">Presencial</option>
                        <option value="online">Online / E-learning</option>
                        <option value="hibrido">Híbrido</option>
                      </select>
                  </div>
                  <div className="md:col-span-2 pt-4">
                      <button 
                        type="submit" 
                        disabled={saving}
                        className="rounded-xl bg-slate-900 px-8 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        {saving ? "Salvando..." : "Salvar Alterações Gerais"}
                      </button>
                  </div>
                </form>
              )}

              {configSubTab === "comercial" && (
                <div className="space-y-8">
                  <form onSubmit={handleUpdateCourse} className="grid gap-6 md:grid-cols-2 max-w-4xl">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Preço de Tabela (AOA)</label>
                        <input 
                          type="number" 
                          value={editForm.preco_tabela} 
                          onChange={e => setEditForm(p => ({ ...p, preco_tabela: e.target.value }))}
                          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-900"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Custo Hora Formador (AOA)</label>
                        <input 
                          type="number" 
                          value={editForm.custo_hora_estimado} 
                          onChange={e => setEditForm(p => ({ ...p, custo_hora_estimado: e.target.value }))}
                          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-900"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Desconto (%)</label>
                        <input 
                          disabled={!editForm.desconto_ativo}
                          type="number" 
                          value={editForm.desconto_percentual} 
                          onChange={e => setEditForm(p => ({ ...p, desconto_percentual: e.target.value }))}
                          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-900 disabled:bg-slate-50"
                        />
                    </div>
                    <div className="flex flex-col justify-center gap-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                          <input 
                            type="checkbox" 
                            checked={editForm.desconto_ativo} 
                            onChange={e => setEditForm(p => ({ ...p, desconto_ativo: e.target.checked }))}
                            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                          />
                          Ativar Desconto Promocional
                        </label>
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                          <input 
                            type="checkbox" 
                            checked={editForm.parceria_b2b_ativa} 
                            onChange={e => setEditForm(p => ({ ...p, parceria_b2b_ativa: e.target.checked }))}
                            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                          />
                          Aceita Parceria B2B
                        </label>
                    </div>
                    <div className="md:col-span-2 pt-4 border-t border-slate-100">
                        <button 
                          type="submit" 
                          disabled={saving}
                          className="rounded-xl bg-slate-900 px-8 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                        >
                          {saving ? "Salvando..." : "Salvar Configurações Comerciais"}
                        </button>
                    </div>
                  </form>

                  {/* Rentabilidade Tool (Legacy copy) */}
                  <div className="rounded-2xl border border-klasse-gold/20 bg-amber-50/30 p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Calculator size={18} className="text-klasse-gold" />
                      <strong className="text-sm font-bold text-slate-900 uppercase tracking-wider">Análise de Rentabilidade Teórica (por aluno)</strong>
                    </div>
                    <div className="grid gap-6 md:grid-cols-3">
                      <div className="grid gap-1">
                        <span className="text-[10px] uppercase font-black text-slate-400">Receita Unitária</span>
                        <span className="text-xl font-black text-slate-900">
                          {formatMoney(Number(editForm.preco_tabela) * (editForm.desconto_ativo ? (1 - Number(editForm.desconto_percentual) / 100) : 1))}
                        </span>
                      </div>
                      <div className="grid gap-1">
                        <span className="text-[10px] uppercase font-black text-slate-400">Custo Pedagógico Total</span>
                        <span className="text-xl font-black text-rose-600">
                          {formatMoney(Number(editForm.custo_hora_estimado) * Number(editForm.carga_horaria))}
                        </span>
                        <p className="text-[9px] text-slate-500">Carga horária x Custo hora formador</p>
                      </div>
                      <div className="grid gap-1">
                        <span className="text-[10px] uppercase font-black text-slate-400">Break-even (Ponto de Equilíbrio)</span>
                        <span className="text-xl font-black text-emerald-600">
                          {Math.ceil((Number(editForm.custo_hora_estimado) * Number(editForm.carga_horaria)) / (Number(editForm.preco_tabela) * (editForm.desconto_ativo ? (1 - Number(editForm.desconto_percentual) / 100) : 1) || 1))} Alunos
                        </span>
                        <p className="text-[9px] text-slate-500">Mínimo para cobrir custo do formador</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {configSubTab === "programa" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Ementa do Curso</h3>
                      <p className="text-sm text-slate-500">Defina os módulos que compõem este programa académico.</p>
                    </div>
                    <button 
                      onClick={() => setModulos(p => [...p, { ordem: p.length + 1, titulo: "", carga_horaria: null, descricao: "" }])}
                      className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
                    >
                      <Plus size={16} /> Adicionar Módulo
                    </button>
                  </div>

                  <div className="grid gap-4">
                    {modulos.map((modulo, idx) => (
                      <div key={idx} className="group relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-300">
                        <div className="grid gap-4 md:grid-cols-[1fr_120px_auto]">
                           <div className="space-y-1.5">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Título do Módulo {idx + 1}</label>
                              <input 
                                type="text"
                                value={modulo.titulo}
                                onChange={e => setModulos(p => p.map((m, i) => i === idx ? { ...m, titulo: e.target.value } : m))}
                                placeholder="Ex: Introdução ao Excel"
                                className="w-full border-none p-0 text-sm font-bold text-slate-900 outline-none focus:ring-0"
                              />
                           </div>
                           <div className="space-y-1.5">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Carga (h)</label>
                              <input 
                                type="number"
                                value={modulo.carga_horaria ?? ""}
                                onChange={e => setModulos(p => p.map((m, i) => i === idx ? { ...m, carga_horaria: Number(e.target.value) || null } : m))}
                                placeholder="8"
                                className="w-full border-none p-0 text-sm font-bold text-slate-900 outline-none focus:ring-0"
                              />
                           </div>
                           <div className="flex items-center">
                              <button 
                                onClick={() => setModulos(p => p.filter((_, i) => i !== idx))}
                                className="rounded-lg p-2 text-slate-300 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                              >
                                <Trash2 size={18} />
                              </button>
                           </div>
                        </div>
                        <div className="mt-4 border-t border-slate-50 pt-4">
                           <textarea 
                             value={modulo.descricao ?? ""}
                             onChange={e => setModulos(p => p.map((m, i) => i === idx ? { ...m, descricao: e.target.value } : m))}
                             placeholder="Breve descrição dos conteúdos abordados..."
                             className="w-full border-none p-0 text-xs text-slate-500 outline-none focus:ring-0 resize-none h-12"
                           />
                        </div>
                      </div>
                    ))}
                    {modulos.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center">
                        <p className="text-sm font-medium text-slate-400">Nenhum módulo definido. Comece a montar o programa académico.</p>
                      </div>
                    )}
                  </div>

                  <div className="pt-6 border-t border-slate-100 flex justify-end">
                    <button 
                      onClick={() => handleUpdateCourse()}
                      disabled={saving}
                      className="rounded-xl bg-slate-900 px-8 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      {saving ? "Salvando..." : "Salvar Programa Académico"}
                    </button>
                  </div>
                </div>
              )}

              {configSubTab === "materiais" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Materiais de Apoio</h3>
                      <p className="text-sm text-slate-500">Links e documentos que estarão disponíveis para todas as turmas deste curso.</p>
                    </div>
                    <button 
                      onClick={() => setMateriais(p => [...p, { titulo: "", url: "", tipo: "pdf" }])}
                      className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
                    >
                      <Plus size={16} /> Adicionar Material
                    </button>
                  </div>

                  <div className="grid gap-3">
                    {materiais.map((material, idx) => (
                      <div key={idx} className="flex gap-4 items-end rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                         <div className="flex-1 space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Título</label>
                            <input 
                              type="text"
                              value={material.titulo}
                              onChange={e => setMateriais(p => p.map((m, i) => i === idx ? { ...m, titulo: e.target.value } : m))}
                              placeholder="Ex: Manual do Formando"
                              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-slate-900 bg-white"
                            />
                         </div>
                         <div className="flex-[1.5] space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">URL / Link</label>
                            <input 
                              type="text"
                              value={material.url}
                              onChange={e => setMateriais(p => p.map((m, i) => i === idx ? { ...m, url: e.target.value } : m))}
                              placeholder="https://..."
                              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-slate-900 bg-white"
                            />
                         </div>
                         <div className="w-32 space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo</label>
                            <select 
                              value={material.tipo}
                              onChange={e => setMateriais(p => p.map((m, i) => i === idx ? { ...m, tipo: e.target.value } : m))}
                              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-slate-900 bg-white"
                            >
                              <option value="pdf">PDF</option>
                              <option value="video">Vídeo</option>
                              <option value="link">Link</option>
                              <option value="zip">ZIP</option>
                            </select>
                         </div>
                         <button 
                            onClick={() => setMateriais(p => p.filter((_, i) => i !== idx))}
                            className="mb-1 rounded-lg p-2 text-slate-300 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                          >
                            <Trash2 size={18} />
                         </button>
                      </div>
                    ))}
                    {materiais.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center">
                        <p className="text-sm font-medium text-slate-400">Nenhum material base configurado.</p>
                      </div>
                    )}
                  </div>

                  <div className="pt-6 border-t border-slate-100 flex justify-end">
                    <button 
                      onClick={() => handleUpdateCourse()}
                      disabled={saving}
                      className="rounded-xl bg-slate-900 px-8 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      {saving ? "Salvando..." : "Salvar Materiais"}
                    </button>
                  </div>
                </div>
              )}
              {configSubTab === "visual" && (
                <div className="space-y-8">
                  <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
                    <form onSubmit={handleUpdateCourse} className="grid gap-6 md:grid-cols-2">
                       <div className="space-y-4 md:col-span-2">
                          <h3 className="text-lg font-bold text-slate-900">Marketing & Divulgação</h3>
                          <p className="text-sm text-slate-500">Personalize a aparência do seu curso no site público e nas redes sociais.</p>
                       </div>
                       
                       <div className="space-y-4">
                          <div className="space-y-1.5">
                             <label className="text-xs font-bold uppercase tracking-wider text-klasse-gold">Link do Curso (URL Amigável)</label>
                             <input 
                               type="text" 
                               value={editForm.slug} 
                               onChange={e => setEditForm(p => ({ ...p, slug: e.target.value }))}
                               placeholder="ex: excel-avancado"
                               className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-900"
                             />
                             <p className="text-[10px] text-slate-500 italic">O seu curso será encontrado em: klasse.ao/seu-centro/<b>{editForm.slug || 'link-do-curso'}</b></p>
                          </div>
                          <div className="space-y-1.5">
                             <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Vídeo de Apresentação (YouTube/Vimeo)</label>
                             <input 
                               type="text" 
                               value={editForm.video_url} 
                               onChange={e => setEditForm(p => ({ ...p, video_url: e.target.value }))}
                               placeholder="Ex: https://www.youtube.com/watch?v=..."
                               className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-900"
                             />
                          </div>
                          <div className="space-y-3">
                             <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Foto de Capa do Curso</label>
                             <div className="flex flex-col gap-4">
                                {editForm.thumbnail_url ? (
                                  <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm group/capa">
                                    <img src={editForm.thumbnail_url} alt="Preview" className="h-full w-full object-cover" />
                                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover/capa:opacity-100 transition-opacity flex items-center justify-center">
                                       <button
                                          type="button"
                                          onClick={() => setEditForm(p => ({ ...p, thumbnail_url: "" }))}
                                          className="rounded-full bg-white p-2 text-rose-600 shadow-xl hover:scale-110 transition-transform"
                                        >
                                          <Trash2 size={20} />
                                       </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex aspect-video w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50">
                                    <ImageIcon size={48} className="text-slate-200 mb-3" />
                                    <span className="text-xs font-bold text-slate-400">Nenhuma foto selecionada</span>
                                  </div>
                                )}
                                
                                <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
                                  {uploading ? <Loader2 size={18} className="animate-spin text-klasse-gold" /> : <Plus size={18} className="text-klasse-gold" />}
                                  {uploading ? "A carregar..." : "Carregar Foto de Capa"}
                                  <input type="file" className="hidden" accept="image/*" onChange={handleThumbnailUpload} disabled={uploading} />
                                </label>
                                <p className="text-[10px] text-slate-400 text-center">Formatos aceites: JPG, PNG ou WEBP. Tamanho recomendado: 1200x630px.</p>
                             </div>
                          </div>
                       </div>

                       <div className="space-y-4">
                          <div className="space-y-1.5">
                             <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Título para o Google & Partilhas</label>
                             <input 
                               type="text" 
                               value={editForm.seo_title} 
                               onChange={e => setEditForm(p => ({ ...p, seo_title: e.target.value }))}
                               placeholder="Como o curso aparece em buscas"
                               className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-900"
                             />
                          </div>
                          <div className="space-y-1.5">
                             <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Pequeno Resumo de Venda</label>
                             <textarea 
                               value={editForm.seo_description} 
                               onChange={e => setEditForm(p => ({ ...p, seo_description: e.target.value }))}
                               placeholder="Escreva um resumo curto e apelativo para atrair alunos..."
                               className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-900 h-24 resize-none"
                             />
                          </div>
                       </div>

                       <div className="md:col-span-2 pt-4 border-t border-slate-100 flex justify-end">
                          <button 
                            type="submit" 
                            disabled={saving}
                            className="rounded-xl bg-slate-900 px-8 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                          >
                            {saving ? "Salvando..." : "Salvar Configurações de Landing"}
                          </button>
                       </div>
                    </form>

                    {/* Check-up de Publicação Lateral (Readiness) */}
                    <div className="space-y-4">
                       <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
                          <div className="flex items-center justify-between mb-6">
                             <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Check-up de Publicação</h3>
                             <Globe size={18} className="text-blue-500" />
                          </div>
                          
                          <div className="space-y-4">
                             {readiness.length === 0 ? (
                               <p className="text-xs text-slate-500 italic">Abra uma turma operacional para validar a publicação.</p>
                             ) : (
                               readiness.map(item => (
                                 <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
                                    <div className="flex items-start justify-between gap-2 mb-3">
                                       <div className="min-w-0">
                                          <p className="text-xs font-bold text-slate-900 truncate">{item.nome}</p>
                                          <p className="text-[10px] text-slate-400">{item.codigo}</p>
                                       </div>
                                       {item.pronto ? <CheckCircle2 size={16} className="text-emerald-500" /> : <AlertCircle size={16} className="text-amber-500" />}
                                    </div>
                                    
                                    <div className="grid gap-1.5">
                                       <CheckItem label="Curso ativo" done={item.checks.curso_ativo} />
                                       <CheckItem label="Turma aberta" done={item.checks.turma_aberta} />
                                       <CheckItem label="Preço definido" done={item.checks.preco_configurado} />
                                       <CheckItem label="Vagas disponíveis" done={item.checks.vagas_disponiveis} />
                                       <CheckItem label="Centro c/ pagamentos" done={item.checks.recebimentos_ativos} />
                                    </div>

                                    {!item.pronto && !item.checks.preco_configurado && (
                                       <button 
                                         onClick={() => { setActiveTab("configuracoes"); setConfigSubTab("comercial"); }}
                                         className="mt-3 w-full rounded-lg bg-amber-50 py-1.5 text-[10px] font-bold text-amber-700 hover:bg-amber-100"
                                       >
                                         Configurar Preço →
                                       </button>
                                    )}
                                 </div>
                               ))
                             )}
                          </div>

                          <p className="mt-6 text-[10px] text-slate-400 leading-relaxed italic">
                             Para aparecer na Landing Page, uma turma deve cumprir todos os 5 critérios acima.
                          </p>
                       </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {activeTab === "turmas" && (
          <div className="grid gap-4">
            {cohorts.length === 0 ? (
              <EmptyState message="Nenhuma turma aberta para este curso." />
            ) : (
              cohorts.map(cohort => (
                <CohortRow 
                  key={cohort.id} 
                  cohort={cohort} 
                  onDuplicate={() => handleDuplicateCohort(cohort)}
                />
              ))
            )}
          </div>
        )}

        {activeTab === "leads" && (
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
             <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 font-bold text-slate-700">Nome</th>
                    <th className="px-6 py-3 font-bold text-slate-700">Contacto</th>
                    <th className="px-6 py-3 font-bold text-slate-700">Origem</th>
                    <th className="px-6 py-3 font-bold text-slate-700 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leads.map(lead => (
                    <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-900">{lead.nome}</td>
                      <td className="px-6 py-4 text-slate-600">
                        {lead.email}<br/>
                        <span className="text-xs">{lead.telefone}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-600">
                          {lead.origem}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <a 
                          href={`https://wa.me/${lead.telefone?.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366]/10 px-3 py-1.5 text-xs font-bold text-[#25D366] hover:bg-[#25D366]/20"
                        >
                          <MessageCircle size={14} /> WhatsApp
                        </a>
                      </td>
                    </tr>
                  ))}
                  {leads.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-400">Nenhum lead interessado no momento.</td>
                    </tr>
                  )}
                </tbody>
             </table>
          </div>
        )}
      </main>
    </div>
  );
}

function MetricCard({ icon, label, value, sub }: { icon: React.ReactNode, label: string, value: string | number, sub: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm">
          {icon}
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
          <p className="text-xl font-black text-slate-900">{value}</p>
        </div>
      </div>
      <p className="mt-3 text-[10px] font-medium text-slate-500">{sub}</p>
    </div>
  );
}

function TabButton({ active, label, onClick }: { active: boolean, label: string, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 text-sm font-bold transition-all ${
        active 
          ? "border-b-2 border-slate-900 text-slate-900" 
          : "text-slate-400 hover:text-slate-600"
      }`}
    >
      {label}
    </button>
  );
}

function CohortRow({ cohort, onDuplicate }: { cohort: Cohort, onDuplicate: () => void }) {
  // Mock occupancy for demonstration (Pillar 4)
  const occupancy = Math.floor(Math.random() * 100);
  const isCritical = occupancy < 20;
  const isFull = occupancy >= 90;

  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-300">
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-bold text-slate-900">{cohort.nome}</h3>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${
            cohort.status === 'aberta' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
          }`}>
            {cohort.status}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-6 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Calendar size={14} /> {cohort.data_inicio} → {cohort.data_fim}
          </div>
          <div className="flex items-center gap-1.5">
            <Users size={14} /> {cohort.vagas} vagas totais
          </div>
        </div>
      </div>

      <div className="flex items-center gap-8">
        {/* Occupancy Bar (Pillar 4) */}
        <div className="w-48">
          <div className="mb-1.5 flex justify-between text-[10px] font-bold uppercase tracking-widest">
            <span className={isCritical ? 'text-amber-600' : isFull ? 'text-emerald-600' : 'text-slate-400'}>
              Ocupação
            </span>
            <span className="text-slate-900">{occupancy}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
            <div 
              className={`h-full transition-all ${
                isCritical ? 'bg-amber-500' : isFull ? 'bg-emerald-500' : 'bg-blue-500'
              }`} 
              style={{ width: `${occupancy}%` }} 
            />
          </div>
          {isFull && (
            <p className="mt-1 text-[9px] font-bold text-emerald-600 uppercase flex items-center gap-1">
              <AlertCircle size={10} /> Meta atingida
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <button 
            onClick={onDuplicate}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
            title="Duplicar Turma (Pillar 2)"
          >
            <Copy size={16} />
          </button>
          <Link 
            href={`/formacao/cohorts/${cohort.id}/overview`}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            Gerir <ChevronRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
      <p className="text-sm font-medium text-slate-400">{message}</p>
    </div>
  );
}

function CheckItem({ label, done }: { label: string, done: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-1.5 text-[10px]">
      <span className="font-medium text-slate-600">{label}</span>
      <CheckCircle2 size={12} className={done ? "text-emerald-500" : "text-slate-200"} />
    </div>
  );
}
