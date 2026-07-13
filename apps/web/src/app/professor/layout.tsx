import ProfessorPortalLayout from "@/components/professor/layout/ProfessorPortalLayout";
import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  manifest: "/manifest-professor.json",
};

export default function ProfessorLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProfessorPortalLayout>{children}</ProfessorPortalLayout>
  );
}
