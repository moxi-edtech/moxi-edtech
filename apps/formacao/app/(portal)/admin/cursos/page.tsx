"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type TabKey = "basico" | "programa" | "comercial";

type CursoModulo = {
  ordem: number;
  titulo: string;
  carga_horaria: number | null;
  descricao: string | null;
};

type Curso = {
  id: string;
  codigo: string;
  nome: string;
  area: string | null;
  modalidade: "presencial" | "online" | "hibrido";
  carga_horaria: number | null;
  status: string;
  preco_tabela: number;
  desconto_ativo: boolean;
  desconto_percentual: number;
  parceria_b2b_ativa: boolean;
  modulos: CursoModulo[];
};

type FormModulo = {
  id: string;
  titulo: string;
  carga_horaria: string;
  descricao: string;
};

const emptyForm = {
  codigo: "",
  nome: "",
  area: "",
  modalidade: "presencial" as "presencial" | "online" | "hibrido",
  carga_horaria: "",
  preco_tabela: "",
  desconto_ativo: false,
  desconto_percentual: "",
  parceria_b2b_ativa: false,
};

function createModuloId() {
  return `m-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

export default function CursosPage() {
  const [items, setItems] = useState<Curso[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("basico");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [modulos, setModulos] = useState<FormModulo[]>([
    { id: "m-1", titulo: "", carga_horaria: "", descricao: "" },
  ]);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/formacao/backoffice/cursos", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as
        | { ok: boolean; error?: string; items?: Curso[] }
        | null;
      if (!res.ok || !json?.ok || !Array.isArray(json.items)) {
        throw new Error(json?.error || "Falha ao carregar catálogo de cursos");
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

  const payloadModulos = useMemo(
    () =>
      modulos
        .map((item) => ({
          titulo: item.titulo.trim(),
          carga_horaria: item.carga_horaria ? Number(item.carga_horaria) : null,
          descricao: item.descricao.trim() || null,
        }))
        .filter((item) => item.titulo.length > 0),
    [modulos]
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const body = {
        codigo: form.codigo,
        nome: form.nome,
        area: form.area,
        modalidade: form.modalidade,
        carga_horaria: form.carga_horaria ? Number(form.carga_horaria) : null,
        preco_tabela: form.preco_tabela ? Number(form.preco_tabela) : 0,
        desconto_ativo: form.desconto_ativo,
        desconto_percentual: form.desconto_percentual ? Number(form.desconto_percentual) : 0,
        parceria_b2b_ativa: form.parceria_b2b_ativa,
        modulos: payloadModulos,
      };

      const endpoint = "/api/formacao/backoffice/cursos";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editingId ? { ...body, id: editingId } : body),
      });

      const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Falha ao guardar curso");
      }

      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setModulos([{ id: createModuloId(), titulo: "", carga_horaria: "", descricao: "" }]);
    setActiveTab("basico");
  };

  const editItem = (item: Curso) => {
    setEditingId(item.id);
    setForm({
      codigo: item.codigo,
      nome: item.nome,
      area: item.area ?? "",
      modalidade: item.modalidade,
      carga_horaria: item.carga_horaria ? String(item.carga_horaria) : "",
      preco_tabela: String(item.preco_tabela ?? 0),
      desconto_ativo: Boolean(item.desconto_ativo),
      desconto_percentual: String(item.desconto_percentual ?? 0),
      parceria_b2b_ativa: Boolean(item.parceria_b2b_ativa),
    });
    setModulos(
      item.modulos.length > 0
        ? item.modulos.map((modulo) => ({
            id: createModuloId(),
            titulo: modulo.titulo,
            carga_horaria: modulo.carga_horaria ? String(modulo.carga_horaria) : "",
            descricao: modulo.descricao ?? "",
          }))
        : [{ id: createModuloId(), titulo: "", carga_horaria: "", descricao: "" }]
    );
    setActiveTab("basico");
  };

  const changeStatus = async (id: string, status: "ativo" | "inativo") => {
    setError(null);
    const res = await fetch("/api/formacao/backoffice/cursos", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;
    if (!res.ok || !json?.ok) {
      setError(json?.error || "Falha ao atualizar status");
      return;
    }
    await load();
  };

  const removeItem = async (id: string) => {
    setError(null);
    const res = await fetch(`/api/formacao/backoffice/cursos?id=${id}`, { method: "DELETE" });
    const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;
    if (!res.ok || !json?.ok) {
      setError(json?.error || "Falha ao remover curso");
      return;
    }
    if (editingId === id) resetForm();
    await load();
  };

  return (
    <div className="grid gap-4">
      <h1 className="m-0 text-2xl font-bold text-zinc-900 md:text-3xl">Backoffice • Catálogo de Cursos</h1>

      <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-[#E4EBE6] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8A9E8F]">catálogo</p>
            <strong className="text-[#111811]">{editingId ? "Editar curso" : "Novo curso"}</strong>
          </div>
          <div className="flex gap-2">
            {(["basico", "programa", "comercial"] as TabKey[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === tab
                    ? "border-klasse-gold bg-klasse-gold/10 text-klasse-gold"
                    : "border-[#E4EBE6] text-[#4A6352] hover:bg-[#F7F9F7]"
                }`}
              >
                {tab === "basico" ? "Info Básica" : tab === "programa" ? "Programa Académico" : "Comercial"}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "basico" ? (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            <Input label="Código" value={form.codigo} onChange={(value) => setForm((prev) => ({ ...prev, codigo: value }))} placeholder="CUR-EXCEL-01" required />
            <Input label="Nome" value={form.nome} onChange={(value) => setForm((prev) => ({ ...prev, nome: value }))} placeholder="Excel Profissional" required />
            <Input label="Categoria" value={form.area} onChange={(value) => setForm((prev) => ({ ...prev, area: value }))} placeholder="Tecnologia" />
            <label className="grid gap-1 text-sm text-[#4A6352]">
              <span>Modalidade</span>
              <select
                value={form.modalidade}
                onChange={(e) => setForm((prev) => ({ ...prev, modalidade: e.target.value as "presencial" | "online" | "hibrido" }))}
                className="rounded-lg border border-[#E4EBE6] px-3 py-2 text-sm outline-none focus:border-klasse-gold"
              >
                <option value="presencial">Presencial</option>
                <option value="online">E-learning</option>
                <option value="hibrido">Híbrido</option>
              </select>
            </label>
            <Input label="Carga horária total" type="number" min={1} value={form.carga_horaria} onChange={(value) => setForm((prev) => ({ ...prev, carga_horaria: value }))} placeholder="40" />
          </div>
        ) : null}

        {activeTab === "programa" ? (
          <div className="grid gap-2">
            {modulos.map((modulo, index) => (
              <div key={modulo.id} className="grid gap-2 rounded-xl border border-[#E4EBE6] bg-[#F7F9F7] p-3 md:grid-cols-[1.4fr_160px_1fr_auto]">
                <Input
                  label={`Módulo ${index + 1}`}
                  value={modulo.titulo}
                  onChange={(value) =>
                    setModulos((prev) => prev.map((item) => (item.id === modulo.id ? { ...item, titulo: value } : item)))
                  }
                  placeholder="Introdução"
                />
                <Input
                  label="Carga (h)"
                  type="number"
                  min={1}
                  value={modulo.carga_horaria}
                  onChange={(value) =>
                    setModulos((prev) =>
                      prev.map((item) => (item.id === modulo.id ? { ...item, carga_horaria: value } : item))
                    )
                  }
                  placeholder="8"
                />
                <Input
                  label="Descrição"
                  value={modulo.descricao}
                  onChange={(value) =>
                    setModulos((prev) =>
                      prev.map((item) => (item.id === modulo.id ? { ...item, descricao: value } : item))
                    )
                  }
                  placeholder="Objetivos e conteúdos"
                />
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => setModulos((prev) => prev.filter((item) => item.id !== modulo.id))}
                    className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-40"
                    disabled={modulos.length === 1}
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setModulos((prev) => [...prev, { id: createModuloId(), titulo: "", carga_horaria: "", descricao: "" }])
              }
              className="w-fit rounded-lg border border-[#E4EBE6] bg-white px-3 py-2 text-sm font-semibold text-[#1F6B3B] hover:bg-[#F7F9F7]"
            >
              + Adicionar módulo
            </button>
          </div>
        ) : null}

        {activeTab === "comercial" ? (
          <div className="grid gap-2 md:grid-cols-2">
            <Input
              label="Preço de tabela (Kz)"
              type="number"
              min={0}
              value={form.preco_tabela}
              onChange={(value) => setForm((prev) => ({ ...prev, preco_tabela: value }))}
              placeholder="50000"
            />
            <Input
              label="Desconto (%)"
              type="number"
              min={0}
              max={100}
              value={form.desconto_percentual}
              onChange={(value) => setForm((prev) => ({ ...prev, desconto_percentual: value }))}
              placeholder="10"
              disabled={!form.desconto_ativo}
            />
            <label className="flex items-center gap-2 rounded-lg border border-[#E4EBE6] px-3 py-2 text-sm text-[#4A6352]">
              <input
                type="checkbox"
                checked={form.desconto_ativo}
                onChange={(e) => setForm((prev) => ({ ...prev, desconto_ativo: e.target.checked }))}
              />
              Ativar desconto promocional
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-[#E4EBE6] px-3 py-2 text-sm text-[#4A6352]">
              <input
                type="checkbox"
                checked={form.parceria_b2b_ativa}
                onChange={(e) => setForm((prev) => ({ ...prev, parceria_b2b_ativa: e.target.checked }))}
              />
              Aceita parceria B2B
            </label>
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={resetForm} className="rounded-lg border border-[#E4EBE6] px-3 py-2 text-sm text-[#4A6352]">
            Limpar
          </button>
          <button type="submit" className="rounded-lg border border-klasse-gold bg-klasse-gold px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-60" disabled={saving}>
            {saving ? "A guardar..." : editingId ? "Atualizar curso" : "Criar curso"}
          </button>
        </div>
      </form>

      {error ? <p className="m-0 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {loading ? <p className="m-0 text-sm text-zinc-700">Carregando catálogo...</p> : null}

      <div className="hidden overflow-x-auto rounded-xl border border-zinc-200 bg-white md:block">
        <table className="min-w-[1100px] w-full border-collapse text-sm">
          <thead className="bg-zinc-50/90">
            <tr>
              <Th>Código</Th>
              <Th>Curso</Th>
              <Th>Modalidade</Th>
              <Th>Carga (h)</Th>
              <Th>Preço</Th>
              <Th>Módulos</Th>
              <Th>Status</Th>
              <Th>Ações</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <Td>{item.codigo}</Td>
                <Td>
                  <div>
                    <p className="font-semibold text-[#111811]">{item.nome}</p>
                    <p className="text-xs text-[#4A6352]">{item.area || "-"}</p>
                  </div>
                </Td>
                <Td>{item.modalidade}</Td>
                <Td>{item.carga_horaria ?? "-"}</Td>
                <Td>{formatMoney(item.preco_tabela)}</Td>
                <Td>{item.modulos.length}</Td>
                <Td>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusPill(item.status)}`}>{item.status}</span>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1.5">
                    <button className="rounded-md border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-50" type="button" onClick={() => editItem(item)}>
                      Editar
                    </button>
                    <button className="rounded-md border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-50 disabled:opacity-50" type="button" onClick={() => changeStatus(item.id, "ativo")} disabled={item.status === "ativo"}>
                      Ativar
                    </button>
                    <button className="rounded-md border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-50 disabled:opacity-50" type="button" onClick={() => changeStatus(item.id, "inativo")} disabled={item.status === "inativo"}>
                      Inativar
                    </button>
                    <button className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50" type="button" onClick={() => removeItem(item.id)}>
                      Apagar
                    </button>
                  </div>
                </Td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <Td colSpan={8}>Sem cursos cadastrados.</Td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
  min,
  max,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  return (
    <label className="grid gap-1 text-sm text-[#4A6352]">
      <span>{label}</span>
      <input
        type={type}
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className="rounded-lg border border-[#E4EBE6] px-3 py-2 text-sm text-[#111811] outline-none focus:border-klasse-gold disabled:bg-slate-50"
      />
    </label>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="border-b border-zinc-200 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{children}</th>;
}

function Td({ children, colSpan }: { children: React.ReactNode; colSpan?: number }) {
  return <td colSpan={colSpan} className="border-b border-zinc-100 px-3 py-2.5 text-zinc-800">{children}</td>;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 }).format(
    Number.isFinite(value) ? value : 0
  );
}

function statusPill(status: string) {
  const normalized = status.toLowerCase().trim();
  if (normalized === "inativo") return "bg-slate-200 text-slate-700";
  if (normalized === "ativo") return "bg-emerald-100 text-emerald-700";
  return "bg-amber-100 text-amber-700";
}
