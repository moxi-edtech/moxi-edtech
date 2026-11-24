/** Shared visual semantics for compact operational cards; no business logic or fetches. */
export function operationalCardTone({
  unavailable = false,
  needsAttention = false,
}: {
  unavailable?: boolean;
  needsAttention?: boolean;
} = {}) {
  if (unavailable) return "neutral";
  return needsAttention ? "attention" : "normal";
}

export const operationalCardIconClasses = {
  normal: "bg-emerald/10 text-emerald dark:text-emerald-300",
  attention: "bg-amber/15 text-amber-700 dark:text-amber-300",
  neutral: "bg-muted text-muted-foreground",
} as const;
