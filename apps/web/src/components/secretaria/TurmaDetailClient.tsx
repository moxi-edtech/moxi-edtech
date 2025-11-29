"use client";

import { useEffect, useState } from "react";
import { Loader2, Download, List, User, Users, BookOpen, Book, UserCheck } from "lucide-react";
import Link from "next/link";

type Aluno = {
  numero: number;
  matricula_id: string;
  aluno_id: string;
  nome: string;
  bi: string;
  naturalidade: string;
  provincia: string;
  telefone: string;
  encarregado: string;
  telefone_encarregado: string;
  status_matricula: string;
};

type TurmaData = {
  turma: {
    id: string;
    nome: string;
    codigo: string | null;
    classe: string | null;
    turno: string | null;
    sala: string | null;
    escola_nome: string | null;
    diretor_turma_id?: string | null;
  };
  total: number;
  alunos: Aluno[];
};

type Disciplina = {
    id: string;
    disciplina: {
        id: string;
        nome: string;
    };
    professor: {
        id: string;
        nome: string;
        email: string;
    };
    vinculos: {
        horarios: boolean;
        notas: boolean;
        presencas: boolean;
        planejamento: boolean;
    }
};

type Professor = {
    id: string;
    nome: string;
};

export default function TurmaDetailClient({ turmaId }: { turmaId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TurmaData | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [loadingDisciplinas, setLoadingDisciplinas] = useState(false);
  const [showDisciplinas, setShowDisciplinas] = useState(false);
  const [professores, setProfessores] = useState<Professor[]>([]);
  const [diretorTurmaId, setDiretorTurmaId] = useState<string | null>(null);
  const [showDiretorForm, setShowDiretorForm] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [turmaRes, profsRes] = await Promise.all([
            fetch(`/api/secretaria/turmas/${turmaId}/alunos/lista`),
            fetch("/api/secretaria/professores")
        ]);
        const [turmaJson, profsJson] = await Promise.all([
            turmaRes.json(),
            profsRes.json()
        ]);
        if (!turmaRes.ok || !turmaJson.ok) {
          throw new Error(turmaJson.error || "Falha ao carregar dados da turma");
        }
        setData(turmaJson);
        setDiretorTurmaId(turmaJson.turma.diretor_turma_id);

        if (profsJson.ok) {
            setProfessores(profsJson.items);
        }

      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro desconhecido");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [turmaId]);

  const loadDisciplinas = async () => {
    setLoadingDisciplinas(true);
    try {
        const res = await fetch(`/api/secretaria/turmas/${turmaId}/disciplinas`);
        const json = await res.json();
        if (!res.ok || !json.ok) {
            throw new Error(json.error || "Falha ao carregar disciplinas");
        }
        setDisciplinas(json.items);
    } catch (e) {
        setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
        setLoadingDisciplinas(false);
    }
  };

  const handleUpdateDiretor = async () => {
    try {
      const res = await fetch(`/api/secretaria/turmas/${turmaId}/diretor`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diretor_turma_id: diretorTurmaId }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Falha ao atualizar diretor da turma");
      }
      setShowDiretorForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 p-6">
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <h1 className="text-2xl font-bold text-moxinexa-navy">{data?.turma.nome ?? "Carregando..."}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {data?.turma.escola_nome ?? ""}
        </p>
      </div>

      {loading && (
        <div className="text-center p-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-moxinexa-teal" />
          <p className="text-slate-500 mt-2">Carregando...</p>
        </div>
      )}

      {error && <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">{error}</div>}
      
      {!loading && !error && data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-50 text-blue-600"><Users /></div>
                <div>
                  <div className="text-2xl font-bold text-slate-900">{data.total}</div>
                  <div className="text-sm text-slate-600">Alunos na Turma</div>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-50 text-green-600"><BookOpen /></div>
                <div>
                  <div className="text-lg font-bold text-slate-900">{data.turma.classe}</div>
                  <div className="text-sm text-slate-600">Classe</div>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-orange-50 text-orange-600">{data.turma.turno}</div>
                    <div>
                        <div className="text-lg font-bold text-slate-900">{data.turma.turno}</div>
                        <div className="text-sm text-slate-600">Turno</div>
                    </div>
                </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 text-moxinexa-navy">Alunos da Turma</h2>
            <div className="flex gap-4">
              <a href={`/api/secretaria/turmas/${turmaId}/alunos/lista?format=pdf`} target="_blank" rel="noopener noreferrer" className="bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 flex items-center gap-2">
                <Download className="h-4 w-4" />
                Baixar PDF
              </a>
              <button onClick={() => setShowTable(!showTable)} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2">
                <List className="h-4 w-4" />
                {showTable ? "Ocultar" : "Mostrar"} Alunos
              </button>
            </div>

            {showTable && (
              <div className="overflow-x-auto mt-6">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Nº</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Nome</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">BI</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Encarregado</th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Telefone</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.alunos.map((aluno) => (
                      <tr key={aluno.aluno_id}>
                        <td className="px-4 py-4 text-slate-600">{aluno.numero}</td>
                        <td className="px-4 py-4 text-slate-900 font-medium">{aluno.nome}</td>
                        <td className="px-4 py-4 text-slate-600">{aluno.bi}</td>
                        <td className="px-4 py-4 text-slate-600">{aluno.encarregado}</td>
                        <td className="px-4 py-4 text-slate-600">{aluno.telefone_encarregado || aluno.telefone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 text-moxinexa-navy">Disciplinas da Turma</h2>
            <div className="flex gap-4">
                <button onClick={() => {
                    if (!showDisciplinas) {
                        loadDisciplinas();
                    }
                    setShowDisciplinas(!showDisciplinas)
                }} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2">
                    <Book className="h-4 w-4" />
                    {showDisciplinas ? "Ocultar" : "Mostrar"} Disciplinas
                </button>
            </div>
            {loadingDisciplinas && <div className="mt-4">Carregando...</div>}
            {showDisciplinas && !loadingDisciplinas && (
                <div className="overflow-x-auto mt-6">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Disciplina</th>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Professor</th>
                                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Vínculos</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {disciplinas.map((disciplina) => (
                                <tr key={disciplina.id}>
                                    <td className="px-4 py-4 text-slate-900 font-medium">{disciplina.disciplina.nome}</td>
                                    <td className="px-4 py-4 text-slate-600">{disciplina.professor.nome}</td>
                                    <td className="px-4 py-4 text-slate-600">
                                        {disciplina.vinculos.horarios && <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold bg-green-100 text-green-700">Horários</span>}
                                        {disciplina.vinculos.notas && <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold bg-green-100 text-green-700">Notas</span>}
                                        {disciplina.vinculos.presencas && <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold bg-green-100 text-green-700">Presenças</span>}
                                        {disciplina.vinculos.planejamento && <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold bg-green-100 text-green-700">Planejamento</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
          </div>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 text-moxinexa-navy">Diretor da Turma</h2>
            <div className="flex gap-4">
                <button onClick={() => setShowDiretorForm(!showDiretorForm)} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2">
                    <UserCheck className="h-4 w-4" />
                    {showDiretorForm ? "Ocultar" : "Alterar"} Diretor
                </button>
            </div>
            {showDiretorForm && (
                <div className="mt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="diretor" className="block text-sm font-medium text-gray-700">
                                Diretor
                            </label>
                            <select
                                id="diretor"
                                value={diretorTurmaId ?? ""}
                                onChange={(e) => setDiretorTurmaId(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                            >
                                <option value="">Selecione um diretor</option>
                                {professores.map((professor) => (
                                    <option key={professor.id} value={professor.id}>
                                    {professor.nome}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                        <button onClick={handleUpdateDiretor} className="bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700">
                            Salvar
                        </button>
                    </div>
                </div>
            )}
            </div>
        </>
      )}
    </div>
  );
}
