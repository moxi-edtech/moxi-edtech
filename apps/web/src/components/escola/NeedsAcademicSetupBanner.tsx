"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

type Props = {
  escolaId: string;
  message?: string;
  className?: string;
};

export default function NeedsAcademicSetupBanner({ escolaId, message, className }: Props) {
  const router = useRouter();
  const text = useMemo(() => message || "Algumas configurações acadêmicas precisam de atenção.", [message]);

  return (
    <div className={`rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-900 ${className || ''}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold">Ação necessária</div>
          <div className="text-sm mt-0.5">{text}</div>
        </div>
        <button
          type="button"
          onClick={() => router.push(`/escola/${escolaId}/admin/configuracoes`)}
          className="inline-flex items-center rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700"
        >
          Abrir Configurações
        </button>
      </div>
    </div>
  );
}

