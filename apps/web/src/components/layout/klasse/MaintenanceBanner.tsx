"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock3, Wrench } from "lucide-react";

type MaintenanceWindow = {
  id: string;
  title: string;
  message: string;
  starts_at: string;
  ends_at: string;
  maintenance_type: "infra" | "vacuum_full";
  banner_severity: "warning" | "critical";
  enforce_heavy_ops: boolean;
  phase: "active" | "scheduled";
};

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-AO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MaintenanceBanner() {
  const [windowData, setWindowData] = useState<MaintenanceWindow | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/system/maintenance", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !json?.ok) {
          setWindowData(null);
          return;
        }
        setWindowData(json.window ?? null);
      } catch {
        if (!cancelled) setWindowData(null);
      }
    }

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const content = useMemo(() => {
    if (!windowData) return null;

    if (windowData.phase === "active") {
      return {
        title: windowData.title || "Manutenção em andamento",
        detail: `${windowData.message} Até ${formatDateTime(windowData.ends_at)}.`,
        tone:
          windowData.banner_severity === "critical"
            ? "border-rose-200 bg-rose-50 text-rose-900"
            : "border-amber-200 bg-amber-50 text-amber-900",
        icon:
          windowData.banner_severity === "critical" ? (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          ) : (
            <Wrench className="h-4 w-4 shrink-0" />
          ),
      };
    }

    return {
      title: `Manutenção agendada: ${windowData.title}`,
      detail: `${windowData.message} Janela: ${formatDateTime(windowData.starts_at)} até ${formatDateTime(windowData.ends_at)}.`,
      tone: "border-sky-200 bg-sky-50 text-sky-900",
      icon: <Clock3 className="h-4 w-4 shrink-0" />,
    };
  }, [windowData]);

  if (!content) return null;

  return (
    <div className={`border-b px-4 py-3 md:px-6 ${content.tone}`}>
      <div className="flex items-start gap-3">
        {content.icon}
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-5">{content.title}</p>
          <p className="mt-1 text-sm leading-5 opacity-90">{content.detail}</p>
        </div>
      </div>
    </div>
  );
}
