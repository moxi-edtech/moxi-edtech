"use client";

import { useState, useEffect } from "react";
import { 
  BookOpen, 
  Plus, 
  Trash2, 
  Search, 
  ShoppingBag, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  MoreVertical,
  Layers
} from "lucide-react";
import { toast } from "sonner";
import { CURRICULUM_PRESETS } from "@/lib/onboarding"; // Teus presets
import { PRESETS_META } from "@/components/escola/onboarding/academicSetupTypes"; // Teus metadados

// --- TIPOS ---
type ActiveCourse = {
  id: string;
  nome: string;
  codigo: string;
  total_classes: number;
  total_turmas: number;
  total_alunos: number;
};

export default function StructureMarketplace({ escolaId }: { escolaId: string }) {
  const [activeTab, setActiveTab] = useState<'my_courses' | 'catalog'>('my_courses');
  const [courses, setCourses] = useState<ActiveCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);

  // --- CARREGAR CURSOS ATIVOS ---
  const fetchCourses = async () => {
    setLoading(true);
    try {
      // Endpoint sugerido: retorna cursos com contagens
      const res = await fetch(`/api/escolas/${escolaId}/cursos/stats`); 
      const json = await res.json();
      if (json.ok) setCourses(json.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, [escolaId]);

  // --- INSTALAR CURSO (DO CATÁLOGO) ---
  const handleInstall = async (presetKey: string) => {
    setInstalling(presetKey);
    const toastId = toast.loading("A instalar estrutura do curso...");

    try {
      // Reutilizamos a API poderosa que criámos antes!
      // Mas enviamos uma matriz simplificada apenas para criar a estrutura (sem turmas iniciais)
      // O diretor cria as turmas depois na gestão de turmas.
      const preset = PRESETS_META.find(p => p.key === presetKey);
      if (!preset) return;

      const payload = {
        presetKey: "custom_matrix",
        matrix: [{
            classe: "10ª Classe", // Dummy para forçar criação do curso
            cursoKey: presetKey,
            qtyManha: 0, qtyTarde: 0, qtyNoite: 0 // 0 turmas, só cria estrutura
        }]
      };

      const res = await fetch(`/api/escolas/${escolaId}/onboarding/curriculum/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Falha ao instalar curso.");

      toast.success("Curso adicionado com sucesso!", { id: toastId });
      await fetchCourses(); // Recarrega a lista
      setActiveTab('my_courses'); // Volta para a aba "Meus Cursos"

    } catch (e) {
      toast.error("Erro ao instalar curso.", { id: toastId });
    } finally {
      setInstalling(null);
    }
  };

  // --- REMOVER CURSO ---
  const handleRemove = async (cursoId: string, totalAlunos: number) => {
    if (totalAlunos > 0) {
      alert("Não é possível remover este curso pois existem alunos matriculados.");
      return;
    }
    
    if (!confirm("Tem a certeza? Isso apagará o curso e as classes associadas se estiverem vazias.")) return;

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
      
      {/* TABS DE NAVEGAÇÃO */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('my_courses')}
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'my_courses' 
              ? 'border-slate-900 text-slate-900' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Layers className="w-4 h-4" />
          Cursos Ativos ({courses.length})
        </button>
        <button
          onClick={() => setActiveTab('catalog')}
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'catalog' 
              ? 'border-teal-500 text-teal-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          Catálogo de Cursos
        </button>
      </div>

      {/* === ABA: MEUS CURSOS === */}
      {activeTab === 'my_courses' && (
        <div className="animate-in fade-in slide-in-from-left-4 duration-300">
            
            {loading ? (
                <div className="p-12 text-center text-slate-400"><Loader2 className="w-8 h-8 animate-spin mx-auto"/></div>
            ) : courses.length === 0 ? (
                <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                    <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3"/>
                    <h3 className="text-slate-900 font-bold">Nenhum curso ativo</h3>
                    <p className="text-slate-500 text-sm mb-6">A sua escola ainda não tem cursos configurados.</p>
                    <button onClick={() => setActiveTab('catalog')} className="bg-teal-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-teal-700 transition">
                        Explorar Catálogo
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {courses.map(curso => (
                        <div key={curso.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-slate-100 text-slate-600 rounded-lg group-hover:bg-slate-900 group-hover:text-white transition-colors">
                                    <BookOpen className="w-6 h-6"/>
                                </div>
                                <div className="relative">
                                    <button className="p-1 hover:bg-slate-100 rounded text-slate-400"><MoreVertical className="w-4 h-4"/></button>
                                </div>
                            </div>
                            
                            <h3 className="font-bold text-slate-800 mb-1">{curso.nome}</h3>
                            <p className="text-xs text-slate-400 font-mono mb-4">COD: {curso.codigo || "N/A"}</p>
                            
                            <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-100 pt-4">
                                <div>
                                    <span className="block text-slate-400">Classes</span>
                                    <span className="font-bold text-slate-700">{curso.total_classes} níveis</span>
                                </div>
                                <div>
                                    <span className="block text-slate-400">Alunos</span>
                                    <span className="font-bold text-slate-700">{curso.total_alunos} ativos</span>
                                </div>
                            </div>

                            <div className="mt-4 flex gap-2">
                                <button className="flex-1 py-2 text-xs font-bold bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition">
                                    Gerir
                                </button>
                                <button 
                                    onClick={() => handleRemove(curso.id, curso.total_alunos)}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                    title="Remover Curso"
                                >
                                    <Trash2 className="w-4 h-4"/>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      )}

      {/* === ABA: CATÁLOGO (MARKETPLACE) === */}
      {activeTab === 'catalog' && (
        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            
            <div className="mb-6 bg-teal-50 border border-teal-100 p-4 rounded-xl flex items-start gap-3">
                <div className="p-2 bg-white rounded-full text-teal-600 shadow-sm"><ShoppingBag className="w-5 h-5"/></div>
                <div>
                    <h4 className="font-bold text-teal-900 text-sm">Adicione novos cursos</h4>
                    <p className="text-xs text-teal-700 mt-1">
                        Ao adicionar, o sistema cria automaticamente as classes, disciplinas e estrutura curricular oficial.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PRESETS_META.map(preset => {
                    // Verifica se já está instalado (pelo nome aproximado)
                    const isInstalled = courses.some(c => c.nome.toLowerCase() === preset.label.toLowerCase());

                    return (
                        <div key={preset.key} className={`
                            flex items-center justify-between p-5 rounded-xl border transition-all
                            ${isInstalled ? 'bg-slate-50 border-slate-200 opacity-80' : 'bg-white border-slate-200 hover:border-teal-400 shadow-sm hover:shadow-md'}
                        `}>
                            <div className="flex items-center gap-4">
                                <div className={`
                                    w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg
                                    ${isInstalled ? 'bg-slate-200 text-slate-500' : 'bg-teal-50 text-teal-600'}
                                `}>
                                    {preset.label.charAt(0)}
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 text-sm">{preset.label}</h4>
                                    <p className="text-xs text-slate-500">
                                        {preset.categoria === 'geral' ? 'Ensino Geral' : 'Ensino Técnico / Profissional'}
                                    </p>
                                </div>
                            </div>

                            {isInstalled ? (
                                <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
                                    <CheckCircle2 className="w-3 h-3"/> Instalado
                                </span>
                            ) : (
                                <button 
                                    onClick={() => handleInstall(preset.key)}
                                    disabled={!!installing}
                                    className="flex items-center gap-2 text-xs font-bold bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 disabled:opacity-50"
                                >
                                    {installing === preset.key ? <Loader2 className="w-3 h-3 animate-spin"/> : <Plus className="w-3 h-3"/>}
                                    Adicionar
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
      )}

    </div>
  );
}