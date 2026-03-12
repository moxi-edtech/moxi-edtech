"use client";

import { useEffect, useState } from "react";

export function FinanceiroResumo() {
  const [resumo, setResumo] = useState<{ pendentes: number; emDia: boolean } | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {

        const currentYear = new Date().getFullYear();
        const fromAno = currentYear - 4;
        const toAno = currentYear;
        const params = new URLSearchParams({ fromAno: String(fromAno), toAno: String(toAno) });
        const res = await fetch(`/api/aluno/financeiro?${params.toString()}`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao carregar financeiro');
        const pend = (json.mensalidades || []).filter((m: { status?: string }) => m.status === 'pendente' || m.status === 'atrasado').length;
        if (mounted) setResumo({ pendentes: pend, emDia: pend === 0 });
      } catch {
        if (mounted) setResumo({ pendentes: 0, emDia: true });
      }
    })();
    return () => { mounted = false };
  }, []);

  return (
    <div className="bg-white p-4 rounded-lg border">
      <div className="text-sm text-gray-600">Resumo financeiro</div>
      <div className="mt-2 text-gray-800">
        {resumo?.emDia ? 'Em dia' : `Pendências: ${resumo?.pendentes ?? '-'}`}
      </div>
    </div>
  );
}
