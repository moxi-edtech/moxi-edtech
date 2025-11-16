"use client";

import { useEffect, useMemo, useState } from "react";
import TurmaForm from "./TurmaForm";
import DiretorForm from "./DiretorForm";
import Link from "next/link";

interface TurmaItem {
  id: string;
  nome: string;
  classe: string | null;
  turno: string;
  ano_letivo: string | null;
  professor: { nome: string | null; email: string | null };
  status_counts: Record<string, number>;
  total_alunos: number;
  ultima_matricula: string | null;
}

interface TurmasResponse {
  ok: boolean;
  items: TurmaItem[];
  total: number;
  stats: {
    totalTurmas: number;
    totalAlunos: number;
    porTurno: Array<{ turno: string; total: number }>;
  };
  error?: string;
}

const TURNO_LABELS: Record<string, string> = {
  Manhã: "Manhã",
  Tarde: "Tarde",
  Noite: "Noite",
  Integral: "Integral",
  "Sem turno": "Sem turno",
  sem_turno: "Sem turno",
};

export default function TurmasListClient() {
  const [turno, setTurno] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [data, setData] = useState<TurmasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showDiretorForm, setShowDiretorForm] = useState(false);
  const [selectedTurma, setSelectedTurma] = useState<TurmaItem | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (turno !== "todos") params.set("turno", turno);
      const res = await fetch(`/api/secretaria/turmas?${params.toString()}`, { cache: 'no-store' });
      const json = (await res.json()) as TurmasResponse;
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao carregar turmas');
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    if (mounted) {
      fetchData();
    }
    return () => { mounted = false };
  }, [turno]);

  const handleOpenDiretorForm = (turma: TurmaItem) => {
    setSelectedTurma(turma);
    setShowDiretorForm(true);
  };

  const filtrosTurno = useMemo(() => {
    const porTurno = data?.stats?.porTurno ?? [];
    const base = porTurno.map((item) => ({
      id: item.turno,
      label: TURNO_LABELS[item.turno] || item.turno,
      total: item.total,
    }));
    return [{ id: "todos", label: "Todos", total: data?.stats?.totalTurmas ?? 0 }, ...base];
  }, [data?.stats?.porTurno, data?.stats?.totalTurmas]);

  const itensFiltrados = useMemo(() => {
    const itens = data?.items ?? [];
    const lowerBusca = busca.trim().toLowerCase();
    return itens.filter((item) => {
      if (turno !== "todos" && (item.turno ?? 'sem_turno') !== turno) return false;
      if (!lowerBusca) return true;
      return (
        item.nome.toLowerCase().includes(lowerBusca) ||
        (item.classe || '').toLowerCase().includes(lowerBusca) ||
        (item.professor?.nome || '').toLowerCase().includes(lowerBusca) ||
        (item.professor?.email || '').toLowerCase().includes(lowerBusca)
      );
    });
  }, [data?.items, turno, busca]);

  if (loading && !data) {
    return <div className="p-6">Carregando turmas…</div>;
  }

  if (error) {
    return <div className="p-6 text-red-600">Erro ao carregar turmas: {error}</div>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-moxinexa-dark">Gestão de turmas</h1>
          <p className="text-sm text-moxinexa-gray">Acompanhe distribuição, diretoria de turma e progresso acadêmico.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => setShowCreateForm(true)}
            className="rounded-full border border-emerald-500/60 px-4 py-2 text-sm text-emerald-600 hover:bg-emerald-50 transition"
          >
            + Nova turma
          </button>
          <button className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition">Importar lista</button>
        </div>
      </header>

      {/* Aviso de responsabilidade */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
        A criação e edição de turmas é responsabilidade da Secretaria. Administradores da escola definem curso → classe → ano letivo → turno → sala, mas não criam turmas aqui.
      </div>

      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-semibold">Nova Turma</h2>
            <div className="mt-4">
              <TurmaForm onSuccess={() => {
                setShowCreateForm(false);
                fetchData();
              }} />
            </div>
          </div>
        </div>
      )}

      {showDiretorForm && selectedTurma && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-semibold">Definir Diretor para {selectedTurma.nome}</h2>
            <div className="mt-4">
              <DiretorForm turmaId={selectedTurma.id} onSuccess={() => {
                setShowDiretorForm(false);
                fetchData();
              }} />
            </div>
          </div>
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <HighlightCard title="Turmas ativas" value={data?.stats?.totalTurmas ?? 0} description="Estruturas prontas para alocação de estudantes." icon="🏫" />
        <HighlightCard title="Alunos vinculados" value={data?.stats?.totalAlunos ?? 0} description="Total de matrículas distribuídas nas turmas." icon="👩‍🎓" />
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Distribuição por turno</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {filtrosTurno.slice(1).map((item) => (
              <li key={item.id} className="flex items-center justify-between">
                <span>{item.label}</span>
                <span className="font-semibold">{item.total}</span>
              </li>
            ))}
            {filtrosTurno.length <= 1 && <li>Sem turnos cadastrados.</li>}
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {filtrosTurno.map((item) => {
              const isActive = turno === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setTurno(item.id)}
                  className={`rounded-full px-4 py-1.5 text-sm transition flex items-center gap-2 ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow'
                      : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>{item.label}</span>
                  <span
                    className={`rounded-full px-2 py-[2px] text-xs font-semibold ${
                      isActive ? 'bg-white/30 text-white/90' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {item.total}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar turma, classe, diretor ou e-mail"
              className="w-full rounded-full border border-slate-200 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 lg:w-72"
            />
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-3 pr-4">Turma</th>
                <th className="py-3 pr-4">Classe</th>
                <th className="py-3 pr-4">Diretor</th>
                <th className="py-3 pr-4">Turno</th>
                <th className="py-3 pr-4">Alunos</th>
                <th className="py-3 pr-4">Última movimentação</th>
                <th className="py-3 pr-4">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {itensFiltrados.map((item) => (
                <tr key={item.id} className="align-top">
                  <td className="py-3 pr-4">
                    <p className="font-semibold text-slate-800">{item.nome}</p>
                    <p className="text-xs text-slate-500">{item.ano_letivo ?? 'Ano letivo não informado'}</p>
                  </td>
                  <td className="py-3 pr-4 text-sm text-slate-700">{item.classe ?? 'N/A'}</td>
                  <td className="py-3 pr-4 text-sm text-slate-700">
                    {item.professor?.nome ? (
                      <div>
                        <p className="font-medium">{item.professor.nome}</p>
                        {item.professor.email && <p className="text-xs text-slate-500">{item.professor.email}</p>}
                      </div>
                    ) : (
                      <span className="text-xs text-amber-600">Sem diretor associado</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-xs text-slate-600">{TURNO_LABELS[item.turno] || item.turno}</td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(item.status_counts || {}).map(([status, total]) => {
                        const norm = normalizeStatus(status);
                        return (
                          <span key={status} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs ${norm.className}`}>
                            {norm.label}
                            <strong>{total}</strong>
                          </span>
                        );
                      })}
                      {Object.keys(item.status_counts || {}).length === 0 && (
                        <span className="text-xs text-slate-400">Sem matrículas</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-xs text-slate-500">
                    {item.ultima_matricula ? new Date(item.ultima_matricula).toLocaleString() : 'Sem registos'}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-col gap-2 text-xs">
                      <Link href={`/secretaria/matriculas?turma_id=${item.id}`} className="rounded-full border border-slate-200 px-3 py-1 text-slate-600 hover:border-emerald-500 hover:text-emerald-600 transition text-center">
                        Gerir alunos
                      </Link>
                      <button 
                        onClick={() => handleOpenDiretorForm(item)}
                        className="rounded-full border border-slate-200 px-3 py-1 text-slate-600 hover:border-emerald-500 hover:text-emerald-600 transition"
                      >
                        Definir diretor
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {itensFiltrados.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-slate-500">Nenhuma turma corresponde aos filtros atuais.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function HighlightCard({ title, value, description, icon }: { title: string; value: number; description: string; icon: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-3xl" aria-hidden>{icon}</div>
      <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="text-3xl font-bold text-slate-900">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function normalizeStatus(status: string) {
  const value = (status || '').toLowerCase();
  if (["ativa", "ativo", "active"].includes(value)) return { label: "Ativos", className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' };
  if (["concluida", "concluido", "graduado"].includes(value)) return { label: "Concluídos", className: 'bg-slate-100 text-slate-600 border border-slate-200' };
  if (["transferido", "transferida"].includes(value)) return { label: "Transferidos", className: 'bg-blue-100 text-blue-700 border border-blue-200' };
  if (["pendente", "aguardando"].includes(value)) return { label: "Pendentes", className: 'bg-amber-100 text-amber-700 border border-amber-200' };
  if (["trancado", "suspenso", "desistente", "inativo"].includes(value)) return { label: "Irregulares", className: 'bg-rose-100 text-rose-700 border border-rose-200' };
  return { label: status || 'Outros', className: 'bg-slate-50 text-slate-600 border border-slate-200' };
}
