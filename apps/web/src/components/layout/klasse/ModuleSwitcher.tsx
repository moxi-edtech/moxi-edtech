"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useEscolaId } from "@/hooks/useEscolaId";
import { usePapel } from "@/lib/usePapel";
import { buildPortalHref } from "@/lib/navigation";

type ModuleKey = "admin" | "operacoes" | "secretaria" | "financeiro";

const LABELS: Record<ModuleKey, string> = {
  admin: "Admin",
  operacoes: "Operações",
  secretaria: "Secretaria",
  financeiro: "Financeiro",
};

function resolveModule(pathname: string): ModuleKey | null {
  if (pathname.includes("/operacoes")) return "operacoes";
  if (pathname.includes("/admin")) return "admin";
  if (pathname.includes("/secretaria")) return "secretaria";
  if (pathname.includes("/financeiro")) return "financeiro";
  return null;
}

export default function ModuleSwitcher() {
  return <ModuleSwitcherInner />;
}

type ModuleSwitcherProps = {
  escolaId?: string | null;
  escolaParam?: string | null;
};

export function ModuleSwitcherInner({
  escolaId: explicitEscolaId,
  escolaParam: explicitEscolaParam,
}: ModuleSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const { escolaId, escolaSlug } = useEscolaId();
  const resolvedEscolaId = explicitEscolaId || escolaId;
  const { papel, loading } = usePapel(resolvedEscolaId);

  const currentModule = useMemo(() => resolveModule(pathname), [pathname]);
  const escolaIdFromPath = useMemo(() => {
    const match = pathname.match(/\/escola\/([^/]+)/);
    return match?.[1] ?? null;
  }, [pathname]);
  const escolaParam = explicitEscolaParam || escolaSlug || escolaIdFromPath || resolvedEscolaId;

  const modules = useMemo<ModuleKey[]>(() => {
    if (papel === "admin_financeiro") return ["operacoes", "financeiro"];
    if (papel === "secretaria_financeiro") return ["secretaria", "financeiro"];
    return [];
  }, [papel]);

  if (
    loading ||
    !currentModule ||
    modules.length === 0 ||
    !modules.includes(currentModule) ||
    (currentModule !== "financeiro" && !escolaParam)
  ) {
    return null;
  }

  const resolveTarget = (moduleKey: ModuleKey) => {
    if (moduleKey === "financeiro") return buildPortalHref(escolaParam, "/financeiro/dashboard");
    if (moduleKey === "operacoes") return buildPortalHref(escolaParam, "/operacoes/dashboard");
    if (moduleKey === "admin") {
      return buildPortalHref(escolaParam, "/admin/dashboard");
    }
    return buildPortalHref(escolaParam, "/secretaria");
  };

  const handleChange = (next: ModuleKey) => {
    if (next === currentModule) return;
    const target = resolveTarget(next);
    router.push(target);
  };

  const currentIndex = modules.indexOf(currentModule);
  const nextModule =
    currentIndex >= 0 ? modules[(currentIndex + 1) % modules.length] ?? null : null;
  const alternateModules = modules.filter((moduleKey) => moduleKey !== currentModule);

  if (!nextModule || alternateModules.length === 0) return null;

  return (
    <button
      type="button"
      onClick={() => handleChange(nextModule)}
      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-klasse-gold/20"
      aria-label={`Alternar módulo a partir de ${LABELS[currentModule]}`}
      title={`Alternar para ${LABELS[nextModule]}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Módulo</span>
        <span className="text-xs font-bold text-slate-700">{LABELS[currentModule]}</span>
      </div>
      <div
        className="relative h-6 w-12 rounded-full bg-slate-200 transition"
        role="switch"
        aria-checked={currentModule === "financeiro"}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-slate-200 transition-transform ${
            currentModule === "financeiro" ? "translate-x-6" : "translate-x-0.5"
          }`}
        />
      </div>
      <span className="hidden text-xs font-semibold text-slate-500 sm:inline">
        {alternateModules.map((moduleKey) => LABELS[moduleKey]).join(" / ")}
      </span>
    </button>
  );
}
