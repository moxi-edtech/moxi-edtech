"use client";

import { FormEvent, useEffect, useState } from "react";

type Template = {
  id: string;
  nome: string;
  diretora_nome: string | null;
  cargo_assinatura: string | null;
  base_legal: string | null;
  regime_default: string | null;
  ativo: boolean;
};

type Emissao = {
  id: string;
  numero_documento: string;
  emitido_em: string;
  formando_user_id: string;
  cohort_id: string | null;
  template_id: string | null;
};

type FormandoOption = {
  user_id: string;
  label: string;
};

type CohortOption = {
  id: string;
  label: string;
};

export default function CertificadosPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [emissoes, setEmissoes] = useState<Emissao[]>([]);
  const [formandos, setFormandos] = useState<FormandoOption[]>([]);
  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [templateForm, setTemplateForm] = useState({
    nome: "",
    diretora_nome: "",
    cargo_assinatura: "",
    base_legal: "",
    regime_default: "",
  });

  const [emissaoForm, setEmissaoForm] = useState({
    template_id: "",
    formando_user_id: "",
    cohort_id: "",
    numero_documento: "",
  });

  const load = async () => {
    try {
      setError(null);
      const [templatesRes, emissoesRes, optionsRes] = await Promise.all([
        fetch("/api/formacao/certificados/templates", { cache: "no-store" }),
        fetch("/api/formacao/certificados/emissoes", { cache: "no-store" }),
        fetch("/api/formacao/certificados/options", { cache: "no-store" }),
      ]);

      const templatesJson = (await templatesRes.json().catch(() => null)) as
        | { ok: boolean; error?: string; items?: Template[] }
        | null;
      const emissoesJson = (await emissoesRes.json().catch(() => null)) as
        | { ok: boolean; error?: string; items?: Emissao[] }
        | null;
      const optionsJson = (await optionsRes.json().catch(() => null)) as
        | { ok: boolean; error?: string; formandos?: FormandoOption[]; cohorts?: CohortOption[] }
        | null;

      if (!templatesRes.ok || !templatesJson?.ok || !Array.isArray(templatesJson.items)) {
        throw new Error(templatesJson?.error || "Falha ao carregar templates");
      }
      if (!emissoesRes.ok || !emissoesJson?.ok || !Array.isArray(emissoesJson.items)) {
        throw new Error(emissoesJson?.error || "Falha ao carregar emissões");
      }
      if (!optionsRes.ok || !optionsJson?.ok) {
        throw new Error(optionsJson?.error || "Falha ao carregar opções");
      }

      setTemplates(templatesJson.items);
      setEmissoes(emissoesJson.items);
      setFormandos(Array.isArray(optionsJson.formandos) ? optionsJson.formandos : []);
      setCohorts(Array.isArray(optionsJson.cohorts) ? optionsJson.cohorts : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createTemplate = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const res = await fetch("/api/formacao/certificados/templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(templateForm),
    });
    const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;

    if (!res.ok || !json?.ok) {
      setError(json?.error || "Falha ao criar template");
      return;
    }

    setTemplateForm({ nome: "", diretora_nome: "", cargo_assinatura: "", base_legal: "", regime_default: "" });
    load();
  };

  const emitir = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const res = await fetch("/api/formacao/certificados/emissoes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(emissaoForm),
    });
    const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;

    if (!res.ok || !json?.ok) {
      setError(json?.error || "Falha ao emitir certificado");
      return;
    }

    setEmissaoForm({ template_id: "", formando_user_id: "", cohort_id: "", numero_documento: "" });
    load();
  };

  const toggleTemplate = async (id: string, ativo: boolean) => {
    setError(null);
    const res = await fetch("/api/formacao/certificados/templates", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, ativo: !ativo }),
    });
    const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;
    if (!res.ok || !json?.ok) {
      setError(json?.error || "Falha ao atualizar template");
      return;
    }
    load();
  };

  const removeTemplate = async (id: string) => {
    setError(null);
    const res = await fetch(`/api/formacao/certificados/templates?id=${id}`, { method: "DELETE" });
    const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;
    if (!res.ok || !json?.ok) {
      setError(json?.error || "Falha ao remover template");
      return;
    }
    load();
  };

  const removeEmissao = async (id: string) => {
    setError(null);
    const res = await fetch(`/api/formacao/certificados/emissoes?id=${id}`, { method: "DELETE" });
    const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;
    if (!res.ok || !json?.ok) {
      setError(json?.error || "Falha ao remover emissão");
      return;
    }
    load();
  };

  return (
    <div className="grid gap-4">
      <h1 className="m-0 text-3xl font-bold text-zinc-900">Certificados</h1>

      <form onSubmit={createTemplate} className="grid gap-2 rounded-xl border border-zinc-200 p-3">
        <strong>Novo template</strong>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={templateForm.nome} onChange={(e) => setTemplateForm((p) => ({ ...p, nome: e.target.value }))} placeholder="Nome do template" />
          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={templateForm.diretora_nome} onChange={(e) => setTemplateForm((p) => ({ ...p, diretora_nome: e.target.value }))} placeholder="Nome da diretora" />
          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={templateForm.cargo_assinatura} onChange={(e) => setTemplateForm((p) => ({ ...p, cargo_assinatura: e.target.value }))} placeholder="Cargo assinatura" />
          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={templateForm.regime_default} onChange={(e) => setTemplateForm((p) => ({ ...p, regime_default: e.target.value }))} placeholder="Regime default" />
        </div>
        <textarea className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={templateForm.base_legal} onChange={(e) => setTemplateForm((p) => ({ ...p, base_legal: e.target.value }))} placeholder="Base legal" rows={2} />
        <button type="submit" className="w-fit rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800">Criar template</button>
      </form>

      <form onSubmit={emitir} className="grid gap-2 rounded-xl border border-zinc-200 p-3">
        <strong>Emitir certificado</strong>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <select className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={emissaoForm.template_id} onChange={(e) => setEmissaoForm((p) => ({ ...p, template_id: e.target.value }))}>
            <option value="">Template</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.nome}</option>
            ))}
          </select>
          <select className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={emissaoForm.formando_user_id} onChange={(e) => setEmissaoForm((p) => ({ ...p, formando_user_id: e.target.value }))} required>
            <option value="">Selecione o formando</option>
            {formandos.map((f) => (
              <option key={f.user_id} value={f.user_id}>{f.label}</option>
            ))}
          </select>
          <select className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={emissaoForm.cohort_id} onChange={(e) => setEmissaoForm((p) => ({ ...p, cohort_id: e.target.value }))}>
            <option value="">Sem turma</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" value={emissaoForm.numero_documento} onChange={(e) => setEmissaoForm((p) => ({ ...p, numero_documento: e.target.value }))} placeholder="Número (opcional)" />
        </div>
        <button type="submit" className="w-fit rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800">Emitir</button>
      </form>

      {error ? <p className="m-0 text-sm text-red-700">{error}</p> : null}

      <section className="rounded-xl border border-zinc-200 p-3">
        <strong>Templates</strong>
        <ul className="mb-0">
          {templates.map((t) => (
            <li key={t.id}>
              {t.nome} {t.ativo ? "(ativo)" : "(inativo)"}
              <span className="ml-2 inline-flex gap-1.5">
                <button className="rounded-md border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-50" type="button" onClick={() => toggleTemplate(t.id, t.ativo)}>
                  {t.ativo ? "Inativar" : "Ativar"}
                </button>
                <button className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50" type="button" onClick={() => removeTemplate(t.id)}>
                  Apagar
                </button>
              </span>
            </li>
          ))}
          {templates.length === 0 ? <li>Sem templates.</li> : null}
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-200 p-3">
        <strong>Certificados emitidos</strong>
        <ul className="mb-0">
          {emissoes.map((e) => (
            <li key={e.id}>
              {e.numero_documento} · {e.formando_user_id} · {e.emitido_em}
              <span className="ml-2">
                <button className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50" type="button" onClick={() => removeEmissao(e.id)}>
                  Apagar
                </button>
              </span>
            </li>
          ))}
          {emissoes.length === 0 ? <li>Sem emissões.</li> : null}
        </ul>
      </section>
    </div>
  );
}
