"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { useHorarioBaseData } from "@/hooks/useHorarioData";

type HorarioDataContextValue = ReturnType<typeof useHorarioBaseData> & {
  refreshBaseData: () => void;
};

const HorarioDataContext = createContext<HorarioDataContextValue | null>(null);

export function HorarioDataProvider({ children }: { children: ReactNode }) {
  const params = useParams();
  const escolaId = params?.id as string | undefined;
  const [baseRefreshToken, setBaseRefreshToken] = useState(0);
  const baseData = useHorarioBaseData(escolaId, baseRefreshToken);

  const value = useMemo(
    () => ({
      ...baseData,
      refreshBaseData: () => setBaseRefreshToken((prev) => prev + 1),
    }),
    [baseData]
  );

  return <HorarioDataContext.Provider value={value}>{children}</HorarioDataContext.Provider>;
}

export function useHorarioDataContext() {
  const context = useContext(HorarioDataContext);
  if (!context) {
    throw new Error("useHorarioDataContext precisa de HorarioDataProvider");
  }
  return context;
}
