"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { FileText, Plus, Trash2, Info, TrendingUp, Calculator, Image as ImageIcon, CheckCircle2, ListChecks, Loader2 } from "lucide-react";

type TabKey = "basico" | "programa" | "comercial" | "materiais" | "landing";

type CursoModulo = {
  ordem: number;
  titulo: string;
  carga_horaria: number | null;
  descricao: string | null;
};

type CursoMaterial = {
  id?: string;
  titulo: string;
  url: string;
  tipo: string;
};

type Curso = {
  id: string;
  codigo: string;
  nome: string;
  area: string | null;
  modalidade: "presencial" | "online" | "hibrido";
  carga_horaria: number | null;
  status: string;
  thumbnail_url: string | null;
  certificado_template_id: string | null;
  objetivos: string[];
  requisitos: string[];
  preco_tabela: number;
  desconto_ativo: boolean;
  desconto_percentual: number;
  parceria_b2b_ativa: boolean;
  custo_hora_estimado: number;
  modulos: CursoModulo[];
  materiais: CursoMaterial[];
};

type Template = {
  id: string;
  nome: string;
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
  thumbnail_url: "",
  certificado_template_id: "",
  preco_tabela: "",
  desconto_ativo: false,
  desconto_percentual: "",
  parceria_b2b_ativa: false,
  custo_hora_estimado: "",
};

function createId() {
  return `id-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

export default function CursosPage() {
  const [items, setItems] = useState<Curso[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("basico");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [modulos, setModulos] = useState<FormModulo[]>([
    { id: createId(), titulo: "", carga_horaria: "", descricao: "" },
  ]);
  const [materiais, setMateriais] = useState<CursoMaterial[]>([]);
  const [objetivos, setObjetivos] = useState<string[]>([]);
  const [requisitos, setRequisitos] = useState<string[]>([]);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [cursosRes, templatesRes] = await Promise.all([
        fetch("/api/formacao/backoffice/cursos", { cache: "no-store" }),
        fetch("/api/formacao/certificados/templates", { cache: "no-store" }),
      ]);

      const cursosJson = (await cursosRes.json().catch(() => null)) as
        | { ok: boolean; error?: string; items?: Curso[] }
        | null;
      const templatesJson = (await templatesRes.json().catch(() => null)) as
        | { ok: boolean; error?: string; items?: Template[] }
        | null;

      if (!cursosRes.ok || !cursosJson?.ok || !Array.isArray(cursosJson.items)) {
        throw new Error(cursosJson?.error || "Falha ao carregar catálogo de cursos");
      }
      setItems(cursosJson.items);
      setTemplates(templatesJson?.items ?? []);
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
        thumbnail_url: form.thumbnail_url || null,
        certificado_template_id: form.certificado_template_id || null,
        objetivos: objetivos.filter((o) => o.trim().length > 0),
        requisitos: requisitos.filter((r) => r.trim().length > 0),
        preco_tabela: form.preco_tabela ? Number(form.preco_tabela) : 0,
        desconto_ativo: form.desconto_ativo,
        desconto_percentual: form.desconto_percentual ? Number(form.desconto_percentual) : 0,
        parceria_b2b_ativa: form.parceria_b2b_ativa,
        custo_hora_estimado: form.custo_hora_estimado ? Number(form.custo_hora_estimado) : 0,
        modulos: payloadModulos,
        materiais: materiais.map(({ titulo, url, tipo }) => ({ titulo, url, tipo })),
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
    setModulos([{ id: createId(), titulo: "", carga_horaria: "", descricao: "" }]);
    setMateriais([]);
    setObjetivos([]);
    setRequisitos([]);
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
      thumbnail_url: item.thumbnail_url ?? "",
      certificado_template_id: item.certificado_template_id ?? "",
      preco_tabela: String(item.preco_tabela ?? 0),
      desconto_ativo: Boolean(item.desconto_ativo),
      desconto_percentual: String(item.desconto_percentual ?? 0),
      parceria_b2b_ativa: Boolean(item.parceria_b2b_ativa),
      custo_hora_estimado: String(item.custo_hora_estimado ?? 0),
    });
    setModulos(
      item.modulos.length > 0
        ? item.modulos.map((modulo) => ({
            id: createId(),
            titulo: modulo.titulo,
            carga_horaria: modulo.carga_horaria ? String(modulo.carga_horaria) : "",
            descricao: modulo.descricao ?? "",
          }))
        : [{ id: createId(), titulo: "", carga_horaria: "", descricao: "" }]
    );
    setMateriais(item.materiais ?? []);
    setObjetivos(item.objetivos ?? []);
    setRequisitos(item.requisitos ?? []);
    setActiveTab("basico");
  };

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "thumbnail");

      const res = await fetch("/api/formacao/backoffice/cursos/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Erro no upload");

      setForm((prev) => ({ ...prev, thumbnail_url: json.url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no upload");
    } finally {
      setUploading(false);
    }
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
            {(["basico", "programa", "comercial", "materiais", "landing"] as TabKey[]).map((tab) => (
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
                {tab === "basico"
                  ? "Info Básica"
                  : tab === "programa"
                  ? "Programa"
                  : tab === "comercial"
                  ? "Comercial"
                  : tab === "materiais"
                  ? "Materiais"
                  : "Visual & Landing"}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "basico" ? (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
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
            <Input label="Carga horária (h)" type="number" min={1} value={form.carga_horaria} onChange={(value) => setForm((prev) => ({ ...prev, carga_horaria: value }))} placeholder="40" />
            <label className="grid gap-1 text-sm text-[#4A6352]">
              <span className="flex items-center gap-1" title="Template usado para emissão automática em turmas deste curso.">Certificado Padrão <Info size={12} /></span>
              <select
                value={form.certificado_template_id}
                onChange={(e) => setForm((prev) => ({ ...prev, certificado_template_id: e.target.value }))}
                className="rounded-lg border border-[#E4EBE6] px-3 py-2 text-sm outline-none focus:border-klasse-gold"
              >
                <option value="">Nenhum template</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
            </label>
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
                <label className="grid gap-1 text-sm text-[#4A6352]">
                  <span className="flex items-center justify-between">
                    Descrição (Rich Text)
                    <div className="flex gap-1">
                      <button type="button" onClick={() => {
                        setModulos(prev => prev.map(m => m.id === modulo.id ? { ...m, descricao: m.descricao + '<b></b>' } : m))
                      }} title="Negrito" className="px-1.5 border rounded bg-white text-[10px] font-bold">B</button>
                      <button type="button" onClick={() => {
                        setModulos(prev => prev.map(m => m.id === modulo.id ? { ...m, descricao: m.descricao + '<li></li>' } : m))
                      }} title="Lista" className="px-1.5 border rounded bg-white text-[10px]">List</button>
                    </div>
                  </span>
                  <textarea
                    value={modulo.descricao}
                    onChange={(e) => setModulos((prev) =>
                      prev.map((item) => (item.id === modulo.id ? { ...item, descricao: e.target.value } : item))
                    )}
                    placeholder="Objetivos e conteúdos"
                    className="rounded-lg border border-[#E4EBE6] px-3 py-2 text-sm outline-none focus:border-klasse-gold h-20"
                  />
                </label>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => setModulos((prev) => prev.filter((item) => item.id !== modulo.id))}
                    className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-40"
                    disabled={modulos.length === 1}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setModulos((prev) => [...prev, { id: createId(), titulo: "", carga_horaria: "", descricao: "" }])
              }
              className="flex w-fit items-center gap-2 rounded-lg border border-[#E4EBE6] bg-white px-3 py-2 text-sm font-semibold text-[#1F6B3B] hover:bg-[#F7F9F7]"
            >
              <Plus size={16} /> Adicionar módulo
            </button>
          </div>
        ) : null}

        {activeTab === "landing" ? (
          <div className="grid gap-6">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Thumbnail Section */}
              <div className="grid gap-3 p-4 rounded-xl border border-[#E4EBE6] bg-[#F7F9F7]/50">
                <div className="flex items-center gap-2 text-sm font-bold text-[#111811]">
                  <ImageIcon size={16} className="text-klasse-gold" />
                  Capa do Curso (Thumbnail)
                </div>
                <div className="flex flex-col gap-4">
                  {form.thumbnail_url ? (
                    <div className="relative aspect-video w-full max-w-[300px] overflow-hidden rounded-lg border bg-white shadow-sm">
                      <img src={form.thumbnail_url} alt="Preview" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setForm(p => ({ ...p, thumbnail_url: "" }))}
                        className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-rose-600 shadow-sm hover:bg-white"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex aspect-video w-full max-w-[300px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white">
                      <ImageIcon size={32} className="text-slate-300 mb-2" />
                      <span className="text-xs text-slate-400">Sem imagem de capa</span>
                    </div>
                  )}
                  
                  <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-klasse-gold px-4 py-2 text-xs font-bold text-klasse-gold hover:bg-klasse-gold/5 transition-colors">
                    <Plus size={14} />
                    {uploading ? <Loader2 size={14} className="animate-spin" /> : "Carregar Foto"}
                    <input type="file" className="hidden" accept="image/*" onChange={handleThumbnailUpload} disabled={uploading} />
                  </label>
                  <p className="text-[10px] text-slate-500 italic">Recomendado: 1280x720px (16:9). Máx: 5MB.</p>
                </div>
              </div>

              {/* Outcomes & Requirements Aggregator */}
              <div className="grid gap-4">
                {/* Objetivos */}
                <div className="grid gap-3 p-4 rounded-xl border border-[#E4EBE6]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-bold text-[#111811]">
                      <CheckCircle2 size={16} className="text-emerald-500" />
                      Resultados de Aprendizagem
                    </div>
                    <button type="button" onClick={() => setObjetivos(p => [...p, ""])} className="text-[#1F6B3B] text-[10px] font-bold uppercase tracking-wider">+ Adicionar</button>
                  </div>
                  <div className="grid gap-2">
                    {objetivos.map((obj, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          value={obj}
                          onChange={e => setObjetivos(p => p.map((v, idx) => idx === i ? e.target.value : v))}
                          placeholder="Ex: Dominar funções avançadas de Excel"
                          className="flex-1 rounded-lg border border-[#E4EBE6] px-3 py-1.5 text-sm outline-none focus:border-klasse-gold"
                        />
                        <button type="button" onClick={() => setObjetivos(p => p.filter((_, idx) => idx !== i))} className="text-rose-600"><Trash2 size={14} /></button>
                      </div>
                    ))}
                    {objetivos.length === 0 && <p className="text-xs text-slate-400 italic">Adicione o que o aluno ganhará com este curso.</p>}
                  </div>
                </div>

                {/* Requisitos */}
                <div className="grid gap-3 p-4 rounded-xl border border-[#E4EBE6]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-bold text-[#111811]">
                      <ListChecks size={16} className="text-amber-500" />
                      Requisitos Prévios
                    </div>
                    <button type="button" onClick={() => setRequisitos(p => [...p, ""])} className="text-[#1F6B3B] text-[10px] font-bold uppercase tracking-wider">+ Adicionar</button>
                  </div>
                  <div className="grid gap-2">
                    {requisitos.map((req, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          value={req}
                          onChange={e => setRequisitos(p => p.map((v, idx) => idx === i ? e.target.value : v))}
                          placeholder="Ex: Conhecimentos básicos de informática"
                          className="flex-1 rounded-lg border border-[#E4EBE6] px-3 py-1.5 text-sm outline-none focus:border-klasse-gold"
                        />
                        <button type="button" onClick={() => setRequisitos(p => p.filter((_, idx) => idx !== i))} className="text-rose-600"><Trash2 size={14} /></button>
                      </div>
                    ))}
                    {requisitos.length === 0 && <p className="text-xs text-slate-400 italic">Adicione o que o aluno precisa saber antes.</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "comercial" ? (
          <div className="grid gap-4">
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
              <Input
                label="Preço de tabela (Kz)"
                type="number"
                min={0}
                value={form.preco_tabela}
                onChange={(value) => setForm((prev) => ({ ...prev, preco_tabela: value }))}
                placeholder="50000"
              />
              <Input
                label="Custo Hora Formador (Kz)"
                type="number"
                min={0}
                value={form.custo_hora_estimado}
                onChange={(value) => setForm((prev) => ({ ...prev, custo_hora_estimado: value }))}
                placeholder="5000"
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
              <div className="flex flex-col gap-2 justify-center">
                <label className="flex items-center gap-2 text-sm text-[#4A6352]">
                  <input
                    type="checkbox"
                    checked={form.desconto_ativo}
                    onChange={(e) => setForm((prev) => ({ ...prev, desconto_ativo: e.target.checked }))}
                  />
                  Ativar desconto promocional
                </label>
                <label className="flex items-center gap-2 text-sm text-[#4A6352]">
                  <input
                    type="checkbox"
                    checked={form.parceria_b2b_ativa}
                    onChange={(e) => setForm((prev) => ({ ...prev, parceria_b2b_ativa: e.target.checked }))}
                  />
                  Aceita parceria B2B
                </label>
              </div>
            </div>

            <div className="rounded-xl border border-klasse-gold/20 bg-amber-50/30 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Calculator size={16} className="text-klasse-gold" />
                <strong className="text-sm text-[#111811]">Rentabilidade Teórica (por aluno)</strong>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-0.5">
                  <span className="text-[10px] uppercase font-bold text-[#8A9E8F]">Receita Estimada</span>
                  <span className="text-lg font-bold text-[#111811]">
                    {formatMoney(Number(form.preco_tabela) * (form.desconto_ativo ? (1 - Number(form.desconto_percentual) / 100) : 1))}
                  </span>
                </div>
                <div className="grid gap-0.5">
                  <span className="text-[10px] uppercase font-bold text-[#8A9E8F]">Custo Pedagógico</span>
                  <span className="text-lg font-bold text-rose-600">
                    {formatMoney(Number(form.custo_hora_estimado) * Number(form.carga_horaria))}
                    <small className="block text-[9px] font-normal text-slate-500">Custo total p/ centro (carga horária x valor hora)</small>
                  </span>
                </div>
                <div className="grid gap-0.5">
                  <span className="text-[10px] uppercase font-bold text-[#8A9E8F]">Ponto de Equilíbrio</span>
                  <span className="text-lg font-bold text-emerald-600">
                    {Math.ceil((Number(form.custo_hora_estimado) * Number(form.carga_horaria)) / (Number(form.preco_tabela) * (form.desconto_ativo ? (1 - Number(form.desconto_percentual) / 100) : 1) || 1))} Alunos
                    <small className="block text-[9px] font-normal text-slate-500">Qtd. mínima para cobrir o custo do formador</small>
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "materiais" ? (
          <div className="grid gap-3">
            <div className="flex items-center gap-2 text-[#4A6352] text-sm bg-[#F7F9F7] p-3 rounded-lg border border-dashed border-[#E4EBE6]">
              <Info size={16} className="shrink-0" />
              <p>Estes materiais serão automaticamente vinculados a todas as <strong>novas turmas</strong> criadas para este curso.</p>
            </div>
            {materiais.map((material, index) => (
              <div key={index} className="grid gap-2 rounded-xl border border-[#E4EBE6] p-3 md:grid-cols-[1fr_1.5fr_120px_auto]">
                <Input
                  label="Título"
                  value={material.titulo}
                  onChange={(value) =>
                    setMateriais((prev) => prev.map((item, i) => (i === index ? { ...item, titulo: value } : item)))
                  }
                  placeholder="Manual do Aluno"
                />
                <Input
                  label="URL / Link do Arquivo"
                  value={material.url}
                  onChange={(value) =>
                    setMateriais((prev) => prev.map((item, i) => (i === index ? { ...item, url: value } : item)))
                  }
                  placeholder="https://storage.moxi.ao/manual.pdf"
                />
                <label className="grid gap-1 text-sm text-[#4A6352]">
                  <span>Tipo</span>
                  <select
                    value={material.tipo}
                    onChange={(e) => setMateriais((prev) => prev.map((item, i) => (i === index ? { ...item, tipo: e.target.value } : item)))}
                    className="rounded-lg border border-[#E4EBE6] px-3 py-2 text-sm outline-none focus:border-klasse-gold"
                  >
                    <option value="pdf">PDF</option>
                    <option value="video">Vídeo</option>
                    <option value="link">Link Externo</option>
                    <option value="zip">Arquivo ZIP</option>
                  </select>
                </label>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => setMateriais((prev) => prev.filter((_, i) => i !== index))}
                    className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setMateriais((prev) => [...prev, { titulo: "", url: "", tipo: "pdf" }])}
              className="flex w-fit items-center gap-2 rounded-lg border border-[#E4EBE6] bg-white px-3 py-2 text-sm font-semibold text-[#1F6B3B] hover:bg-[#F7F9F7]"
            >
              <Plus size={16} /> Adicionar Material Padrão
            </button>
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
          <thead>
            <tr className="bg-zinc-50/90">
              <Th>Código</Th>
              <Th>Curso</Th>
              <Th>Modalidade</Th>
              <Th>Carga (h)</Th>
              <Th>Preço</Th>
              <Th>Recursos</Th>
              <Th>Status</Th>
              <Th>Ações</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="group hover:bg-[#F7F9F7]/50 transition-colors">
                <Td>
                  <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{item.codigo}</span>
                </Td>
                <Td>
                  <div>
                    <p className="font-semibold text-[#111811]">{item.nome}</p>
                    <p className="text-[10px] text-[#8A9E8F] uppercase font-bold tracking-wider">{item.area || "Geral"}</p>
                  </div>
                </Td>
                <Td>
                  <span className="capitalize text-xs text-[#4A6352]">{item.modalidade}</span>
                </Td>
                <Td>
                  <span className="text-xs font-medium text-[#4A6352]">{item.carga_horaria ?? "-"}h</span>
                </Td>
                <Td>
                  <div className="grid gap-0.5">
                    <span className="font-bold text-[#111811]">{formatMoney(item.preco_tabela)}</span>
                    {item.desconto_ativo && (
                      <span className="text-[10px] text-emerald-600 font-bold">-{item.desconto_percentual}% OFF</span>
                    )}
                  </div>
                </Td>
                <Td>
                  <div className="flex flex-col gap-1">
                    <span className="flex items-center gap-1 text-[11px] text-[#4A6352]">
                      <FileText size={10} className={item.certificado_template_id ? "text-klasse-gold" : "text-slate-300"} />
                      {item.certificado_template_id ? "Certificado Vinculado" : "Sem Certificado"}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-[#4A6352]">
                      <Plus size={10} className={item.materiais?.length > 0 ? "text-emerald-500" : "text-slate-300"} />
                      {item.materiais?.length || 0} Materiais Base
                    </span>
                  </div>
                </Td>
                <Td>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusPill(item.status)}`}>{item.status}</span>
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
