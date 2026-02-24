"use client";

import { use, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, ArrowLeft, Save, User, Phone, Users, Shield } from "lucide-react";
import { Skeleton } from "@/components/feedback/FeedbackSystem";

type Aluno = {
  id: string;
  nome: string | null;
  responsavel: string | null;
  telefone_responsavel: string | null;
  status: string | null;
  created_at: string;
};

export default function AlunoEditPage({ params }: { params: Promise<{ id: string; alunoId: string }> }) {
  const { id: escolaId, alunoId } = use(params);
  const router = useRouter();
  const [aluno, setAluno] = useState<Aluno | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, startSaving] = useTransition();

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/secretaria/alunos/${encodeURIComponent(alunoId)}`);
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Falha ao carregar");
      const item = json.item as any;
      if (!item) throw new Error("Aluno não encontrado");
      setAluno({
        id: item.id,
        nome: item.nome ?? null,
        responsavel: item.responsavel ?? null,
        telefone_responsavel: item.telefone_responsavel ?? null,
        status: item.status ?? null,
        created_at: item.created_at ?? new Date().toISOString(),
      });
    } catch (e) {
      console.error(e);
      setAluno(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load();   }, []);

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!aluno) return;
    startSaving(async () => {
      const res = await fetch(`/api/secretaria/alunos/${alunoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          nome: aluno.nome, 
          responsavel: aluno.responsavel, 
          telefone_responsavel: aluno.telefone_responsavel, 
          status: aluno.status 
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) { 
        alert(json.error || "Falha ao salvar"); 
        return; 
      }
      router.push(`/escola/${escolaId}/admin/alunos`);
    });
  }

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto p-6 bg-slate-50 rounded-xl">
        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-center">
          <div className="space-y-2">
            <Skeleton className="h-4 w-40 mx-auto" />
            <Skeleton className="h-3 w-56 mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  if (!aluno) {
    return (
      <div className="w-full max-w-4xl mx-auto p-6 bg-slate-50 rounded-xl">
        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-center">
          <div className="text-red-500 text-lg font-semibold mb-2">Aluno não encontrado</div>
          <div className="text-slate-600 mb-4">O aluno solicitado não foi encontrado no sistema.</div>
          <button 
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'ativo': return 'bg-emerald-100 text-emerald-700';
      case 'pendente': return 'bg-amber-100 text-amber-700';
      case 'inativo': return 'bg-slate-100 text-slate-700';
      case 'suspenso': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'ativo': return '🟢';
      case 'pendente': return '🟡';
      case 'inativo': return '⚫';
      case 'suspenso': return '🔴';
      default: return '⚪';
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 p-6 bg-slate-50 rounded-xl">
      {/* --- HEADER DE AÇÃO --- */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-moxinexa-navy flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-moxinexa-teal" />
            Editar Aluno
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Atualize as informações do aluno no sistema
            {aluno.nome && ` • ${aluno.nome}`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>
        </div>
      </div>

      {/* --- CARDS DE INFORMAÇÕES --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-sm text-slate-500 flex items-center gap-2 mb-1">
            <User className="h-4 w-4" />
            ID do Aluno
          </div>
          <div className="font-mono text-sm text-slate-700 bg-slate-50 p-2 rounded">
            {aluno.id}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-sm text-slate-500 flex items-center gap-2 mb-1">
            <Calendar className="h-4 w-4" />
            Cadastrado em
          </div>
          <div className="text-sm text-slate-700">
            {new Date(aluno.created_at).toLocaleDateString('pt-AO')}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-sm text-slate-500 flex items-center gap-2 mb-1">
            <Shield className="h-4 w-4" />
            Status Atual
          </div>
          <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${getStatusColor(aluno.status)}`}>
            {getStatusIcon(aluno.status)} {aluno.status || 'Não definido'}
          </div>
        </div>
      </div>

      {/* --- FORMULÁRIO DE EDIÇÃO --- */}
      <form onSubmit={save} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Coluna 1 */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <User className="h-4 w-4" />
                Nome do Aluno
              </label>
              <input 
                className="w-full border border-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all"
                value={aluno.nome ?? ""} 
                onChange={(e) => setAluno((v) => v ? { ...v, nome: e.target.value } : v)}
                placeholder="Digite o nome completo do aluno"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Nome do Responsável
              </label>
              <input 
                className="w-full border border-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all"
                value={aluno.responsavel ?? ""} 
                onChange={(e) => setAluno((v) => v ? { ...v, responsavel: e.target.value } : v)}
                placeholder="Digite o nome do responsável"
              />
            </div>
          </div>

          {/* Coluna 2 */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Telefone do Responsável
              </label>
              <input 
                className="w-full border border-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all"
                value={aluno.telefone_responsavel ?? ""} 
                onChange={(e) => setAluno((v) => v ? { ...v, telefone_responsavel: e.target.value } : v)}
                placeholder="Digite o telefone de contato"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Status do Aluno
              </label>
              <select 
                className="w-full border border-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-moxinexa-teal focus:border-transparent transition-all"
                value={aluno.status ?? ""} 
                onChange={(e) => setAluno((v) => v ? { ...v, status: e.target.value } : v)}
              >
                <option value="">Selecione um status</option>
                <option value="pendente">Pendente</option>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
                <option value="suspenso">Suspenso</option>
              </select>
            </div>
          </div>
        </div>

        {/* BOTÕES DE AÇÃO */}
        <div className="flex gap-3 pt-4 border-t border-slate-100">
          <button 
            type="submit" 
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-moxinexa-teal px-6 py-3 text-sm font-bold text-white hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-teal-900/20 transition-all active:scale-95 transform hover:-translate-y-0.5"
          >
            {saving ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Salvando..." : "Salvar Alterações"}
          </button>
          
          <button 
            type="button" 
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
            Cancelar
          </button>
        </div>
      </form>

      {/* --- INFORMAÇÕES ADICIONAIS --- */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="text-sm text-slate-600">
          <p className="flex items-center gap-2">
            <span className="font-bold">💡 Dica:</span> 
            Mantenha os dados do aluno sempre atualizados para uma gestão eficiente.
          </p>
        </div>
      </div>
    </div>
  );
}

// Componente Calendar para ícone
const Calendar = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);
