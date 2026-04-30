"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Globe2,
  Loader2,
  MessageCircle,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "@/lib/toast";

type FaqItem = {
  pergunta: string;
  resposta: string;
};

type PublicacaoForm = {
  badge: string;
  headline: string;
  descricao: string;
  banner_url: string;
  instrucoes: string;
  contactos: {
    whatsapp: string;
    telefone: string;
    email: string;
    endereco: string;
  };
  redes_sociais: {
    instagram: string;
    facebook: string;
    linkedin: string;
    website: string;
  };
  faq: FaqItem[];
};

type ReadinessItem = {
  id: string;
  codigo: string | null;
  nome: string | null;
  curso_nome: string | null;
  status: string | null;
  vagas: number;
  vagas_ocupadas: number;
  valor_referencia: number;
  moeda: string;
  data_inicio: string | null;
  checks: {
    curso_ativo: boolean;
    turma_aberta: boolean;
    preco_configurado: boolean;
    vagas_disponiveis: boolean;
    recebimentos_ativos: boolean;
  };
  pronto: boolean;
};

const emptyForm: PublicacaoForm = {
  badge: "",
  headline: "",
  descricao: "",
  banner_url: "",
  instrucoes: "",
  contactos: {
    whatsapp: "",
    telefone: "",
    email: "",
    endereco: "",
  },
  redes_sociais: {
    instagram: "",
    facebook: "",
    linkedin: "",
    website: "",
  },
  faq: [],
};

export function PublicacaoClient() {
  const [form, setForm] = useState<PublicacaoForm>(emptyForm);
  const [readiness, setReadiness] = useState<ReadinessItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stats = useMemo(() => {
    const ready = readiness.filter((item) => item.pronto).length;
    return { ready, total: readiness.length };
  }, [readiness]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/formacao/admin/publicacao", { cache: "no-store" });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Falha ao carregar publicação.");
      setForm({ ...emptyForm, ...json.item });
      setReadiness(Array.isArray(json.readiness) ? json.readiness : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar publicação.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/formacao/admin/publicacao", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: form }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Falha ao guardar publicação.");
      setForm({ ...emptyForm, ...json.item });
      toast({ title: "Publicação atualizada", description: "A landing pública passa a usar este conteúdo." });
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao guardar publicação.";
      setError(message);
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function updateContact(key: keyof PublicacaoForm["contactos"], value: string) {
    setForm((current) => ({ ...current, contactos: { ...current.contactos, [key]: value } }));
  }

  function updateSocial(key: keyof PublicacaoForm["redes_sociais"], value: string) {
    setForm((current) => ({ ...current, redes_sociais: { ...current.redes_sociais, [key]: value } }));
  }

  function updateFaq(index: number, patch: Partial<FaqItem>) {
    setForm((current) => ({
      ...current,
      faq: current.faq.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  }

  function addFaq() {
    setForm((current) => ({
      ...current,
      faq: [...current.faq, { pergunta: "", resposta: "" }].slice(0, 8),
    }));
  }

  function removeFaq(index: number) {
    setForm((current) => ({ ...current, faq: current.faq.filter((_, i) => i !== index) }));
  }

  return (
    <div className="space-y-6 pb-12">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">admin</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Publicação da Landing</h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
              Controle o texto público, contactos, FAQ e a prontidão dos cursos que aparecem para visitantes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/financeiro/recebimentos"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <MessageCircle size={16} />
              Recebimentos
            </Link>
            <button
              type="button"
              onClick={save}
              disabled={saving || loading}
              className="inline-flex items-center gap-2 rounded-xl bg-klasse-green px-4 py-2 text-sm font-semibold text-white hover:bg-klasse-green/90 disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Guardar
            </button>
          </div>
        </div>
      </header>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">{error}</div>
      ) : null}

      {loading ? (
        <div className="h-96 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Loader2 className="animate-spin text-slate-400" size={24} />
        </div>
      ) : (
        <main className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
          <section className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <SectionTitle title="Conteúdo público" description="Textos de topo e instruções que substituem o conteúdo fixo da landing." />
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="Etiqueta">
                  <input className={inputClass} value={form.badge} onChange={(e) => setForm((p) => ({ ...p, badge: e.target.value }))} placeholder="Ex: Inscrições abertas" />
                </Field>
                <Field label="Banner URL">
                  <input className={inputClass} value={form.banner_url} onChange={(e) => setForm((p) => ({ ...p, banner_url: e.target.value }))} placeholder="https://..." />
                </Field>
                <Field label="Headline">
                  <input className={inputClass} value={form.headline} onChange={(e) => setForm((p) => ({ ...p, headline: e.target.value }))} placeholder="Formação profissional para acelerar a sua carreira" />
                </Field>
                <Field label="Descrição">
                  <textarea className={`${inputClass} min-h-28 resize-y`} value={form.descricao} onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))} placeholder="Explique a proposta do centro em linguagem comercial clara." />
                </Field>
                <Field label="Instruções públicas">
                  <textarea className={`${inputClass} min-h-28 resize-y md:col-span-2`} value={form.instrucoes} onChange={(e) => setForm((p) => ({ ...p, instrucoes: e.target.value }))} placeholder="Ex: Escolha uma turma, preencha os dados e anexe o comprovativo no checkout." />
                </Field>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <SectionTitle title="Contactos e redes" description="Dados visíveis para alunos que precisam falar com a secretaria antes de se inscrever." />
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field label="WhatsApp">
                  <input className={inputClass} value={form.contactos.whatsapp} onChange={(e) => updateContact("whatsapp", e.target.value)} placeholder="+244 9xx xxx xxx" />
                </Field>
                <Field label="Telefone">
                  <input className={inputClass} value={form.contactos.telefone} onChange={(e) => updateContact("telefone", e.target.value)} placeholder="+244 9xx xxx xxx" />
                </Field>
                <Field label="E-mail">
                  <input className={inputClass} value={form.contactos.email} onChange={(e) => updateContact("email", e.target.value)} placeholder="secretaria@centro.ao" />
                </Field>
                <Field label="Endereço">
                  <input className={inputClass} value={form.contactos.endereco} onChange={(e) => updateContact("endereco", e.target.value)} placeholder="Rua, município, província" />
                </Field>
                <Field label="Instagram">
                  <input className={inputClass} value={form.redes_sociais.instagram} onChange={(e) => updateSocial("instagram", e.target.value)} placeholder="https://instagram.com/..." />
                </Field>
                <Field label="Facebook">
                  <input className={inputClass} value={form.redes_sociais.facebook} onChange={(e) => updateSocial("facebook", e.target.value)} placeholder="https://facebook.com/..." />
                </Field>
                <Field label="LinkedIn">
                  <input className={inputClass} value={form.redes_sociais.linkedin} onChange={(e) => updateSocial("linkedin", e.target.value)} placeholder="https://linkedin.com/company/..." />
                </Field>
                <Field label="Website">
                  <input className={inputClass} value={form.redes_sociais.website} onChange={(e) => updateSocial("website", e.target.value)} placeholder="https://..." />
                </Field>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <SectionTitle title="FAQ pública" description="Perguntas exibidas na landing. Sem itens configurados, usamos a FAQ padrão." />
                <button type="button" onClick={addFaq} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  <Plus size={16} />
                  Pergunta
                </button>
              </div>
              <div className="mt-5 space-y-3">
                {form.faq.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                    Nenhuma pergunta personalizada. Adicione as dúvidas mais comuns sobre inscrições, pagamento e certificado.
                  </div>
                ) : (
                  form.faq.map((item, index) => (
                    <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-500">Pergunta {index + 1}</span>
                        <button type="button" onClick={() => removeFaq(index)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50" aria-label="Remover pergunta">
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-[0.8fr_1.2fr]">
                        <input className={inputClass} value={item.pergunta} onChange={(e) => updateFaq(index, { pergunta: e.target.value })} placeholder="Pergunta" />
                        <textarea className={`${inputClass} min-h-20 resize-y`} value={item.resposta} onChange={(e) => updateFaq(index, { resposta: e.target.value })} placeholder="Resposta" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <aside className="space-y-5">
            <Preview form={form} />
            <ReadinessPanel items={readiness} ready={stats.ready} total={stats.total} />
          </aside>
        </main>
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-colors focus:border-klasse-green focus:bg-white";

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-base font-bold text-slate-950">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="ml-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function Preview({ form }: { form: PublicacaoForm }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-klasse-gold">preview</p>
          <h2 className="mt-1 text-lg font-semibold">Topo da landing</h2>
        </div>
        <Globe2 size={20} className="text-slate-400" />
      </div>
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-klasse-gold">{form.badge || "Inscrições abertas"}</p>
        <h3 className="mt-3 text-xl font-black leading-tight">{form.headline || "Formação Profissional Certificada"}</h3>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {form.descricao || "Cursos práticos e certificados para transformar o futuro profissional dos seus alunos."}
        </p>
      </div>
      <div className="mt-4 space-y-2 text-sm text-slate-300">
        {form.contactos.whatsapp ? <p>WhatsApp: {form.contactos.whatsapp}</p> : null}
        {form.contactos.email ? <p>E-mail: {form.contactos.email}</p> : null}
        {form.contactos.endereco ? <p>Endereço: {form.contactos.endereco}</p> : null}
      </div>
    </section>
  );
}

function ReadinessPanel({ items, ready, total }: { items: ReadinessItem[]; ready: number; total: number }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-950">Pronto para landing</h2>
          <p className="mt-1 text-sm text-slate-600">
            {ready} de {total} turmas cumprem todos os critérios.
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
          {total === 0 ? "sem turmas" : `${Math.round((ready / Math.max(total, 1)) * 100)}%`}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            Crie cursos e turmas para validar a publicação na landing.
          </div>
        ) : (
          items.map((item) => <ReadinessCard key={item.id} item={item} />)
        )}
      </div>
    </section>
  );
}

function ReadinessCard({ item }: { item: ReadinessItem }) {
  const checks = [
    { label: "Curso ativo", done: item.checks.curso_ativo },
    { label: "Turma aberta", done: item.checks.turma_aberta },
    { label: "Preço configurado", done: item.checks.preco_configurado },
    { label: "Vagas disponíveis", done: item.checks.vagas_disponiveis },
    { label: "Recebimentos ativos", done: item.checks.recebimentos_ativos },
  ];

  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-slate-950">{item.curso_nome || item.nome || "Turma sem curso"}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {item.codigo || "Sem código"} · {item.vagas_ocupadas}/{item.vagas || "∞"} vagas · {item.valor_referencia} {item.moeda}
          </p>
        </div>
        {item.pronto ? <CheckCircle2 size={18} className="text-emerald-600" /> : <AlertCircle size={18} className="text-amber-600" />}
      </div>

      <div className="mt-3 grid gap-2">
        {checks.map((check) => (
          <div key={check.label} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-xs">
            <span className="font-medium text-slate-700">{check.label}</span>
            <CheckCircle2 size={14} className={check.done ? "text-emerald-600" : "text-slate-300"} />
          </div>
        ))}
      </div>

      {!item.pronto ? (
        <Link href="/secretaria/turmas" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-klasse-green hover:underline">
          Ajustar turma <ExternalLink size={12} />
        </Link>
      ) : null}
    </article>
  );
}
