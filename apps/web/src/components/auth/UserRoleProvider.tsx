"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { useUserRole, type UserRole } from "@/hooks/useUserRole";

interface UserRoleContextType {
  userRole: UserRole | null;
  isLoading: boolean;
}

const UserRoleContext = createContext<UserRoleContextType | undefined>(undefined);

export function UserRoleProvider({ children }: { children: ReactNode }) {
  const state = useUserRole();

  return (
    <UserRoleContext.Provider value={state}>
      {children}
    </UserRoleContext.Provider>
  );
}

export function useUserRoleContext() {
  const context = useContext(UserRoleContext);
  if (context === undefined) {
    // Retornamos um estado padrão em vez de erro para evitar quebras em componentes fora do provider
    // Mas o ideal é que ele esteja sempre sob o provider no portal
    return { userRole: null, isLoading: true };
  }
  return context;
}
