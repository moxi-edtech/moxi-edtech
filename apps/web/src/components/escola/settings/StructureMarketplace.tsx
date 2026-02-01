"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  BookOpen,
  Trash2,
  ShoppingBag,
  CheckCircle2,
  Loader2,
  Layers,
  Settings,
  X,
  Save,
  PlusCircle,
  ArrowLeft,
  GraduationCap,
  Users,
  Plus,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useVirtualizer } from "@tanstack/react-virtual";

// Importações de dados estáticos
import {
  CURRICULUM_PRESETS_META,
  type CurriculumKey,
  CURRICULUM_PRESETS,
} from "@/lib/academico/curriculum-presets"; 
import { PRESET_TO_TYPE, TYPE_COLORS, getTypeLabel, type CourseType } from "@/lib/courseTypes";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildEscolaUrl } from "@/lib/escola/url";
import { filterItemsByCourse } from "@/lib/academico/filters";

// --- TIPOS ---
type ActiveCourse = {
  id: string;
  nome: string;
  codigo?: string | null;
  curriculum_key?: string | null;
  course_code?: string | null;
  total_classes: number;
  total_turmas: number;
  total_alunos: number;
};

// Detalhes profundos do curso (para o CRUD)
type CourseDetails = {
  id: string;
  disciplinas: { id: string; nome: string; classe: string; }[];
  turmas: { id: string; nome: string; classe: string; classe_id?: string; turno: string; total_alunos: number }[];
  classes: { id: string; nome: string }[];
  alunos: any[];
};

type CourseDraft = {
    label: string;
    classes: string[];
    subjects: string[];
    isCustom: boolean;
    baseKey: string;
    turnos: string[];
};

const ALL_CLASSES = ["7ª", "8ª", "9ª", "10ª", "11ª", "12ª", "13ª"];
const DEFAULT_TURNOS = ["Manhã"];
const TURNOS_OPTIONS = ["Manhã", "Tarde", "Noite"];

const normalize = (val: string) =>
  val
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

const normalizeClasseLabel = (val: string) =>
  normalize(val).replace(/classe/g, "").replace(/[^a-z0-9]/g, "");

const resolvePresetKeyForCourse = (course: ActiveCourse | undefined): CurriculumKey | null => {
  const code = (course?.curriculum_key || course?.course_code || course?.codigo) as CurriculumKey | undefined;
  if (!code) return null;
  // A regra de negócio é que o `codigo` do curso DEVE ser um `CurriculumKey` válido.
  return code in CURRICULUM_PRESETS ? code : null;
};

export default function StructureMarketplace({ escolaId }: { escolaId: string }) {
  // Navegação Principal
  const [activeTab, setActiveTab] = useState<'my_courses' | 'catalog'>('my_courses');
  const [courses, setCourses] = useState<ActiveCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [setupStatus, setSetupStatus] = useState<{ periodos_ok?: boolean; ano_letivo_ok?: boolean } | null>(null);
  
  // --- ESTADO DO GERENCIADOR (CRUD DETALHADO) ---
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedPresetKey, setSelectedPresetKey] = useState<CurriculumKey | null>(null);
  const [details, setDetails] = useState<CourseDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const { escolaId: escolaFromHook, isLoading: escolaLoading, error: escolaError } = useEscolaId();
  const resolvedEscolaId = escolaId || escolaFromHook || null;
  const disciplinasScrollRef = useRef<HTMLDivElement | null>(null);
  const adminConfigUrl = resolvedEscolaId
    ? `/escola/${resolvedEscolaId}/admin/configuracoes/academico-completo`
    : "#";
  const avaliacaoUrl = resolvedEscolaId
    ? `/escola/${resolvedEscolaId}/admin/configuracoes/avaliacao-frequencia`
    : "#";
  const fluxoUrl = resolvedEscolaId
    ? `/escola/${resolvedEscolaId}/secretaria/fluxo-academico`
    : "#";

  // --- ESTADOS DE CRIAÇÃO (MODAL DE NOVO CURSO) ---
  const [showModal, setShowModal] = useState(false);
  const [draft, setDraft] = useState<CourseDraft | null>(null);
  const [newSubject, setNewSubject] = useState("");
  const [installing, setInstalling] = useState(false);
  const [quickInstallingKey, setQuickInstallingKey] = useState<string | null>(null);
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null);
  

  const fetchJson = async (url: string, opts?: RequestInit) => {
    const res = await fetch(url, { ...opts, headers: { ...(opts?.headers || {}), 'X-Proxy-Used': 'canonical' } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.ok === false) {
      const issues = Array.isArray(json?.issues)
        ? json.issues.map((issue: any) => issue.message).join(', ')
        : null;
      const detail = issues || json?.message || json?.error;
      throw new Error(detail || `Falha na requisição (${res.status})`);
    }
    return json;
  };

  const disciplinas = details?.disciplinas ?? [];
  const hasDisciplinas = disciplinas.length > 0;
  const disciplinasVirtualizer = useVirtualizer({
    count: disciplinas.length,
    getScrollElement: () => disciplinasScrollRef.current,
    estimateSize: () => 56,
    overscan: 6,
  });

  // --- CARREGAR CURSOS ATIVOS ---
  const fetchCourses = async (options?: { cursor?: string | null; append?: boolean }) => {
    if (options?.append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setNextCursor(null);
    }
    try {
      if (!resolvedEscolaId) return;
      const params = new URLSearchParams();
      params.set('limit', '30');
      if (options?.cursor) params.set('cursor', options.cursor);
      const json = await fetchJson(buildEscolaUrl(resolvedEscolaId, '/cursos/stats', params));
      const next = json.next_cursor ?? null;
      setNextCursor(next);
      if (options?.append) {
        setCourses((prev) => [...prev, ...(json.data || json.items || [])]);
      } else {
        setCourses(json.data || json.items || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => { if (resolvedEscolaId) fetchCourses(); }, [resolvedEscolaId]);

  const loadMoreCourses = async () => {
    if (!nextCursor || loadingMore) return;
    await fetchCourses({ cursor: nextCursor, append: true });
  };

  // --- CARREGAR STATUS DO SETUP ---
  useEffect(() => {
    const loadSetupStatus = async () => {
      try {
        if (!resolvedEscolaId) return setSetupStatus(null);
        const json = await fetchJson(`/api/escola/${resolvedEscolaId}/admin/setup/status`);
        setSetupStatus(json?.data ?? null);
      } catch (e) {
        console.warn('Falha ao carregar status de setup', e);
        setSetupStatus(null);
      }
    };
    loadSetupStatus();
  }, [resolvedEscolaId]);

  const installBlockedReason = useMemo(() => {
    if (setupStatus?.ano_letivo_ok === false) {
      return 'Defina o ano letivo ativo antes de instalar.';
    }
    if (setupStatus?.periodos_ok === false) {
      return 'Configurar períodos do ano letivo antes de instalar.';
    }
    return null;
  }, [setupStatus]);

  if (escolaLoading) {
    return (
      <div className="p-6 flex flex-col items-center gap-2 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin text-klasse-gold" />
        <p>Carregando contexto da escola...</p>
      </div>
    );
  }

  if (escolaError || !resolvedEscolaId) {
    return (
      <div className="p-6 text-red-700 bg-red-50 border border-red-200 rounded-lg">
        {escolaError || 'Escola não identificada.'}
      </div>
    );
  }

  // --- CARREGAR DETALHES DO CURSO (AO CLICAR) ---
  const handleOpenManager = async (course: ActiveCourse) => {
    setLoadingDetails(true);
    setSelectedCourseId(course.id);
    setSelectedPresetKey(null); // Reset before setting
    setDetails(null);

    try {
      if (!resolvedEscolaId) throw new Error("Escola não identificada");

      const presetKey = resolvePresetKeyForCourse(course);

      const detailsUrl = buildEscolaUrl(resolvedEscolaId, `/cursos/${course.id}/details`);
      const detailsRes = await fetchJson(detailsUrl);
      const turmasApi = detailsRes.data?.turmas || [];
      const alunosApi = detailsRes.data?.alunos || [];

      // --- Case 1: No preset found ---
      if (!presetKey) {
        toast.message('Curso sem preset. Exibindo registros reais.', {
          description: 'Você pode editar livremente este curso.'
        });

        const disciplinasParams = new URLSearchParams({ curso_id: course.id, pageSize: '1000' });
        const disciplinasRes = await fetchJson(buildEscolaUrl(resolvedEscolaId, '/disciplinas', disciplinasParams));
        const disciplinas = (disciplinasRes.items || disciplinasRes.data || []);
        
        const classesParams = new URLSearchParams({ curso_id: course.id, pageSize: '50' });
        const classesRes = await fetchJson(buildEscolaUrl(resolvedEscolaId, '/classes', classesParams));
        const classes = (classesRes.items || classesRes.data || []);

        setDetails({
          id: course.id,
          disciplinas,
          classes,
          turmas: turmasApi,
          alunos: alunosApi
        });
        
        return; // Early return
      }

      // --- Case 2: Preset found ---
      setSelectedPresetKey(presetKey);

      // 1. Disciplinas (do preset)
      const disciplinas = CURRICULUM_PRESETS[presetKey].map(d => ({
        id: `${d.classe}-${d.nome}`, // ID virtual
        nome: d.nome,
        classe: d.classe,
      }));

      // 2. Classes (reais da escola, filtradas pelo preset)
      const classesParams = new URLSearchParams({ curso_id: course.id, pageSize: '50' });
      const classesRes = await fetchJson(buildEscolaUrl(resolvedEscolaId, '/classes', classesParams));
      const allClassesForCourse = (classesRes.items || classesRes.data || []);
      const allowedClassesNomes = new Set(CURRICULUM_PRESETS_META[presetKey]?.classes || []);
      const classesFiltradas = allClassesForCourse.filter((c: any) => allowedClassesNomes.has(c.nome));
      
      // Turmas e alunos já foram buscados e processados
      setDetails({
        id: course.id,
        classes: classesFiltradas,
        disciplinas,
        turmas: turmasApi,
        alunos: alunosApi,
      });

    } catch (e: any) {
      toast.error("Erro ao carregar detalhes.", { description: e.message });
      setSelectedCourseId(null);
      setSelectedPresetKey(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  // --- Utilitário: aplica currículo via endpoint de onboarding (novo modelo)
  const applyCurriculum = async (args: {
    presetKey: string;
    label: string;
    classes: string[];
    subjects: string[];
    turnos: string[];
  }) => {
    const anoLetivoId = null;

    if (installBlockedReason) {
      throw new Error(installBlockedReason);
    }

    const turnosFlags = {
      manha: args.turnos.includes('Manhã'),
      tarde: args.turnos.includes('Tarde'),
      noite: args.turnos.includes('Noite'),
    };

    const matrix: Record<string, boolean> = {};
    for (const subject of args.subjects) {
      for (const cls of args.classes) {
        if (turnosFlags.manha) matrix[`${subject}::${cls}::M`] = true;
        if (turnosFlags.tarde) matrix[`${subject}::${cls}::T`] = true;
        if (turnosFlags.noite) matrix[`${subject}::${cls}::N`] = true;
      }
    }

    const payload = {
      presetKey: args.presetKey,
      customData: {
        label: args.label,
        associatedPreset: args.presetKey,
        classes: args.classes,
        subjects: args.subjects,
      },
      advancedConfig: {
        classes: args.classes,
        subjects: args.subjects,
        turnos: turnosFlags,
        matrix: matrix,
      },
    };

    if (!resolvedEscolaId) throw new Error('Escola não identificada');
    await fetchJson(`/api/escola/${resolvedEscolaId}/admin/curriculo/install-preset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        options: { autoPublish: true, generateTurmas: true },
      }),
    });
  };

  const handleAddTurma = async () => {
    toast.error('Criação manual de turmas aqui foi descontinuada. Use o fluxo de aplicar currículo.');
  };

  // --- CRUD: ADICIONAR DISCIPLINA NO GERENCIADOR ---
  const handleAddDisciplinaDetails = async () => {
    toast.error('Use a aplicação de currículo para incluir disciplinas (novo modelo).');
  };

  const buildPresetSubjects = (presetKey: CurriculumKey): string[] => {
    return Array.from(new Set(CURRICULUM_PRESETS[presetKey]?.map((d) => d.nome) || []));
  };

  // --- CRUD: REMOVER DISCIPLINA ---
  const handleRemoveDisciplina = (id: string) => {
      if(!confirm("Remover esta disciplina do curso?")) return;
      // API call...
      if(details) {
          setDetails({
              ...details,
              disciplinas: details.disciplinas.filter(d => d.id !== id)
          });
      }
  }

  // ... (Lógica anterior de Presets e Instalação mantida igual) ...
  // [Apenas copiando as funções auxiliares que já existiam para não quebrar]
  const extractSubjectsFromPreset = (key: CurriculumKey): string[] => {
      const data: any = CURRICULUM_PRESETS[key];
      let subjects: string[] = [];
      if (Array.isArray(data)) subjects = data.map(d => typeof d === 'string' ? d : d.nome);
      else if (data) subjects = data.subjects || [];
      return Array.from(new Set(subjects));
  };

  const handleQuickInstall = async (presetKey: CurriculumKey) => {
      setQuickInstallingKey(presetKey);
      try {
        const meta = CURRICULUM_PRESETS_META[presetKey as CurriculumKey];
        const classes = meta?.classes && meta.classes.length > 0 ? [...meta.classes] : ['10ª Classe'];
        const subjects = buildPresetSubjects(presetKey as CurriculumKey);
        const turnos = DEFAULT_TURNOS;

        await applyCurriculum({
          presetKey,
          label: meta?.label || 'Novo Curso',
          classes,
          subjects,
          turnos,
        });

        toast.success('Estrutura criada com sucesso.');
        fetchCourses();
      } catch (e: any) {
      const msg = e?.message || 'Falha ao instalar estrutura';
      if (msg.includes('publish')) {
        toast.error('Falha ao publicar currículo.', { description: msg });
      } else if (msg.includes('generate')) {
        toast.error('Falha ao gerar turmas.', { description: msg });
      } else {
        toast.error(msg);
      }
      } finally {
        setQuickInstallingKey(null);
      }
  };

  const openPresetConfig = (presetKey: string) => {
    const meta = CURRICULUM_PRESETS_META[presetKey as CurriculumKey];
    const subjects = extractSubjectsFromPreset(presetKey as CurriculumKey);
    const classes = meta?.classes && meta.classes.length > 0 ? [...meta.classes] : ['10ª Classe', '11ª Classe', '12ª Classe'];
    setDraft({ label: meta?.label || "Novo Curso", classes, subjects, isCustom: false, baseKey: presetKey, turnos: DEFAULT_TURNOS });
    setShowModal(true);
  };

  const openCustomConfig = () => {
      setDraft({ label: "", classes: ['10ª Classe'], subjects: ["Língua Portuguesa"], isCustom: true, baseKey: "custom_builder", turnos: DEFAULT_TURNOS });
      setShowModal(true);
  };

  const toggleClass = (clsRaw: string) => {
      if(!draft) return;
      const cls = clsRaw.includes("Classe") ? clsRaw : `${clsRaw} Classe`;
      const has = draft.classes.includes(cls);
      let newClasses = has ? draft.classes.filter(c => c !== cls) : [...draft.classes, cls].sort((a,b) => parseInt(a) - parseInt(b));
      setDraft({ ...draft, classes: newClasses });
  };

  const addSubject = () => {
      if(!draft || !newSubject.trim()) return;
      if(draft.subjects.includes(newSubject.trim())) return toast.error("Já existe.");
      setDraft({...draft, subjects: [...draft.subjects, newSubject.trim()]});
      setNewSubject("");
  };
  
  const handleSave = async () => {
    if (!draft) return;
    setInstalling(true);
    try {
      const isPreset = !draft.isCustom && draft.baseKey in CURRICULUM_PRESETS;
      const subjects = isPreset ? buildPresetSubjects(draft.baseKey as CurriculumKey) : draft.subjects;
      const turnos = draft.turnos?.length ? draft.turnos : DEFAULT_TURNOS;

      await applyCurriculum({
        presetKey: draft.baseKey,
        label: draft.label || 'Novo Curso',
        classes: draft.classes,
        subjects,
        turnos,
      });

      toast.success('Curso criado com sucesso');
      setShowModal(false);
      fetchCourses();
    } catch (e: any) {
      const msg = e?.message || 'Falha ao criar curso';
      if (msg.includes('publish')) {
        toast.error('Falha ao publicar currículo.', { description: msg });
      } else if (msg.includes('generate')) {
        toast.error('Falha ao gerar turmas.', { description: msg });
      } else {
        toast.error(msg);
      }
    } finally {
      setInstalling(false);
    }
  };
  
  const handleRemove = async (id: string) => {
      if (!resolvedEscolaId) {
        toast.error("Escola não identificada.");
        return;
      }
      
      try {
        await fetchJson(buildEscolaUrl(resolvedEscolaId, `/cursos/${id}`), { method: 'DELETE' });
        toast.success("Curso removido.");
        if (selectedCourseId === id) {
          setSelectedCourseId(null);
          setSelectedPresetKey(null);
        }
        setCourses((prev) => prev.filter((c) => c.id !== id));
        // fetchCourses(); // Opcional: pode recarregar tudo para garantir consistência
      } catch (e: any) {
        toast.error(e?.message || "Falha ao remover curso");
      } finally {
        setDeletingCourseId(null);
      }
  };

  // --- RENDERIZAÇÃO ---

  // VISTA DO GERENCIADOR (O "CRUD" QUE VOCÊ PEDIU)
  if (selectedCourseId) {
    const cursoAtivo = courses.find(c => c.id === selectedCourseId);
    const totalClasses = details?.classes.length ?? 0;
    const totalTurmas = details?.turmas.length ?? 0;
    const totalDisciplinas = details?.disciplinas.length ?? 0;
    const totalAlunos = details?.alunos.length ?? 0;

    return (
        <div className="bg-white min-h-[500px] rounded-2xl shadow-sm border border-slate-200 animate-in slide-in-from-right-4 fade-in duration-300">
            {/* Header do Gerenciador */}
            <div className="border-b border-slate-200 p-6 flex items-center justify-between bg-slate-50/50 rounded-t-2xl">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => { setSelectedCourseId(null); setSelectedPresetKey(null); }} 
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-slate-200 text-slate-600 hover:text-klasse-gold hover:border-klasse-gold/40 bg-white shadow-sm focus:outline-none focus:ring-4 focus:ring-klasse-gold/20"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span className="text-xs font-bold">Voltar</span>
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            {cursoAtivo?.nome}
                            <span className="px-2 py-0.5 rounded-full bg-klasse-gold/15 text-klasse-gold text-[10px] uppercase font-bold border border-klasse-gold/30">Ativo</span>
                        </h2>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">{cursoAtivo?.codigo || "Sem código"}</p>
                        {selectedPresetKey && (
                          <p className="text-[11px] text-slate-500 font-semibold mt-1">
                            Currículo: {CURRICULUM_PRESETS_META[selectedPresetKey]?.label || selectedPresetKey}
                          </p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-4">
                     <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-slate-200 font-semibold">
                          <Layers className="w-3 h-3 text-slate-400"/> {totalClasses} classes
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-slate-200 font-semibold">
                          <Users className="w-3 h-3 text-slate-400"/> {totalTurmas} turmas
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-slate-200 font-semibold">
                          <BookOpen className="w-3 h-3 text-slate-400"/> {totalDisciplinas} disciplinas
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-slate-200 font-semibold">
                          <Users className="w-3 h-3 text-slate-400"/> {totalAlunos} alunos
                        </span>
                     </div>
                </div>
            </div>

            {/* Conteúdo do Gerenciador */}
            <div className="p-6">
                {loadingDetails ? (
                    <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-klasse-gold"/></div>
                ) : !details ? (
                    <div className="text-center py-10 text-slate-400">Erro ao carregar dados.</div>
                ) : (
                    <div className="space-y-10">
                        <div className="space-y-8 animate-in fade-in">
                            {details.classes.map(classe => {
                                const turmasDaClasse = details.turmas.filter(t => (t.classe_id && classe.id) ? t.classe_id === classe.id : t.classe === classe.nome);
                                const totalTurmasClasse = turmasDaClasse.length;
                                const totalAlunosClasse = turmasDaClasse.reduce((acc, t) => acc + (Number((t as any).total_alunos) || 0), 0);
                                
                                return (
                                    <div key={classe.id} className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                                        <div className="px-4 py-3 border-b border-slate-200 bg-white flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg"><GraduationCap className="w-4 h-4"/></div>
                                                <span className="font-bold text-slate-700 text-sm">{classe.nome}</span>
                                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 font-semibold">
                                                    {totalTurmasClasse} turmas · {totalAlunosClasse} alunos
                                                </span>
                                            </div>
                                            <button 
                                                onClick={() => handleAddTurma()}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-700 border border-slate-200 rounded-lg bg-white hover:border-klasse-gold/40 hover:text-klasse-gold focus:outline-none focus:ring-4 focus:ring-klasse-gold/20"
                                            >
                                                <Plus className="w-3 h-3"/> Nova Turma
                                            </button>
                                        </div>
                                        
                                        {turmasDaClasse.length === 0 ? (
                                            <div className="p-8 text-center">
                                                <p className="text-xs text-slate-400 italic mb-2">Nenhuma turma criada para {classe.nome}.</p>
                                                <button onClick={() => handleAddTurma()} className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-klasse-gold/20">
                                                    Criar Primeira Turma
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                                                {turmasDaClasse.map(turma => (
                                                    <div key={turma.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm hover:border-klasse-gold/50 transition-colors group cursor-pointer relative">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <span className="font-bold text-slate-800 text-sm">{turma.nome}</span>
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${turma.turno === 'Manhã' ? 'bg-klasse-gold/15 text-klasse-gold' : 'bg-slate-100 text-slate-600'}`}>
                                                                {turma.turno}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                                            <Users className="w-3 h-3"/> {turma.total_alunos} Alunos
                                                        </div>
                                                        
                                                        {/* Botão de excluir turma (só aparece no hover) */}
                                                        <div className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 rounded-md focus:outline-none focus:ring-4 focus:ring-red-100">
                                                                <Trash2 className="h-3 w-3"/>
                                                                <span className="hidden md:inline">Remover</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        <div className="animate-in fade-in max-w-3xl mx-auto">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h3 className="font-bold text-slate-800">Grade Curricular</h3>
                                    <p className="text-xs text-slate-400">Disciplinas leccionadas neste curso, conforme o currículo oficial.</p>
                                </div>
                                <button
                                    onClick={handleAddDisciplinaDetails}
                                    disabled={!!selectedPresetKey}
                                    className="inline-flex items-center gap-2 bg-klasse-gold text-white px-4 py-2 rounded-xl text-xs font-bold hover:brightness-95 shadow-sm focus:outline-none focus:ring-4 focus:ring-klasse-gold/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Plus className="w-4 h-4"/> Adicionar Disciplina
                                </button>
                            </div>

                            <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                                <div ref={disciplinasScrollRef} className="max-h-[520px] overflow-y-auto">
                                <table className="w-full table-fixed text-left text-sm">
                                    <thead className="bg-white border-b border-slate-200 text-xs uppercase text-slate-400 font-bold sticky top-0 z-10" style={{ display: "table", width: "100%", tableLayout: "fixed" }}>
                                        <tr>
                                            <th className="px-4 py-3">Nome da Disciplina</th>
                                            <th className="px-4 py-3">Classe</th>
                                            <th className="px-4 py-3 text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody
                                      className="divide-y divide-slate-100"
                                      style={
                                        hasDisciplinas
                                          ? {
                                              position: "relative",
                                              display: "block",
                                              height: disciplinasVirtualizer.getTotalSize(),
                                            }
                                          : undefined
                                      }
                                    >
                                        {disciplinasVirtualizer.getVirtualItems().map((virtualRow) => {
                                          const disc = disciplinas[virtualRow.index];
                                          return (
                                            <tr
                                                key={disc.id}
                                                className="hover:bg-white transition-colors group"
                                                style={{
                                                  position: "absolute",
                                                  top: 0,
                                                  left: 0,
                                                  transform: `translateY(${virtualRow.start}px)`,
                                                  width: "100%",
                                                  display: "table",
                                                  tableLayout: "fixed",
                                                }}
                                            >
                                                <td className="px-4 py-3 font-medium text-slate-700 flex items-center gap-3">
                                                    <span className="text-slate-300 font-mono text-xs w-4">{(virtualRow.index + 1).toString().padStart(2, '0')}</span>
                                                    {disc.nome}
                                                </td>
                                                <td className="px-4 py-3 font-mono text-slate-500 text-xs">{disc.classe}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <button
                                                        onClick={() => handleRemoveDisciplina(disc.id)}
                                                        disabled={!!selectedPresetKey}
                                                        className="inline-flex items-center gap-1 text-slate-400 hover:text-red-500 px-2 py-1 rounded-lg hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 focus:outline-none focus:ring-4 focus:ring-red-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                        <span className="hidden sm:inline text-xs font-bold">Remover</span>
                                                    </button>
                                                </td>
                                            </tr>
                                          );
                                        })}
                                    </tbody>
                                </table>
                                </div>
                                {details.disciplinas.length === 0 && (
                                    <div className="p-8 text-center text-slate-400 text-sm">
                                        Nenhuma disciplina cadastrada.
                                    </div>
                                )}
                            </div>
                           {selectedPresetKey && <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-lg flex gap-2 text-xs text-amber-800">
                                <AlertCircle className="w-4 h-4 shrink-0"/>
                                <p>A grade curricular é definida pelo preset <strong>({selectedPresetKey})</strong> e não pode ser alterada directamente. Para um currículo flexível, crie um curso "do zero".</p>
                            </div>}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
  }

  // VISTA PADRÃO (LISTA E CATÁLOGO)
  const presetsList = Object.entries(CURRICULUM_PRESETS_META).map(([key, meta]) => ({ id: key as CurriculumKey, ...meta }));

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Configuração Acadêmica Guiada</h2>
          <p className="text-sm text-slate-500">
            Experiência clara para montar o calendário, avaliação, currículo e turmas.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Estrutura temporal</h3>
            <p className="text-xs text-slate-500">
              Configure períodos letivos, pesos e travas de notas.
            </p>
            <Link
              href={adminConfigUrl}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
            >
              Abrir calendário
              <ArrowLeft className="w-3 h-3" />
            </Link>
          </div>

          <div className="rounded-xl border border-slate-100 bg-white p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Modelo de avaliação</h3>
            <p className="text-xs text-slate-500">
              Escolha o modelo angolano, personalize pesos e visualize a pauta.
            </p>
            <Link
              href={avaliacaoUrl}
              className="inline-flex items-center gap-2 rounded-full bg-klasse-gold px-4 py-2 text-xs font-semibold text-white"
            >
              Configurar avaliação
              <GraduationCap className="w-3 h-3" />
            </Link>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Currículo & presets</h3>
            <p className="text-xs text-slate-500">
              Aplique presets nacionais e publique o currículo em um clique.
            </p>
            <button
              onClick={() => setActiveTab('catalog')}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Ver catálogo
              <ShoppingBag className="w-3 h-3" />
            </button>
          </div>

          <div className="rounded-xl border border-slate-100 bg-white p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Gerar turmas</h3>
            <p className="text-xs text-slate-500">
              Gere turmas a partir do currículo publicado e valide a estrutura.
            </p>
            <button
              onClick={() => setActiveTab('my_courses')}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Revisar cursos
              <Users className="w-3 h-3" />
            </button>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Fluxos de aprovação</h3>
            <p className="text-xs text-slate-500">
              Defina o fluxo de aprovação de notas com papéis claros.
            </p>
            <Link
              href={fluxoUrl}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
            >
              Abrir fluxo
              <Settings className="w-3 h-3" />
            </Link>
          </div>

          <div className="rounded-xl border border-slate-100 bg-white p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Sandbox de testes</h3>
            <p className="text-xs text-slate-500">
              Simule impactos antes de aplicar mudanças reais.
            </p>
            <Link
              href={`${adminConfigUrl}?mode=preview`}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Testar configurações
              <AlertCircle className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
      
      {/* TABS PRINCIPAIS */}
      <div className="flex border-b border-slate-200">
        <button onClick={() => setActiveTab('my_courses')} className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'my_courses' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
          <Layers className="w-4 h-4" /> Cursos Ativos ({courses.length})
        </button>
        <button onClick={() => setActiveTab('catalog')} className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'catalog' ? 'border-klasse-gold text-klasse-gold' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
          <ShoppingBag className="w-4 h-4" /> Catálogo
        </button>
      </div>

      {/* ABA: MEUS CURSOS */}
      {activeTab === 'my_courses' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.length === 0 && !loading && (
                <div className="col-span-3 text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                    <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3"/>
                    <h3 className="text-slate-900 font-bold">Nenhum curso ativo</h3>
                    <button onClick={() => setActiveTab('catalog')} className="mt-4 text-klasse-gold font-bold underline">Ir ao Catálogo</button>
                </div>
            )}
            {courses.map(curso => {
                const hasAlunos = curso.total_alunos > 0;
                return (
                  <div 
                      key={curso.id} 
                      onClick={() => handleOpenManager(curso)}
                      className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-lg hover:border-klasse-gold/50 hover:-translate-y-1 transition-all group cursor-pointer relative"
                  >
                      <div className="flex justify-between items-start mb-4">
                          <div className="p-3 bg-slate-100 text-slate-600 rounded-lg group-hover:bg-slate-900 group-hover:text-white transition-colors"><BookOpen className="w-6 h-6"/></div>
                          
                          <div className="relative" title={hasAlunos ? "Curso possui alunos vinculados" : "Remover curso"}>
                            <button 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  if (!hasAlunos) {
                                    setDeletingCourseId(curso.id);
                                  }
                                }} 
                                disabled={hasAlunos}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition z-10 focus:outline-none focus:ring-4 focus:ring-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Trash2 className="h-4 w-4"/>
                                <span className="hidden sm:inline">Remover</span>
                            </button>
                          </div>
                      </div>
                      <h3 className="font-bold text-slate-800 mb-1 truncate group-hover:text-klasse-gold transition-colors" title={curso.nome}>{curso.nome}</h3>
                      <p className="text-xs text-slate-400 font-mono mb-4">{curso.codigo || 'Sem código'}</p>
                      <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-100 pt-4">
                          <div><span className="block text-slate-400">Classes</span><span className="font-bold text-slate-700">{curso.total_classes}</span></div>
                          <div><span className="block text-slate-400">Turmas</span><span className="font-bold text-slate-700">{curso.total_turmas}</span></div>
                      </div>
                      
                      <div className="absolute inset-0 bg-klasse-gold/10 opacity-0 group-hover:opacity-100 rounded-xl transition-opacity pointer-events-none" />
                  </div>
                )
            })}
          </div>
          {nextCursor && (
            <div className="flex justify-center">
              <button
                onClick={loadMoreCourses}
                disabled={loadingMore}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {loadingMore ? 'Carregando...' : 'Carregar mais'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ABA: CATÁLOGO */}
      {activeTab === 'catalog' && (
        <div className="animate-in fade-in">
                <div className="mb-6 flex justify-end">
                <button onClick={openCustomConfig} className="flex items-center gap-2 bg-klasse-gold text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:brightness-95 transition-all focus:outline-none focus:ring-4 focus:ring-klasse-gold/20">
                    <PlusCircle className="w-4 h-4" /> Criar Curso do Zero
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {presetsList.map(preset => {
                    const isInstalled = courses.some(c => c.nome.toLowerCase() === preset.label.toLowerCase());
                    const tipo: CourseType = PRESET_TO_TYPE[preset.id] ?? "geral";
                    const colors = TYPE_COLORS[tipo] || TYPE_COLORS.geral;

                    return (
                        <div key={preset.id} className={`flex items-center justify-between p-5 rounded-xl border ${isInstalled ? 'bg-slate-50 opacity-70' : 'bg-white hover:shadow-md'}`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${isInstalled ? 'bg-slate-200 text-slate-500' : colors.bgLight + ' ' + colors.text}`}>
                                    {preset.label[0]}
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 text-sm">{preset.label}</h4>
                                    <p className="text-xs text-slate-500">{getTypeLabel(tipo)}</p>
                                </div>
                            </div>
                            {isInstalled ? (
                                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Instalado</span>
                            ) : (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleQuickInstall(preset.id)}
                                        disabled={!!quickInstallingKey || !!installBlockedReason}
                                        title={installBlockedReason ?? undefined}
                                        className="text-xs font-medium border border-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-50 flex items-center gap-1 disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        {quickInstallingKey === preset.id ? <Loader2 className="w-3 h-3 animate-spin"/> : "Instalar"}
                                    </button>
                                    <button 
                                        onClick={() => openPresetConfig(preset.id)} 
                                        className="text-xs font-bold text-white bg-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-800 flex items-center gap-1"
                                    >
                                        <Settings className="w-3 h-3"/> Configurar
                                    </button>
                                </div>
                            )}
                            {installBlockedReason && (
                              <p className="mt-2 text-[11px] text-amber-600">
                                {installBlockedReason}
                              </p>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE REMOÇÃO */}
      {deletingCourseId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
                <div className="p-6">
                    <div className="flex justify-center mb-4">
                        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                            <AlertCircle className="w-8 h-8 text-red-600" />
                        </div>
                    </div>
                    <h3 className="text-center font-bold text-lg text-slate-800 mb-2">Remover curso?</h3>
                    <p className="text-center text-sm text-slate-500">
                        Essa ação é irreversível e apagará todas as turmas e classes associadas que não possuam alunos.
                    </p>
                </div>
                <div className="p-4 bg-slate-50 grid grid-cols-2 gap-3">
                    <button onClick={() => setDeletingCourseId(null)} className="px-4 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100">
                        Cancelar
                    </button>
                    <button onClick={() => {
                        if (deletingCourseId) {
                            handleRemove(deletingCourseId)
                        }
                    }} className="px-4 py-2.5 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700">
                        Remover
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* MODAL DE CONFIGURAÇÃO (CRIAR CURSO) */}
      {showModal && draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in p-4">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-slate-800">
                        {draft.isCustom ? "Criar Novo Curso" : "Personalizar Instalação"}
                    </h3>
                    <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600"/></button>
                </div>
                <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Nome do Curso</label>
                        <input value={draft.label} onChange={e => setDraft({...draft, label: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold outline-none font-bold text-slate-700" placeholder="Ex: Técnico de Gestão Empresarial" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Classes Abrangidas</label>
                        <div className="flex flex-wrap gap-2">
                            {ALL_CLASSES.map(clsKey => {
                                const clsName = clsKey + " Classe";
                                const isSelected = draft.classes.includes(clsName);
                                return (
                                    <button key={clsKey} onClick={() => toggleClass(clsKey)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${isSelected ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                                        {clsKey}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Turnos do Curso</label>
                        <div className="flex flex-wrap gap-2">
                            {TURNOS_OPTIONS.map((turno) => {
                                const isSelected = draft.turnos.includes(turno);
                                return (
                                    <button
                                        key={turno}
                                        type="button"
                                        onClick={() => {
                                            const next = isSelected
                                              ? draft.turnos.filter((t) => t !== turno)
                                              : [...draft.turnos, turno];
                                            setDraft({ ...draft, turnos: next.length ? next : DEFAULT_TURNOS });
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${isSelected ? 'bg-klasse-gold text-white border-klasse-gold' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                                    >
                                        {turno}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between items-end mb-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Disciplinas ({draft.subjects.length})</label>
                        </div>
                        <div className="flex gap-2 mb-3">
                            <input value={newSubject} onChange={e => setNewSubject(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSubject()} placeholder="Digite o nome da disciplina..." className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/20" />
                            <button onClick={addSubject} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1"><Plus className="w-3 h-3"/> Adicionar</button>
                        </div>
                        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1 bg-slate-50/50 rounded-xl border border-slate-100">
                            {draft.subjects.map(sub => (
                                <span key={sub} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 shadow-sm">
                                    {sub}
                                    <button onClick={() => setDraft({...draft, subjects: draft.subjects.filter(s => s !== sub)})} className="text-slate-300 hover:text-red-500 transition-colors"><X className="w-3 h-3"/></button>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700">Cancelar</button>
                    <button onClick={handleSave} disabled={installing} className="px-6 py-2 bg-klasse-gold text-white text-sm font-bold rounded-xl hover:brightness-95 shadow-sm transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus:ring-4 focus:ring-klasse-gold/20">
                        {installing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} {installing ? "Instalando..." : "Salvar e Criar"}
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}
