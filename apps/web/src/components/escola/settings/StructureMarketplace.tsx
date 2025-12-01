"use client";

import { useState, useEffect } from "react";
import { 
  BookOpen, Plus, Trash2, ShoppingBag, CheckCircle2, 
  Loader2, MoreVertical, Layers, Settings, X, Save, PlusCircle
} from "lucide-react";
import { toast } from "sonner";
import { CURRICULUM_PRESETS } from "@/lib/onboarding"; 
import { PRESETS_META } from "@/components/escola/onboarding/academicSetupTypes";

// --- TIPOS ---
type ActiveCourse = {
  id: string;
  nome: string;
  codigo: string;
  total_classes: number;
  total_turmas: number;
  total_alunos: number;
};

// Estado do "Rascunho"
type CourseDraft = {
    label: string;
    classes: string[];
    subjects: string[];
    isCustom: boolean;
    baseKey?: string;
};

const ALL_CLASSES = ["7ª", "8ª", "9ª", "10ª", "11ª", "12ª", "13ª"];

export default function StructureMarketplace({ escolaId }: { escolaId: string }) {
  const [activeTab, setActiveTab] = useState<'my_courses' | 'catalog'>('my_courses');
  const [courses, setCourses] = useState<ActiveCourse[]>([]);
  const [loading, setLoading] = useState(true);
  
  // --- ESTADOS DE EDIÇÃO (MODAL) ---
  const [showModal, setShowModal] = useState(false);
  const [draft, setDraft] = useState<CourseDraft | null>(null);
  const [newSubject, setNewSubject] = useState("");
  const [installing, setInstalling] = useState(false);

  // --- CARREGAR CURSOS ATIVOS ---
  const fetchCourses = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/escolas/${escolaId}/cursos/stats`); 
      const json = await res.json();
      if (json.ok) setCourses(json.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCourses(); }, [escolaId]);

// --- ABRIR CONFIGURADOR (PRESET) ---
  const openPresetConfig = (presetKey: string) => {
    const meta = PRESETS_META.find(p => p.key === presetKey);
    const data: any = CURRICULUM_PRESETS[presetKey as keyof typeof CURRICULUM_PRESETS];
    
    // Normaliza dados
    let classes: string[] = ['10ª', '11ª', '12ª'];
    
    // --- CORREÇÃO AQUI ---
    let subjects: string[] = []; // Definir explicitamente como array de strings
    // ---------------------

    if (Array.isArray(data)) {
        subjects = data;
    } else if (data) {
        subjects = data.subjects || [];
        if(data.classes) classes = data.classes;
    }

    setDraft({
        label: meta?.label || "Novo Curso",
        classes: classes,
        subjects: subjects,
        isCustom: false,
        baseKey: presetKey
    });
    setShowModal(true);
  };

  // --- ABRIR CONFIGURADOR (DO ZERO) ---
  const openCustomConfig = () => {
      setDraft({
          label: "",
          classes: ['10ª', '11ª', '12ª'],
          subjects: ["Língua Portuguesa", "Matemática", "Inglês", "Informática"],
          isCustom: true
      });
      setShowModal(true);
  };

  // --- AÇÕES DO MODAL ---
  const toggleClass = (cls: string) => {
      if(!draft) return;
      const has = draft.classes.includes(cls);
      setDraft({
          ...draft,
          classes: has ? draft.classes.filter(c => c !== cls) : [...draft.classes, cls].sort((a,b) => parseInt(a)-parseInt(b))
      });
  };

  const addSubject = () => {
      if(!draft || !newSubject.trim()) return;
      if(draft.subjects.includes(newSubject.trim())) return toast.error("Disciplina já existe.");
      setDraft({...draft, subjects: [...draft.subjects, newSubject.trim()]});
      setNewSubject("");
  };

  // --- SALVAR (INSTALAR) ---
  const handleSave = async () => {
    if (!draft || !draft.label) return toast.error("O curso precisa de um nome.");
    if (draft.classes.length === 0) return toast.error("Selecione pelo menos uma classe.");
    
    setInstalling(true);
    const toastId = toast.loading("A criar estrutura...");

    try {
      // Payload Inteligente para a API "Custom Builder"
      const payload = {
        presetKey: "custom_builder",
        customData: {
            name: draft.label,
            classes: draft.classes.map(c => c.includes('ª') ? `${c} Classe` : c),
            subjects: draft.subjects
        }
      };

      const res = await fetch(`/api/escolas/${escolaId}/onboarding/curriculum/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Falha ao criar.");

      toast.success("Curso criado com sucesso!", { id: toastId });
      setShowModal(false);
      fetchCourses();
      setActiveTab('my_courses');

    } catch (e) {
      toast.error("Erro ao criar curso.", { id: toastId });
    } finally {
      setInstalling(false);
    }
  };

  // --- REMOVER CURSO ---
  const handleRemove = async (cursoId: string, totalAlunos: number) => {
    if (totalAlunos > 0) return alert("Impossível remover curso com alunos.");
    if (!confirm("Tem a certeza?")) return;

    const toastId = toast.loading("A remover...");
    try {
        await fetch(`/api/escolas/${escolaId}/cursos/${cursoId}`, { method: 'DELETE' });
        toast.success("Curso removido.", { id: toastId });
        fetchCourses();
    } catch {
        toast.error("Erro ao remover.", { id: toastId });
    }
  };

  return (
    <div className="space-y-6">
      
      {/* TABS */}
      <div className="flex border-b border-slate-200">
        <button onClick={() => setActiveTab('my_courses')} className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'my_courses' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
          <Layers className="w-4 h-4" /> Cursos Ativos ({courses.length})
        </button>
        <button onClick={() => setActiveTab('catalog')} className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'catalog' ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
          <ShoppingBag className="w-4 h-4" /> Catálogo & Customização
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
                <div key={curso.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-slate-100 text-slate-600 rounded-lg"><BookOpen className="w-6 h-6"/></div>
                        <button onClick={() => handleRemove(curso.id, curso.total_alunos)} className="p-2 text-slate-300 hover:text-red-500 transition"><Trash2 className="w-4 h-4"/></button>
                    </div>
                    <h3 className="font-bold text-slate-800 mb-1">{curso.nome}</h3>
                    <p className="text-xs text-slate-400 font-mono mb-4">{curso.codigo}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-100 pt-4">
                        <div><span className="block text-slate-400">Classes</span><span className="font-bold text-slate-700">{curso.total_classes}</span></div>
                        <div><span className="block text-slate-400">Alunos</span><span className="font-bold text-slate-700">{curso.total_alunos}</span></div>
                    </div>
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
                {PRESETS_META.map(preset => {
                    const isInstalled = courses.some(c => c.nome.toLowerCase() === preset.label.toLowerCase());
                    return (
                        <div key={preset.key} className={`flex items-center justify-between p-5 rounded-xl border ${isInstalled ? 'bg-slate-50 opacity-70' : 'bg-white hover:shadow-md'}`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${isInstalled ? 'bg-slate-200 text-slate-500' : 'bg-teal-50 text-teal-600'}`}>{preset.label[0]}</div>
                                <div>
                                    <h4 className="font-bold text-slate-800 text-sm">{preset.label}</h4>
                                    <p className="text-xs text-slate-500">{preset.categoria === 'geral' ? 'Ensino Geral' : 'Técnico'}</p>
                                </div>
                            </div>
                            {isInstalled ? (
                                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Instalado</span>
                            ) : (
                                <button onClick={() => openPresetConfig(preset.key)} className="text-xs font-bold text-slate-900 border border-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-50 flex items-center gap-1">
                                    <Settings className="w-3 h-3"/> Configurar
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
      )}

      {/* MODAL DE CONFIGURAÇÃO (O CÉREBRO DA PERSONALIZAÇÃO) */}
      {showModal && draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-slate-800">Configurar Curso</h3>
                    <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600"/></button>
                </div>

                {/* Body (Scroll) */}
                <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                    
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Nome do Curso</label>
                        <input 
                            value={draft.label} 
                            onChange={e => setDraft({...draft, label: e.target.value})}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none font-bold text-slate-700"
                            placeholder="Ex: Técnico de Gestão"
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Classes Abrangidas</label>
                        <div className="flex flex-wrap gap-2">
                            {ALL_CLASSES.map(cls => (
                                <button key={cls} onClick={() => toggleClass(cls)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${draft.classes.includes(cls) ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200'}`}>
                                    {cls}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-end mb-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Plano Curricular ({draft.subjects.length})</label>
                        </div>
                        
                        <div className="flex gap-2 mb-3">
                            <input value={newSubject} onChange={e => setNewSubject(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSubject()} placeholder="Adicionar disciplina..." className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-teal-500"/>
                            <button onClick={addSubject} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-bold text-xs">+ Adicionar</button>
                        </div>

                        <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1">
                            {draft.subjects.map(sub => (
                                <span key={sub} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 group">
                                    {sub}
                                    <button onClick={() => setDraft({...draft, subjects: draft.subjects.filter(s => s !== sub)})} className="text-slate-300 hover:text-red-500"><X className="w-3 h-3"/></button>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-bold text-slate-500">Cancelar</button>
                    <button onClick={handleSave} disabled={installing} className="px-6 py-2 bg-teal-600 text-white text-sm font-bold rounded-xl hover:bg-teal-700 shadow-lg transition-all flex items-center gap-2">
                        {installing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                        Salvar Curso
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}