"use client";

import { FormEvent, useEffect, useState } from "react";

type FormadorItem = {
  user_id: string;
  nome: string;
  email: string | null;
};

type ApiListResponse = {
  ok: boolean;
  error?: string;
  items?: FormadorItem[];
};

type ApiCreateResponse = {
  ok: boolean;
  error?: string;
  item?: FormadorItem;
  created_new?: boolean;
  temporary_password?: string | null;
};

const inputClass =
  "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm transition-all duration-200 focus:border-[#1F6B3B] focus:outline-none focus:ring-2 focus:ring-[#1F6B3B]/20";

export default function EquipaFormadoresClient() {
  const [items, setItems] = useState<FormadorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome: "",
    email: "",
    telefone: "",
  });

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/formacao/admin/equipa/formadores", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as ApiListResponse | null;
      if (!res.ok || !json?.ok || !Array.isArray(json.items)) {
        throw new Error(json?.error || "Falha ao carregar equipa");
      }
      setItems(json.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setGeneratedPassword(null);
    setSaving(true);

    try {
      const res = await fetch("/api/formacao/admin/equipa/formadores", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nome: form.nome,
          email: form.email,
          telefone: form.telefone || null,
        }),
      });
      const json = (await res.json().catch(() => null)) as ApiCreateResponse | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Falha ao cadastrar formador");
      }

      setSuccess(json.created_new ? "Formador criado e vinculado com sucesso." : "Utilizador existente vinculado como formador.");
      setGeneratedPassword(json.temporary_password ?? null);
      setForm({ nome: "", email: "", telefone: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="m-0 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">gestão · equipa</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">Equipa de Formadores</h1>
        <p className="mt-2 text-sm text-slate-600">Cadastre formadores do centro e depois atribua-os às turmas em Cohorts.</p>
      </header>

      <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5">
        <strong>Novo formador</strong>
        <div className="grid gap-2 md:grid-cols-2">
          <input
            className={inputClass}
            placeholder="Nome completo"
            value={form.nome}
            onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
            required
          />
          <input
            className={inputClass}
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            type="email"
            required
          />
          <input
            className={inputClass}
            placeholder="Telefone (opcional)"
            value={form.telefone}
            onChange={(e) => setForm((prev) => ({ ...prev, telefone: e.target.value }))}
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="w-fit rounded-lg border border-[#C8902A] bg-[#C8902A] px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#B07E21] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "A guardar..." : "Cadastrar formador"}
        </button>
      </form>

      {error ? <p className="m-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {success ? <p className="m-0 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p> : null}
      {generatedPassword ? (
        <p className="m-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Senha temporária do novo utilizador: <strong>{generatedPassword}</strong>
        </p>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <strong>Formadores vinculados</strong>
        {loading ? (
          <p className="mt-3 text-sm text-slate-600">A carregar equipa...</p>
        ) : items.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">Ainda não há formadores vinculados ao centro.</p>
        ) : (
          <ul className="mt-3 grid gap-2 p-0">
            {items.map((item) => (
              <li key={item.user_id} className="list-none rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2">
                <p className="m-0 text-sm font-semibold text-slate-900">{item.nome}</p>
                <p className="m-0 text-xs text-slate-500">{item.email ?? "sem email"}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
