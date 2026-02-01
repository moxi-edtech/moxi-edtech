"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { 
  BookOpenCheck, 
  Wand2, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight,
  School
} from "lucide-react";
import ConfigSystemShell from "@/components/escola/settings/ConfigSystemShell";

// --- TYPES ---
type Curso = { id: string; nome: string };
type Classe = { id: string; curso_id?: string; nome: string; turno?: string };
type CurriculoStatus = { 
  curso_id: string; 
  status: 'draft' | 'published' | 'archived' | 'none'; 
  version: number; 
  ano_letivo_id: string 
};

type ImpactData = {
  turmas?: number;
  alunos?: number;
  professores?: number;
};

export default function TurmasConfiguracoesPage() {
  const params = useParams() as { id?: string };
  const escolaId = params?.id;
  const base = escolaId ? `/escola/${escolaId}/admin/configuracoes` : "";
  
  const menuItems = [
    { label: "📅 Calendário", href: `${base}/calendario` },
    { label: "📊 Avaliação", href: `${base}/avaliacao` },
    { label: "👥 Turmas", href: `${base}/turmas` },
    { label: "💰 Financeiro", href: `${base}/financeiro` },
    { label: "🔄 Fluxos", href: `${base}/fluxos` },
    { label: "⚙️ Avançado", href: `${base}/avancado` },
  ];

  // --- STATE ---
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // ID do curso sendo processado
  
  const [impact, setImpact] = useState<ImpactData>({});
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [classes, setClasses] = useState<Classe[]>([]);
  const [curriculos, setCurriculos] = useState<CurriculoStatus[]>([]);
  const [anoLetivo, setAnoLetivo] = useState<{ id: string; ano: number } | null>(null);

  // --- FETCH ---
  useEffect(() => {
    if (!escolaId) return;
    const load = async () => {
      try {
        // Parallel fetching para performance
        const [cursosRes, classesRes, curriculoRes, impactRes] = await Promise.all([
          fetch(`/api/escolas/${escolaId}/cursos`, { cache: "no-store" }),
          fetch(`/api/escolas/${escolaId}/classes`, { cache: "no-store" }),
          fetch(`/api/escola/${escolaId}/admin/curriculo/status`, { cache: "no-store" }),
          fetch(`/api/escola/${escolaId}/admin/setup/impact`, { 
            method: "POST", 
            body: JSON.stringify({}) 
          })
        ]);

        const cursosJson = await cursosRes.json();
        if (cursosRes.ok) setCursos(cursosJson.data ?? []);

        const classesJson = await classesRes.json();
        if (classesRes.ok) setClasses(classesJson.data ?? []);

        const curriculoJson = await curriculoRes.json();
        if (curriculoRes.ok) {
          setCurriculos(curriculoJson.curriculos ?? []);
          setAnoLetivo(curriculoJson.ano_letivo ?? null);
        }

        const impactJson = await impactRes.json();
        if (impactRes.ok) {
          setImpact({
            turmas: impactJson.data?.counts?.turmas_afetadas,
            alunos: impactJson.data?.counts?.alunos_afetados,
            professores: impactJson.data?.counts?.professores_afetados,
          });
        }
      } catch (e) {
        console.error(e);
        toast.error("Erro ao carregar dados acadêmicos.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [escolaId]);

  // --- ACTIONS ---
  
  // 1. Publicar Currículo (Trava a grade curricular)
  const handlePublish = async (cursoId: string) => {
    if (!escolaId || !anoLetivo) return;
    const curriculo = curriculos.find((c) => c.curso_id === cursoId);
    if (!curriculo) {
      toast.error("Currículo não encontrado.");
      return;
    }

    setActionLoading(`publish-${cursoId}`);
    try {
      const res = await fetch(`/api/escola/${escolaId}/admin/curriculo/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cursoId,
          anoLetivoId: curriculo.ano_letivo_id,
          version: curriculo.version,
          rebuildTurmas: true, // Cuidado com flags destrutivas implícitas
        }),
      });

      if (!res.ok) throw new Error("Falha na publicação");
      
      // Atualiza estado local otimista
      setCurriculos(prev => prev.map(c => c.curso_id === cursoId ? { ...c, status: 'published' } : c));
      toast.success("Currículo publicado com sucesso!");
    } catch (e) {
      toast.error("Erro ao publicar currículo.");
    } finally {
      setActionLoading(null);
    }
  };

  // 2. Gerar Turmas (Cria as entidades 'turma' baseadas nas 'classes')
  const handleGenerate = async (cursoId: string) => {
    if (!escolaId || !anoLetivo) return;
    
    // Filtra classes deste curso
    const turmasPayload = classes
      .filter((c) => c.curso_id === cursoId)
      .map((c) => ({
        classeId: c.id,
        turno: (c.turno as "M" | "T" | "N") ?? "M",
        quantidade: 1, // Default seguro. Idealmente viria de uma config.
      }));

    if (turmasPayload.length === 0) {
      toast.warning("Este curso não possui classes cadastradas (ex: 10ª A, 10ª B).");
      return;
    }

    setActionLoading(`gen-${cursoId}`);
    try {
      const res = await fetch(`/api/escola/${escolaId}/admin/turmas/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cursoId,
          anoLetivo: anoLetivo.ano,
          turmas: turmasPayload,
        }),
      });

      if (!res.ok) throw new Error("Falha na geração");
      
      toast.success(`${turmasPayload.length} turmas geradas/atualizadas!`);
      // Poderíamos refazer o fetch do impact aqui para atualizar os números
    } catch (e) {
      toast.error("Erro ao gerar turmas.");
    } finally {
      setActionLoading(null);
    }
  };

  // O botão salvar final apenas confirma que o setup de turmas foi revisado
  const handleConfirmSetup = async () => {
    if (!escolaId) return;
    try {
      await fetch(`/api/escola/${escolaId}/admin/setup/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes: { turmas: true } }),
      });
      // toast.success("Configuração de turmas concluída."); // O Shell já lida com feedback visual se quiser
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <ConfigSystemShell
      escolaId={escolaId ?? ""}
      title="Gestão de Turmas & Currículo"
      subtitle="Publique os currículos para destravar a criação de turmas."
      menuItems={menuItems}
      prevHref={`${base}/avaliacao`}
      nextHref={`${base}/financeiro`}
      testHref={`${base}/sandbox`}
      impact={impact}
      onSave={handleConfirmSetup}
      saveDisabled={!!actionLoading} // Desabilita avançar se estiver processando algo
    >
      <div className="space-y-6">
        
        {/* INFO CARD */}
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-5 text-sm text-slate-600 flex gap-4">
          <div className="rounded-full bg-blue-100 p-2 text-blue-600 h-fit">
            <School className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-slate-900">Como funciona a geração?</p>
            <p className="mt-1">
              1. <strong>Publique o currículo</strong> para definir quais disciplinas existem. <br/>
              2. Clique em <strong>Gerar Turmas</strong> para criar as salas (ex: 10ª A, 10ª B) automaticamente.
            </p>
          </div>
        </div>

        {/* LISTA DE CURSOS */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900 px-1">Cursos Disponíveis</h3>
          
          {loading ? (
             <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-slate-300" /></div>
          ) : cursos.length === 0 ? (
            <div className="text-center py-8 text-slate-500 border border-dashed rounded-xl">
              Nenhum curso cadastrado na escola.
            </div>
          ) : (
            cursos.map((curso) => {
              const curriculo = curriculos.find((c) => c.curso_id === curso.id);
              const status = curriculo?.status ?? 'none';
              const isPublished = status === 'published';
              const classesDoCurso = classes.filter(c => c.curso_id === curso.id).length;

              return (
                <div 
                  key={curso.id} 
                  className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
                >
                  <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                    
                    {/* INFO DO CURSO */}
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 rounded-full p-1.5 ${isPublished ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                        {isPublished ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">{curso.nome}</h4>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                          <span className={`font-medium ${isPublished ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {isPublished ? 'Currículo Publicado' : 'Rascunho'}
                          </span>
                          <span>•</span>
                          <span>v.{curriculo?.version ?? 1}</span>
                          <span>•</span>
                          <span>{classesDoCurso} classes base</span>
                        </div>
                      </div>
                    </div>

                    {/* AÇÕES */}
                    <div className="flex items-center gap-3">
                      
                      {/* BOTÃO PUBLICAR */}
                      {!isPublished && (
                        <button
                          onClick={() => handlePublish(curso.id)}
                          disabled={!!actionLoading}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-klasse-gold disabled:opacity-50"
                        >
                          {actionLoading === `publish-${curso.id}` ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <BookOpenCheck className="h-3 w-3" />
                          )}
                          Publicar Currículo
                        </button>
                      )}

                      {/* BOTÃO GERAR TURMAS */}
                      <button
                        onClick={() => handleGenerate(curso.id)}
                        disabled={!isPublished || !!actionLoading}
                        title={!isPublished ? "Publique o currículo primeiro" : "Gerar turmas baseado nas classes"}
                        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold shadow-sm transition-all
                          ${isPublished 
                            ? "bg-slate-900 text-white hover:bg-slate-800 hover:shadow" 
                            : "bg-slate-100 text-slate-400 cursor-not-allowed"
                          }
                        `}
                      >
                         {actionLoading === `gen-${curso.id}` ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Wand2 className="h-3 w-3" />
                          )}
                        Gerar Turmas
                      </button>
                    </div>
                  </div>
                  
                  {/* Progress Bar Decorativo (só se publicado) */}
                  {isPublished && (
                    <div className="absolute bottom-0 left-0 h-1 w-full bg-emerald-500/10">
                       <div className="h-full w-full bg-emerald-500" style={{ width: '100%' }}></div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <Link
          href={escolaId ? `/escola/${escolaId}/admin/turmas` : "#"}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 sm:w-auto"
        >
          <span>Gerenciar Turmas Manualmente</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </ConfigSystemShell>
  );
}