"use client";

import { useEffect, useMemo, useState } from "react";
import { Save, RotateCcw, BadgePercent, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PLAN_NAMES, type PlanTier } from "@/config/plans";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

type FormacaoPlanTier = "basic" | "pro" | "enterprise";
type CommercialPlanTier = PlanTier | FormacaoPlanTier;

type PlanCommercialSettings = {
  plan: CommercialPlanTier;
  price_mensal_kz: number;
  price_anual_kz: number;
  trial_days: number;
  discount_percent: number;
  promo_label: string | null;
  promo_ends_at: string | null;
  updated_at?: string | null;
};

const PLAN_ORDER: PlanTier[] = ["essencial", "profissional", "premium"];
const FORMACAO_PLAN_ORDER: FormacaoPlanTier[] = ["basic", "pro", "enterprise"];
const FORMACAO_PLAN_NAMES: Record<FormacaoPlanTier, string> = {
  basic: "Essencial",
  pro: "Corporativo",
  enterprise: "Enterprise",
};

function currency(value: number) {
  return `Kz ${Number(value || 0).toLocaleString("pt-AO")}`;
}

function effectivePrice(item: PlanCommercialSettings, field: "price_mensal_kz" | "price_anual_kz") {
  const base = Number(item[field] ?? 0);
  const discount = Number(item.discount_percent ?? 0);
  if (base <= 0 || discount <= 0) return base;
  return Math.round(base * (1 - discount / 100));
}

export default function PlanosComerciaisClient() {
  const [items, setItems] = useState<PlanCommercialSettings[]>([]);
  const [formacaoItems, setFormacaoItems] = useState<PlanCommercialSettings[]>([]);
  const [originalItems, setOriginalItems] = useState<PlanCommercialSettings[]>([]);
  const [originalFormacaoItems, setOriginalFormacaoItems] = useState<PlanCommercialSettings[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const res = await fetch("/api/super-admin/plans", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao carregar planos");
      
      const ordered = [...(json.items ?? [])].sort(
        (a, b) => PLAN_ORDER.indexOf(a.plan as PlanTier) - PLAN_ORDER.indexOf(b.plan as PlanTier)
      );
      const orderedFormacao = [...(json.formacaoItems ?? [])].sort(
        (a, b) => FORMACAO_PLAN_ORDER.indexOf(a.plan as FormacaoPlanTier) - FORMACAO_PLAN_ORDER.indexOf(b.plan as FormacaoPlanTier)
      );
      
      setItems(JSON.parse(JSON.stringify(ordered)));
      setOriginalItems(JSON.parse(JSON.stringify(ordered)));
      setFormacaoItems(JSON.parse(JSON.stringify(orderedFormacao)));
      setOriginalFormacaoItems(JSON.parse(JSON.stringify(orderedFormacao)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const isDirty = useMemo(() => {
    return JSON.stringify(items) !== JSON.stringify(originalItems) || 
           JSON.stringify(formacaoItems) !== JSON.stringify(originalFormacaoItems);
  }, [items, originalItems, formacaoItems, originalFormacaoItems]);

  const changedCount = useMemo(() => {
    let count = 0;
    items.forEach((item, idx) => {
      if (JSON.stringify(item) !== JSON.stringify(originalItems[idx])) count++;
    });
    formacaoItems.forEach((item, idx) => {
      if (JSON.stringify(item) !== JSON.stringify(originalFormacaoItems[idx])) count++;
    });
    return count;
  }, [items, originalItems, formacaoItems, originalFormacaoItems]);

  function updatePlan(plan: CommercialPlanTier, patch: Partial<PlanCommercialSettings>, product: "k12" | "formacao") {
    if (product === "formacao") {
      setFormacaoItems((current) => current.map((item) => (item.plan === plan ? { ...item, ...patch } : item)));
      return;
    }
    setItems((current) => current.map((item) => (item.plan === plan ? { ...item, ...patch } : item)));
  }

  async function save() {
    try {
      setSaving(true);
      const res = await fetch("/api/super-admin/plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, formacaoItems }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao guardar planos");
      
      const ordered = [...(json.items ?? [])].sort(
        (a, b) => PLAN_ORDER.indexOf(a.plan as PlanTier) - PLAN_ORDER.indexOf(b.plan as PlanTier)
      );
      const orderedFormacao = [...(json.formacaoItems ?? [])].sort(
        (a, b) => FORMACAO_PLAN_ORDER.indexOf(a.plan as FormacaoPlanTier) - FORMACAO_PLAN_ORDER.indexOf(b.plan as FormacaoPlanTier)
      );
      
      setItems(JSON.parse(JSON.stringify(ordered)));
      setOriginalItems(JSON.parse(JSON.stringify(ordered)));
      setFormacaoItems(JSON.parse(JSON.stringify(orderedFormacao)));
      setOriginalFormacaoItems(JSON.parse(JSON.stringify(orderedFormacao)));
      
      toast.success("Configuração comercial dos planos atualizada");
      setShowConfirm(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  }

  function getTotals(currentItems: PlanCommercialSettings[]) {
    return currentItems.reduce(
      (acc, item) => {
        acc.monthly += effectivePrice(item, "price_mensal_kz");
        acc.annual += effectivePrice(item, "price_anual_kz");
        return acc;
      },
      { monthly: 0, annual: 0 }
    );
  }

  if (loading && items.length === 0) {
    return <SkeletonLoader />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            isDirty ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
          )}>
            {isDirty ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          </div>
          <div>
            <h3 className="font-bold text-slate-900">
              {isDirty ? `${changedCount} Alterações pendentes` : "Configurações sincronizadas"}
            </h3>
            <p className="text-xs text-slate-500">
              {isDirty ? "Guarde as alterações para aplicar os novos preços globalmente." : "Todos os preços estão atualizados no catálogo."}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            disabled={loading || saving}
            tone="slate"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Recarregar
          </Button>
          <Button
            size="sm"
            onClick={() => setShowConfirm(true)}
            disabled={!isDirty || loading || saving}
            tone="green"
          >
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar Alterações
          </Button>
        </div>
      </div>

      <Tabs defaultValue="k12" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="k12" className="text-sm font-bold">KLASSE Escolar (SaaS)</TabsTrigger>
          <TabsTrigger value="formacao" className="text-sm font-bold">KLASSE Formação</TabsTrigger>
        </TabsList>

        <TabsContent value="k12">
          <div className="space-y-6">
            <StatsSection totals={getTotals(items)} promoCount={items.filter(i => Number(i.discount_percent) > 0).length} />
            <div className="grid gap-6">
              {items.map((item, idx) => (
                <PlanCard 
                  key={item.plan} 
                  item={item} 
                  originalItem={originalItems[idx]}
                  product="k12" 
                  onUpdate={(patch) => updatePlan(item.plan, patch, "k12")} 
                />
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="formacao">
          <div className="space-y-6">
            <StatsSection totals={getTotals(formacaoItems)} promoCount={formacaoItems.filter(i => Number(i.discount_percent) > 0).length} />
            <div className="grid gap-6">
              {formacaoItems.map((item, idx) => (
                <PlanCard 
                  key={item.plan} 
                  item={item} 
                  originalItem={originalFormacaoItems[idx]}
                  product="formacao" 
                  onUpdate={(patch) => updatePlan(item.plan, patch, "formacao")} 
                />
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Atualização de Preços</DialogTitle>
            <DialogDescription>
              Você está prestes a alterar as configurações comerciais de {changedCount} plano(s). 
              Estas alterações serão aplicadas imediatamente a todas as novas subscrições e renovações.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
             <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                <p className="text-sm text-amber-800 font-medium">
                  Atenção: Preços configurados como 0 farão com que novas escolas entrem como "Pendente de Parametrização" no sistema de faturação.
                </p>
             </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} loading={saving} tone="green">
              Confirmar e Publicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatsSection({ totals, promoCount }: { totals: { monthly: number, annual: number }, promoCount: number }) {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Soma mensal catálogo</p>
        <p className="mt-2 text-2xl font-bold text-slate-950">{currency(totals.monthly)}</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Soma anual catálogo</p>
        <p className="mt-2 text-2xl font-bold text-slate-950">{currency(totals.annual)}</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Planos com promoção ativa</p>
        <p className="mt-2 text-2xl font-bold text-klasse-green">{promoCount}</p>
      </div>
    </section>
  );
}

function PlanCard({ 
  item, 
  originalItem,
  product, 
  onUpdate 
}: { 
  item: PlanCommercialSettings, 
  originalItem?: PlanCommercialSettings,
  product: "k12" | "formacao", 
  onUpdate: (patch: Partial<PlanCommercialSettings>) => void 
}) {
  const isModified = originalItem && JSON.stringify(item) !== JSON.stringify(originalItem);
  const monthlyEffective = effectivePrice(item, "price_mensal_kz");
  const annualEffective = effectivePrice(item, "price_anual_kz");
  const planName = product === "formacao"
    ? FORMACAO_PLAN_NAMES[item.plan as FormacaoPlanTier]
    : PLAN_NAMES[item.plan as PlanTier];

  return (
    <article className={cn(
      "rounded-2xl border bg-white shadow-sm overflow-hidden transition-all",
      isModified ? "border-amber-200 ring-1 ring-amber-100" : "border-slate-200"
    )}>
      <div className="flex items-center justify-between bg-slate-50/50 px-6 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold text-slate-900">{planName}</h3>
          {isModified && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
              Modificado
            </Badge>
          )}
        </div>
        <p className="text-[10px] text-slate-400 font-medium">
          Última atualização: {item.updated_at ? new Date(item.updated_at).toLocaleDateString("pt-AO", { day: '2-digit', month: 'long', year: 'numeric' }) : "n/d"}
        </p>
      </div>

      <div className="p-6 grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="grid gap-5 md:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 block">Preço Mensal (KZ)</label>
            <input
              type="number"
              min={0}
              value={item.price_mensal_kz}
              onChange={(e) => onUpdate({ price_mensal_kz: Math.max(0, Math.round(Number(e.target.value || 0))) })}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-klasse-green focus:ring-4 focus:ring-klasse-green/10"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 block">Preço Anual (KZ)</label>
            <input
              type="number"
              min={0}
              value={item.price_anual_kz}
              onChange={(e) => onUpdate({ price_anual_kz: Math.max(0, Math.round(Number(e.target.value || 0))) })}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-klasse-green focus:ring-4 focus:ring-klasse-green/10"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 block">Trial (Dias)</label>
            <input
              type="number"
              min={0}
              max={365}
              value={item.trial_days}
              onChange={(e) => onUpdate({ trial_days: Math.min(365, Math.max(0, Math.round(Number(e.target.value || 0)))) })}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-klasse-green focus:ring-4 focus:ring-klasse-green/10"
            />
          </div>

          <div className="md:col-span-3 grid gap-5 md:grid-cols-3 pt-2 border-t border-slate-100">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 block">Desconto (%)</label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={item.discount_percent}
                  onChange={(e) => onUpdate({ discount_percent: Math.min(100, Math.max(0, Number(e.target.value || 0))) })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-klasse-green focus:ring-4 focus:ring-klasse-green/10 pr-8"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">%</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 block">Fim Promoção</label>
              <input
                type="date"
                value={item.promo_ends_at ? item.promo_ends_at.slice(0, 10) : ""}
                onChange={(e) => onUpdate({ promo_ends_at: e.target.value ? new Date(`${e.target.value}T23:59:59.000Z`).toISOString() : null })}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-klasse-green focus:ring-4 focus:ring-klasse-green/10"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 block">Rótulo Promoção</label>
              <input
                value={item.promo_label ?? ""}
                onChange={(e) => onUpdate({ promo_label: e.target.value || null })}
                placeholder="Ex.: Campanha de Natal"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-klasse-green focus:ring-4 focus:ring-klasse-green/10"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 flex flex-col justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              <BadgePercent className="h-3.5 w-3.5" />
              Preço Efetivo Atual
            </p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Mensal:</span>
                <span className="text-base font-bold text-slate-900">{currency(monthlyEffective)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Anual:</span>
                <span className="text-base font-bold text-slate-900">{currency(annualEffective)}</span>
              </div>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-200">
            <p className="text-[10px] leading-relaxed text-slate-400 italic">
              O sincronismo de cobranças utiliza o preço efetivo acima. Alterações impactam novos contratos.
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

function SkeletonLoader() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-20 bg-slate-100 rounded-2xl border border-slate-200" />
      <div className="h-10 bg-slate-100 rounded-lg w-full" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-24 bg-slate-100 rounded-xl border border-slate-200" />
        <div className="h-24 bg-slate-100 rounded-xl border border-slate-200" />
        <div className="h-24 bg-slate-100 rounded-xl border border-slate-200" />
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} className="h-64 bg-slate-100 rounded-2xl border border-slate-200" />
      ))}
    </div>
  );
}
