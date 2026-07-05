"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Clock3,
  Coins,
  FileText,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  Wallet,
  XCircle,
} from "lucide-react";

import { useConfirm, useToast } from "@/components/feedback/FeedbackSystem";
import { Button } from "@/components/ui/Button";

type CommissionItem = {
  id: string;
  afiliado_codigo: string;
  afiliado_nome: string;
  membro_nome: string | null;
  escola_id: string;
  escola_nome: string;
  tipo: string;
  status: "pending" | "approved" | "blocked" | "paid" | "cancelled";
  base_valor_kz: number;
  percentual: number;
  valor_kz: number;
  competencia_inicio: string | null;
  competencia_fim: string | null;
  due_at: string | null;
  approved_at: string | null;
  paid_at: string | null;
  created_at: string;
  assinatura?: {
    id: string;
    plano: string | null;
    ciclo: string | null;
    status: string | null;
    valor_kz: number;
    data_renovacao: string | null;
  } | null;
  pagamento?: {
    id: string;
    status: string | null;
    valor_kz: number;
    periodo_inicio: string | null;
    periodo_fim: string | null;
    confirmado_em: string | null;
    created_at: string | null;
  } | null;
};

type Payload = {
  ok: boolean;
  items?: CommissionItem[];
  filters?: {
    afiliados?: Array<{ codigo: string; nome: string }>;
  };
  error?: string;
};

type PayoutItem = {
  payout_id: string;
  commission_id: string;
  valor_kz: number;
  commission: {
    id: string;
    escola_id: string;
    escola_nome: string;
    tipo: string;
    status: string;
    valor_kz: number;
    created_at: string;
  } | null;
};

type PayoutItemStatus = "requested" | "approved" | "paid" | "rejected" | "cancelled";

type Payout = {
  id: string;
  afiliado_codigo: string;
  afiliado_nome: string;
  requested_by_nome: string | null;
  status: PayoutItemStatus;
  total_kz: number;
  receipt_file_name: string;
  receipt_file_type: string | null;
  receipt_file_size: number | null;
  receipt_signed_url: string | null;
  requested_at: string;
  approved_at: string | null;
  paid_at: string | null;
  rejected_at: string | null;
  commission_count: number;
  items: PayoutItem[];
};

type PayoutPayload = {
  ok: boolean;
  payouts?: Payout[];
  error?: string;
};

const STATUS_META: Record<
  CommissionItem["status"],
  { label: string; badge: string; chip: string }
> = {
  pending: {
    label: "Pendente",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    chip: "bg-amber-100 text-amber-700",
  },
  approved: {
    label: "Aprovada",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    chip: "bg-emerald-100 text-emerald-700",
  },
  blocked: {
    label: "Bloqueada",
    badge: "bg-rose-50 text-rose-700 border-rose-200",
    chip: "bg-rose-100 text-rose-700",
  },
  paid: {
    label: "Paga",
    badge: "bg-sky-50 text-sky-700 border-sky-200",
    chip: "bg-sky-100 text-sky-700",
  },
  cancelled: {
    label: "Cancelada",
    badge: "bg-slate-100 text-slate-700 border-slate-200",
    chip: "bg-slate-200 text-slate-700",
  },
};

const PAYOUT_STATUS_META: Record<PayoutItemStatus, { label: string; badge: string; chip: string }> = {
  requested: {
    label: "Solicitado",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    chip: "bg-amber-100 text-amber-700",
  },
  approved: {
    label: "Aprovado",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    chip: "bg-emerald-100 text-emerald-700",
  },
  paid: {
    label: "Pago",
    badge: "bg-sky-50 text-sky-700 border-sky-200",
    chip: "bg-sky-100 text-sky-700",
  },
  rejected: {
    label: "Rejeitado",
    badge: "bg-rose-50 text-rose-700 border-rose-200",
    chip: "bg-rose-100 text-rose-700",
  },
  cancelled: {
    label: "Cancelado",
    badge: "bg-slate-100 text-slate-700 border-slate-200",
    chip: "bg-slate-200 text-slate-700",
  },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 })
    .format(value || 0)
    .replace("AOA", "Kz");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export default function PartnerCommissionsClient() {
  const confirm = useConfirm();
  const { toast } = useToast();
  const [items, setItems] = useState<CommissionItem[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyPayoutId, setBusyPayoutId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | CommissionItem["status"]>("all");
  const [affiliateFilter, setAffiliateFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [affiliateOptions, setAffiliateOptions] = useState<Array<{ codigo: string; nome: string }>>([]);

  const notifySuccess = useCallback((title: string) => {
    toast({ variant: "success", title });
  }, [toast]);

  const notifyError = useCallback((title: string) => {
    toast({ variant: "error", title, duration: 6000 });
  }, [toast]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [response, payoutsResponse] = await Promise.all([
        fetch("/api/super-admin/commissions", { cache: "no-store" }),
        fetch("/api/super-admin/commissions/payouts", { cache: "no-store" }),
      ]);
      const payload = (await response.json().catch(() => null)) as Payload | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Falha ao carregar faturamentos.");
      }
      const payoutPayload = (await payoutsResponse.json().catch(() => null)) as PayoutPayload | null;
      if (!payoutsResponse.ok || !payoutPayload?.ok) {
        throw new Error(payoutPayload?.error || "Falha ao carregar pedidos de payout.");
      }
      setItems(Array.isArray(payload.items) ? payload.items : []);
      setPayouts(Array.isArray(payoutPayload.payouts) ? payoutPayload.payouts : []);
      setAffiliateOptions(Array.isArray(payload.filters?.afiliados) ? payload.filters?.afiliados : []);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (affiliateFilter !== "all" && item.afiliado_codigo !== affiliateFilter) return false;

      if (!search.trim()) return true;
      const haystack = [
        item.afiliado_codigo,
        item.afiliado_nome,
        item.escola_nome,
        item.membro_nome ?? "",
        item.tipo,
        item.status,
        item.assinatura?.plano ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(search.trim().toLowerCase());
    });
  }, [affiliateFilter, items, search, statusFilter]);

  const summary = useMemo(() => {
    return filteredItems.reduce(
      (acc, item) => {
        acc.totalKz += item.valor_kz;
        acc.totalCount += 1;
        acc[item.status].kz += item.valor_kz;
        acc[item.status].count += 1;
        return acc;
      },
      {
        totalKz: 0,
        totalCount: 0,
        pending: { kz: 0, count: 0 },
        approved: { kz: 0, count: 0 },
        blocked: { kz: 0, count: 0 },
        paid: { kz: 0, count: 0 },
        cancelled: { kz: 0, count: 0 },
      },
    );
  }, [filteredItems]);

  const filteredPayouts = useMemo(() => {
    return payouts.filter((payout) => {
      if (affiliateFilter !== "all" && payout.afiliado_codigo !== affiliateFilter) return false;

      if (!search.trim()) return true;
      const haystack = [
        payout.afiliado_codigo,
        payout.afiliado_nome,
        payout.requested_by_nome ?? "",
        payout.status,
        payout.receipt_file_name,
        ...payout.items.map((item) => item.commission?.escola_nome ?? ""),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(search.trim().toLowerCase());
    });
  }, [affiliateFilter, payouts, search]);

  const payoutSummary = useMemo(() => {
    return filteredPayouts.reduce(
      (acc, payout) => {
        acc.totalKz += payout.total_kz;
        acc.totalCount += 1;
        acc[payout.status].kz += payout.total_kz;
        acc[payout.status].count += 1;
        return acc;
      },
      {
        totalKz: 0,
        totalCount: 0,
        requested: { kz: 0, count: 0 },
        approved: { kz: 0, count: 0 },
        paid: { kz: 0, count: 0 },
        rejected: { kz: 0, count: 0 },
        cancelled: { kz: 0, count: 0 },
      },
    );
  }, [filteredPayouts]);

  async function mutateCommission(item: CommissionItem, action: "approve" | "block" | "mark_paid" | "cancel" | "reopen") {
    const labels: Record<typeof action, string> = {
      approve: "Aprovar faturamento",
      block: "Bloquear faturamento",
      mark_paid: "Marcar como pago",
      cancel: "Cancelar faturamento",
      reopen: "Reabrir faturamento",
    };

    let note = "";
    if (action === "block" || action === "cancel") {
      const response = await confirm({
        title: labels[action],
        message: `Indique a justificativa para ${labels[action].toLowerCase()} de ${item.escola_nome}.`,
        inputType: "text",
        placeholder: "Ex: inadimplência da escola ou divergência comercial",
        confirmLabel: action === "block" ? "Bloquear" : "Cancelar",
        variant: "danger",
      });
      if (response === null) return;
      note = String(response).trim();
      if (note.length < 3) {
        notifyError("Justificativa obrigatória com pelo menos 3 caracteres.");
        return;
      }
    } else {
      const ok = await confirm({
        title: labels[action],
        message: `Deseja ${labels[action].toLowerCase()} de ${item.escola_nome}?`,
        confirmLabel: labels[action],
        variant: action === "approve" || action === "mark_paid" ? "default" : undefined,
      });
      if (!ok) return;
    }

    setBusyId(item.id);
    try {
      const response = await fetch(`/api/super-admin/commissions/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: note || undefined }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Falha ao atualizar faturamento.");
      }
      notifySuccess(`${labels[action]} concluída para ${item.escola_nome}.`);
      await load();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setBusyId(null);
    }
  }

  async function mutatePayout(payout: Payout, action: "approve" | "reject" | "mark_paid" | "cancel") {
    const labels: Record<typeof action, string> = {
      approve: "Aprovar payout",
      reject: "Rejeitar payout",
      mark_paid: "Marcar payout pago",
      cancel: "Cancelar payout",
    };

    let note = "";
    if (action === "reject" || action === "cancel") {
      const response = await confirm({
        title: labels[action],
        message: `Indique a justificativa para ${labels[action].toLowerCase()} de ${payout.afiliado_nome}.`,
        inputType: "text",
        placeholder: "Ex: recibo divergente ou valor a corrigir",
        confirmLabel: action === "reject" ? "Rejeitar" : "Cancelar",
        variant: "danger",
      });
      if (response === null) return;
      note = String(response).trim();
      if (note.length < 3) {
        notifyError("Justificativa obrigatória com pelo menos 3 caracteres.");
        return;
      }
    } else {
      const ok = await confirm({
        title: labels[action],
        message: `Deseja ${labels[action].toLowerCase()} de ${payout.afiliado_nome}?`,
        confirmLabel: labels[action],
        variant: action === "approve" || action === "mark_paid" ? "default" : undefined,
      });
      if (!ok) return;
    }

    setBusyPayoutId(payout.id);
    try {
      const response = await fetch(`/api/super-admin/commissions/payouts/${payout.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: note || undefined }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Falha ao atualizar payout.");
      }
      notifySuccess(`${labels[action]} concluído para ${payout.afiliado_nome}.`);
      await load();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setBusyPayoutId(null);
    }
  }

  return (
    <section className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-950">Cockpit de Faturamento de Parceiros</h2>
          <p className="text-sm text-slate-500">
            Opera o ledger já gerado pelo backend: aprovação, bloqueio, pagamento e reabertura.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Pesquisar escola, parceiro ou plano"
              className="h-10 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-slate-400"
            />
          </div>
          <select
            value={affiliateFilter}
            onChange={(event) => setAffiliateFilter(event.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
          >
            <option value="all">Todos os parceiros</option>
            {affiliateOptions.map((affiliate) => (
              <option key={affiliate.codigo} value={affiliate.codigo}>
                {affiliate.nome}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | CommissionItem["status"])}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400"
          >
            <option value="all">Todos os estados</option>
            {Object.entries(STATUS_META).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
          <Button variant="outline" tone="slate" onClick={() => load()} disabled={loading}>
            <RefreshCw className={loading ? "animate-spin" : ""} />
            Recarregar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total filtrado</p>
          <p className="mt-2 text-2xl font-black text-slate-950">{formatCurrency(summary.totalKz)}</p>
          <p className="text-sm text-slate-500">{summary.totalCount} registos</p>
        </article>
        {(["pending", "approved", "blocked", "paid"] as const).map((status) => (
          <article key={status} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{STATUS_META[status].label}</p>
              <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${STATUS_META[status].chip}`}>
                {summary[status].count}
              </span>
            </div>
            <p className="mt-2 text-2xl font-black text-slate-950">{formatCurrency(summary[status].kz)}</p>
          </article>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-950">Fila de payout com recibo</h3>
            <p className="text-sm text-slate-500">
              Valida os pedidos enviados pelo parceiro antes de liquidar o faturamento.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            {(["requested", "approved", "paid", "rejected"] as const).map((status) => (
              <span key={status} className={`rounded-xl px-3 py-2 font-bold ${PAYOUT_STATUS_META[status].chip}`}>
                {PAYOUT_STATUS_META[status].label}: {payoutSummary[status].count}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {filteredPayouts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
              Nenhum pedido de payout encontrado para os filtros atuais.
            </div>
          ) : (
            filteredPayouts.slice(0, 6).map((payout) => {
              const meta = PAYOUT_STATUS_META[payout.status];
              const isBusy = busyPayoutId === payout.id;
              return (
                <article key={payout.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-slate-950">{payout.afiliado_nome}</p>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${meta.badge}`}>
                          {meta.label}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {payout.afiliado_codigo} · {payout.commission_count} faturamento(s) · solicitado em {formatDate(payout.requested_at)}
                      </p>
                      {payout.requested_by_nome ? (
                        <p className="text-xs text-slate-500">Operador: {payout.requested_by_nome}</p>
                      ) : null}
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-lg font-black text-slate-950">{formatCurrency(payout.total_kz)}</p>
                      <p className="text-xs text-slate-500">{payoutSummary.totalCount} pedido(s) filtrado(s)</p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl bg-slate-50 p-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <FileText className="h-4 w-4 text-slate-400" />
                      {payout.receipt_signed_url ? (
                        <a
                          href={payout.receipt_signed_url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-slate-800 underline-offset-2 hover:underline"
                        >
                          {payout.receipt_file_name}
                        </a>
                      ) : (
                        <span>{payout.receipt_file_name}</span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {payout.items.slice(0, 3).map((item) => (
                        <span key={item.commission_id} className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-slate-600">
                          {item.commission?.escola_nome ?? "Escola sem nome"} · {formatCurrency(item.valor_kz)}
                        </span>
                      ))}
                      {payout.items.length > 3 ? (
                        <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-slate-500">
                          +{payout.items.length - 3}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {payout.status === "requested" ? (
                      <>
                        <Button size="sm" tone="green" onClick={() => mutatePayout(payout, "approve")} loading={isBusy}>
                          <CheckCircle2 />
                          Aprovar
                        </Button>
                        <Button size="sm" variant="outline" tone="red" onClick={() => mutatePayout(payout, "reject")} disabled={isBusy}>
                          <XCircle />
                          Rejeitar
                        </Button>
                        <Button size="sm" variant="outline" tone="gray" onClick={() => mutatePayout(payout, "cancel")} disabled={isBusy}>
                          <Ban />
                          Cancelar
                        </Button>
                      </>
                    ) : null}
                    {payout.status === "approved" ? (
                      <>
                        <Button size="sm" tone="blue" onClick={() => mutatePayout(payout, "mark_paid")} loading={isBusy}>
                          <Wallet />
                          Marcar pago
                        </Button>
                        <Button size="sm" variant="outline" tone="red" onClick={() => mutatePayout(payout, "reject")} disabled={isBusy}>
                          <XCircle />
                          Rejeitar
                        </Button>
                      </>
                    ) : null}
                    {payout.status === "paid" ? (
                      <span className="inline-flex items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700">
                        <Coins className="h-4 w-4" />
                        Liquidado
                      </span>
                    ) : null}
                    {payout.status === "rejected" || payout.status === "cancelled" ? (
                      <span className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
                        <Clock3 className="h-4 w-4" />
                        Encerrado
                      </span>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-700">Nenhum faturamento encontrado.</p>
          <p className="text-sm text-slate-500">Ajuste os filtros ou aguarde nova geração a partir dos pagamentos confirmados.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-2">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-400">
                <th className="px-3 py-2">Parceiro / Escola</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Valor</th>
                <th className="px-3 py-2">Competência</th>
                <th className="px-3 py-2">Vencimento</th>
                <th className="px-3 py-2">Origem</th>
                <th className="px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const isBusy = busyId === item.id;
                return (
                  <tr key={item.id} className="rounded-2xl bg-slate-50 text-sm text-slate-700">
                    <td className="rounded-l-2xl px-3 py-3 align-top">
                      <div className="space-y-1">
                        <p className="font-bold text-slate-950">{item.escola_nome}</p>
                        <p className="text-xs text-slate-500">
                          {item.afiliado_codigo} · {item.afiliado_nome}
                        </p>
                        {item.membro_nome ? <p className="text-xs text-slate-500">Operador: {item.membro_nome}</p> : null}
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="space-y-1">
                        <span className="inline-flex rounded-full bg-slate-200 px-2 py-1 text-[11px] font-bold uppercase text-slate-700">
                          {item.tipo}
                        </span>
                        {item.assinatura?.plano ? (
                          <p className="text-xs text-slate-500">
                            {item.assinatura.plano} · {item.assinatura.ciclo ?? "—"}
                          </p>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${STATUS_META[item.status].badge}`}>
                        {STATUS_META[item.status].label}
                      </span>
                      <div className="mt-2 space-y-1 text-xs text-slate-500">
                        <p>Criada: {formatDate(item.created_at)}</p>
                        {item.approved_at ? <p>Aprovada: {formatDate(item.approved_at)}</p> : null}
                        {item.paid_at ? <p>Paga: {formatDate(item.paid_at)}</p> : null}
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="space-y-1">
                        <p className="font-bold text-slate-950">{formatCurrency(item.valor_kz)}</p>
                        <p className="text-xs text-slate-500">Base: {formatCurrency(item.base_valor_kz)}</p>
                        <p className="text-xs text-slate-500">Percentual: {Math.round(item.percentual * 100)}%</p>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top text-xs text-slate-500">
                      <p>{formatDate(item.competencia_inicio)}</p>
                      <p>{formatDate(item.competencia_fim)}</p>
                    </td>
                    <td className="px-3 py-3 align-top text-xs text-slate-500">{formatDate(item.due_at)}</td>
                    <td className="px-3 py-3 align-top">
                      <div className="space-y-1 text-xs text-slate-500">
                        {item.pagamento?.status ? <p>Pagamento: {item.pagamento.status}</p> : <p>Pagamento: —</p>}
                        {item.pagamento?.valor_kz ? <p>Valor pago: {formatCurrency(item.pagamento.valor_kz)}</p> : null}
                        {item.pagamento?.confirmado_em ? <p>Confirmado: {formatDate(item.pagamento.confirmado_em)}</p> : null}
                      </div>
                    </td>
                    <td className="rounded-r-2xl px-3 py-3 align-top">
                      <div className="flex flex-wrap gap-2">
                        {item.status === "pending" ? (
                          <>
                            <Button size="sm" tone="green" onClick={() => mutateCommission(item, "approve")} loading={isBusy}>
                              <CheckCircle2 />
                              Aprovar
                            </Button>
                            <Button size="sm" variant="outline" tone="red" onClick={() => mutateCommission(item, "block")} disabled={isBusy}>
                              <Ban />
                              Bloquear
                            </Button>
                            <Button size="sm" variant="outline" tone="gray" onClick={() => mutateCommission(item, "cancel")} disabled={isBusy}>
                              <XCircle />
                              Cancelar
                            </Button>
                          </>
                        ) : null}

                        {item.status === "approved" ? (
                          <>
                            <Button size="sm" tone="blue" onClick={() => mutateCommission(item, "mark_paid")} loading={isBusy}>
                              <Wallet />
                              Marcar paga
                            </Button>
                            <Button size="sm" variant="outline" tone="red" onClick={() => mutateCommission(item, "block")} disabled={isBusy}>
                              <Ban />
                              Bloquear
                            </Button>
                          </>
                        ) : null}

                        {item.status === "blocked" ? (
                          <>
                            <Button size="sm" tone="green" onClick={() => mutateCommission(item, "approve")} loading={isBusy}>
                              <CheckCircle2 />
                              Aprovar
                            </Button>
                            <Button size="sm" variant="outline" tone="gray" onClick={() => mutateCommission(item, "reopen")} disabled={isBusy}>
                              <RotateCcw />
                              Reabrir
                            </Button>
                            <Button size="sm" variant="outline" tone="gray" onClick={() => mutateCommission(item, "cancel")} disabled={isBusy}>
                              <XCircle />
                              Cancelar
                            </Button>
                          </>
                        ) : null}

                        {item.status === "cancelled" ? (
                          <Button size="sm" variant="outline" tone="gray" onClick={() => mutateCommission(item, "reopen")} disabled={isBusy}>
                            <RotateCcw />
                            Reabrir
                          </Button>
                        ) : null}

                        {item.status === "paid" ? (
                          <span className="inline-flex items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700">
                            <Coins className="h-4 w-4" />
                            Liquidada
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
