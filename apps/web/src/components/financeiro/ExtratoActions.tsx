"use client";

import Link from "next/link";
import { usePlanFeature } from "@/hooks/usePlanFeature";

export function ExtratoActions({ alunoId }: { alunoId: string }) {
  const { isEnabled } = usePlanFeature("doc_qr_code");

  return (
    <div className="whitespace-nowrap">
      <Link
        href={`/api/financeiro/extrato/aluno/${alunoId}`}
        className="text-muted-foreground hover:underline mr-3"
        target="_blank"
      >
        Extrato (JSON)
      </Link>
      {isEnabled ? (
        <Link
          href={`/api/financeiro/extrato/aluno/${alunoId}/pdf`}
          className="text-muted-foreground hover:underline"
          target="_blank"
        >
          PDF
        </Link>
      ) : (
        <span className="text-muted-foreground">PDF</span>
      )}
    </div>
  );
}
