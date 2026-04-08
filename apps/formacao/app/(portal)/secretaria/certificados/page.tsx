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

export default function CertificadosPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [emissoes, setEmissoes] = useState<Emissao[]>([]);
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
      const [templatesRes, emissoesRes] = await Promise.all([
        fetch("/api/formacao/certificados/templates", { cache: "no-store" }),
        fetch("/api/formacao/certificados/emissoes", { cache: "no-store" }),
      ]);

      const templatesJson = (await templatesRes.json().catch(() => null)) as
        | { ok: boolean; error?: string; items?: Template[] }
        | null;
      const emissoesJson = (await emissoesRes.json().catch(() => null)) as
        | { ok: boolean; error?: string; items?: Emissao[] }
        | null;

      if (!templatesRes.ok || !templatesJson?.ok || !Array.isArray(templatesJson.items)) {
        throw new Error(templatesJson?.error || "Falha ao carregar templates");
      }
      if (!emissoesRes.ok || !emissoesJson?.ok || !Array.isArray(emissoesJson.items)) {
        throw new Error(emissoesJson?.error || "Falha ao carregar emissões");
      }

      setTemplates(templatesJson.items);
      setEmissoes(emissoesJson.items);
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
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0 }}>Certificados</h1>

      <form onSubmit={createTemplate} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12, display: "grid", gap: 8 }}>
        <strong>Novo template</strong>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8 }}>
          <input value={templateForm.nome} onChange={(e) => setTemplateForm((p) => ({ ...p, nome: e.target.value }))} placeholder="Nome do template" />
          <input value={templateForm.diretora_nome} onChange={(e) => setTemplateForm((p) => ({ ...p, diretora_nome: e.target.value }))} placeholder="Nome da diretora" />
          <input value={templateForm.cargo_assinatura} onChange={(e) => setTemplateForm((p) => ({ ...p, cargo_assinatura: e.target.value }))} placeholder="Cargo assinatura" />
          <input value={templateForm.regime_default} onChange={(e) => setTemplateForm((p) => ({ ...p, regime_default: e.target.value }))} placeholder="Regime default" />
        </div>
        <textarea value={templateForm.base_legal} onChange={(e) => setTemplateForm((p) => ({ ...p, base_legal: e.target.value }))} placeholder="Base legal" rows={2} />
        <button type="submit">Criar template</button>
      </form>

      <form onSubmit={emitir} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12, display: "grid", gap: 8 }}>
        <strong>Emitir certificado</strong>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8 }}>
          <select value={emissaoForm.template_id} onChange={(e) => setEmissaoForm((p) => ({ ...p, template_id: e.target.value }))}>
            <option value="">Template</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.nome}</option>
            ))}
          </select>
          <input value={emissaoForm.formando_user_id} onChange={(e) => setEmissaoForm((p) => ({ ...p, formando_user_id: e.target.value }))} placeholder="Formando user_id" />
          <input value={emissaoForm.cohort_id} onChange={(e) => setEmissaoForm((p) => ({ ...p, cohort_id: e.target.value }))} placeholder="Cohort id (opcional)" />
          <input value={emissaoForm.numero_documento} onChange={(e) => setEmissaoForm((p) => ({ ...p, numero_documento: e.target.value }))} placeholder="Número (opcional)" />
        </div>
        <button type="submit">Emitir</button>
      </form>

      {error ? <p style={{ margin: 0, color: "#b91c1c" }}>{error}</p> : null}

      <section style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}>
        <strong>Templates</strong>
        <ul style={{ marginBottom: 0 }}>
          {templates.map((t) => (
            <li key={t.id}>
              {t.nome} {t.ativo ? "(ativo)" : "(inativo)"}
              <span style={{ marginLeft: 8, display: "inline-flex", gap: 6 }}>
                <button type="button" onClick={() => toggleTemplate(t.id, t.ativo)}>
                  {t.ativo ? "Inativar" : "Ativar"}
                </button>
                <button type="button" onClick={() => removeTemplate(t.id)}>
                  Apagar
                </button>
              </span>
            </li>
          ))}
          {templates.length === 0 ? <li>Sem templates.</li> : null}
        </ul>
      </section>

      <section style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}>
        <strong>Certificados emitidos</strong>
        <ul style={{ marginBottom: 0 }}>
          {emissoes.map((e) => (
            <li key={e.id}>
              {e.numero_documento} · {e.formando_user_id} · {e.emitido_em}
              <span style={{ marginLeft: 8 }}>
                <button type="button" onClick={() => removeEmissao(e.id)}>
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
