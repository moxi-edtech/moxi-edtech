"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useEscolaId } from "@/hooks/useEscolaId";
import { usePapel } from "@/lib/usePapel";
import { buildPortalHref } from "@/lib/navigation";

type ModuleKey = "admin" | "secretaria" | "financeiro";

const LABELS: Record<ModuleKey, string> = {
  admin: "Admin",
  secretaria: "Secretaria",
  financeiro: "Financeiro",
};

function resolveModule(pathname: string): ModuleKey | null {
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
    if (papel === "admin_financeiro") return ["admin", "financeiro"];
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

  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Módulo</span>
      <select
        value={currentModule}
        onChange={(event) => handleChange(event.target.value as ModuleKey)}
        className="min-w-[108px] text-xs font-semibold text-slate-700 bg-transparent focus:outline-none"
        aria-label="Seletor de módulo"
      >
        {modules.map((moduleKey) => (
          <option key={moduleKey} value={moduleKey}>
            {LABELS[moduleKey]}
          </option>
        ))}
      </select>
    </div>
  );
}
