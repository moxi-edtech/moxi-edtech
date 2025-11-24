"use client";

import React from "react";
import ProfessorSidebar from "@/components/professor/ProfessorSidebar";

export default function ProfessorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-amber-50 to-white">
      <ProfessorSidebar />
      <main className="flex-1 p-6 ml-[var(--sidebar-w-professor,256px)]">
        {children}
      </main>
    </div>
  );
}

