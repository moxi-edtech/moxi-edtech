"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Eye, RefreshCw, Search, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

type AiAction = {
  id: string;
  school_id: string;
  action_type: string;
  source_module: string;
  title: string;
  summary: string | null;
  content: string;
  status: string;
  risk_level: string;
  requires_approval: boolean;
  created_by: string;
  created_at: string;
  last_error: string | null;
};

type Filters = {
  status: string;
  type: string;
  module: string;
  risk: string;
  createdBy: string;
  from: string;
  to: string;
};

const STATUS_OPTIONS = [
  "draft",
  "review_required",
  "approved",
  "rejected",
  "queued",
  "sending",
  "sent",
  "failed",
  "cancelled",
];

const TYPE_OPTIONS = [
  "finance_message",
  "communication_draft",
  "school_summary",
  "student_summary",
  "help_navigation",
  "operational_recommendation",
];

const MODULE_OPTIONS = ["dashboard", "financeiro", "secretaria", "academico", "comunicacao", "classe_ai"];
const RISK_OPTIONS = ["low", "medium", "high"];

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  review_required: "Revisão",
  approved: "Aprovada",
  rejected: "Rejeitada",
  queued: "Na fila",
  sending: "Enviando",
  sent: "Enviada",
  failed: "Falhou",
  cancelled: "Cancelada",
};

const typeLabels: Record<string, string> = {
  finance_message: "Cobrança",
  communication_draft: "Comunicado",
  school_summary: "Resumo da escola",
  student_summary: "Resumo do aluno",
  help_navigation: "Ajuda",
  operational_recommendation: "Recomendação",
};

function statusClass(status: string) {
  switch (status) {
    case "review_required":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "approved":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "rejected":
    case "failed":
      return "bg-red-50 text-red-700 border-red-200";
    case "sent":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "cancelled":
      return "bg-slate-100 text-slate-600 border-slate-200";
    default:
      return "bg-white text-slate-700 border-slate-200";
  }
}

function riskClass(risk: string) {
  switch (risk) {
    case "high":
      return "bg-red-50 text-red-700 border-red-200";
    case "medium":
      return "bg-amber-50 text-amber-700 border-amber-200";
    default:
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
}

function toDateTimeLocal(value: string) {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

export default function AiActionsCenterClient({ schoolId }: { schoolId: string }) {
  const [actions, setActions] = useState<AiAction[]>([]);
  const [summary, setSummary] = useState<{ total: number; byStatus: Record<string, number>; byType: Record<string, number> }>({
    total: 0,
    byStatus: {},
    byType: {},
  });
  const [filters, setFilters] = useState<Filters>({
    status: "",
    type: "",
    module: "",
    risk: "",
    createdBy: "",
    from: "",
    to: "",
  });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AiAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ schoolId });
    if (filters.status) params.set("status", filters.status);
    if (filters.type) params.set("type", filters.type);
    if (filters.module) params.set("module", filters.module);
    if (filters.risk) params.set("risk", filters.risk);
    if (filters.createdBy) params.set("createdBy", filters.createdBy);
    const from = toDateTimeLocal(filters.from);
    const to = toDateTimeLocal(filters.to);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return params.toString();
  }, [filters, schoolId]);

  async function loadActions() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ai/actions?${queryString}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Erro ao carregar ações IA.");
      setActions(data.actions ?? []);
      setSummary(data.summary ?? { total: 0, byStatus: {}, byType: {} });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar ações IA.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActions();
  }, [queryString]);

  async function transition(action: AiAction, next: "approve" | "reject" | "cancel" | "retry") {
    setMutatingId(action.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ai/actions/${action.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId, transition: next }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Erro ao atualizar ação IA.");
      setActions((prev) => prev.map((item) => (item.id === action.id ? data.action : item)));
      setSelected((prev) => (prev?.id === action.id ? data.action : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar ação IA.");
    } finally {
      setMutatingId(null);
    }
  }

  async function copyContent(action: AiAction) {
    await navigator.clipboard.writeText(action.content);
    setCopiedId(action.id);
    setTimeout(() => setCopiedId(null), 1600);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">KLASSE AI</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Central de Ações IA</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Rascunhos, recomendações e resumos preparados pela IA para revisão humana.
            </p>
          </div>
          <Button type="button" variant="outline" tone="slate" onClick={loadActions} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        </header>

        <section className="grid gap-3 md:grid-cols-5">
          {[
            ["Pendentes", summary.byStatus.review_required ?? 0],
            ["Aprovadas", summary.byStatus.approved ?? 0],
            ["Rejeitadas", summary.byStatus.rejected ?? 0],
            ["Enviadas", summary.byStatus.sent ?? 0],
            ["Falhas", summary.byStatus.failed ?? 0],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-6">
            <select
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">Status</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{statusLabels[status]}</option>
              ))}
            </select>
            <select
              value={filters.type}
              onChange={(event) => setFilters((prev) => ({ ...prev, type: event.target.value }))}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">Tipo</option>
              {TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>{typeLabels[type]}</option>
              ))}
            </select>
            <select
              value={filters.module}
              onChange={(event) => setFilters((prev) => ({ ...prev, module: event.target.value }))}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">Módulo</option>
              {MODULE_OPTIONS.map((module) => (
                <option key={module} value={module}>{module}</option>
              ))}
            </select>
            <select
              value={filters.risk}
              onChange={(event) => setFilters((prev) => ({ ...prev, risk: event.target.value }))}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">Risco</option>
              {RISK_OPTIONS.map((risk) => (
                <option key={risk} value={risk}>{risk}</option>
              ))}
            </select>
            <input
              value={filters.createdBy}
              onChange={(event) => setFilters((prev) => ({ ...prev, createdBy: event.target.value }))}
              placeholder="Criado por"
              className="h-10 rounded-md border border-slate-200 px-3 text-sm"
            />
            <div className="flex items-center gap-2 rounded-md border border-slate-200 px-3">
              <Search className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-slate-500">{summary.total} ações</span>
            </div>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <input
              type="date"
              value={filters.from}
              onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))}
              className="h-10 rounded-md border border-slate-200 px-3 text-sm"
            />
            <input
              type="date"
              value={filters.to}
              onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))}
              className="h-10 rounded-md border border-slate-200 px-3 text-sm"
            />
          </div>
        </section>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>
        ) : null}

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-12 border-b border-slate-200 bg-slate-100 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
            <div className="col-span-4">Título</div>
            <div className="col-span-2">Tipo</div>
            <div className="col-span-2">Módulo</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-1">Risco</div>
            <div className="col-span-1">Data</div>
            <div className="col-span-1 text-right">Ação</div>
          </div>

          {loading ? (
            <div className="p-8 text-sm text-slate-500">Carregando ações IA...</div>
          ) : actions.length === 0 ? (
            <div className="p-8 text-sm text-slate-500">Nenhuma ação IA encontrada para os filtros atuais.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {actions.map((action) => (
                <div key={action.id} className="grid grid-cols-12 items-center gap-2 px-4 py-4 text-sm">
                  <div className="col-span-4 min-w-0">
                    <p className="truncate font-bold text-slate-900">{action.title}</p>
                    <p className="truncate text-xs text-slate-500">{action.summary ?? action.content}</p>
                  </div>
                  <div className="col-span-2 text-slate-700">{typeLabels[action.action_type] ?? action.action_type}</div>
                  <div className="col-span-2 text-slate-600">{action.source_module}</div>
                  <div className="col-span-1">
                    <span className={`rounded-md border px-2 py-1 text-xs font-bold ${statusClass(action.status)}`}>
                      {statusLabels[action.status] ?? action.status}
                    </span>
                  </div>
                  <div className="col-span-1">
                    <span className={`rounded-md border px-2 py-1 text-xs font-bold ${riskClass(action.risk_level)}`}>
                      {action.risk_level}
                    </span>
                  </div>
                  <div className="col-span-1 text-xs text-slate-500">
                    {new Date(action.created_at).toLocaleDateString("pt-AO")}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button type="button" variant="ghost" size="icon" onClick={() => setSelected(action)} title="Ver detalhes">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-200 p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{typeLabels[selected.action_type] ?? selected.action_type}</p>
                <h2 className="mt-1 text-lg font-black text-slate-950">{selected.title}</h2>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setSelected(null)} title="Fechar">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="mb-4 flex flex-wrap gap-2">
                <span className={`rounded-md border px-2 py-1 text-xs font-bold ${statusClass(selected.status)}`}>
                  {statusLabels[selected.status] ?? selected.status}
                </span>
                <span className={`rounded-md border px-2 py-1 text-xs font-bold ${riskClass(selected.risk_level)}`}>
                  risco {selected.risk_level}
                </span>
                {selected.requires_approval ? (
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-700">
                    requer aprovação
                  </span>
                ) : null}
              </div>
              <pre className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-800">
                {selected.content}
              </pre>
              {selected.last_error ? (
                <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{selected.last_error}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap justify-between gap-2 border-t border-slate-200 p-4">
              <Button type="button" variant="outline" tone="slate" onClick={() => copyContent(selected)}>
                <Copy className="h-4 w-4" />
                {copiedId === selected.id ? "Copiado" : "Copiar conteúdo"}
              </Button>
              <div className="flex flex-wrap gap-2">
                {["draft", "review_required", "failed"].includes(selected.status) ? (
                  <Button type="button" tone="emerald" onClick={() => transition(selected, "approve")} loading={mutatingId === selected.id}>
                    <ShieldCheck className="h-4 w-4" />
                    Aprovar rascunho
                  </Button>
                ) : null}
                {["draft", "review_required", "approved", "failed"].includes(selected.status) ? (
                  <Button type="button" variant="outline" tone="red" onClick={() => transition(selected, "reject")} disabled={mutatingId === selected.id}>
                    <X className="h-4 w-4" />
                    Rejeitar
                  </Button>
                ) : null}
                {!["sent", "sending", "cancelled"].includes(selected.status) ? (
                  <Button type="button" variant="outline" tone="slate" onClick={() => transition(selected, "cancel")} disabled={mutatingId === selected.id}>
                    Cancelar
                  </Button>
                ) : null}
                {selected.status === "failed" ? (
                  <Button type="button" variant="outline" tone="amber" onClick={() => transition(selected, "retry")} disabled={mutatingId === selected.id}>
                    <RefreshCw className="h-4 w-4" />
                    Reenviar
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
