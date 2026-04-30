"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  Building2,
  CheckCircle2,
  DoorOpen,
  Edit3,
  Loader2,
  Plus,
  Trash2,
  Wrench,
} from "lucide-react";

type SalaTipo = "sala" | "laboratorio" | "auditorio" | "online";
type SalaStatus = "ativa" | "manutencao" | "inativa";

type Sala = {
  id: string;
  nome: string;
  tipo: SalaTipo;
  capacidade: number;
  localizacao: string | null;
  recursos: string[];
  status: SalaStatus;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

type FormState = {
  id: string | null;
  nome: string;
  tipo: SalaTipo;
  capacidade: string;
  localizacao: string;
  recursos: string;
  status: SalaStatus;
  observacoes: string;
};

const emptyForm: FormState = {
  id: null,
  nome: "",
  tipo: "sala",
  capacidade: "25",
  localizacao: "",
  recursos: "",
  status: "ativa",
  observacoes: "",
};

const tipoLabels: Record<SalaTipo, string> = {
  sala: "Sala",
  laboratorio: "Laboratório",
  auditorio: "Auditório",
  online: "Sala online",
};

const statusLabels: Record<SalaStatus, string> = {
  ativa: "Ativa",
  manutencao: "Manutenção",
  inativa: "Inativa",
};

const statusClasses: Record<SalaStatus, string> = {
  ativa: "border-emerald-200 bg-emerald-50 text-emerald-700",
  manutencao: "border-amber-200 bg-amber-50 text-amber-700",
  inativa: "border-slate-200 bg-slate-100 text-slate-600",
};

function parseRecursos(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function resourceText(sala: Sala) {
  if (!Array.isArray(sala.recursos) || sala.recursos.length === 0) return "Sem recursos registados";
  return sala.recursos.join(", ");
}

export default function InfraestruturaClient() {
  const [items, setItems] = useState<Sala[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stats = useMemo(() => {
    const ativas = items.filter((item) => item.status === "ativa");
    const capacidadeAtiva = ativas.reduce((total, item) => total + Number(item.capacidade ?? 0), 0);
    const manutencao = items.filter((item) => item.status === "manutencao").length;
    return { total: items.length, ativas: ativas.length, capacidadeAtiva, manutencao };
  }, [items]);

  async function loadItems() {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/formacao/backoffice/infraestrutura", { cache: "no-store" });
    const json = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok || !json?.ok) {
      setError(json?.error ?? "Falha ao carregar infraestrutura.");
      return;
    }
    setItems(Array.isArray(json.items) ? json.items : []);
  }

  useEffect(() => {
    loadItems();
  }, []);

  function editSala(sala: Sala) {
    setForm({
      id: sala.id,
      nome: sala.nome,
      tipo: sala.tipo,
      capacidade: String(sala.capacidade),
      localizacao: sala.localizacao ?? "",
      recursos: Array.isArray(sala.recursos) ? sala.recursos.join(", ") : "",
      status: sala.status,
      observacoes: sala.observacoes ?? "",
    });
  }

  async function saveSala(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      id: form.id ?? undefined,
      nome: form.nome,
      tipo: form.tipo,
      capacidade: Number(form.capacidade),
      localizacao: form.localizacao,
      recursos: parseRecursos(form.recursos),
      status: form.status,
      observacoes: form.observacoes,
    };

    const response = await fetch("/api/formacao/backoffice/infraestrutura", {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await response.json().catch(() => null);
    setSaving(false);

    if (!response.ok || !json?.ok) {
      setError(json?.error ?? "Falha ao guardar sala.");
      return;
    }

    const saved = json.item as Sala;
    setItems((current) => {
      if (!form.id) return [...current, saved].sort((a, b) => a.nome.localeCompare(b.nome));
      return current.map((item) => (item.id === saved.id ? saved : item));
    });
    setForm(emptyForm);
  }

  async function deleteSala(sala: Sala) {
    const confirmed = window.confirm(`Remover ${sala.nome}?`);
    if (!confirmed) return;

    setError(null);
    const response = await fetch(`/api/formacao/backoffice/infraestrutura?id=${encodeURIComponent(sala.id)}`, {
      method: "DELETE",
    });
    const json = await response.json().catch(() => null);
    if (!response.ok || !json?.ok) {
      setError(json?.error ?? "Falha ao remover sala.");
      return;
    }
    setItems((current) => current.filter((item) => item.id !== sala.id));
    if (form.id === sala.id) setForm(emptyForm);
  }

  return (
    <div className="space-y-6 pb-10">
      <header className="border-b border-slate-200 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              operação académica
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
              Salas & Infraestrutura
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Registe salas físicas, laboratórios, auditórios e ambientes online usados pelas formações.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setForm(emptyForm)}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            <Plus size={16} />
            Nova sala
          </button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Espaços registados" value={stats.total} icon={<Building2 size={18} />} />
        <Metric title="Ativos" value={stats.ativas} icon={<CheckCircle2 size={18} />} />
        <Metric title="Capacidade ativa" value={stats.capacidadeAtiva} icon={<DoorOpen size={18} />} />
        <Metric title="Em manutenção" value={stats.manutencao} icon={<Wrench size={18} />} />
      </section>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <form onSubmit={saveSala} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                {form.id ? "Editar espaço" : "Novo espaço"}
              </h2>
              <p className="mt-1 text-xs text-slate-500">Campos operacionais usados para planeamento.</p>
            </div>
          </div>

          <div className="space-y-4">
            <Field label="Nome">
              <input
                required
                value={form.nome}
                onChange={(event) => setForm((state) => ({ ...state, nome: event.target.value }))}
                placeholder="Sala 01, Laboratório A..."
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition-colors focus:border-slate-500"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo">
                <select
                  value={form.tipo}
                  onChange={(event) => setForm((state) => ({ ...state, tipo: event.target.value as SalaTipo }))}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition-colors focus:border-slate-500"
                >
                  {Object.entries(tipoLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Capacidade">
                <input
                  required
                  type="number"
                  min="1"
                  value={form.capacidade}
                  onChange={(event) => setForm((state) => ({ ...state, capacidade: event.target.value }))}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition-colors focus:border-slate-500"
                />
              </Field>
            </div>

            <Field label="Localização / link">
              <input
                value={form.localizacao}
                onChange={(event) => setForm((state) => ({ ...state, localizacao: event.target.value }))}
                placeholder="Bloco A, 2º piso ou link da sala online"
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition-colors focus:border-slate-500"
              />
            </Field>

            <Field label="Recursos">
              <input
                value={form.recursos}
                onChange={(event) => setForm((state) => ({ ...state, recursos: event.target.value }))}
                placeholder="Projetor, internet, computadores"
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition-colors focus:border-slate-500"
              />
            </Field>

            <Field label="Status">
              <select
                value={form.status}
                onChange={(event) => setForm((state) => ({ ...state, status: event.target.value as SalaStatus }))}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition-colors focus:border-slate-500"
              >
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Observações">
              <textarea
                value={form.observacoes}
                onChange={(event) => setForm((state) => ({ ...state, observacoes: event.target.value }))}
                rows={4}
                placeholder="Notas de manutenção, restrições ou observações internas"
                className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors focus:border-slate-500"
              />
            </Field>
          </div>

          <div className="mt-5 flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-klasse-green px-4 text-sm font-semibold text-white transition-colors hover:bg-klasse-green/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              Guardar
            </button>
            {form.id && (
              <button
                type="button"
                onClick={() => setForm(emptyForm)}
                className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>

        <section className="min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-base font-semibold text-slate-950">Inventário operacional</h2>
          </div>

          {loading ? (
            <div className="flex h-64 items-center justify-center text-sm text-slate-500">
              <Loader2 size={18} className="mr-2 animate-spin" />
              A carregar infraestrutura
            </div>
          ) : items.length === 0 ? (
            <div className="px-6 py-20 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <Building2 size={22} />
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-900">Nenhum espaço registado</p>
              <p className="mt-1 text-sm text-slate-500">Crie a primeira sala ou ambiente online do centro.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Espaço</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Capacidade</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Recursos</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((sala) => (
                    <tr key={sala.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-4">
                        <p className="text-sm font-semibold text-slate-950">{sala.nome}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {tipoLabels[sala.tipo]} {sala.localizacao ? `• ${sala.localizacao}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-sm font-semibold text-slate-700">
                        {sala.capacidade}
                      </td>
                      <td className="max-w-[280px] px-4 py-4 text-sm text-slate-600">
                        <span className="line-clamp-2">{resourceText(sala)}</span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses[sala.status]}`}>
                          {statusLabels[sala.status]}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => editSala(sala)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-950"
                            aria-label={`Editar ${sala.nome}`}
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSala(sala)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 text-rose-600 transition-colors hover:bg-rose-50"
                            aria-label={`Remover ${sala.nome}`}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Metric({ title, value, icon }: { title: string; value: number; icon: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          {icon}
        </div>
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}
