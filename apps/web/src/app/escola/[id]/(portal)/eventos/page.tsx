"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useEscolaId } from "@/hooks/useEscolaId";
import { useToast } from "@/components/feedback/FeedbackSystem";

type Evento = {
  id: string;
  titulo: string;
  inicio_at: string;
  fim_at: string | null;
  descricao?: string | null;
  publico_alvo: string;
};

function cid() {
  return Math.random().toString(36).slice(2, 9);
}
function pad(n: number) {
  return String(n).padStart(2, "0");
}
function fmtDateTime(dt: Date) {
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(
    dt.getDate()
  )}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export default function EventosPage() {
  const { escolaId } = useEscolaId();
  const { success, error } = useToast();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Evento | null>(null);

  const [formData, setFormData] = useState<Partial<Evento>>({
    titulo: "",
    inicio_at: new Date().toISOString(),
    fim_at: null,
    descricao: "",
    publico_alvo: "todos",
  });

  useEffect(() => {
    if (!escolaId) return;
    (async () => {
      const res = await fetch(`/api/escolas/${escolaId}/admin/eventos`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        setEventos(json.items || []);
      }
    })();
  }, [escolaId]);

  function abrirCriar() {
    setEditing(null);
    setFormData({
      titulo: "",
      inicio_at: new Date().toISOString(),
      fim_at: null,
      descricao: "",
      publico_alvo: "todos",
    });
    setModalAberto(true);
  }

  function abrirEditar(ev: Evento) {
    setEditing(ev);
    setFormData(ev);
    setModalAberto(true);
  }

  async function salvarEvento() {
    if (!escolaId) {
      error("Escola não identificada.");
      return;
    }
    if (!formData.titulo || !formData.inicio_at) return;

    setLoading(true);
    try {
      if (formData.fim_at && formData.inicio_at >= formData.fim_at) {
        error("O fim deve ser maior que o início");
        return;
      }

      const payload = {
        titulo: formData.titulo,
        descricao: formData.descricao ?? null,
        inicio_at: formData.inicio_at,
        fim_at: formData.fim_at ?? null,
        publico_alvo: formData.publico_alvo ?? "todos",
      };

      const res = await fetch(
        editing
          ? `/api/escolas/${escolaId}/admin/eventos/${editing.id}`
          : `/api/escolas/${escolaId}/admin/eventos`,
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Falha ao salvar evento");
      }

      if (editing) {
        setEventos((prev) =>
          prev.map((ev) => (ev.id === editing.id ? { ...ev, ...payload } as Evento : ev))
        );
      } else {
        setEventos((prev) => [
          ...prev,
          { id: json?.id ?? cid(), ...payload } as Evento,
        ]);
      }

      success("Evento salvo.");
      setModalAberto(false);
      setEditing(null);
    } catch (err) {
      error(err instanceof Error ? err.message : "Falha ao salvar evento");
    } finally {
      setLoading(false);
    }
  }

  const deleteEvento = async (ev: Evento) => {
    if (!escolaId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/escolas/${escolaId}/admin/eventos/${ev.id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Falha ao remover evento");
      }
      setEventos((prev) => prev.filter((item) => item.id !== ev.id));
      success("Evento removido.");
    } catch (err) {
      error(err instanceof Error ? err.message : "Falha ao remover evento");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Eventos</h1>
        <button
          onClick={abrirCriar}
          className="px-3 py-2 text-sm rounded-xl bg-klasse-gold text-klasse-gold-900 hover:brightness-95"
        >
          + Novo evento
        </button>
      </header>

      <ul className="divide-y divide-border bg-card rounded-lg shadow-sm">
        {eventos.length === 0 && (
          <li className="p-6 text-center text-muted-foreground text-sm">Nenhum evento.</li>
        )}
        {eventos.map((ev) => (
          <li key={ev.id} className="p-4 flex items-center justify-between">
            <div>
              <div className="font-medium text-foreground">{ev.titulo}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(ev.inicio_at).toLocaleString()} — {ev.fim_at
                  ? new Date(ev.fim_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : "—"}
              </div>
              <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {ev.publico_alvo}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => abrirEditar(ev)}
                className="px-2.5 py-1.5 text-xs rounded-md border border-border text-foreground hover:bg-muted"
              >
                Editar
              </button>
              <button
                onClick={() => deleteEvento(ev)}
                className="px-2.5 py-1.5 text-xs rounded-md bg-red-600 text-white hover:bg-red-700"
              >
                Remover
              </button>
            </div>
          </li>
        ))}
      </ul>

      {modalAberto && (
        <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4">
          <div className="w-full max-w-lg bg-card rounded-xl shadow-xl p-6 space-y-5 animate-fadeIn">
            <div>
              <h2 className="text-lg font-semibold mb-3">Novo evento</h2>
              <div className="grid gap-3">
                <input
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  placeholder="Ex.: Reunião geral"
                  className="w-full border px-3 py-2 rounded-md"
                  required
                />
                <select
                  value={formData.publico_alvo}
                  onChange={(e) => setFormData({ ...formData, publico_alvo: e.target.value })}
                  className="border px-3 py-2 rounded-md"
                >
                  <option value="todos">Todos</option>
                  <option value="professores">Professores</option>
                  <option value="alunos">Alunos</option>
                  <option value="responsaveis">Responsáveis</option>
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="datetime-local"
                    value={fmtDateTime(new Date(formData.inicio_at || new Date().toISOString()))}
                    onChange={(e) =>
                      setFormData({ ...formData, inicio_at: new Date(e.target.value).toISOString() })
                    }
                    className="border px-3 py-2 rounded-md"
                  />
                  <input
                    type="datetime-local"
                    value={formData.fim_at ? fmtDateTime(new Date(formData.fim_at)) : ""}
                    onChange={(e) =>
                      setFormData({ ...formData, fim_at: e.target.value ? new Date(e.target.value).toISOString() : null })
                    }
                    className="border px-3 py-2 rounded-md"
                  />
                </div>
                <textarea
                  value={formData.descricao ?? ""}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  rows={3}
                  placeholder="Descrição do evento"
                  className="w-full border px-3 py-2 rounded-md"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button onClick={() => setModalAberto(false)} variant="outline" tone="gray" size="sm">
                Cancelar
              </Button>
              <Button onClick={salvarEvento} disabled={loading} tone="green" size="sm" className="flex items-center gap-2">
                {loading && (
                  <span className="w-4 h-4 border-2 border-border border-t-transparent rounded-full animate-spin" />
                )}
                Salvar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
