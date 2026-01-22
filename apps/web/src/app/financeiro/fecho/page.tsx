"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Printer } from "lucide-react";

type FechoItem = {
  id: string;
  hora: string;
  aluno: string;
  valor: number;
  metodo: string;
};

type FechoTotals = {
  especie: number;
  tpa: number;
  transferencia: number;
  total: number;
};

type FechoResponse = {
  ok: boolean;
  date: string;
  operador_id: string | null;
  operador_label: string;
  escola_nome: string;
  totals: FechoTotals;
  items: FechoItem[];
  error?: string;
};

const formatKz = (value: number) =>
  new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA" }).format(value || 0);

export const dynamic = "force-dynamic";

export default function FechoCaixaPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<FechoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [obs, setObs] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/financeiro/fecho?date=${date}`, {
          cache: "no-store",
        });
        const json = (await res.json().catch(() => ({}))) as FechoResponse;
        if (!res.ok || !json.ok) throw new Error(json.error || "Falha ao carregar fecho");
        if (active) setData(json);
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : "Erro ao carregar fecho");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [date]);

  const totals = data?.totals || { especie: 0, tpa: 0, transferencia: 0, total: 0 };

  const rows = useMemo(() => data?.items || [], [data]);

  return (
    <main className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Fecho de Caixa - {date}</h1>
          <p className="text-sm text-slate-500">Resumo diário do operador.</p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <Link
            href={`/financeiro/fecho/print?date=${date}`}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <Printer className="h-4 w-4" />
            Imprimir Fecho
          </Link>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-xs uppercase text-amber-700">💵 Em Espécie</p>
          <p className="mt-2 text-2xl font-semibold text-amber-900">{formatKz(totals.especie)}</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <p className="text-xs uppercase text-blue-700">💳 Banco/TPA</p>
          <p className="mt-2 text-2xl font-semibold text-blue-900">{formatKz(totals.tpa)}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-xs uppercase text-emerald-700">∑ Total do Dia</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-900">{formatKz(totals.total)}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
          Lançamentos do Dia
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Hora</th>
              <th className="px-4 py-3 text-left font-semibold">Aluno</th>
              <th className="px-4 py-3 text-left font-semibold">Valor</th>
              <th className="px-4 py-3 text-left font-semibold">Método</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  Nenhum lançamento encontrado para o dia.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600">{row.hora}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{row.aluno}</td>
                <td className="px-4 py-3 text-slate-800">{formatKz(row.valor)}</td>
                <td className="px-4 py-3 text-slate-600 capitalize">{row.metodo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <label className="text-xs font-semibold uppercase text-slate-500">Observações</label>
        <textarea
          value={obs}
          onChange={(event) => setObs(event.target.value)}
          placeholder="Sobra/Falta de troco, observações do turno..."
          className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/10"
          rows={3}
        />
      </section>
    </main>
  );
}
