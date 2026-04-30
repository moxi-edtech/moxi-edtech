"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  CreditCard,
  ExternalLink,
  Eye,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import {
  aprovarInscricaoAction,
  rejeitarInscricaoAction,
  reenviarAcessoAction,
} from "@/app/actions/secretaria-actions";
import { toast } from "@/lib/toast";

type PriorityLevel = "alta" | "media" | "baixa";

type PagamentoItem = {
  id: string;
  nome: string;
  bi: string;
  email: string | null;
  telefone: string | null;
  comprovativo_url: string | null;
  status: "PENDENTE";
  created_at: string;
  cohort_nome: string;
  curso_nome: string;
  data_inicio: string | null;
  valor_referencia: number;
  moeda: string;
  priority_score: number;
  priority_level: PriorityLevel;
  priority_reasons: string[];
  operational_recommendation: string;
  operational_recommendation_reason: string;
};

type AcessoItem = {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  estado: string;
  status_pagamento: string;
  created_at: string;
  updated_at: string;
  cohort_nome: string;
  curso_nome: string;
};

type NotificacaoItem = {
  id: string;
  titulo: string;
  corpo: string | null;
  prioridade: "info" | "aviso" | "urgente";
  action_label: string | null;
  action_url: string | null;
  created_at: string;
};

type InboxPayload = {
  pagamentos: PagamentoItem[];
  acessos: AcessoItem[];
  notificacoes: NotificacaoItem[];
  summary: {
    pagamentos_pendentes: number;
    prioridade_alta: number;
    acessos_recentes: number;
    notificacoes_abertas: number;
  };
};

const emptyPayload: InboxPayload = {
  pagamentos: [],
  acessos: [],
  notificacoes: [],
  summary: {
    pagamentos_pendentes: 0,
    prioridade_alta: 0,
    acessos_recentes: 0,
    notificacoes_abertas: 0,
  },
};

function formatCurrency(value: number, currency = "AOA") {
  return new Intl.NumberFormat("pt-AO", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium" }).format(new Date(value));
}

function priorityClass(level: PriorityLevel) {
  if (level === "alta") return "border-rose-200 bg-rose-50 text-rose-700";
  if (level === "media") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function notificationClass(priority: NotificacaoItem["prioridade"]) {
  if (priority === "urgente") return "border-rose-200 bg-rose-50 text-rose-700";
  if (priority === "aviso") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

export default function InboxSecretariaClient() {
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"pagamentos" | "suporte">("pagamentos");
  const [payload, setPayload] = useState<InboxPayload>(emptyPayload);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  async function loadInbox() {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/formacao/secretaria/inbox", { cache: "no-store" });
    const json = await response.json().catch(() => null);
    setLoading(false);

    if (!response.ok || !json?.ok) {
      setError(json?.error ?? "Falha ao carregar inbox operacional.");
      return;
    }

    setPayload({
      pagamentos: Array.isArray(json.pagamentos) ? json.pagamentos : [],
      acessos: Array.isArray(json.acessos) ? json.acessos : [],
      notificacoes: Array.isArray(json.notificacoes) ? json.notificacoes : [],
      summary: json.summary ?? emptyPayload.summary,
    });
  }

  useEffect(() => {
    loadInbox();
  }, []);

  const filteredPagamentos = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return payload.pagamentos;
    return payload.pagamentos.filter((item) =>
      [item.nome, item.email, item.telefone, item.bi, item.curso_nome, item.cohort_nome]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [payload.pagamentos, query]);

  const filteredAcessos = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return payload.acessos;
    return payload.acessos.filter((item) =>
      [item.nome, item.email, item.telefone, item.curso_nome, item.cohort_nome]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [payload.acessos, query]);

  async function handleAprovar(id: string) {
    const formData = new FormData();
    formData.append("id", id);

    startTransition(async () => {
      const result = await aprovarInscricaoAction(formData);
      if (result.success) {
        toast({ title: "Acesso libertado", description: result.message });
        await loadInbox();
      } else {
        toast({ title: "Erro na aprovação", description: result.error, variant: "destructive" });
      }
    });
  }

  async function handleRejeitar(id: string) {
    const motivo = window.prompt("Motivo da rejeição (mínimo 5 caracteres):");
    if (!motivo || motivo.trim().length < 5) return;

    const formData = new FormData();
    formData.append("id", id);
    formData.append("motivo", motivo);

    startTransition(async () => {
      const result = await rejeitarInscricaoAction(formData);
      if (result.success) {
        toast({ title: "Inscrição rejeitada", description: result.message });
        await loadInbox();
      } else {
        toast({ title: "Erro", description: result.error, variant: "destructive" });
      }
    });
  }

  async function handleReenviar(item: AcessoItem) {
    const formData = new FormData();
    formData.append("email", item.email);
    formData.append("inscricao_id", item.id);

    startTransition(async () => {
      const result = await reenviarAcessoAction(formData);
      if (result.success) {
        toast({ title: "Credenciais reenviadas", description: result.message });
      } else {
        toast({ title: "Erro", description: result.error, variant: "destructive" });
      }
    });
  }

  return (
    <div className="space-y-6 pb-10">
      <header className="border-b border-slate-200 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">secretaria</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Inbox Operacional</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Triagem real de inscrições públicas, comprovativos e reenvio de acessos para alunos ativos.
            </p>
          </div>
          <button
            type="button"
            onClick={loadInbox}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Atualizar
          </button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Pagamentos pendentes" value={payload.summary.pagamentos_pendentes} icon={<CreditCard size={18} />} />
        <Metric title="Prioridade alta" value={payload.summary.prioridade_alta} icon={<AlertCircle size={18} />} />
        <Metric title="Acessos recentes" value={payload.summary.acessos_recentes} icon={<ShieldCheck size={18} />} />
        <Metric title="Notificações abertas" value={payload.summary.notificacoes_abertas} icon={<Mail size={18} />} />
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
          {(["pagamentos", "suporte"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`h-9 rounded-md px-4 text-sm font-semibold transition-colors ${
                activeTab === tab ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab === "pagamentos" ? "Validação de pagamentos" : "Suporte & acessos"}
            </button>
          ))}
        </div>

        <div className="relative min-w-[260px] flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pesquisar por nome, curso, email ou telefone"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition-colors focus:border-slate-500"
          />
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-72 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-slate-500">
          <Loader2 size={18} className="mr-2 animate-spin" />
          A carregar inbox operacional
        </div>
      ) : activeTab === "pagamentos" ? (
        <PagamentosPanel
          items={filteredPagamentos}
          isPending={isPending}
          onAprovar={handleAprovar}
          onRejeitar={handleRejeitar}
        />
      ) : (
        <SuportePanel
          acessos={filteredAcessos}
          notificacoes={payload.notificacoes}
          isPending={isPending}
          onReenviar={handleReenviar}
        />
      )}
    </div>
  );
}

function PagamentosPanel({
  items,
  isPending,
  onAprovar,
  onRejeitar,
}: {
  items: PagamentoItem[];
  isPending: boolean;
  onAprovar: (id: string) => void;
  onRejeitar: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircle size={30} />}
        title="Sem pagamentos pendentes"
        description="As inscrições públicas pendentes de validação aparecem aqui assim que chegam."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70">
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Formando</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Curso / turma</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Valor</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Prioridade</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/80">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-600">
                      {item.nome.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">{item.nome}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{item.email || item.telefone || item.bi}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <p className="text-sm font-semibold text-slate-800">{item.curso_nome}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {item.cohort_nome} · início {formatDate(item.data_inicio)}
                  </p>
                </td>
                <td className="px-4 py-4">
                  <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    {formatCurrency(item.valor_referencia, item.moeda)}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityClass(item.priority_level)}`}>
                    {item.priority_level} · {item.priority_score}
                  </span>
                  <p className="mt-1 max-w-[280px] text-xs text-slate-500">
                    {item.operational_recommendation}: {item.operational_recommendation_reason}
                  </p>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center justify-end gap-2">
                    {item.comprovativo_url ? (
                      <a
                        href={item.comprovativo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50"
                        aria-label={`Ver comprovativo de ${item.nome}`}
                      >
                        <Eye size={16} />
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onRejeitar(item.id)}
                      disabled={isPending}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
                      aria-label={`Rejeitar ${item.nome}`}
                    >
                      <XCircle size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onAprovar(item.id)}
                      disabled={isPending}
                      className="inline-flex h-9 items-center gap-2 rounded-lg bg-klasse-green px-4 text-sm font-semibold text-white transition-colors hover:bg-klasse-green/90 disabled:opacity-50"
                    >
                      {isPending ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                      Aprovar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SuportePanel({
  acessos,
  notificacoes,
  isPending,
  onReenviar,
}: {
  acessos: AcessoItem[];
  notificacoes: NotificacaoItem[];
  isPending: boolean;
  onReenviar: (item: AcessoItem) => void;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-950">Reenvio de acessos</h2>
          <p className="mt-1 text-xs text-slate-500">Inscrições oficiais recentes com email registado.</p>
        </div>
        {acessos.length === 0 ? (
          <EmptyState
            compact
            icon={<Mail size={24} />}
            title="Sem alunos para reenvio"
            description="Quando houver inscrições oficiais com email, elas aparecem aqui."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {acessos.map((item) => (
              <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950">{item.nome}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{item.email}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.curso_nome} · {item.cohort_nome}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onReenviar(item)}
                  disabled={isPending}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  {isPending ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
                  Reenviar
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <aside className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-950">Notificações abertas</h2>
        </div>
        {notificacoes.length === 0 ? (
          <EmptyState
            compact
            icon={<CheckCircle size={24} />}
            title="Sem notificações"
            description="Alertas direcionados para sua conta aparecem aqui."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {notificacoes.map((item) => (
              <article key={item.id} className="px-4 py-4">
                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${notificationClass(item.prioridade)}`}>
                  {item.prioridade}
                </span>
                <h3 className="mt-2 text-sm font-semibold text-slate-950">{item.titulo}</h3>
                {item.corpo ? <p className="mt-1 text-sm leading-5 text-slate-600">{item.corpo}</p> : null}
                {item.action_url ? (
                  <a
                    href={item.action_url}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-klasse-green hover:underline"
                  >
                    {item.action_label ?? "Abrir"} <ExternalLink size={12} />
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

function Metric({ title, value, icon }: { title: string; value: number; icon: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          {icon}
        </div>
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
  compact = false,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <div className={`text-center ${compact ? "px-5 py-12" : "rounded-xl border border-slate-200 bg-white px-6 py-20"}`}>
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        {icon}
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-950">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-5 text-slate-500">{description}</p>
    </div>
  );
}
