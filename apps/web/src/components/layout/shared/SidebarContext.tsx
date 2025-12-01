"use client";

import { createContext, useContext } from "react";

type SidebarContextType = {
  collapsed: boolean;
  toggle: () => void;
};

const SidebarContext = createContext<SidebarContextType | null>(null);

export const useSidebarContext = () => {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebarContext must be used within SidebarContainer");
  return ctx;
};

export const SidebarProvider = SidebarContext.Provider;