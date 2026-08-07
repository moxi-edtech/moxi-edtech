"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronDown } from "lucide-react";
import { ACADEMIC_YEAR_PARAM, type AcademicWorkspaceContext } from "@/lib/academic-year/context";

type AcademicYearOption = {
  id: string;
  label: string;
  status: "PLANNED" | "ACTIVE" | "CLOSED";
};
type SchoolSessionResponse = { id: string; nome?: string | null; ano_letivo?: number | null; status?: string | null; data_inicio?: string | null };

function mapStatus(value: string | null | undefined, dataInicio?: string | null): AcademicYearOption["status"] {
  if (value === "ativa") return "ACTIVE";
  if (dataInicio && new Date(`${dataInicio}T00:00:00Z`) > new Date()) return "PLANNED";
  return "CLOSED";
}

export default function AcademicYearSelector({ escolaId }: { escolaId?: string | null }) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const selectedId = searchParams?.get(ACADEMIC_YEAR_PARAM);
  const [options, setOptions] = useState<AcademicYearOption[]>([]);
  const [context, setContext] = useState<AcademicWorkspaceContext | null>(null);

  useEffect(() => {
    let cancelled = false;
    const query = selectedId ? `?${ACADEMIC_YEAR_PARAM}=${encodeURIComponent(selectedId)}` : "";
    Promise.all([
      fetch(`/api/secretaria/school-sessions${escolaId ? `?escolaId=${encodeURIComponent(escolaId)}` : ""}`, { cache: "no-store" }),
      fetch(`/api/academic-context${query}`, { cache: "no-store" }),
    ]).then(async ([sessionsRes, contextRes]) => {
      const sessionsJson = await sessionsRes.json().catch(() => null);
      const contextJson = await contextRes.json().catch(() => null);
      if (cancelled) return;
      const items = Array.isArray(sessionsJson?.data) ? sessionsJson.data : [];
      setOptions(items.map((item: SchoolSessionResponse) => ({
        id: String(item.id),
        label: String(item.nome ?? `${item.ano_letivo}/${Number(item.ano_letivo) + 1}`),
        status: mapStatus(item.status, item.data_inicio),
      })));
      if (contextJson?.ok) setContext(contextJson.context as AcademicWorkspaceContext);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [escolaId, selectedId]);

  const currentValue = selectedId ?? context?.anoLetivoId ?? "";
  const currentLabel = useMemo(
    () => options.find((option) => option.id === currentValue)?.label ?? context?.anoLetivoLabel ?? "Ano letivo",
    [context?.anoLetivoLabel, currentValue, options],
  );

  if (!currentValue && options.length === 0) return null;

  function changeYear(nextId: string) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set(ACADEMIC_YEAR_PARAM, nextId);
    for (const key of ["turma_id", "matricula_id", "disciplina_id", "aluno_id", "periodo_id"]) params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
      <CalendarDays className="h-4 w-4 text-[#1F6B3B]" aria-hidden="true" />
      <span className="hidden lg:inline text-xs text-slate-500">Ano letivo</span>
      <select
        aria-label="Ano letivo"
        value={currentValue}
        onChange={(event) => changeYear(event.target.value)}
        className="max-w-[140px] appearance-none bg-transparent pr-5 font-semibold text-slate-800 outline-none"
      >
        {options.length === 0 && <option value={currentValue}>{currentLabel}</option>}
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}{option.status === "ACTIVE" ? " · atual" : " · histórico"}
          </option>
        ))}
      </select>
      <ChevronDown className="-ml-6 h-3.5 w-3.5 pointer-events-none text-slate-400" aria-hidden="true" />
    </label>
  );
}
