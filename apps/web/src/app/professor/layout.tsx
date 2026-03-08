import ProfessorPortalLayout from "@/components/professor/layout/ProfessorPortalLayout";
import React from "react";

export default function ProfessorLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProfessorPortalLayout>{children}</ProfessorPortalLayout>
  );
}
