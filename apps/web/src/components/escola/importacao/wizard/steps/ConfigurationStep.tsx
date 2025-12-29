"use client";

import { useEffect, useState, useMemo } from "react";
import { Loader2, CheckCircle, Save, Info, ArrowLeft, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { buildEscolaUrl } from "@/lib/escola/url";
import { useUserRole } from "@/hooks/useUserRole";

type Curso = {
  id: string;
  nome: string;
  codigo: string;
  status_aprovacao: 'pendente' | 'aprovado';
  import_id: string;
};

type Turma = {
  id: string;
  nome: string;
  turma_codigo: string;
  curso_id: string | null;
  classe_id: string | null;
  turno: string | null;
  status_validacao: 'rascunho' | 'ativo';
  import_id: string;
  curso_nome: string; // From get_import_summary
  curso_status: 'pendente' | 'aprovado'; // From get_import_summary
  classe_nome: string; // From get_import_summary
};

type SummaryData = {
  cursos: Curso[];
  turmas: Turma[];
};

type ConfigurationStepProps = {
  escolaId: string;
  importId: string;
  initialSummaryData: SummaryData;
  onComplete: () => void;
  onBack: () => void;
};

type AvailableClasse = {
  id: string;
  nome: string;
};

type AvailableCurso = {
  id: string;
  nome: string;
  status_aprovacao: 'pendente' | 'aprovado';
};

export default function ConfigurationStep({
  escolaId,
  importId,
  initialSummaryData,
  onComplete,
  onBack,
}: ConfigurationStepProps) {
  const [loading, setLoading] = useState(false);
  const [cursosToConfigure, setCursosToConfigure] = useState<Curso[]>(initialSummaryData.cursos || []);
  const [turmasToConfigure, setTurmasToConfigure] = useState<Turma[]>(initialSummaryData.turmas || []);
  const [availableClasses, setAvailableClasses] = useState<AvailableClasse[]>([]);
  const [availableCourses, setAvailableCourses] = useState<AvailableCurso[]>([]);
  const { userRole, isLoading: loadingRole } = useUserRole();

  const canApproveCourses = useMemo(() => userRole === 'admin' || userRole === 'super_admin', [userRole]);

  useEffect(() => {
    async function fetchAuxiliaryData() {
      setLoading(true);
      try {
        const [classesRes, coursesRes] = await Promise.all([
          fetch(buildEscolaUrl(escolaId, '/classes')),
          fetch(buildEscolaUrl(escolaId, '/cursos')),
        ]);

        const classesJson = await classesRes.json();
        if (classesRes.ok) {
          setAvailableClasses(classesJson.items || classesJson.data || []);
        } else {
          toast.error("Erro ao carregar classes disponíveis.");
        }

        const coursesJson = await coursesRes.json();
        if (coursesRes.ok) {
          setAvailableCourses(coursesJson.items || coursesJson.data || []);
        } else {
          toast.error("Erro ao carregar cursos disponíveis.");
        }
      } catch (error) {
        console.error("Erro ao carregar dados auxiliares:", error);
        toast.error("Erro de conexão ao carregar dados auxiliares.");
      } finally {
        setLoading(false);
      }
    }

    fetchAuxiliaryData();
  }, [escolaId]);

  const handleCursoChange = (id: string, field: keyof Curso, value: any) => {
    setCursosToConfigure((prev) =>
      prev.map((curso) => (curso.id === id ? { ...curso, [field]: value } : curso))
    );
  };

  const handleTurmaChange = (id: string, field: keyof Turma, value: any) => {
    setTurmasToConfigure((prev) =>
      prev.map((turma) => (turma.id === id ? { ...turma, [field]: value } : turma))
    );
  };

  const handleSaveConfiguration = async () => {
    setLoading(true);
    try {
      const payload = {
        cursos: cursosToConfigure.map(c => ({
            id: c.id,
            nome: c.nome,
            status_aprovacao: c.status_aprovacao // Admins can change this
        })),
        turmas: turmasToConfigure.map(t => ({
            id: t.id,
            nome: t.nome,
            curso_id: t.curso_id,
            classe_id: t.classe_id,
            turno: t.turno,
            status_validacao: t.status_validacao // Secretary can change this to 'ativo'
        })),
      };

      const response = await fetch(`/api/migracao/${importId}/configure`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao salvar configurações.");
      }

      toast.success("Configurações salvas com sucesso!");
      onComplete();
    } catch (error: any) {
      console.error("Erro ao salvar configurações:", error);
      toast.error(error.message || "Erro de conexão ao salvar configurações.");
    } finally {
      setLoading(false);
    }
  };

  if (loading || loadingRole) {
    return (
      <div className="flex flex-col items-center gap-2 text-slate-500 py-20">
        <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
        <p>Carregando dados para configuração...</p>
      </div>
    );
  }

  const handleActivateAllTurmas = () => {
    setTurmasToConfigure((prev) =>
      prev.map((turma) =>
        turma.status_validacao === 'rascunho'
          ? { ...turma, status_validacao: 'ativo' }
          : turma
      )
    );
    toast.info("Todas as turmas em rascunho foram marcadas para ativação ao salvar.");
  };

  const hasCursosToApprove = useMemo(() => cursosToConfigure.some(c => c.status_aprovacao === 'pendente'), [cursosToConfigure]);
  const hasTurmasToActivate = useMemo(() => turmasToConfigure.some(t => t.status_validacao === 'rascunho'), [turmasToConfigure]);

  return (
    <div className="space-y-6">
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3 text-sm text-blue-800">
        <Info className="h-5 w-5 flex-shrink-0" />
        <div>
          <h3 className="font-bold">Ajuste os itens criados durante a importação.</h3>
          <p className="mt-1">
            Cursos criados por não-administradores aguardam sua aprovação. Turmas em rascunho precisam ser configuradas e ativadas.
          </p>
        </div>
      </div>

      {cursosToConfigure.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">Cursos Novos/Pendentes</h2>
          {cursosToConfigure.map((curso) => (
            <div key={curso.id} className="border border-slate-200 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-700">{curso.nome} ({curso.codigo})</h4>
                {curso.status_aprovacao === 'pendente' && (
                  <span className="px-2 py-0.5 text-xs font-semibold text-orange-700 bg-orange-50 rounded-full border border-orange-200">
                    Pendente
                  </span>
                )}
                {curso.status_aprovacao === 'aprovado' && (
                  <span className="px-2 py-0.5 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-full border border-emerald-200">
                    Aprovado
                  </span>
                )}
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Nome do Curso</label>
                <input
                  type="text"
                  value={curso.nome}
                  onChange={(e) => handleCursoChange(curso.id, 'nome', e.target.value)}
                  className="w-full rounded-md border-slate-300 shadow-sm text-sm"
                />
              </div>

              {curso.status_aprovacao === 'pendente' && canApproveCourses && (
                <button
                  onClick={() => handleCursoChange(curso.id, 'status_aprovacao', 'aprovado')}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 mt-2"
                >
                  <CheckCircle className="inline-block w-4 h-4 mr-2" /> Aprovar Curso
                </button>
              )}
              {curso.status_aprovacao === 'pendente' && !canApproveCourses && (
                <div className="p-2 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-md mt-2">
                    <AlertCircle className="inline-block w-3 h-3 mr-1" /> Este curso precisa da aprovação de um Administrador para ser ativado.
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {turmasToConfigure.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-800">Turmas em Rascunho</h2>
            {hasTurmasToActivate && (
              <button
                onClick={handleActivateAllTurmas}
                disabled={loading}
                className={`
                  inline-flex items-center justify-center gap-2
                  rounded-lg px-4 py-2.5 text-sm font-medium
                  bg-blue-600 text-white
                  hover:bg-blue-700
                  disabled:opacity-50 disabled:cursor-not-allowed
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                  transition-colors
                `}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                <span>{loading ? "Ativando..." : "Ativar Todas as Turmas Rascunho"}</span>
              </button>
            )}
          </div>
          {turmasToConfigure.map((turma) => (
            <div key={turma.id} className="border border-slate-200 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-700">{turma.nome} ({turma.turma_codigo})</h4>
                {turma.status_validacao === 'rascunho' && (
                  <span className="px-2 py-0.5 text-xs font-semibold text-orange-700 bg-orange-50 rounded-full border border-orange-200">
                    Rascunho
                  </span>
                )}
                {turma.status_validacao === 'ativo' && (
                  <span className="px-2 py-0.5 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-full border border-emerald-200">
                    Ativo
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Nome da Turma</label>
                <input
                  type="text"
                  value={turma.nome}
                  onChange={(e) => handleTurmaChange(turma.id, 'nome', e.target.value)}
                  className="w-full rounded-md border-slate-300 shadow-sm text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Curso</label>
                <select
                  value={turma.curso_id || ''}
                  onChange={(e) => handleTurmaChange(turma.id, 'curso_id', e.target.value || null)}
                  className="w-full rounded-md border-slate-300 shadow-sm text-sm"
                >
                  <option value="">Nenhum</option>
                  {availableCourses.map((c) => (
                    <option key={c.id} value={c.id} disabled={c.status_aprovacao === 'pendente' && !canApproveCourses}>
                      {c.nome} {c.status_aprovacao === 'pendente' && `(Pendente: ${c.status_aprovacao})`}
                    </option>
                  ))}
                </select>
                {turma.curso_id && availableCourses.find(c => c.id === turma.curso_id)?.status_aprovacao === 'pendente' && (
                    <p className="text-xs text-orange-700 mt-1">
                        O curso selecionado está pendente e precisa de aprovação do administrador.
                    </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Classe</label>
                <select
                  value={turma.classe_id || ''}
                  onChange={(e) => handleTurmaChange(turma.id, 'classe_id', e.target.value || null)}
                  className="w-full rounded-md border-slate-300 shadow-sm text-sm"
                >
                  <option value="">Nenhuma</option>
                  {availableClasses.map((cl) => (
                    <option key={cl.id} value={cl.id}>
                      {cl.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Turno</label>
                <input
                  type="text"
                  value={turma.turno || ''}
                  onChange={(e) => handleTurmaChange(turma.id, 'turno', e.target.value)}
                  className="w-full rounded-md border-slate-300 shadow-sm text-sm"
                />
              </div>
              
              {turma.status_validacao === 'rascunho' && (
                <button
                  onClick={() => handleTurmaChange(turma.id, 'status_validacao', 'ativo')}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 mt-2"
                >
                  <CheckCircle className="inline-block w-4 h-4 mr-2" /> Ativar Turma
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {(cursosToConfigure.length === 0 && turmasToConfigure.length === 0) && (
        <div className="text-center py-10 text-slate-500">
            Nenhuma estrutura para configurar nesta importação.
        </div>
      )}

      <div className="flex justify-between gap-3 pt-4 border-t border-slate-100">
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <button
          onClick={handleSaveConfiguration}
          disabled={loading}
          className={`
            inline-flex items-center justify-center gap-2
            rounded-lg px-4 py-2.5 text-sm font-medium
            bg-blue-600 text-white
            hover:bg-blue-700
            disabled:opacity-50 disabled:cursor-not-allowed
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            transition-colors
          `}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span>{loading ? "Salvando..." : "Salvar Configurações"}</span>
        </button>
      </div>
    </div>
  );
}
