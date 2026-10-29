"use client";

import React, { useState, useEffect } from "react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

interface Event {
  id: string;
  nome: string;
  descricao: string;
  data_inicio: string;
  data_fim: string;
  tipo: string;
  publico_alvo: string;
  cor_hex?: string;
  offering_id?: string | null;
  curso_nome?: string | null;
}

interface AcademicYear {
  id: string;
  ano: number;
  ativo?: boolean | null;
  data_inicio: string;
  data_fim: string;
}

export default function CalendarioPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [courseOfferings, setCourseOfferings] = useState<Array<{
    course_id: string; offering_id: string; nome: string; subsistema: string;
  }>>([]);

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [inicioAt, setInicioAt] = useState("");
  const [fimAt, setFimAt] = useState("");
  const [publicoAlvo, setPublicoAlvo] = useState("");

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedYearId) params.set("ano_letivo_id", selectedYearId);
      if (selectedCourseId) params.set("curso_id", selectedCourseId);
      const query = params.size ? `?${params.toString()}` : "";
      const res = await fetch(`/api/secretaria/calendario${query}`, { cache: "no-store" });
      const json = await res.json();
      if (json.ok) {
        setEvents(json.items);
        setYears(json.anos_letivos || []);
        setCourseOfferings(json.course_offerings || []);
        setError(null);
        if (!selectedYearId && json.ano_letivo?.id) setSelectedYearId(json.ano_letivo.id);
      } else {
        setError(json.error || "Falha ao carregar calendário académico.");
      }
    } catch (e) {
      setError("Falha ao carregar eventos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [selectedYearId, selectedCourseId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/secretaria/calendario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo, // API POST expects 'titulo' for legacy reasons or we can update it
          descricao,
          inicio_at: inicioAt,
          fim_at: fimAt,
          publico_alvo: publicoAlvo,
          ano_letivo_id: selectedYearId,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Falha ao criar evento");
      }

      fetchEvents(); 
      setTitulo("");
      setDescricao("");
      setInicioAt("");
      setFimAt("");
      setPublicoAlvo("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background rounded-xl shadow border p-5 space-y-6">
      <DashboardHeader
        title="Calendário Unificado da Escola"
        description="Visualização de eventos genéricos e calendário académico (MED)."
        breadcrumbs={[
          { label: "Início", href: "/" },
          { label: "Secretaria", href: "/secretaria" },
          { label: "Calendário" },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">Contexto académico</p>
          <p className="text-xs font-semibold text-foreground">
            Um calendário oficial por ano. Eventos específicos identificados pelo curso.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedCourseId}
            onChange={(event) => setSelectedCourseId(event.target.value)}
            aria-label="Filtrar calendário por curso"
            className="rounded-lg border border-blue-200 bg-background px-3 py-2 text-xs font-bold text-foreground"
          >
            <option value="">Todos os cursos (visão administrativa)</option>
            {[...new Map(courseOfferings.map((item) => [item.course_id, item])).values()]
              .sort((a, b) => a.nome.localeCompare(b.nome, "pt"))
              .map((item) => <option key={item.course_id} value={item.course_id}>{item.nome}</option>)}
          </select>
        <select
          value={selectedYearId ?? ""}
          onChange={(event) => setSelectedYearId(event.target.value || null)}
          className="rounded-lg border border-blue-200 bg-background px-3 py-2 text-xs font-bold text-foreground"
        >
          {years.map((year) => <option key={year.id} value={year.id}>{year.ano}/{year.ano + 1}{year.ativo ? " · ativo" : ""}</option>)}
        </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-md font-semibold mb-4">Novo Evento Geral</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="titulo" className="block text-sm font-medium text-foreground">Título</label>
              <input
                type="text" id="titulo" value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className="mt-1 block w-full rounded-md border-border shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                required
              />
            </div>
            <div>
              <label htmlFor="descricao" className="block text-sm font-medium text-foreground">Descrição</label>
              <textarea
                id="descricao" value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={3}
                className="mt-1 block w-full rounded-md border-border shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="inicioAt" className="block text-sm font-medium text-foreground">Início</label>
                <input
                  type="datetime-local" id="inicioAt" value={inicioAt}
                  onChange={(e) => setInicioAt(e.target.value)}
                  className="mt-1 block w-full rounded-md border-border shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                  required
                />
              </div>
              <div>
                <label htmlFor="fimAt" className="block text-sm font-medium text-foreground">Fim</label>
                <input
                  type="datetime-local" id="fimAt" value={fimAt}
                  onChange={(e) => setFimAt(e.target.value)}
                  className="mt-1 block w-full rounded-md border-border shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                />
              </div>
            </div>
            <div>
              <label htmlFor="publicoAlvo" className="block text-sm font-medium text-foreground">Público Alvo</label>
              <select
                id="publicoAlvo" value={publicoAlvo}
                onChange={(e) => setPublicoAlvo(e.target.value)}
                className="mt-1 block w-full rounded-md border-border shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
              >
                <option value="">Todos</option>
                <option value="alunos">Alunos</option>
                <option value="professores">Professores</option>
                <option value="responsaveis">Encarregados</option>
              </select>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end">
              <button
                type="submit" disabled={loading}
                className="inline-flex justify-center rounded-md border border-transparent bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading ? "Salvando..." : "Salvar Evento"}
              </button>
            </div>
          </form>
        </div>

        <div>
          <h2 className="text-md font-semibold mb-4">Eventos e Datas Importantes</h2>
          {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {!loading && events.length === 0 && <p className="text-sm text-muted-foreground">Nenhum evento agendado.</p>}
          <ul className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
            {events.map((event) => (
              <li key={event.id} className="p-4 border rounded-xl bg-muted/50 hover:bg-background transition-colors relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: event.cor_hex || '#64748b' }} />
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-foreground">{event.nome}</p>
                    <p className="text-xs text-muted-foreground mt-1">{event.descricao}</p>
                    {event.offering_id && (
                      <p className="mt-1 text-xs font-semibold text-amber-700">
                        Aplicável ao curso: {event.curso_nome || "Curso"}
                      </p>
                    )}
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${event.tipo === 'EVENTO_GERAL' ? 'bg-muted text-muted-foreground' : 'bg-amber-100 text-amber-700'}`}>
                    {event.tipo.replace('_', ' ')}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-4 text-[10px] font-medium text-muted-foreground">
                  <span className="flex items-center gap-1">📅 {new Date(event.data_inicio).toLocaleDateString('pt-PT')}</span>
                  {event.data_fim && event.data_fim !== event.data_inicio && (
                    <span className="flex items-center gap-1">🏁 Até {new Date(event.data_fim).toLocaleDateString('pt-PT')}</span>
                  )}
                  <span className="flex items-center gap-1 ml-auto">
                    👥 {event.offering_id ? "Curso" : (event.publico_alvo || "Todos")}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
