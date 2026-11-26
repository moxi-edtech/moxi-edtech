"use client";
import { useEffect, useState } from "react";
import { Printer, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDateTime } from "@/lib/formatters";
import { TIPOS_DOCUMENTO_EMITIVEL } from "@/lib/documentos/printUrl";

type Item = { id: string; tipo: string; aluno: string; ano: string | null; criadoEm: string; printUrl: string };
const labels: Record<string, string> = { certificado: "Certificado", historico: "Histórico escolar", declaracao_notas: "Declaração com notas", declaracao_frequencia: "Declaração de frequência", boletim_trimestral: "Boletim trimestral", cartao_estudante: "Cartão de estudante", ficha_inscricao: "Ficha de inscrição", comprovante_matricula: "Comprovativo de matrícula" };
export default function DocumentosEmitidosList() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [tipo, setTipo] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    const params = new URLSearchParams({ page: String(page), q: query, tipo });
    fetch(`/api/secretaria/documentos/emitidos?${params}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const json = await response.json();
        if (!response.ok || !json.ok) throw new Error(json.error || "Falha ao carregar documentos.");
        if (!controller.signal.aborted) { setItems(json.items); setTotal(json.total); }
      }).catch(err => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, query, tipo, retry]);
  return <section className="space-y-4 rounded-xl border border-border bg-card p-4">
    <div><h2 className="font-semibold text-foreground">Documentos emitidos</h2><p className="text-sm text-muted-foreground">Consulte e reimprima sem gerar outra cobrança.</p></div>
    <form className="flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); setPage(1); setQuery(search.trim()); }}>
      <label className="min-w-0 flex-1 text-sm">Aluno<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome do aluno" className="mt-1 block min-h-11 w-full rounded-xl border border-input bg-background px-3 focus:ring-4 focus:ring-klasse-gold/20" /></label>
      <label className="text-sm">Documento<select value={tipo} onChange={event => { setTipo(event.target.value); setPage(1); }} className="mt-1 block min-h-11 rounded-xl border border-input bg-background px-3"><option value="">Todos</option>{TIPOS_DOCUMENTO_EMITIVEL.map(type => <option key={type} value={type}>{labels[type]}</option>)}</select></label>
      <button className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold" type="submit"><Search className="h-4 w-4" />Pesquisar</button>
    </form>
    {loading ? <p role="status" className="text-sm text-muted-foreground">A carregar documentos…</p> : error ? <div role="alert" className="text-sm">{error} <button type="button" className="underline" onClick={() => setRetry(n => n + 1)}>Tentar novamente</button></div> : !items.length ? <p className="py-6 text-center text-sm text-muted-foreground">Nenhum documento encontrado.</p> : <>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border text-muted-foreground"><tr><th className="p-3">Aluno</th><th className="p-3">Documento</th><th className="p-3">Ano letivo</th><th className="p-3">Emissão</th><th className="p-3">Ação</th></tr></thead><tbody>{items.map(item => <tr key={item.id} className="border-b border-border"><td className="p-3">{item.aluno}</td><td className="p-3">{labels[item.tipo] ?? item.tipo}</td><td className="p-3">{item.ano ?? "—"}</td><td className="p-3">{formatDateTime(item.criadoEm)}</td><td className="p-3"><a href={item.printUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 font-semibold text-foreground"><Printer className="h-4 w-4" />Reimprimir</a></td></tr>)}</tbody></table></div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{total} documentos</span><div className="flex items-center gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="inline-flex items-center gap-1 rounded-xl border border-border p-2 disabled:opacity-50"><ChevronLeft className="h-4 w-4" />Anterior</button><span>{page}</span><button type="button" disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)} className="inline-flex items-center gap-1 rounded-xl border border-border p-2 disabled:opacity-50">Seguinte<ChevronRight className="h-4 w-4" /></button></div></div>
    </>}
  </section>;
}
