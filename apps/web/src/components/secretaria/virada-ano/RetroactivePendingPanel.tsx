"use client";

import { useEffect, useState } from "react";

type Item = { id: string; tipo: string; titulo: string; detalhe: string; ano_letivo: number | null; href: string | null };

export function RetroactivePendingPanel() {
  const [tipo, setTipo] = useState("all");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ tipo, ...(q ? { q } : {}) });
    fetch(`/api/secretaria/operacoes-academicas/virada/pendencias?${params}`, { cache: "no-store", signal: controller.signal })
      .then((res) => res.json())
      .then((json) => setItems(json?.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [tipo, q]);

  return <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
      <div><h2 className="text-sm font-semibold text-slate-800">Pendências retroativas</h2><p className="text-xs text-slate-500">Alunos, turmas, disciplinas e documentos que precisam de tratamento.</p></div>
      <div className="flex gap-2"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar aluno, turma..." className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs" /><select value={tipo} onChange={(e) => setTipo(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"><option value="all">Todos</option><option value="aluno">Alunos</option><option value="turma">Turmas</option><option value="disciplina">Disciplinas</option><option value="documento">Documentos</option></select></div>
    </div>
    {loading ? <p className="text-xs text-slate-500">A carregar...</p> : items.length === 0 ? <p className="text-xs text-emerald-700">Nenhuma pendência encontrada.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b border-amber-200 text-slate-500"><th className="py-2">Tipo</th><th>Título</th><th>Detalhe</th><th>Ano</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-b border-amber-100"><td className="py-2 font-semibold uppercase text-[10px]">{item.tipo}</td><td>{item.href ? <a className="text-klasse-green hover:underline" href={item.href}>{item.titulo}</a> : item.titulo}</td><td>{item.detalhe}</td><td>{item.ano_letivo ?? "—"}</td></tr>)}</tbody></table></div>}
  </section>;
}
