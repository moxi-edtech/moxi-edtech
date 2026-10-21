"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type BalcaoDraftStatus = "clean" | "dirty" | "saving" | "saved";
export type BalcaoDraftSummary = { dirty: boolean; submitting: boolean; statuses: Readonly<Record<string, BalcaoDraftStatus>> };
type Reporter = (key: string, status: BalcaoDraftStatus | null) => void;
const DraftReporterContext = createContext<Reporter | null>(null);

/** Tracks controlled React values, including programmatic changes; no DOM/button heuristics. */
export function deriveBalcaoDraftStatus(
  value: unknown, baseline: unknown, options: { submitting?: boolean; saved?: boolean; enabled?: boolean } = {},
): BalcaoDraftStatus {
  if (options.enabled === false) return "clean";
  if (options.submitting) return "saving";
  if (JSON.stringify(value) !== JSON.stringify(baseline)) return "dirty";
  return options.saved ? "saved" : "clean";
}

export function useBalcaoDraftForm(
  formKey: string,
  value: unknown,
  baseline: unknown,
  options: { submitting?: boolean; saved?: boolean; enabled?: boolean } = {},
) {
  const report = useContext(DraftReporterContext);
  const status = deriveBalcaoDraftStatus(value, baseline, options);
  useEffect(() => {
    report?.(formKey, status);
    return () => report?.(formKey, null);
  }, [report, formKey, status]);
  return status;
}

/** Parent components own the form snapshots; this scope holds *statuses only*, never personal values. */
export function BalcaoDraftScope({
  onChange, children,
}: {
  onChange: (summary: BalcaoDraftSummary) => void;
  children: ReactNode;
}) {
  const [statuses, setStatuses] = useState<Record<string, BalcaoDraftStatus>>({});
  const report = useMemo<Reporter>(() => (key, status) => {
    setStatuses(current => {
      if (status === null) {
        if (!(key in current)) return current;
        const next = { ...current };
        delete next[key];
        return next;
      }
      if (current[key] === status) return current;
      return { ...current, [key]: status };
    });
  }, []);
  const summary = useMemo<BalcaoDraftSummary>(() => ({
    dirty: Object.values(statuses).some(status => status === "dirty" || status === "saving"),
    submitting: Object.values(statuses).some(status => status === "saving"),
    statuses,
  }), [statuses]);
  useEffect(() => { onChange(summary); }, [onChange, summary]);
  return <DraftReporterContext.Provider value={report}>{children}</DraftReporterContext.Provider>;
}
