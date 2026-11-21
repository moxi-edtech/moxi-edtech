import * as React from "react";
import {
  getStatusLabel,
  getStatusTone,
  STATUS_TONE_CLASSES,
  type StatusVariant,
} from "@/lib/ui/status-presentation";

export function StatusPill({
  status,
  variant = "matricula",
  size = "sm",
}: {
  status?: string | null;
  variant?: StatusVariant;
  size?: "sm" | "xs";
}) {
  const label = getStatusLabel(status);
  const tone = getStatusTone(status, variant);
  return (
    <span
      className={[
        "inline-flex max-w-full items-center rounded-full border font-semibold uppercase tracking-wide",
        size === "xs" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs",
        STATUS_TONE_CLASSES[tone],
      ].join(" ")}
      title={label}
    >
      {label}
    </span>
  );
}
