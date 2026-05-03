"use client";

import { useEffect, useState } from "react";
import { 
  CheckCircle2, 
  XCircle, 
  ExternalLink, 
  Clock, 
  Search, 
  Filter,
  User,
  Calendar,
  CreditCard,
  Loader2
} from "lucide-react";

type StagingInscricao = {
  id: string;
  nome_completo: string;
  bi_passaporte: string;
  email: string | null;
  telefone: string;
  comprovativo_url: string;
  status: "PENDENTE" | "APROVADA" | "REJEITADA";
  created_at: string;
  priority_score?: number;
  priority_level?: "alta" | "media" | "baixa";
  priority_reasons?: string[];
  operational_recommendation?: string;
  operational_recommendation_reason?: string;
  cohort: {
    nome: string;
    curso_nome: string;
    data_inicio?: string | null;
  };
};

export default function AdmissoesWebPage() {
  const [items, setItems] = useState<StagingInscricao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<"TODAS" | "PENDENTE" | "APROVADA" | "REJEITADA">("PENDENTE");
  const [search, setSearch] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/formacao/admin/inscricoes-staging");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Falha ao carregar inscrições");
      setItems(json.items);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAction = async (id: string, action: "APROVAR" | "REJEITAR") => {
    if (!confirm(`Tem certeza que deseja ${action.toLowerCase()} esta inscrição?`)) return;

    setBusy(prev => ({ ...prev, [id]: true }));
    try {
      const res = await fetch("/api/formacao/admin/inscricoes-staging", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Falha ao processar ação");
      
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusy(prev => ({ ...prev, [id]: false }));
    }
  };

  const filteredItems = items.filter(item => {
    const matchesFilter = filter === "TODAS" || item.status === filter;
    const matchesSearch = item.nome_completo.toLowerCase().includes(search.toLowerCase()) || 
                         item.bi_passaporte.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const priorityPill = (level?: "alta" | "media" | "baixa") => {
    if (level === "alta") return "bg-rose-50 text-rose-700 border border-rose-100";
    if (level === "media") return "bg-amber-50 text-amber-700 border border-amber-100";
    return "bg-slate-100 text-slate-700 border border-slate-200";
  };

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-klasse-gold">Secretaria Virtual</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">Admissões Web</h1>
            <p className="mt-2 text-sm text-slate-600">
              Faça a triagem das matrículas realizadas através da landing page pública.
            </p>
          </div>
          <button 
            onClick={loadData}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
          >
            Atualizar Lista
          </button>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar por nome ou BI..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-10 py-2.5 text-sm outline-none transition-all focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/5"
            />
          </div>
          <div className="flex gap-2">
            {(["PENDENTE", "APROVADA", "REJEITADA", "TODAS"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-4 py-2 text-xs font-black transition-all ${
                  filter === f 
                    ? "bg-slate-900 text-white" 
                    : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200">
          <Loader2 className="animate-spin text-klasse-gold mb-4" size={40} />
          <p className="text-slate-500 font-bold">Carregando inscrições...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-200">
          <Clock className="mx-auto text-slate-300 mb-4" size={48} />
          <p className="text-slate-500 font-bold">Nenhuma inscrição encontrada para este filtro.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredItems.map((item) => (
            <article 
              key={item.id}
              className="group relative flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:border-klasse-gold/30 hover:shadow-lg"
            >
              <div className="flex items-start gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                  item.status === 'PENDENTE' ? 'bg-amber-50 text-amber-600' :
                  item.status === 'APROVADA' ? 'bg-emerald-50 text-emerald-600' :
                  'bg-rose-50 text-rose-600'
                }`}>
                  <User size={24} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900">{item.nome_completo}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
                    <span className="flex items-center gap-1" suppressHydrationWarning><Calendar size={12} /> {new Date(item.created_at).toLocaleDateString("pt-AO")}</span>
                    <span className="flex items-center gap-1 uppercase tracking-tight">BI: {item.bi_passaporte}</span>
                    <span className="flex items-center gap-1 uppercase tracking-tight text-klasse-gold">{item.cohort.curso_nome}</span>
                    <span className={`rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-widest ${priorityPill(item.priority_level)}`}>
                      Prioridade {item.priority_level ?? "baixa"} · {item.priority_score ?? 0}
                    </span>
                  </div>
                  {item.priority_reasons && item.priority_reasons.length > 0 ? (
                    <p className="mt-2 text-[11px] font-semibold text-slate-500">
                      {item.priority_reasons.join(" · ")}
                    </p>
                  ) : null}
                  {item.operational_recommendation ? (
                    <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-blue-700">
                        Próxima ação: {item.operational_recommendation}
                      </span>
                      {item.operational_recommendation_reason ? (
                        <span className="text-[10px] font-semibold text-blue-700/80">
                          {item.operational_recommendation_reason}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <a 
                  href={item.comprovativo_url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all border border-slate-200"
                >
                  <CreditCard size={14} /> Ver Talão <ExternalLink size={12} />
                </a>

                {item.status === "PENDENTE" && (
                  <>
                    <button
                      disabled={busy[item.id]}
                      onClick={() => handleAction(item.id, "REJEITAR")}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white transition-all disabled:opacity-50"
                      title="Rejeitar Inscrição"
                    >
                      <XCircle size={20} />
                    </button>
                    <button
                      disabled={busy[item.id]}
                      onClick={() => handleAction(item.id, "APROVAR")}
                      className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2 text-xs font-black text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
                    >
                      {busy[item.id] ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                      Aprovar
                    </button>
                  </>
                )}

                {item.status !== "PENDENTE" && (
                  <span className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest ${
                    item.status === 'APROVADA' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'
                  }`}>
                    {item.status}
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
