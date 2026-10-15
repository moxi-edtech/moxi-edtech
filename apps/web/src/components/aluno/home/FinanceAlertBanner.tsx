import { Notice } from "@/components/ui/alert";
import Link from "next/link";

type Props = {
  loading: boolean;
  alert: { id: string; valor: number; mes: string | null } | null;
};

const kwanza = new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 });

export function FinanceAlertBanner({ loading, alert }: Props) {
  if (loading) return <div className="h-14 sm:h-16 animate-pulse rounded-xl bg-amber-100" />;
  if (!alert) return null;

  return (
    <Notice
      tone="attention"
      eyebrow="Pagamentos"
      title="Mensalidade em atraso"
      description={`${kwanza.format(alert.valor)}${alert.mes ? ` · ${alert.mes}` : ""}. Consulta os detalhes para regularizar a mensalidade.`}
      action={<Link href="/aluno/financeiro" className="rounded-xl bg-[#2B6044] px-5 text-sm font-semibold text-white hover:bg-[#214c36] focus-visible:ring-2 focus-visible:ring-[#2B6044] focus-visible:ring-offset-2">Ver pagamento</Link>}
    />
  );
}
