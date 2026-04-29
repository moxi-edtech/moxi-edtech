"use client";

import { useEffect, useState } from "react";
import { UserPlus, Loader2, ArrowRight, UserCheck, AlertCircle, Calendar } from "lucide-react";
import { toast } from "@/lib/toast";

type CohortOption = {
  id: string;
  nome: string;
  curso_nome: string;
};

type Candidate = {
  user_id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  bi_numero: string | null;
};

type Resolution = {
  mode: string;
  candidates: Candidate[];
};

export function InscricaoDiretaClient() {
  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [cohorts, setCohorts] = useState<CohortOption[]>([]);
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [form, setForm] = useState({
    cohort_id: "",
    nome: "",
    email: "",
    bi_numero: "",
    telefone: "",
    modalidade: "presencial" as "presencial" | "online_live",
    valor_cobrado: "",
    criar_cobranca: true,
    vencimento_em: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    async function loadOptions() {
      try {
        const res = await fetch("/api/formacao/backoffice/cohorts");
        const json = await res.json();
        if (res.ok && json.items) {
          // Filtrar apenas turmas abertas ou planejadas
          setCohorts(json.items.filter((c: any) => c.status !== 'concluida' && c.status !== 'cancelada'));
        }
      } catch (e) {
        console.error("Erro ao carregar turmas", e);
      } finally {
        setLoadingOptions(false);
      }
    }
    loadOptions();
  }, []);

  const handleSubmit = async (selectedUserId?: string) => {
    if (!form.cohort_id) {
      toast({ title: "Erro", description: "Selecione uma turma", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/formacao/secretaria/inscricoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          formando_user_id: selectedUserId,
          valor_cobrado: Number(form.valor_cobrado || 0),
          origem: "balcao",
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        if (json.code === "FORMANDO_RESOLUTION_REQUIRED") {
          setResolution(json.resolution);
          toast({ title: "Resolução Necessária", description: "Possíveis perfis encontrados.", variant: "default" });
          return;
        }
        throw new Error(json.error || "Falha na inscrição");
      }

      toast({ title: "Sucesso!", description: "Inscrição realizada com sucesso.", variant: "default" });
      // Reset form
      setForm({
        ...form,
        nome: "",
        email: "",
        bi_numero: "",
        telefone: "",
        valor_cobrado: "",
      });
      setResolution(null);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <header className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-klasse-gold text-white shadow-lg shadow-klasse-gold/20">
            <UserPlus size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase tracking-widest">Nova Inscrição</h1>
            <p className="text-sm font-medium text-slate-500">Registo de formando no balcão da secretaria.</p>
          </div>
        </div>
      </header>

      <main className="rounded-[2.5rem] border border-slate-200 bg-white shadow-xl overflow-hidden">
        <div className="p-8">
          {resolution ? (
            <div className="space-y-6">
              <div className="rounded-2xl bg-amber-50 border border-amber-100 p-6 flex gap-4">
                <AlertCircle className="text-amber-600 shrink-0" size={24} />
                <div>
                  <p className="text-base font-bold text-amber-900">Perfil Duplicado</p>
                  <p className="text-sm text-amber-700 mt-1">
                    Encontramos os seguintes candidatos no sistema. Selecione um para associar a inscrição ou volte para revisar.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {resolution.candidates.map((candidate) => (
                  <button
                    key={candidate.user_id}
                    onClick={() => handleSubmit(candidate.user_id)}
                    disabled={loading}
                    className="w-full flex items-center justify-between gap-4 p-5 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-klasse-gold hover:shadow-lg transition-all text-left group"
                  >
                    <div>
                      <p className="font-black text-slate-900">{candidate.nome}</p>
                      <div className="flex flex-wrap gap-x-4 mt-1">
                        {candidate.email && <span className="text-xs font-bold text-slate-500 uppercase">{candidate.email}</span>}
                        {candidate.bi_numero && <span className="text-xs font-bold text-slate-500 uppercase font-mono">BI: {candidate.bi_numero}</span>}
                      </div>
                    </div>
                    <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200 group-hover:bg-klasse-gold group-hover:text-white group-hover:border-klasse-gold transition-colors">
                      <UserCheck size={20} />
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setResolution(null)}
                className="w-full py-4 text-xs font-black text-slate-400 hover:text-slate-800 transition-colors uppercase tracking-[0.2em]"
              >
                Voltar e revisar dados
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Turma / Cohort Alvo</label>
                <div className="relative">
                    <select
                        required
                        value={form.cohort_id}
                        onChange={(e) => setForm({ ...form, cohort_id: e.target.value })}
                        className="w-full rounded-2xl border border-slate-100 bg-slate-50 pl-5 pr-10 py-4 text-sm outline-none transition-all focus:bg-white focus:border-klasse-gold font-bold appearance-none disabled:opacity-50"
                        disabled={loadingOptions}
                    >
                        <option value="">Selecione uma turma ativa...</option>
                        {cohorts.map(c => (
                            <option key={c.id} value={c.id}>{c.nome} — {c.curso_nome}</option>
                        ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        {loadingOptions ? <Loader2 size={18} className="animate-spin" /> : <Calendar size={18} />}
                    </div>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Nome Completo</label>
                  <input
                    required
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm outline-none transition-all focus:bg-white focus:border-klasse-gold font-bold"
                    placeholder="Ex: João Silva"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Nº do BI</label>
                  <input
                    required
                    value={form.bi_numero}
                    onChange={(e) => setForm({ ...form, bi_numero: e.target.value.toUpperCase() })}
                    className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm outline-none transition-all focus:bg-white focus:border-klasse-gold font-bold font-mono"
                    placeholder="000000000LA000"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Email</label>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value.toLowerCase() })}
                    className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm outline-none transition-all focus:bg-white focus:border-klasse-gold font-bold"
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Telefone</label>
                  <input
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                    className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm outline-none transition-all focus:bg-white focus:border-klasse-gold font-bold"
                    placeholder="900 000 000"
                  />
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Modalidade</label>
                  <select
                    value={form.modalidade}
                    onChange={(e) => setForm({ ...form, modalidade: e.target.value as any })}
                    className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm outline-none transition-all focus:bg-white focus:border-klasse-gold font-bold appearance-none"
                  >
                    <option value="presencial">Presencial</option>
                    <option value="online_live">Online (Live)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Valor a Cobrar (AOA)</label>
                  <input
                    type="number"
                    value={form.valor_cobrado}
                    onChange={(e) => setForm({ ...form, valor_cobrado: e.target.value })}
                    className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm outline-none transition-all focus:bg-white focus:border-klasse-gold font-black text-lg"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="space-y-5 pt-4">
                <div className="flex items-center gap-4 p-2 bg-slate-50/50 rounded-2xl border border-slate-100">
                  <input
                    type="checkbox"
                    id="criar_cobranca"
                    checked={form.criar_cobranca}
                    onChange={(e) => setForm({ ...form, criar_cobranca: e.target.checked })}
                    className="h-6 w-6 rounded-lg border-slate-300 text-klasse-gold focus:ring-klasse-gold"
                  />
                  <label htmlFor="criar_cobranca" className="text-sm font-bold text-slate-700 cursor-pointer">
                    Gerar cobrança financeira automática para este formando
                  </label>
                </div>

                {form.criar_cobranca && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Data de Vencimento</label>
                    <input
                      type="date"
                      value={form.vencimento_em}
                      onChange={(e) => setForm({ ...form, vencimento_em: e.target.value })}
                      className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm outline-none transition-all focus:bg-white focus:border-klasse-gold font-bold"
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 rounded-[2.5rem] bg-klasse-gold py-5 text-base font-black text-white shadow-2xl shadow-klasse-gold/30 transition-all hover:brightness-110 active:scale-95 disabled:opacity-50 mt-6"
              >
                {loading ? <Loader2 size={24} className="animate-spin" /> : <>Registar e Finalizar Inscrição <ArrowRight size={22} /></>}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
