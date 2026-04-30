"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Copy, CreditCard, Eye, Loader2, Save } from "lucide-react";
import { toast } from "@/lib/toast";

type DadosPagamento = {
  ativo: boolean;
  banco: string;
  titular_conta: string;
  iban: string;
  numero_conta: string;
  kwik_chave: string;
  instrucoes_checkout: string;
};

const emptyForm: DadosPagamento = {
  ativo: false,
  banco: "",
  titular_conta: "",
  iban: "",
  numero_conta: "",
  kwik_chave: "",
  instrucoes_checkout: "",
};

export function RecebimentosClient() {
  const [form, setForm] = useState<DadosPagamento>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/formacao/financeiro/recebimentos", { cache: "no-store" });
        const json = await response.json().catch(() => null);
        if (!response.ok || !json?.ok) throw new Error(json?.error || "Falha ao carregar dados de recebimento.");
        setForm({ ...emptyForm, ...json.item });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao carregar dados de recebimento.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/formacao/financeiro/recebimentos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: form }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || "Falha ao guardar dados de recebimento.");
      setForm({ ...emptyForm, ...json.item });
      toast({ title: "Recebimentos atualizados", description: "O checkout público passa a usar estes dados." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao guardar dados de recebimento.";
      setError(message);
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">financeiro</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Recebimentos e Checkout</h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
              Configure os dados bancários e Kwik exibidos na landing page, no checkout público e no portal do aluno.
            </p>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              form.ativo ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            {form.ativo ? "Checkout ativo" : "Checkout sem dados ativos"}
          </span>
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
        <main className="grid gap-5 xl:grid-cols-[1fr_420px]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(event) => setForm((current) => ({ ...current, ativo: event.target.checked }))}
                  className="h-5 w-5 rounded border-slate-300 text-klasse-green focus:ring-klasse-green"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-950">Mostrar estes dados no checkout público</span>
                  <span className="block text-xs text-slate-500">Quando desligado, a landing não expõe instruções bancárias.</span>
                </span>
              </label>

              <Field label="Banco">
                <input className={inputClass} value={form.banco} onChange={(e) => setForm((p) => ({ ...p, banco: e.target.value }))} placeholder="Ex: Banco Angolano de Investimentos" />
              </Field>
              <Field label="Titular da conta">
                <input className={inputClass} value={form.titular_conta} onChange={(e) => setForm((p) => ({ ...p, titular_conta: e.target.value }))} placeholder="Nome legal do centro ou empresa" />
              </Field>
              <Field label="IBAN">
                <input className={inputClass} value={form.iban} onChange={(e) => setForm((p) => ({ ...p, iban: e.target.value.toUpperCase() }))} placeholder="AO06 ..." />
              </Field>
              <Field label="Número de conta">
                <input className={inputClass} value={form.numero_conta} onChange={(e) => setForm((p) => ({ ...p, numero_conta: e.target.value }))} placeholder="Número local da conta" />
              </Field>
              <Field label="Chave Kwik">
                <input className={inputClass} value={form.kwik_chave} onChange={(e) => setForm((p) => ({ ...p, kwik_chave: e.target.value }))} placeholder="Telefone, email ou identificador Kwik" />
              </Field>
              <Field label="Instruções para checkout">
                <textarea
                  className={`${inputClass} min-h-28 resize-y md:col-span-2`}
                  value={form.instrucoes_checkout}
                  onChange={(e) => setForm((p) => ({ ...p, instrucoes_checkout: e.target.value }))}
                  placeholder="Ex: Envie o comprovativo com o nome completo do formando. A validação pode levar até 24h úteis."
                />
              </Field>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-klasse-green px-5 py-3 text-sm font-semibold text-white hover:bg-klasse-green/90 disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Guardar recebimentos
              </button>
            </div>
          </section>

          <aside className="space-y-4">
            <PreviewCard form={form} />
            <Checklist form={form} />
          </aside>
        </main>
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-colors focus:border-klasse-green focus:bg-white";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="ml-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function PreviewCard({ form }: { form: DadosPagamento }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-klasse-gold">preview checkout</p>
          <h2 className="mt-1 text-lg font-semibold">Dados para pagamento</h2>
        </div>
        <Eye size={20} className="text-slate-400" />
      </div>

      <div className="mt-5 space-y-3">
        <PreviewLine label="Banco" value={form.banco || "Banco não definido"} />
        <PreviewLine label="Titular" value={form.titular_conta || "Titular não definido"} />
        <PreviewLine label="IBAN" value={form.iban || "IBAN não definido"} mono />
        <PreviewLine label="Conta" value={form.numero_conta || "Número não definido"} mono />
        <PreviewLine label="Kwik" value={form.kwik_chave || "Chave Kwik não definida"} />
      </div>

      <p className="mt-5 rounded-xl border border-white/10 bg-white/5 p-3 text-sm leading-6 text-slate-300">
        {form.instrucoes_checkout || "Efetue a transferência, guarde o comprovativo e anexe no checkout para validar a vaga."}
      </p>
    </section>
  );
}

function PreviewLine({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</span>
        <Copy size={13} className="text-slate-500" />
      </div>
      <p className={`mt-1 break-all text-sm font-semibold text-klasse-gold ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function Checklist({ form }: { form: DadosPagamento }) {
  const items = [
    { label: "Checkout ativo", done: form.ativo },
    { label: "Tem IBAN, conta ou Kwik", done: Boolean(form.iban || form.numero_conta || form.kwik_chave) },
    { label: "Titular identificado", done: Boolean(form.titular_conta) },
    { label: "Instruções claras", done: Boolean(form.instrucoes_checkout) },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-950">Prontidão do checkout</h2>
      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="text-slate-700">{item.label}</span>
            <CheckCircle2 size={16} className={item.done ? "text-emerald-600" : "text-slate-300"} />
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm leading-6 text-blue-800">
        Estes dados são operacionais. NIF, séries e faturação oficial continuam na configuração fiscal.
      </div>
    </section>
  );
}
