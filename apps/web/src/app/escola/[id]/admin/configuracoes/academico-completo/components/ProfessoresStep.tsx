"use client";

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { type Course, type Teacher } from '@/types/academico.types';
import { StepHeader } from './StepHeader';

type Props = {
  escolaId: string;
  cursos: Course[];
  professores: Teacher[];
  onCursosAtualizados: (cursos: Course[]) => void;
};

export default function ProfessoresStep({ escolaId, cursos, professores, onCursosAtualizados }: Props) {
  const [atribuicoes, setAtribuicoes] = useState<Record<string, string>>({});

  useEffect(() => {
    const inicial = cursos.reduce((acc, curso) => {
      if (curso.professor_id) acc[curso.id] = curso.professor_id;
      return acc;
    }, {} as Record<string, string>);
    setAtribuicoes(inicial);
  }, [cursos]);

  const handleAtribuir = async (cursoId: string, professorId: string) => {
    const originalProfessorId = atribuicoes[cursoId] || "";
    setAtribuicoes(prev => ({ ...prev, [cursoId]: professorId })); // Otimista

    try {
      const res = await fetch(`/api/escolas/${escolaId}/cursos/${cursoId}/professor`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ professor_id: professorId || null }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Falha ao atribuir.");
      onCursosAtualizados(cursos.map(c => c.id === cursoId ? result.data : c));
      toast.success("Professor atribuído!");
    } catch (error: any) {
      toast.error(error.message);
      setAtribuicoes(prev => ({ ...prev, [cursoId]: originalProfessorId })); // Reverte
    }
  };

  const cursosSemProfessor = cursos.filter(c => !c.professor_id).length;

  return (
    <div className="space-y-8">
      <StepHeader icone={<span className="text-3xl">👨‍🏫</span>} titulo="Atribuir Professores" descricao="Associe cada curso a um professor responsável." />
      {cursos.length === 0 ? <p className="text-center text-gray-600 py-10">Crie cursos para poder atribuir professores.</p> : professores.length === 0 ? <p className="text-center text-gray-600 py-10">Cadastre professores para poder fazer as atribuições.</p> : (
        <div className="space-y-6">
          <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg text-center">
            <p className="text-2xl font-bold text-teal-600">{cursosSemProfessor}</p>
            <p className="text-sm text-teal-800">curso(s) sem professor atribuído</p>
          </div>
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
            {cursos.map(curso => (
              <div key={curso.id} className="flex flex-col sm:flex-row items-center justify-between p-4 border rounded-lg">
                <div className="flex-1 mb-3 sm:mb-0">
                  <p className="font-medium text-gray-800">{curso.nome}</p>
                  <p className="text-sm text-gray-500">{professores.find(p => p.id === atribuicoes[curso.id])?.nome || 'Sem professor'}</p>
                </div>
                <select value={atribuicoes[curso.id] || ""} onChange={(e) => handleAtribuir(curso.id, e.target.value)} className="w-full sm:w-auto p-2 border border-gray-300 rounded-lg min-w-48">
                  <option value="">-- Remover Professor --</option>
                  {professores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

