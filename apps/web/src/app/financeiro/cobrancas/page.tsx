"use client";

import { useEffect, useMemo, useState } from "react";
import { Filter } from "lucide-react";

type CobrancaItem = {
  id: string;
  canal: string;
  status: string;
  mensagem?: string | null;
  resposta?: string | null;
  enviado_em: string;
  alunos?: {
    nome?: string | null;
    responsavel?: string | null;
    telefone_responsavel?: string | null;
  } | { nome?: string | null; responsavel?: string | null; telefone_responsavel?: string | null }[] | null;
  mensalidades?: {
    valor_previsto?: number | null;
    data_vencimento?: string | null;
    status?: string | null;
  } | {
    valor_previsto?: number | null;
    data_vencimento?: string | null;
    status?: string | null;
  }[] | null;
};

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default function CobrancasPage() {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<CobrancaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/financeiro/cobrancas?q=${encodeURIComponent(search)}`, {
          cache: "force-cache",
        });
        const json = await res.json();
        if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao carregar cobranças");
        if (active) setItems(json.items ?? []);
      } catch {
        if (active) setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [search]);

  const rows = useMemo(() => {
    return items.map((item) => {
      const aluno = normalizeRelation(item.alunos);
      const mensalidade = normalizeRelation(item.mensalidades);
      return {
        id: item.id,
        nome: aluno?.nome ?? "—",
        responsavel: aluno?.responsavel ?? "—",
        telefone: aluno?.telefone_responsavel ?? "—",
        status: item.status,
        canal: item.canal,
        vencimento: mensalidade?.data_vencimento,
        valor: mensalidade?.valor_previsto ?? 0,
        enviado_em: item.enviado_em,
      };
    });
  }, [items]);

  return (
    <main className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Histórico de Cobranças</h1>
        <p className="text-sm text-slate-500">
          Acompanhe cobranças enviadas e respostas registradas.
        </p>
      </div>

      <div className="relative w-full max-w-lg">
        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          className="pl-10 pr-4 py-2 w-full border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-klasse-gold/20 focus:border-klasse-gold"
          placeholder="Buscar por aluno ou responsável..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left font-semibold uppercase">Aluno</th>
              <th className="px-4 py-3 text-left font-semibold uppercase">Responsável</th>
              <th className="px-4 py-3 text-left font-semibold uppercase">Canal</th>
              <th className="px-4 py-3 text-left font-semibold uppercase">Vencimento</th>
              <th className="px-4 py-3 text-left font-semibold uppercase">Valor</th>
              <th className="px-4 py-3 text-left font-semibold uppercase">Status</th>
              <th className="px-4 py-3 text-left font-semibold uppercase">Enviado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td className="px-4 py-6 text-center text-slate-400" colSpan={7}>
                  Carregando cobranças...
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-slate-400" colSpan={7}>
                  Nenhuma cobrança registrada.
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-900">{row.nome}</td>
                  <td className="px-4 py-3 text-slate-600">{row.responsavel}</td>
                  <td className="px-4 py-3 text-slate-600 uppercase">{row.canal}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {row.vencimento ? new Date(row.vencimento).toLocaleDateString("pt-PT") : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-900 font-semibold">
                    {Number(row.valor || 0).toLocaleString("pt-AO")} Kz
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {row.enviado_em ? new Date(row.enviado_em).toLocaleString("pt-PT") : "—"}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
