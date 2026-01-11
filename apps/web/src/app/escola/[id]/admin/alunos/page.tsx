"use client";

import React, { use, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, Search, Filter, UserPlus, Archive, RotateCcw, Trash2, Edit } from "lucide-react";

type Aluno = {
  id: string;
  nome: string | null;
  email: string | null;
  numero_login: string | null;
  created_at: string;
  status?: string | null;
  origem?: "aluno" | "candidatura" | null;
  aluno_id?: string | null;
};

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id: escolaId } = use(params);

  const [tab, setTab] = useState<"ativos" | "arquivados">("ativos");
  const [q, setQ] = useState("");
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, startCreateTransition] = useTransition();
  const [invite, setInvite] = useState({ nome: "", email: "" });

  async function fetchAlunos() {
    setLoading(true);
    try {
      const url = new URL(`/api/escolas/${escolaId}/admin/alunos`, window.location.origin);
      url.searchParams.set("status", tab === "ativos" ? "active" : "archived");
      if (q.trim()) url.searchParams.set("q", q.trim());
      const res = await fetch(url.toString(), { cache: "force-cache" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Falha ao listar");
      setAlunos(json.items || []);
    } catch (e) {
      console.error(e);
      setAlunos([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAlunos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAlunos();
  };

  async function archiveAluno(id: string) {
    if (!confirm("Arquivar este aluno?")) return;
    const res = await fetch(`/api/secretaria/alunos/${id}/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Arquivado via Admin" }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) alert(json.error || "Falha ao arquivar");
    await fetchAlunos();
  }

  async function restoreAluno(id: string) {
    if (!confirm("Restaurar este aluno?")) return;
    const res = await fetch(`/api/secretaria/alunos/${id}/restore`, { method: "POST" });
    const json = await res.json();
    if (!res.ok || !json.ok) alert(json.error || "Falha ao restaurar");
    await fetchAlunos();
  }

  async function hardDeleteAluno(id: string) {
    if (!confirm("Excluir PERMANENTEMENTE este aluno? Esta ação não pode ser desfeita.")) return;
    const res = await fetch(`/api/secretaria/alunos/${id}/hard-delete`, { method: "POST" });
    const json = await res.json();
    if (!res.ok || !json.ok) alert(json.error || "Falha ao excluir");
    await fetchAlunos();
  }

  function submitInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!invite.nome.trim() || !invite.email.trim()) {
      alert("Informe nome e e-mail");
      return;
    }
    startCreateTransition(async () => {
      const res = await fetch(`/api/escolas/${escolaId}/usuarios/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: invite.nome.trim(), email: invite.email.trim(), papel: "aluno" }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        alert(json.error || "Falha ao criar aluno");
        return;
      }
      setInvite({ nome: "", email: "" });
      if (tab !== "ativos") setTab("ativos");
      fetchAlunos();
    });
  }

  const title = useMemo(() => (tab === "ativos" ? "Alunos Ativos" : "Alunos Arquivados"), [tab]);
  const totalAlunos = alunos.length;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 p-6 bg-slate-50 rounded-xl">
      {/* --- HEADER COM MÉTRICAS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-moxinexa-navy">{totalAlunos}</div>
          <div className="text-sm text-slate-500">
            {tab === "ativos" ? "Alunos Ativos" : "Alunos Arquivados"}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-orange-600">
            {alunos.filter(a => a.email).length}
          </div>
          <div className="text-sm text-slate-500">Com E-mail Cadastrado</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-2xl font-bold text-moxinexa-teal">
            {alunos.filter(a => a.numero_login).length}
          </div>
          <div className="text-sm text-slate-500">Com Número de Login</div>
        </div>
      </div>

      {/* --- HEADER DE AÇÃO --- */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-moxinexa-navy flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${tab === "ativos" ? "bg-green-500" : "bg-amber-500"}`} />
            {title}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {totalAlunos} alunos {tab === "ativos" ? "ativos" : "arquivados"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setTab(tab === "ativos" ? "arquivados" : "ativos")}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-all"
          >
            {tab === "ativos" ? <Archive className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
            {tab === "ativos" ? "Ver Arquivados" : "Ver Ativos"}
          </button>
        </div>
      </div>

      {/* --- FORMULÁRIO DE ADIÇÃO (APENAS ATIVOS) --- */}
      {tab === "ativos" && (
        <form onSubmit={submitInvite} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-moxinexa-navy mb-4 flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-moxinexa-teal" />
            Adicionar Novo Aluno
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <input
                className="w-full border border-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-moxinexa-teal"
                placeholder="Nome completo do aluno"
                value={invite.nome}
                onChange={(e) => setInvite((v) => ({ ...v, nome: e.target.value }))}
              />
            </div>
            <div>
              <input
                className="w-full border border-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-moxinexa-teal"
                placeholder="E-mail"
                type="email"
                value={invite.email}
                onChange={(e) => setInvite((v) => ({ ...v, email: e.target.value }))}
              />
            </div>
            <div>
              <button 
                disabled={creating} 
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-moxinexa-teal px-5 py-3 text-sm font-bold text-white hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-teal-900/20 transition-all"
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                {creating ? "Criando..." : "Adicionar Aluno"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* --- FILTROS E PESQUISA --- */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome, número de login ou ID..."
            className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-moxinexa-teal"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && onSearch(e)}
          />
        </div>
        <button 
          type="submit"
          onClick={onSearch}
          className="px-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center gap-2 text-sm font-medium"
        >
          <Search className="h-4 w-4" /> Buscar
        </button>
        <button className="px-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center gap-2 text-sm font-medium">
          <Filter className="h-4 w-4" /> Filtros
        </button>
      </div>

      {/* --- TABELA DE ALUNOS --- */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Número / ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Aluno
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  E-mail
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Data de Criação
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                  Ações
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    Carregando alunos...
                  </td>
                </tr>
              ) : alunos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    Nenhum aluno {tab === "ativos" ? "ativo" : "arquivado"} encontrado.
                  </td>
                </tr>
              ) : (
                alunos.map((aluno) => (
                  <tr key={aluno.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-4 font-mono text-slate-700">
                      {aluno.numero_login || (
                        <span className="text-slate-400 text-xs">Sem número</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-900">
                      <div className="font-bold text-moxinexa-navy">
                        {aluno.nome || "—"}
                      </div>
                      {aluno.origem === "candidatura" && (
                        <div className="text-[10px] uppercase font-semibold text-amber-600">Lead</div>
                      )}
                      <div className="text-xs text-slate-500 font-mono">
                        {aluno.id.slice(0, 8)}...
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {aluno.email ? (
                        <span className="text-slate-700">{aluno.email}</span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(aluno.created_at).toLocaleDateString('pt-AO')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-2">
                        {aluno.origem === "aluno" && tab === "ativos" ? (
                          <>
                            <Link 
                              href={`/escola/${escolaId}/admin/alunos/${aluno.id}`}
                              className="text-moxinexa-teal hover:text-white hover:bg-moxinexa-teal p-2 rounded-lg transition-all"
                              title="Editar aluno"
                            >
                              <Edit className="w-4 h-4" />
                            </Link>
                            <button
                              onClick={() => archiveAluno(aluno.id)}
                              className="text-amber-600 hover:text-white hover:bg-amber-600 p-2 rounded-lg transition-all"
                              title="Arquivar aluno"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          </>
                        ) : aluno.origem === "aluno" ? (
                          <>
                            <button
                              onClick={() => restoreAluno(aluno.id)}
                              className="text-green-600 hover:text-white hover:bg-green-600 p-2 rounded-lg transition-all"
                              title="Restaurar aluno"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => hardDeleteAluno(aluno.id)}
                              className="text-red-600 hover:text-white hover:bg-red-600 p-2 rounded-lg transition-all"
                              title="Excluir permanentemente"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
