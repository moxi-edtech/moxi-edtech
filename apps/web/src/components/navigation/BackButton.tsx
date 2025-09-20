"use client";

import { useRouter, usePathname } from "next/navigation";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import React from "react";

export default function BackButton() {
  const router = useRouter();
  const pathname = usePathname();

  // Determine if we are on a top-level route (no parent to go back to)
  const segments = (pathname || "/").split("/").filter(Boolean);
  const isTopLevel = segments.length <= 1;

  if (isTopLevel) return null;

  const onClick = () => {
    // Try going back in history; if no history, go to the parent path
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    const parent = "/" + segments.slice(0, -1).join("/");
    router.push(parent || "/");
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex items-center gap-2 text-xs text-moxinexa-gray hover:text-moxinexa-dark transition-colors"
      aria-label="Voltar"
    >
      <ArrowLeftIcon className="h-4 w-4 text-moxinexa-gray group-hover:text-moxinexa-dark" />
      <span>Voltar</span>
    </button>
  );
}

