"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";

import { useToast } from "@/components/feedback/FeedbackSystem";
import type { FiscalDoc } from "@/components/fiscal/types";

type FiscalRetificarPageProps = {
  params: Promise<{ id: string }>;
};

type DocumentosApiResponse = {
  ok?: boolean;
  data?: {
    docs?: FiscalDoc[];
  };
  error?: {
    code?: string;
    message?: string;
  };
};

type ActionApiResponse = {
  ok?: boolean;
  error?: {
    code?: string;
    message?: string;
  };
};

const kwanza = new Intl.NumberFormat("pt-AO", {
  style: "currency",
  currency: "AOA",
});

const dateFormat = new Intl.DateTimeFormat("pt-AO", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(iso: string) {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return "-";
  return dateFormat.format(value);
}

export default function FiscalRetificarPage({ params }: FiscalRetificarPageProps) {
  const [docId, setDocId] = useState<string>("");
  const [doc, setDoc] = useState<FiscalDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { success, warning, error } = useToast();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const resolvedParams = await params;
        if (cancelled) return;
        setDocId(resolvedParams.id);

        const response = await fetch("/api/fiscal/documentos", {
          method: "GET",
          cache: "no-store",
        });
        const json = (await response.json().catch(() => ({}))) as DocumentosApiResponse;

        if (cancelled) return;

        if (!response.ok || json.ok !== true) {
          setErrorMessage(json.error?.message ?? "Não foi possível carregar o documento para retificação.");
          return;
        }

        const found = (json.data?.docs ?? []).find((item) => item.id === resolvedParams.id) ?? null;
        if (!found) {
          setErrorMessage("Documento fiscal não encontrado para retificação.");
          return;
        }

        setDoc(found);
      } catch {
        if (cancelled) return;
        setErrorMessage("Não foi possível carregar o documento para retificação.");
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [params]);

  const motivoInvalido = useMemo(() => motivo.trim().length < 10, [motivo]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || motivoInvalido || !docId) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/fiscal/documentos/${docId}/rectificar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          motivo: motivo.trim(),
          metadata: {
            origem: "ui_retificacao_fiscal",
          },
        }),
      });

      const json = (await response.json().catch(() => ({}))) as ActionApiResponse;

      if (response.status === 409) {
        warning("Ação não permitida", json.error?.message ?? "Este documento não pode ser retificado no estado atual.");
        return;
      }

      if (response.status >= 500) {
        error("Erro interno. Tente novamente.");
        return;
      }

      if (!response.ok || json.ok !== true) {
        error("Falha na retificação", json.error?.message ?? "Não foi possível retificar o documento.");
        return;
      }

      success("Documento retificado.");
      window.location.assign("/financeiro/fiscal");
    } catch {
      error("Erro interno. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 md:p-6">
        <div className="grid min-h-[60vh] place-items-center rounded-xl border border-slate-200 bg-white">
          <div className="inline-flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            A carregar documento fiscal...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen space-y-4 bg-slate-50 p-4 md:p-6">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <a
          href="/financeiro/fiscal"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao ledger
        </a>
      </section>

      {errorMessage ? (
        <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </section>
      ) : null}

      {doc ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h1 className="font-sora text-2xl font-semibold text-slate-900">Retificar Documento Fiscal</h1>
          <p className="mt-1 text-sm text-slate-500">
            Confirme o motivo para registar a retificação no ledger fiscal.
          </p>

          <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Documento</div>
              <div className="font-sora font-semibold text-slate-900">{doc.numero}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Data</div>
              <div className="text-slate-700">{formatDate(doc.emitido_em)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Cliente</div>
              <div className="text-slate-700">{doc.cliente_nome}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Total</div>
              <div className="text-slate-700">{kwanza.format(doc.total_aoa)}</div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="space-y-2">
              <label htmlFor="motivo-retificacao" className="text-sm font-medium text-slate-700">
                Motivo da Retificação
              </label>
              <textarea
                id="motivo-retificacao"
                minLength={10}
                value={motivo}
                onChange={(event) => setMotivo(event.target.value)}
                className="h-32 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#1F6B3B] focus:ring-2 focus:ring-[#1F6B3B]/20"
                placeholder="Descreva o motivo com no mínimo 10 caracteres"
              />
              <p className="text-xs text-slate-500">{motivo.trim().length}/10 mínimo</p>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={motivoInvalido || submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1F6B3B] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#18542e] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {submitting ? "A processar..." : "Confirmar Retificação"}
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </main>
  );
}
