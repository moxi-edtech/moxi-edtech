"use client";

import { useEffect, useState, useCallback } from "react";

type Opts = {
  storageKey: string;
  cssVar: string;            // ex: --sidebar-w
  collapsedWidth?: string;   // "80px"
  expandedWidth?: string;    // "256px"
  initialCollapsed?: boolean;
};

export function useSidebar({
  storageKey,
  cssVar,
  collapsedWidth = "80px",
  expandedWidth = "256px",
  initialCollapsed = false,
}: Opts) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return initialCollapsed;
    const saved = localStorage.getItem(storageKey);
    return saved ? saved === "1" : initialCollapsed;
  });

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty(
        cssVar,
        collapsed ? collapsedWidth : expandedWidth
      );
    }
  }, [collapsed, cssVar, collapsedWidth, expandedWidth]);

  const toggle = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey, next ? "1" : "0");
      }
      if (typeof document !== 'undefined') {
        document.documentElement.style.setProperty(cssVar, next ? collapsedWidth : expandedWidth);
      }
      return next;
    });
  }, [storageKey, cssVar, collapsedWidth, expandedWidth]);

  return { collapsed, toggle };
}
