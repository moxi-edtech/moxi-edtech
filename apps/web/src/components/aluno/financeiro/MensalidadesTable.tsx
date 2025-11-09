"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import StatusPill from "./StatusPill";

type Mensalidade = {
  id: string;
  competencia: string; // YYYY-MM
  valor: number;
  vencimento: string; // ISO date
  status: 'pago' | 'pendente' | 'atrasado';
  pago_em: string | null; // ISO date
};

export function MensalidadesTable() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Mensalidade[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/aluno/financeiro', { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok || !json?.ok) throw new Error(json?.error || 'Falha ao carregar mensalidades');
        if (mounted) setRows(json.mensalidades || []);
      } catch {
        if (mounted) setRows([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false };
  }, []);

  if (loading) return <div>Carregando mensalidades…</div>;
  if (!rows.length) return <div className="text-sm text-gray-600">Nenhuma mensalidade encontrada.</div>;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500">
            <th className="py-2 pr-4">Competência</th>
            <th className="py-2 pr-4">Valor</th>
            <th className="py-2 pr-4">Vencimento</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2">Pago em</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id} className="border-t">
              <td className="py-2 pr-4">{m.competencia}</td>
              <td className="py-2 pr-4">R$ {m.valor.toFixed(2)}</td>
              <td className="py-2 pr-4">{new Date(m.vencimento).toLocaleDateString()}</td>
              <td className="py-2 pr-4"><StatusPill status={m.status} /></td>
              <td className="py-2">{m.pago_em ? new Date(m.pago_em).toLocaleDateString() : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
