"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, Clock3, CreditCard, FileText, RefreshCw, Upload } from "lucide-react";

type Assinatura = {
  id: string;
  plano: string;
  ciclo: string;
  status: string;
  data_inicio: string;
  data_renovacao: string;
  valor_kz: number;
  metodo_pagamento: string;
  notas_internas: string | null;
};

type Pagamento = {
  id: string;
  status: string;
  valor_kz: number;
  metodo: string;
  referencia_ext: string | null;
  comprovativo_url: string | null;
  confirmado_em: string | null;
  periodo_inicio: string;
  periodo_fim: string;
  created_at: string;
};

type SubscriptionPayload = {
  centro: {
    nome: string;
    plano: string;
    plano_label: string;
    subscription_status: string;
    trial_ends_at: string | null;
  };
  assinatura: Assinatura | null;
  pagamentos: Pagamento[];
  plano: {
    price_mensal_kz: number | null;
    price_anual_kz: number | null;
    trial_days: number | null;
    discount_percent: number | null;
    promo_label: string | null;
    promo_ends_at: string | null;
  } | null;
  payment_instructions: {
    banco: string;
    titular_conta: string;
    iban: string;
    numero_conta: string;
    kwik_chave: string;
    email_comercial: string;
    telefone_comercial: string;
    whatsapp_comercial: string;
    link_pagamento: string;
  };
  meses_a_pagar: Array<{
    periodo_inicio: string;
    periodo_fim: string;
    label: string;
    valor_kz: number;
    status: string;
    pagamento_id: string | null;
    comprovativo_url: string | null;
  }>;
};

const currency = new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA" });

function formatDate(value: string | null | undefined) {
  if (!value) return "Sem data";
  return new Date(value).toLocaleDateString("pt-PT");
}

function statusTone(status: string) {
  if (["active", "activa", "confirmado", "pago"].includes(status)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (["trial", "pendente", "past_due", "em_aberto", "proximo"].includes(status)) return "border-amber-200 bg-amber-50 text-amber-700";
  if (["expired", "suspensa", "cancelada", "falhado"].includes(status)) return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function SubscricaoClient() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<SubscriptionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [referencia, setReferencia] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const latestPayment = data?.pagamentos[0] ?? null;
  const hasPendingPayment = data?.pagamentos.some((payment) => payment.status === "pendente") ?? false;
  const effectivePrice = data?.assinatura?.valor_kz ?? data?.plano?.price_mensal_kz ?? 0;
  const openTotal = (data?.meses_a_pagar ?? [])
    .filter((item) => item.status === "em_aberto")
    .reduce((sum, item) => sum + Number(item.valor_kz || 0), 0);
  const instructions = data?.payment_instructions;

  const daysLeft = useMemo(() => {
    const trialEndsAt = data?.centro.trial_ends_at;
    if (!trialEndsAt) return null;
    return Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000);
  }, [data?.centro.trial_ends_at]);

  async function load() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/formacao/admin/subscricao", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao carregar subscrição");
      setData(json.item);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Erro inesperado" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submitProof(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setMessage({ type: "error", text: "Selecione o comprovativo antes de enviar." });
      return;
    }

    setUploading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("referencia", referencia);

      const res = await fetch("/api/formacao/admin/subscricao/comprovativo", {
        method: "POST",
        body: formData,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao enviar comprovativo");

      setReferencia("");
      if (inputRef.current) inputRef.current.value = "";
      setMessage({ type: "success", text: "Comprovativo enviado. A equipa KLASSE vai validar e libertar a assinatura." });
      await load();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Erro inesperado" });
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">A carregar subscrição...</div>;
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700">
        Não foi possível carregar a subscrição.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message ? (
        <div className={`rounded-xl border p-4 text-sm font-semibold ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
          {message.text}
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <article className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">assinatura klasse formação</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-950">Plano {data.centro.plano_label}</h2>
              <p className="mt-2 text-sm text-slate-600">{data.centro.nome}</p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${statusTone(data.centro.subscription_status)}`}>
              {data.centro.subscription_status}
            </span>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Metric title="Mensalidade" value={effectivePrice ? currency.format(effectivePrice) : "Sob consulta"} />
            <Metric title="Renovação" value={formatDate(data.assinatura?.data_renovacao ?? data.centro.trial_ends_at)} />
            <Metric title="Trial" value={daysLeft == null ? "Sem trial" : `${Math.max(0, daysLeft)} dia${daysLeft === 1 ? "" : "s"}`} />
          </div>

          {latestPayment ? (
            <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">último comprovativo</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {currency.format(latestPayment.valor_kz)} · enviado em {formatDate(latestPayment.created_at)}
                  </p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${statusTone(latestPayment.status)}`}>
                  {latestPayment.status}
                </span>
              </div>
            </div>
          ) : null}
        </article>

        <aside className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-klasse-green" />
            <h3 className="text-base font-bold text-slate-950">Enviar comprovativo</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Anexe o comprovativo da subscrição para validação pelo Super Admin.
          </p>

          {instructions ? (
            <div className="mt-4 space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-700">
              <InfoRow label="Banco" value={instructions.banco} />
              <InfoRow label="Titular" value={instructions.titular_conta} />
              <InfoRow label="IBAN" value={instructions.iban} />
              <InfoRow label="Conta" value={instructions.numero_conta} />
              <InfoRow label="Kwik" value={instructions.kwik_chave} />
              {instructions.link_pagamento ? (
                <a href={instructions.link_pagamento} target="_blank" rel="noreferrer" className="inline-flex text-xs font-bold text-klasse-green hover:underline">
                  Abrir link de pagamento
                </a>
              ) : null}
            </div>
          ) : null}

          {hasPendingPayment ? (
            <div className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-700">
              <Clock3 className="h-4 w-4 shrink-0" />
              Já existe um comprovativo pendente de validação.
            </div>
          ) : null}

          <form className="mt-5 space-y-4" onSubmit={submitProof}>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Referência</span>
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-klasse-green"
                value={referencia}
                onChange={(event) => setReferencia(event.target.value)}
                placeholder="Nº operação, transação ou nota"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Comprovativo</span>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={uploading || hasPendingPayment}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-klasse-green px-4 py-2.5 text-sm font-bold text-white transition hover:bg-klasse-green/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Upload className="h-4 w-4" />
              {uploading ? "A enviar..." : "Enviar comprovativo"}
            </button>
          </form>
        </aside>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-950">Meses a pagar</h2>
            <p className="text-xs text-slate-500">Mapa operacional de mensalidades abertas, pendentes e pagas.</p>
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
            Em aberto: {currency.format(openTotal)}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-5 py-3">Período</th>
                <th className="px-5 py-3">Valor</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3">Cobertura</th>
                <th className="px-5 py-3 text-right">Prova</th>
              </tr>
            </thead>
            <tbody>
              {data.meses_a_pagar.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                    Sem mensalidades calculadas para esta assinatura.
                  </td>
                </tr>
              ) : (
                data.meses_a_pagar.map((month) => (
                  <tr key={month.periodo_inicio} className="border-t border-slate-100">
                    <td className="px-5 py-3 font-semibold capitalize text-slate-950">{month.label}</td>
                    <td className="px-5 py-3 text-slate-700">{currency.format(month.valor_kz)}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${statusTone(month.status)}`}>
                        {month.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {formatDate(month.periodo_inicio)} a {formatDate(month.periodo_fim)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {month.comprovativo_url ? (
                        <a href={month.comprovativo_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-klasse-green hover:underline">
                          <FileText className="h-3.5 w-3.5" />
                          Ver
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">Sem prova</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-950">Histórico de pagamentos</h2>
            <p className="text-xs text-slate-500">Comprovativos enviados para validação da assinatura.</p>
          </div>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-5 py-3">Data</th>
                <th className="px-5 py-3">Valor</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3">Referência</th>
                <th className="px-5 py-3 text-right">Prova</th>
              </tr>
            </thead>
            <tbody>
              {data.pagamentos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                    Ainda não existem comprovativos enviados.
                  </td>
                </tr>
              ) : (
                data.pagamentos.map((payment) => (
                  <tr key={payment.id} className="border-t border-slate-100">
                    <td className="px-5 py-3 text-slate-700">{formatDate(payment.created_at)}</td>
                    <td className="px-5 py-3 font-semibold text-slate-950">{currency.format(payment.valor_kz)}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${statusTone(payment.status)}`}>
                        {payment.status === "confirmado" ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{payment.referencia_ext || "-"}</td>
                    <td className="px-5 py-3 text-right">
                      {payment.comprovativo_url ? (
                        <a href={payment.comprovativo_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-klasse-green hover:underline">
                          <FileText className="h-3.5 w-3.5" />
                          Ver
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">Sem anexo</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{title}</p>
      <p className="mt-2 text-base font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="font-bold text-slate-500">{label}</span>
      <span className="text-right font-semibold text-slate-900">{value}</span>
    </div>
  );
}
