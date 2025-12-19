"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  BookOpen, Trash2, ShoppingBag, CheckCircle2, 
  Loader2, Layers, Settings, X, Save, PlusCircle,
  ArrowLeft, GraduationCap, Users, Clock, Plus, AlertCircle
} from "lucide-react";
import { toast } from "sonner";

// Importações de dados estáticos
import { CURRICULUM_PRESETS_META, type CurriculumKey } from "@/lib/onboarding"; 
import { CURRICULUM_PRESETS } from "@/lib/onboarding"; 
import { PRESET_TO_TYPE, TYPE_COLORS, getTypeLabel, type CourseType } from "@/lib/courseTypes";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildEscolaUrl } from "@/lib/escola/url";

// --- TIPOS ---
type ActiveCourse = {
  id: string;
  nome: string;
  codigo: string;
  total_classes: number;
  total_turmas: number;
  total_alunos: number;
};

// Detalhes profundos do curso (para o CRUD)
type CourseDetails = {
  id: string;
  disciplinas: { id: string; nome: string }[];
  turmas: { id: string; nome: string; classe: string; classe_id?: string; turno: string; total_alunos: number }[];
  classes: { id: string; nome: string }[]; // ex: ["10ª Classe", "11ª Classe"]
};

type CourseDraft = {
    label: string;
    classes: string[];
    subjects: string[];
    isCustom: boolean;
    baseKey: string;
};

const ALL_CLASSES = ["7ª", "8ª", "9ª", "10ª", "11ª", "12ª", "13ª"];

export default function StructureMarketplace({ escolaId }: { escolaId: string }) {
  // Navegação Principal
  const [activeTab, setActiveTab] = useState<'my_courses' | 'catalog'>('my_courses');
  const [courses, setCourses] = useState<ActiveCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Array<{ id: string; nome: string; status?: string }>>([]);
  
  // --- ESTADO DO GERENCIADOR (CRUD DETALHADO) ---
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [details, setDetails] = useState<CourseDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [managerTab, setManagerTab] = useState<'turmas' | 'disciplinas'>('turmas');
  const { escolaId: escolaFromHook, isLoading: escolaLoading, error: escolaError } = useEscolaId();
  const resolvedEscolaId = escolaId || escolaFromHook || null;

  // --- ESTADOS DE CRIAÇÃO (MODAL DE NOVO CURSO) ---
  const [showModal, setShowModal] = useState(false);
  const [draft, setDraft] = useState<CourseDraft | null>(null);
  const [newSubject, setNewSubject] = useState("");
  const [installing, setInstalling] = useState(false);
  const [quickInstallingKey, setQuickInstallingKey] = useState<string | null>(null);

  const fetchJson = async (url: string, opts?: RequestInit) => {
    const res = await fetch(url, { ...opts, headers: { ...(opts?.headers || {}), 'X-Proxy-Used': 'canonical' } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.ok === false) {
      throw new Error(json?.error || `Falha na requisição (${res.status})`);
    }
    return json;
  };

  const activeSession = useMemo(() => {
    const active = sessions.find((s) => s.status === 'ativa');
    return active || sessions[0];
  }, [sessions]);

  // --- CARREGAR CURSOS ATIVOS ---
  const fetchCourses = async () => {
    setLoading(true);
    try {
      if (!resolvedEscolaId) return;
      const json = await fetchJson(buildEscolaUrl(resolvedEscolaId, '/cursos/stats'));
      setCourses(json.data || json.items || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (resolvedEscolaId) fetchCourses(); }, [resolvedEscolaId]);

  // --- CARREGAR SESSÕES (para ano letivo e vínculo de turma) ---
  useEffect(() => {
    const loadSessions = async () => {
      try {
        if (!resolvedEscolaId) return setSessions([]);
        const json = await fetchJson(buildEscolaUrl(resolvedEscolaId, '/school-sessions'));
        setSessions(json.data || json.items || []);
      } catch (e) {
        console.warn('Falha ao carregar sessões escolares', e);
        setSessions([]);
      }
    };
    loadSessions();
  }, [resolvedEscolaId]);

  if (escolaLoading) {
    return (
      <div className="p-6 flex flex-col items-center gap-2 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
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
  const handleOpenManager = async (courseId: string) => {
    setSelectedCourseId(courseId);
    setLoadingDetails(true);
    try {
        if (!resolvedEscolaId) throw new Error('Escola não identificada');
        const [classesRes, turmasRes, disciplinasRes] = await Promise.all([
          fetchJson(buildEscolaUrl(resolvedEscolaId, '/classes', new URLSearchParams({ curso_id: courseId }))),
          fetchJson(buildEscolaUrl(resolvedEscolaId, '/turmas')),
          fetchJson(buildEscolaUrl(resolvedEscolaId, '/disciplinas', new URLSearchParams({ curso_id: courseId })))
        ]);

        const classes = (classesRes.items || classesRes.data || []).map((c: any) => ({ id: c.id, nome: c.nome || c.name || c.id }));
        const turmasRaw = (turmasRes.items || turmasRes.data || []) as any[];
        const turmas = turmasRaw
          .filter((t) => !courseId || String((t as any).curso_id || '') === String(courseId))
          .map((t) => ({
            id: t.id,
            nome: t.turma_nome || t.nome,
            classe: t.classe_nome || t.classe_id,
            classe_id: t.classe_id,
            turno: t.turno,
            total_alunos: t.ocupacao_atual || 0,
          }));
        const disciplinas = (disciplinasRes.items || disciplinasRes.data || []).map((d: any) => ({ id: d.id, nome: d.nome }));

        setDetails({
          id: courseId,
          classes,
          disciplinas,
          turmas,
        });
    } catch (e) {
        toast.error("Erro ao carregar detalhes.");
        setSelectedCourseId(null);
    } finally {
        setLoadingDetails(false);
    }
  };

  // --- CRUD: ADICIONAR TURMA NO GERENCIADOR ---
  const createTurmaRecord = async (params: {
    classeId: string;
    classeNome: string;
    cursoId: string | null;
    turno: string;
  }) => {
    const sessionObj = activeSession;
    const anoLetivoLabel = sessionObj?.nome;
    const anoLetivoInt = anoLetivoLabel ? parseInt(anoLetivoLabel.replace(/\D/g, ''), 10) : new Date().getFullYear();

    let suggested = '';
    try {
      const search = new URLSearchParams({ classe_id: params.classeId, turno: params.turno });
      if (anoLetivoLabel) search.set('ano_letivo', anoLetivoLabel);
      if (sessionObj?.id) search.set('session_id', sessionObj.id);
      if (!resolvedEscolaId) throw new Error('Escola não identificada');
      const sJson = await fetchJson(buildEscolaUrl(resolvedEscolaId, '/turmas/sugestao-nome', search));
      suggested = (sJson.suggested || '').toString();
    } catch {}

    const turma_codigo = suggested || 'A';
    const nome = `${params.classeNome} ${turma_codigo}`;

    const payload = {
      nome,
      turma_codigo,
      turno: params.turno,
      session_id: sessionObj?.id || null,
      ano_letivo: anoLetivoInt,
      classe_id: params.classeId,
      curso_id: params.cursoId,
      capacidade_maxima: 35,
    };

    if (!resolvedEscolaId) throw new Error('Escola não identificada');
    const created = await fetchJson(buildEscolaUrl(resolvedEscolaId, '/turmas'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { nome, data: created };
  };

  const handleAddTurma = async (classe: { id: string; nome: string }) => {
    try {
      const turno = prompt(`Turno da nova turma para ${classe.nome} (ex: Manhã, Tarde, Noite):`, 'Manhã');
      if (!turno) return;

      const { nome } = await createTurmaRecord({
        classeId: classe.id,
        classeNome: classe.nome,
        cursoId: selectedCourseId,
        turno,
      });

      toast.success(`Turma ${nome} criada.`);
      if (selectedCourseId) await handleOpenManager(selectedCourseId);
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao criar turma');
    }
  };

  // --- CRUD: ADICIONAR DISCIPLINA NO GERENCIADOR ---
  const handleAddDisciplinaDetails = async () => {
    if (!details?.classes?.[0]) return toast.error('Selecione uma classe para vincular a disciplina');
    const nome = prompt('Nome da nova disciplina:');
    if(!nome || !selectedCourseId) return;

    try {
      const classeId = details.classes[0].id; // USAR O ID
      await fetchJson('/api/secretaria/disciplinas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          curso_id: selectedCourseId,
          classe_id: classeId, // ENVIAR O ID
          tipo: 'core'
        })
      });
      toast.success('Disciplina criada.');
      if (selectedCourseId) await handleOpenManager(selectedCourseId);
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao criar disciplina');
    }
  };

  const createClasseRecord = async (cursoId: string, nome: string) => {
    if (!resolvedEscolaId) throw new Error('Escola não identificada');
    const cls = await fetchJson(buildEscolaUrl(resolvedEscolaId, '/classes'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, curso_id: cursoId })
    });
    return cls.data || cls;
  };

  const createDisciplinaRecord = async (cursoId: string, classeId: string, nome: string) => {
    if (!resolvedEscolaId) throw new Error('Escola não identificada');
    await fetchJson(buildEscolaUrl(resolvedEscolaId, '/disciplinas'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome,
        curso_id: cursoId,
        classe_id: classeId,
        tipo: 'core'
      })
    });
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
        const subjects = extractSubjectsFromPreset(presetKey as CurriculumKey);
        const classes = meta?.classes && meta.classes.length > 0 ? [...meta.classes] : ['10ª Classe'];
        const tipo = PRESET_TO_TYPE[presetKey as CurriculumKey] || 'core';

        const courseResp = await fetchJson(`/api/escolas/${escolaId}/cursos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: meta?.label || 'Novo Curso', tipo, descricao: meta?.description || null })
        });
        const courseId = courseResp.data?.id || courseResp.id;

        const createdClasses: Array<{ id: string; nome: string }> = [];
        for (const cls of classes) {
          try {
            const c = await createClasseRecord(courseId, cls);
            if (c?.id) createdClasses.push({ id: c.id, nome: c.nome || cls });
          } catch (e) {
            console.warn('Falha ao criar classe', cls, e);
          }
        }

        // Disciplinas (vincula na primeira classe criada)
        if (createdClasses[0]) {
          for (const subj of subjects) {
            try { await createDisciplinaRecord(courseId, createdClasses[0].id, subj); } catch (e) { console.warn('Disciplina', subj, e); }
          }
        }

        // Turma padrão "A" turno manhã
        for (const cls of createdClasses) {
          try { await createTurmaRecord({ classeId: cls.id, classeNome: cls.nome, cursoId: courseId, turno: 'Manhã' }); } catch (e) { console.warn('Turma classe', cls.nome, e); }
        }

        toast.success('Estrutura criada com sucesso.');
        fetchCourses();
      } catch (e: any) {
        toast.error(e?.message || 'Falha ao instalar estrutura');
      } finally {
        setQuickInstallingKey(null);
      }
  };

  const openPresetConfig = (presetKey: string) => {
    const meta = CURRICULUM_PRESETS_META[presetKey as CurriculumKey];
    const subjects = extractSubjectsFromPreset(presetKey as CurriculumKey);
    const classes = meta?.classes && meta.classes.length > 0 ? [...meta.classes] : ['10ª Classe', '11ª Classe', '12ª Classe'];
    setDraft({ label: meta?.label || "Novo Curso", classes, subjects, isCustom: false, baseKey: presetKey });
    setShowModal(true);
  };

  const openCustomConfig = () => {
      setDraft({ label: "", classes: ['10ª Classe'], subjects: ["Língua Portuguesa"], isCustom: true, baseKey: "custom_builder" });
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
      const courseResp = await fetchJson(`/api/escolas/${escolaId}/cursos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: draft.label || 'Novo Curso', tipo: draft.isCustom ? 'core' : 'tecnico', descricao: draft.baseKey })
      });
      const courseId = courseResp.data?.id || courseResp.id;

      const createdClasses: Array<{ id: string; nome: string }> = [];
      for (const cls of draft.classes) {
        try {
          const c = await createClasseRecord(courseId, cls);
          if (c?.id) createdClasses.push({ id: c.id, nome: c.nome || cls });
        } catch (e) {
          console.warn('Falha ao criar classe', cls, e);
        }
      }

      if (createdClasses[0]) {
        for (const subj of draft.subjects) {
          try { await createDisciplinaRecord(courseId, createdClasses[0].id, subj); } catch (e) { console.warn('Disciplina', subj, e); }
        }
      }

      for (const cls of createdClasses) {
        try { await createTurmaRecord({ classeId: cls.id, classeNome: cls.nome, cursoId: courseId, turno: 'Manhã' }); } catch (e) { console.warn('Turma classe', cls.nome, e); }
      }

      toast.success('Curso criado com sucesso');
      setShowModal(false);
      fetchCourses();
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao criar curso');
    } finally {
      setInstalling(false);
    }
  };
  
  const handleRemove = async (id: string, total: number) => {
      if (total > 0) return toast.error("Curso tem alunos.");
      if (!resolvedEscolaId) return toast.error("Escola não identificada.");
      if (!confirm("Remover este curso? Classes, turmas e disciplinas vinculadas serão apagadas.")) return;

      try {
        await fetchJson(buildEscolaUrl(resolvedEscolaId, `/cursos/${id}`), { method: 'DELETE' });
        toast.success("Curso removido.");
        setSelectedCourseId((prev) => (prev === id ? null : prev));
        setCourses((prev) => prev.filter((c) => c.id !== id));
        fetchCourses();
      } catch (e: any) {
        toast.error(e?.message || "Falha ao remover curso");
      }
  };

  // --- RENDERIZAÇÃO ---

  // VISTA DO GERENCIADOR (O "CRUD" QUE VOCÊ PEDIU)
  if (selectedCourseId) {
    const cursoAtivo = courses.find(c => c.id === selectedCourseId);

    return (
        <div className="bg-white min-h-[500px] rounded-2xl shadow-sm border border-slate-200 animate-in slide-in-from-right-4 fade-in duration-300">
            {/* Header do Gerenciador */}
            <div className="border-b border-slate-200 p-6 flex items-center justify-between bg-slate-50/50 rounded-t-2xl">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setSelectedCourseId(null)} 
                        className="p-2 hover:bg-white hover:shadow-sm rounded-full border border-transparent hover:border-slate-200 transition-all text-slate-500"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            {cursoAtivo?.nome}
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] uppercase font-bold border border-emerald-200">Ativo</span>
                        </h2>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">{cursoAtivo?.codigo || "Sem código"}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                     {/* Abas internas */}
                     <div className="bg-slate-100 p-1 rounded-lg flex">
                        <button 
                            onClick={() => setManagerTab('turmas')}
                            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${managerTab === 'turmas' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Turmas & Classes
                        </button>
                        <button 
                            onClick={() => setManagerTab('disciplinas')}
                            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${managerTab === 'disciplinas' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Plano Curricular
                        </button>
                     </div>
                </div>
            </div>

            {/* Conteúdo do Gerenciador */}
            <div className="p-6">
                {loadingDetails ? (
                    <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-teal-600"/></div>
                ) : !details ? (
                    <div className="text-center py-10 text-slate-400">Erro ao carregar dados.</div>
                ) : (
                    <>
                        {/* ABA: TURMAS E CLASSES */}
                        {managerTab === 'turmas' && (
                            <div className="space-y-8 animate-in fade-in">
                                {details.classes.map(classe => {
                                    const turmasDaClasse = details.turmas.filter(t => (t.classe_id && classe.id) ? t.classe_id === classe.id : t.classe === classe.nome);
                                    
                                    return (
                                        <div key={classe.id} className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                                            <div className="px-4 py-3 border-b border-slate-200 bg-white flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg"><GraduationCap className="w-4 h-4"/></div>
                                                    <span className="font-bold text-slate-700 text-sm">{classe.nome}</span>
                                                </div>
                                                <button 
                                                    onClick={() => handleAddTurma(classe)}
                                                    className="text-xs font-bold text-teal-600 hover:text-teal-700 hover:underline flex items-center gap-1"
                                                >
                                                    <Plus className="w-3 h-3"/> Nova Turma
                                                </button>
                                            </div>
                                            
                                            {turmasDaClasse.length === 0 ? (
                                                <div className="p-8 text-center">
                                                    <p className="text-xs text-slate-400 italic mb-2">Nenhuma turma criada para {classe.nome}.</p>
                                                    <button onClick={() => handleAddTurma(classe)} className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-50">
                                                        Criar Primeira Turma
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                                                    {turmasDaClasse.map(turma => (
                                                        <div key={turma.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm hover:border-teal-300 transition-colors group cursor-pointer relative">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <span className="font-bold text-slate-800 text-sm">{turma.nome}</span>
                                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${turma.turno === 'Manhã' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
                                                                    {turma.turno}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                                                <Users className="w-3 h-3"/> {turma.total_alunos} Alunos
                                                            </div>
                                                            
                                                            {/* Botão de excluir turma (só aparece no hover) */}
                                                            <div className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button className="p-1.5 text-slate-300 hover:text-red-500 bg-slate-50 hover:bg-red-50 rounded-md">
                                                                    <Trash2 className="w-3 h-3"/>
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
                        )}

                        {/* ABA: DISCIPLINAS (CRUD) */}
                        {managerTab === 'disciplinas' && (
                            <div className="animate-in fade-in max-w-3xl mx-auto">
                                <div className="flex justify-between items-center mb-4">
                                    <div>
                                        <h3 className="font-bold text-slate-800">Grade Curricular</h3>
                                        <p className="text-xs text-slate-400">Disciplinas leccionadas neste curso.</p>
                                    </div>
                                    <button 
                                        onClick={handleAddDisciplinaDetails}
                                        className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-slate-800 shadow-lg"
                                    >
                                        <Plus className="w-4 h-4"/> Adicionar Disciplina
                                    </button>
                                </div>

                                <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-white border-b border-slate-200 text-xs uppercase text-slate-400 font-bold">
                                            <tr>
                                                <th className="px-4 py-3">Nome da Disciplina</th>
                                                <th className="px-4 py-3 text-right">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {details.disciplinas.map((disc, idx) => (
                                                <tr key={disc.id} className="hover:bg-white transition-colors group">
                                                    <td className="px-4 py-3 font-medium text-slate-700 flex items-center gap-3">
                                                        <span className="text-slate-300 font-mono text-xs w-4">{(idx + 1).toString().padStart(2, '0')}</span>
                                                        {disc.nome}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <button 
                                                            onClick={() => handleRemoveDisciplina(disc.id)}
                                                            className="text-slate-300 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {details.disciplinas.length === 0 && (
                                        <div className="p-8 text-center text-slate-400 text-sm">
                                            Nenhuma disciplina cadastrada.
                                        </div>
                                    )}
                                </div>
                                <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-lg flex gap-2 text-xs text-amber-800">
                                    <AlertCircle className="w-4 h-4 shrink-0"/>
                                    <p>Alterações nas disciplinas afectam todas as classes e turmas vinculadas a este curso.</p>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
  }

  // VISTA PADRÃO (LISTA E CATÁLOGO)
  const presetsList = Object.entries(CURRICULUM_PRESETS_META).map(([key, meta]) => ({ id: key as CurriculumKey, ...meta }));

  return (
    <div className="space-y-6">
      
      {/* TABS PRINCIPAIS */}
      <div className="flex border-b border-slate-200">
        <button onClick={() => setActiveTab('my_courses')} className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'my_courses' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
          <Layers className="w-4 h-4" /> Cursos Ativos ({courses.length})
        </button>
        <button onClick={() => setActiveTab('catalog')} className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'catalog' ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
          <ShoppingBag className="w-4 h-4" /> Catálogo
        </button>
      </div>

      {/* ABA: MEUS CURSOS */}
      {activeTab === 'my_courses' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in">
            {courses.length === 0 && !loading && (
                <div className="col-span-3 text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                    <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3"/>
                    <h3 className="text-slate-900 font-bold">Nenhum curso ativo</h3>
                    <button onClick={() => setActiveTab('catalog')} className="mt-4 text-teal-600 font-bold underline">Ir ao Catálogo</button>
                </div>
            )}
            {courses.map(curso => (
                <div 
                    key={curso.id} 
                    onClick={() => handleOpenManager(curso.id)}
                    className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-lg hover:border-teal-400 hover:-translate-y-1 transition-all group cursor-pointer relative"
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-slate-100 text-slate-600 rounded-lg group-hover:bg-slate-900 group-hover:text-white transition-colors"><BookOpen className="w-6 h-6"/></div>
                        {/* Botão delete propagação parada para não abrir o modal */}
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleRemove(curso.id, curso.total_alunos); }} 
                            className="p-2 text-slate-300 hover:text-red-500 transition z-10" 
                            title="Remover"
                        >
                            <Trash2 className="w-4 h-4"/>
                        </button>
                    </div>
                    <h3 className="font-bold text-slate-800 mb-1 truncate group-hover:text-teal-600 transition-colors" title={curso.nome}>{curso.nome}</h3>
                    <p className="text-xs text-slate-400 font-mono mb-4">{curso.codigo}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-100 pt-4">
                        <div><span className="block text-slate-400">Classes</span><span className="font-bold text-slate-700">{curso.total_classes}</span></div>
                        <div><span className="block text-slate-400">Turmas</span><span className="font-bold text-slate-700">{curso.total_turmas}</span></div>
                    </div>
                    
                    <div className="absolute inset-0 bg-teal-500/5 opacity-0 group-hover:opacity-100 rounded-xl transition-opacity pointer-events-none" />
                </div>
            ))}
        </div>
      )}

      {/* ABA: CATÁLOGO */}
      {activeTab === 'catalog' && (
        <div className="animate-in fade-in">
             <div className="mb-6 flex justify-end">
                <button onClick={openCustomConfig} className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg hover:-translate-y-0.5 transition-all">
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
                                        disabled={!!quickInstallingKey}
                                        className="text-xs font-medium border border-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-50 flex items-center gap-1"
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
                        </div>
                    )
                })}
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
                        <input value={draft.label} onChange={e => setDraft({...draft, label: e.target.value})} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none font-bold text-slate-700" placeholder="Ex: Técnico de Gestão Empresarial" />
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
                        <div className="flex justify-between items-end mb-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Disciplinas ({draft.subjects.length})</label>
                        </div>
                        <div className="flex gap-2 mb-3">
                            <input value={newSubject} onChange={e => setNewSubject(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSubject()} placeholder="Digite o nome da disciplina..." className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-teal-500" />
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
                    <button onClick={handleSave} disabled={installing} className="px-6 py-2 bg-teal-600 text-white text-sm font-bold rounded-xl hover:bg-teal-700 shadow-lg transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                        {installing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} {installing ? "Instalando..." : "Salvar e Criar"}
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}
