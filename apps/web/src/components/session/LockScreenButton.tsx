"use client";

import { Lock } from "lucide-react";
import { requestScreenLock } from "@/components/session/SessionLockProvider";

type Props = {
  className?: string;
  label?: string;
  iconOnly?: boolean;
};

export default function LockScreenButton({ className = "", label = "Bloquear", iconOnly = false }: Props) {
  return (
    <button
      type="button"
      onClick={requestScreenLock}
      title="Bloquear tela"
      aria-label="Bloquear tela"
      className={className}
    >
      <Lock className="h-4 w-4" />
      {iconOnly ? null : <span>{label}</span>}
    </button>
  );
}
