"use client";

import { useState, useEffect } from "react";

interface Event {
  id: string;
  titulo: string;
  descricao: string;
  inicio_at: string;
  fim_at: string;
  publico_alvo: string;
}

export default function CalendarioPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [inicioAt, setInicioAt] = useState("");
  const [fimAt, setFimAt] = useState("");
  const [publicoAlvo, setPublicoAlvo] = useState("");

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/secretaria/calendario");
      const json = await res.json();
      if (json.ok) {
        setEvents(json.items);
      }
    } catch (e) {
      setError("Falha ao carregar eventos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/secretaria/calendario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo,
          descricao,
          inicio_at: inicioAt,
          fim_at: fimAt,
          publico_alvo: publicoAlvo,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Falha ao criar evento");
      }

      fetchEvents(); // Refresh the list
      // Reset form
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
    <div className="bg-white rounded-xl shadow border p-5 space-y-6">
      <h1 className="text-lg font-semibold">Calendário Acadêmico</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-md font-semibold mb-4">Novo Evento</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="titulo" className="block text-sm font-medium text-gray-700">
                Título
              </label>
              <input
                type="text"
                id="titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                required
              />
            </div>
            <div>
              <label htmlFor="descricao" className="block text-sm font-medium text-gray-700">
                Descrição
              </label>
              <textarea
                id="descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="inicioAt" className="block text-sm font-medium text-gray-700">
                  Início
                </label>
                <input
                  type="datetime-local"
                  id="inicioAt"
                  value={inicioAt}
                  onChange={(e) => setInicioAt(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                  required
                />
              </div>
              <div>
                <label htmlFor="fimAt" className="block text-sm font-medium text-gray-700">
                  Fim
                </label>
                <input
                  type="datetime-local"
                  id="fimAt"
                  value={fimAt}
                  onChange={(e) => setFimAt(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                />
              </div>
            </div>
            <div>
              <label htmlFor="publicoAlvo" className="block text-sm font-medium text-gray-700">
                Público Alvo
              </label>
              <select
                id="publicoAlvo"
                value={publicoAlvo}
                onChange={(e) => setPublicoAlvo(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
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
                type="submit"
                disabled={loading}
                className="inline-flex justify-center rounded-md border border-transparent bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {loading ? "Salvando..." : "Salvar Evento"}
              </button>
            </div>
          </form>
        </div>
        <div>
          <h2 className="text-md font-semibold mb-4">Eventos Agendados</h2>
          {loading && <p>Carregando...</p>}
          <ul className="space-y-4">
            {events.map((event) => (
              <li key={event.id} className="p-4 border rounded-md">
                <p className="font-semibold">{event.titulo}</p>
                <p className="text-sm text-gray-600">{event.descricao}</p>
                <p className="text-xs text-gray-500 mt-2">
                  De: {new Date(event.inicio_at).toLocaleString()}
                </p>
                {event.fim_at && (
                  <p className="text-xs text-gray-500">
                    Até: {new Date(event.fim_at).toLocaleString()}
                  </p>
                )}
                {event.publico_alvo && (
                  <p className="text-xs text-gray-500 mt-1">
                    Público: {event.publico_alvo}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
