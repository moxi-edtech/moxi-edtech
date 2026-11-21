/** Shared field geometry and focus state for KLASSE forms. Keep presentation separate from validation. */
export const fieldControlClass =
  "w-full min-w-0 rounded-xl border bg-card px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-60";

export const fieldFocusClass =
  "border-border focus-visible:border-klasse-gold focus-visible:ring-4 focus-visible:ring-klasse-gold/20";

export const fieldErrorClass =
  "border-red-500 focus-visible:border-red-500 focus-visible:ring-4 focus-visible:ring-red-500/20";

export const fieldLabelClass = "mb-1.5 block text-sm font-medium text-foreground";
