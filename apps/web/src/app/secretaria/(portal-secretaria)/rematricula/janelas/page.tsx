"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CalendarClock, CheckCircle2, Loader2, Plus, Power, Trash2 } from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { useToast, useConfirm } from "@/components/feedback/FeedbackSystem";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useEscolaId } from "@/hooks/useEscolaId";
import { buildPortalHref } from "@/lib/navigation";

type AnoLetivo = {
  id: string;
  ano: number;
  ativo: boolean | null;
};

type Janela = {
  id: string;
  ano_letivo: number;
  data_inicio: string;
  data_fim: string;
  ativa: boolean;
  observacao: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type FormState = {
  ano_letivo: string;
  data_inicio: string;
  data_fim: string;
  ativa: boolean;
  observacao: string;
};

function getInitialFormState(anoId?: number): FormState {
  const now = new Date();
  const later = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 days
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return {
    ano_letivo: anoId ? String(anoId) : "",
    data_inicio: new Date(now.getTime() - offsetMs).toISOString().slice(0, 16),
    data_fim: new Date(later.getTime() - offsetMs).toISOString().slice(0, 16),
    ativa: true,
    observacao: "",
  };
}

function toLocalInputValue(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function toIsoFromLocal(value: string) {
  return new Date(value).toISOString();
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-AO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function isOpen(janela: Janela) {
  const now = Date.now();
  return janela.ativa && new Date(janela.data_inicio).getTime() <= now && new Date(janela.data_fim).getTime() >= now;
}

function getWindowStatus(janela: Janela) {
  if (!janela.ativa) return { label: "Inativa", class: "bg-slate-100 text-slate-500" };
  const now = Date.now();
  const inicio = new Date(janela.data_inicio).getTime();
  const fim = new Date(janela.data_fim).getTime();

  if (now < inicio) return { label: "Agendada", class: "bg-blue-50 text-blue-700" };
  if (now > fim) return { label: "Encerrada", class: "bg-red-50 text-red-700" };
  return { label: "Aberta Agora", class: "bg-klasse-green-50 text-klasse-green-700" };
}

export default function RematriculaJanelasPage() {
  const { success, error: toastError } = useToast();
  const confirm = useConfirm();
  const { escolaId, escolaSlug } = useEscolaId();
  const escolaParam = escolaSlug || escolaId;
  const [anos, setAnos] = useState<AnoLetivo[]>([]);
  const [items, setItems] = useState<Janela[]>([]);
  const [form, setForm] = useState<FormState>(getInitialFormState());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toastErrorRef = useRef(toastError);

  const activeWindow = useMemo(() => items.find(isOpen) ?? null, [items]);

  useEffect(() => {
    toastErrorRef.current = toastError;
  }, [toastError]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/secretaria/rematricula/janelas", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Falha ao carregar janelas");
      setItems(json.items ?? []);
      setAnos(json.anos ?? []);
      setForm((current) => {
        if (current.ano_letivo || !json.anos?.length) return current;
        return { ...current, ano_letivo: String(json.anos[0].ano ?? "") };
      });
    } catch (err) {
      toastErrorRef.current("Falha ao carregar", err instanceof Error ? err.message : "Não foi possível carregar as janelas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setEditingId(null);
    setForm(getInitialFormState(anos[0]?.ano));
  };

  const edit = (janela: Janela) => {
    setEditingId(janela.id);
    setForm({
      ano_letivo: String(janela.ano_letivo),
      data_inicio: toLocalInputValue(janela.data_inicio),
      data_fim: toLocalInputValue(janela.data_fim),
      ativa: janela.ativa,
      observacao: janela.observacao ?? "",
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.ano_letivo || !form.data_inicio || !form.data_fim) {
      toastError("Dados incompletos", "Informe ano letivo, início e fim da janela.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...(editingId ? { id: editingId } : {}),
        ano_letivo: Number(form.ano_letivo),
        data_inicio: toIsoFromLocal(form.data_inicio),
        data_fim: toIsoFromLocal(form.data_fim),
        ativa: form.ativa,
        observacao: form.observacao || null,
      };

      const res = await fetch("/api/secretaria/rematricula/janelas", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Falha ao salvar janela");

      success("Janela salva", form.ativa ? "A janela foi salva e está ativa." : "A janela foi salva como inativa.");
      resetForm();
      await load();
    } catch (err) {
      toastError("Falha ao salvar", err instanceof Error ? err.message : "Não foi possível salvar a janela.");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (janela: Janela) => {
    setSaving(true);
    try {
      const res = await fetch("/api/secretaria/rematricula/janelas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: janela.id, ativa: !janela.ativa }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Falha ao atualizar janela");
      success(!janela.ativa ? "Janela ativada" : "Janela desativada", "Estado da janela atualizado.");
      await load();
    } catch (err) {
      toastError("Falha ao atualizar", err instanceof Error ? err.message : "Não foi possível atualizar a janela.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (janela: Janela) => {
    const ok = await confirm({
      title: "Remover janela",
      message: `Deseja remover a janela de rematrícula de ${janela.ano_letivo}? Esta ação não remove candidaturas já submetidas.`,
      confirmLabel: "Remover",
      cancelLabel: "Cancelar",
      variant: "danger",
    });
    if (!ok) return;

    setSaving(true);
    try {
      const res = await fetch("/api/secretaria/rematricula/janelas", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: janela.id }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Falha ao remover janela");
      success("Janela removida", "A janela foi removida.");
      await load();
    } catch (err) {
      toastError("Falha ao remover", err instanceof Error ? err.message : "Não foi possível remover a janela.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <DashboardHeader
        title="Janelas de Rematrícula"
        description="Abra ou feche o período em que alunos podem confirmar a rematrícula pelo portal."
        breadcrumbs={[
          { label: "Secretaria", href: "/secretaria" },
          { label: "Rematrícula", href: buildPortalHref(escolaParam, "/secretaria/rematricula") },
          { label: "Janelas" },
        ]}
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Estado atual</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">
              {activeWindow ? `Portal aberto para ${activeWindow.ano_letivo}` : "Nenhuma janela aberta agora"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {activeWindow
                ? `Aberta até ${formatDateTime(activeWindow.data_fim)}.`
                : "O banner de rematrícula não aparece para alunos enquanto não houver janela ativa."}
            </p>
          </div>
          <Link
            href={buildPortalHref(escolaParam, "/secretaria/rematricula")}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Voltar para promoção em massa
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-klasse-gold-600" />
            <h2 className="text-sm font-bold text-slate-900">
              {editingId ? "Editar janela" : "Nova janela"}
            </h2>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-700">Ano letivo</span>
              <select
                value={form.ano_letivo}
                onChange={(event) => setForm((current) => ({ ...current, ano_letivo: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-teal-500 focus:ring-teal-500"
                required
              >
                <option value="">Selecione...</option>
                {anos.map((ano) => (
                  <option key={ano.id} value={ano.ano}>
                    {ano.ano}{ano.ativo ? " · ativo" : ""}
                  </option>
                ))}
              </select>
            </label>

            <Input
              label="Início"
              type="datetime-local"
              value={form.data_inicio}
              onChange={(event) => setForm((current) => ({ ...current, data_inicio: event.target.value }))}
              required
            />

            <Input
              label="Fim"
              type="datetime-local"
              value={form.data_fim}
              onChange={(event) => setForm((current) => ({ ...current, data_fim: event.target.value }))}
              required
            />

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-700">Observação</span>
              <textarea
                value={form.observacao}
                onChange={(event) => setForm((current) => ({ ...current, observacao: event.target.value }))}
                maxLength={500}
                rows={3}
                className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-teal-500 focus:ring-teal-500"
                placeholder="Ex.: Rematrícula online aberta para alunos sem pendências"
              />
            </label>

            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={form.ativa}
                onChange={(event) => setForm((current) => ({ ...current, ativa: event.target.checked }))}
              />
              Janela ativa
            </label>
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button type="submit" tone="gold" disabled={saving || loading}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {editingId ? "Salvar alterações" : "Criar janela"}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
                Cancelar edição
              </Button>
            )}
          </div>
        </form>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-bold text-slate-900">Janelas cadastradas</h2>
            <p className="mt-1 text-xs text-slate-500">
              A janela ativa e dentro do intervalo é a única que libera o banner no portal do aluno.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 p-5 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Nenhuma janela cadastrada.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {items.map((janela) => {
                const status = getWindowStatus(janela);
                const hasStarted = new Date(janela.data_inicio).getTime() <= Date.now();
                return (
                  <article key={janela.id} className="p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900">Ano letivo {janela.ano_letivo}</h3>
                          <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${status.class}`}>
                            {status.label}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                          {formatDateTime(janela.data_inicio)} até {formatDateTime(janela.data_fim)}
                        </p>
                        {janela.observacao && (
                          <p className="mt-2 text-xs text-slate-500">{janela.observacao}</p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => edit(janela)} disabled={saving}>
                          Editar
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => toggle(janela)} disabled={saving}>
                          {janela.ativa ? <Power className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                          {janela.ativa ? "Desativar" : "Ativar"}
                        </Button>
                        <Button 
                          type="button" 
                          size="sm" 
                          tone="red" 
                          onClick={() => remove(janela)} 
                          disabled={saving || hasStarted}
                          title={hasStarted ? "Janelas que já iniciaram não podem ser removidas, apenas desativadas." : ""}
                        >
                          <Trash2 className="h-4 w-4" />
                          Remover
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
