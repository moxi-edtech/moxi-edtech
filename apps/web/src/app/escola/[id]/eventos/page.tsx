"use client";

import { useState } from "react";

type Evento = {
  id: string;
  titulo: string;
  inicio: Date;
  fim: Date;
  desc?: string;
  tipo: string;
  cor: string;
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
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Evento | null>(null);

  const [formData, setFormData] = useState<Partial<Evento>>({
    titulo: "",
    inicio: new Date(),
    fim: new Date(),
    desc: "",
    tipo: "Reunião",
    cor: "#1e6bd6",
  });

  function abrirCriar() {
    setEditing(null);
    setFormData({
      titulo: "",
      inicio: new Date(),
      fim: new Date(),
      desc: "",
      tipo: "Reunião",
      cor: "#1e6bd6",
    });
    setStep(1);
    setModalAberto(true);
  }

  function abrirEditar(ev: Evento) {
    setEditing(ev);
    setFormData(ev);
    setStep(1);
    setModalAberto(true);
  }

  async function salvarEvento() {
    if (!formData.titulo || !formData.inicio || !formData.fim) return;

    if (formData.inicio >= formData.fim) {
      alert("O fim deve ser maior que o início");
      return;
    }

    setLoading(true);
    await new Promise((r) => setTimeout(r, 1200)); // simula API

    if (editing) {
      setEventos((prev) =>
        prev.map((ev) => (ev.id === editing.id ? { ...ev, ...formData } as Evento : ev))
      );
    } else {
      setEventos((prev) => [...prev, { ...(formData as Evento), id: cid() }]);
    }

    setLoading(false);
    setModalAberto(false);
    setEditing(null);
  }

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Eventos</h1>
        <button
          onClick={abrirCriar}
          className="px-3 py-2 text-sm rounded-md bg-[#0B2C45] text-white hover:bg-[#0D4C73]"
        >
          + Novo evento
        </button>
      </header>

      <ul className="divide-y divide-gray-200 bg-white rounded-lg shadow-sm">
        {eventos.length === 0 && (
          <li className="p-6 text-center text-gray-500 text-sm">Nenhum evento.</li>
        )}
        {eventos.map((ev) => (
          <li key={ev.id} className="p-4 flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900">{ev.titulo}</div>
              <div className="text-xs text-gray-600">
                {ev.inicio.toLocaleString()} — {ev.fim.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
              <span
                className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full"
                style={{ background: ev.cor, color: "white" }}
              >
                {ev.tipo}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => abrirEditar(ev)}
                className="px-2.5 py-1.5 text-xs rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Editar
              </button>
              <button
                onClick={() => setEventos((prev) => prev.filter((e) => e.id !== ev.id))}
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
          <div className="w-full max-w-lg bg-white rounded-xl shadow-xl p-6 space-y-5 animate-fadeIn">
            {/* Barra de progresso */}
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-2 bg-[#1e6bd6] transition-all"
                style={{ width: `${(step / 5) * 100}%` }}
              />
            </div>

            {/* Steps */}
            {step === 1 && (
              <div>
                <h2 className="text-lg font-semibold mb-3">Título</h2>
                <input
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  placeholder="Ex.: Reunião geral"
                  className="w-full border px-3 py-2 rounded-md"
                  required
                />
              </div>
            )}
            {step === 2 && (
              <div>
                <h2 className="text-lg font-semibold mb-3">Datas</h2>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="datetime-local"
                    value={fmtDateTime(formData.inicio!)}
                    onChange={(e) =>
                      setFormData({ ...formData, inicio: new Date(e.target.value) })
                    }
                    className="border px-3 py-2 rounded-md"
                  />
                  <input
                    type="datetime-local"
                    value={fmtDateTime(formData.fim!)}
                    onChange={(e) =>
                      setFormData({ ...formData, fim: new Date(e.target.value) })
                    }
                    className="border px-3 py-2 rounded-md"
                  />
                </div>
              </div>
            )}
            {step === 3 && (
              <div>
                <h2 className="text-lg font-semibold mb-3">Descrição</h2>
                <textarea
                  value={formData.desc}
                  onChange={(e) => setFormData({ ...formData, desc: e.target.value })}
                  rows={3}
                  className="w-full border px-3 py-2 rounded-md"
                />
              </div>
            )}
            {step === 4 && (
              <div>
                <h2 className="text-lg font-semibold mb-3">Tipo e cor</h2>
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                    className="border px-3 py-2 rounded-md"
                  >
                    <option>Reunião</option>
                    <option>Prova</option>
                    <option>Aviso</option>
                  </select>
                  <input
                    type="color"
                    value={formData.cor}
                    onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
                    className="h-10 w-full border rounded-md"
                  />
                </div>
              </div>
            )}
            {step === 5 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Confirmar evento</h2>
                <p>
                  <strong>{formData.titulo}</strong> <br />
                  {formData.inicio?.toLocaleString()} —{" "}
                  {formData.fim?.toLocaleString()}
                </p>
                {formData.desc && <p>{formData.desc}</p>}
                <span
                  className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full"
                  style={{ background: formData.cor, color: "white" }}
                >
                  {formData.tipo}
                </span>
              </div>
            )}

            {/* Navegação */}
            <div className="flex justify-between">
              <button
                disabled={step === 1}
                onClick={() => setStep((s) => s - 1)}
                className="px-3 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
              >
                Voltar
              </button>
              {step < 5 ? (
                <button
                  onClick={() => setStep((s) => s + 1)}
                  className="px-3 py-2 text-sm rounded-md bg-[#0B2C45] text-white hover:bg-[#0D4C73]"
                >
                  Próximo
                </button>
              ) : (
                <button
                  onClick={salvarEvento}
                  disabled={loading}
                  className="px-3 py-2 text-sm rounded-md bg-green-600 text-white hover:bg-green-700 flex items-center gap-2"
                >
                  {loading && (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  Salvar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
