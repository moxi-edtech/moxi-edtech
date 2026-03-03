import { Button } from "@/components/ui/Button";

type Props = {
  loading: boolean;
  alert: { id: string; valor: number; mes: string | null } | null;
};

const kwanza = new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 });

export function FinanceAlertBanner({ loading, alert }: Props) {
  if (loading) return <div className="h-16 animate-pulse rounded-xl bg-klasse-gold-100" />;
  if (!alert) return null;

  return (
    <section className="rounded-xl border border-klasse-gold-200 bg-klasse-gold-50 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Mensalidade em atraso</p>
          <p className="text-xs text-slate-600">
            {kwanza.format(alert.valor)} {alert.mes ? `• ${alert.mes}` : ""}
          </p>
        </div>
        <Button tone="green" className="min-h-11" size="sm">Pagar Agora</Button>
      </div>
    </section>
  );
}
