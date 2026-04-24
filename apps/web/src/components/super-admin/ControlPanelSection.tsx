import { BarChart3, Filter, Settings, Shield, Wallet } from "lucide-react";
import ActivitiesSection from "@/components/super-admin/ActivitiesSection";
import MorningBriefing from "@/components/super-admin/MorningBriefing";
import type { ChartsData } from "@/lib/charts";

type HealthSummary = {
  escolasEmRisco: number;
  scoreMedio: number;
};

type Activity = {
  id: string;
  titulo: string;
  resumo: string;
  data: string;
};

function calcFinanceRisk(charts?: ChartsData): number {
  const rows = charts?.pagamentos ?? [];
  const total = rows.reduce((acc, row) => acc + Number(row.total ?? 0), 0);
  const inadimplente = rows
    .filter((row) => String(row.status ?? "").toLowerCase().includes("inad"))
    .reduce((acc, row) => acc + Number(row.total ?? 0), 0);

  if (!total) return 0;
  return Math.round((inadimplente / total) * 100);
}

export default function ControlPanelSection({
  health,
  charts,
  activities,
}: {
  health?: HealthSummary;
  charts?: ChartsData;
  activities: Activity[];
}) {
  const financeRisk = calcFinanceRisk(charts);
  const healthScore = health?.scoreMedio ?? 100;
  const criticalAlerts = health?.escolasEmRisco ?? 0;

  const cards = [
    {
      title: "Saúde Sistémica",
      value: `${healthScore}%`,
      owner: "Owner: SRE",
      action: "Ação: Priorizar tenants com score < 70.",
      icon: Shield,
    },
    {
      title: "Compliance",
      value: criticalAlerts === 0 ? "OK" : "Atenção",
      owner: "Owner: Segurança",
      action: "Ação: Executar auditoria de permissões hoje.",
      icon: Settings,
    },
    {
      title: "Alertas Críticos",
      value: String(criticalAlerts),
      owner: "Owner: Operações",
      action: "Ação: Filtrar e escalar alertas P1 agora.",
      icon: Filter,
    },
    {
      title: "Risco Financeiro",
      value: `${financeRisk}%`,
      owner: "Owner: Financeiro",
      action: "Ação: Revisar escolas com inadimplência > 20%.",
      icon: Wallet,
    },
  ];

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-950">Zona 1 — Controle</h2>
          <p className="text-sm text-slate-500">Saúde sistémica, compliance, alertas críticos e risco financeiro.</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
          <BarChart3 className="h-4 w-4" />
          Painel de Controle
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article key={card.title} className="rounded-xl border border-slate-200 p-4 transition hover:ring-1 hover:ring-klasse-gold/25">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
              <card.icon className="h-4 w-4" />
              {card.title}
            </div>
            <p className="text-2xl font-bold text-slate-950">{card.value}</p>
            <p className="mt-2 text-sm text-slate-600">{card.owner}</p>
            <p className="text-sm text-slate-500">{card.action}</p>
          </article>
        ))}
      </div>

      <MorningBriefing data={health} />
      <ActivitiesSection activities={activities} />
    </section>
  );
}
