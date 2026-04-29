"use client";

import { useEffect, useState } from "react";
import { UserPlus, X, Loader2, ArrowRight, UserCheck, AlertCircle, Search, User } from "lucide-react";
import { toast } from "@/lib/toast";

type Props = {
  open: boolean;
  onClose: () => void;
  cohortId: string;
  cohortNome: string;
  onSuccess?: () => void;
};

type Candidate = {
  user_id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  bi_numero: string | null;
  label: string;
};

type Resolution = {
  mode: string;
  candidates: Candidate[];
};

export function InscricaoBalcaoModal({ open, onClose, cohortId, cohortNome, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [form, setForm] = useState({
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
    if (!open) {
      setResolution(null);
      setLoading(false);
      setForm((prev) => ({
        ...prev,
        nome: "",
        email: "",
        bi_numero: "",
        telefone: "",
        valor_cobrado: "",
        criar_cobranca: true,
        vencimento_em: new Date().toISOString().split("T")[0],
      }));
    }
  }, [open]);

  const handleSubmit = async (selectedUserId?: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/formacao/secretaria/inscricoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          cohort_id: cohortId,
          formando_user_id: selectedUserId,
          valor_cobrado: Number(form.valor_cobrado || 0),
          origem: "balcao",
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        if (json.code === "FORMANDO_RESOLUTION_REQUIRED") {
          setResolution(json.resolution);
          toast({ title: "Resolução Necessária", description: "Identificamos possíveis perfis existentes.", variant: "default" });
          return;
        }
        throw new Error(json.error || "Falha na inscrição");
      }

      toast({ title: "Sucesso!", description: "Inscrição realizada com sucesso.", variant: "default" });
      onSuccess?.();
      onClose();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-300">
        <header className="relative border-b border-slate-100 bg-slate-50/50 p-6">
          <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-white hover:text-slate-600">
            <X size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-klasse-gold text-white shadow-lg shadow-klasse-gold/20">
              <UserPlus size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-klasse-gold">Inscrição Balcão</h3>
              <p className="text-xs font-semibold text-slate-600 truncate max-w-[300px]">{cohortNome}</p>
            </div>
          </div>
        </header>

        <div className="p-6">
          {resolution ? (
            <div className="space-y-4">
              <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 flex gap-3">
                <AlertCircle className="text-amber-600 shrink-0" size={20} />
                <div>
                  <p className="text-sm font-bold text-amber-900">Perfil Duplicado ou Ambiguidade</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Encontramos os seguintes candidatos no sistema com dados semelhantes. Selecione um para associar a inscrição ao perfil existente ou volte para revisar os dados.
                  </p>
                </div>
              </div>

              <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                {resolution.candidates.map((candidate) => (
                  <button
                    key={candidate.user_id}
                    onClick={() => handleSubmit(candidate.user_id)}
                    disabled={loading}
                    className="w-full flex items-center justify-between gap-4 p-4 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-klasse-gold hover:shadow-lg transition-all text-left group"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900 truncate">{candidate.nome}</p>
                      <div className="flex flex-wrap gap-x-3 mt-0.5">
                        {candidate.email && <span className="text-[10px] font-bold text-slate-500 uppercase">{candidate.email}</span>}
                        {candidate.bi_numero && <span className="text-[10px] font-bold text-slate-500 uppercase">BI: {candidate.bi_numero}</span>}
                      </div>
                    </div>
                    <div className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-slate-200 group-hover:bg-klasse-gold group-hover:text-white group-hover:border-klasse-gold transition-colors">
                      <UserCheck size={16} />
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setResolution(null)}
                className="w-full py-3 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors uppercase tracking-widest"
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
              className="space-y-4"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nome Completo</label>
                  <input
                    required
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm outline-none transition-all focus:bg-white focus:border-klasse-gold font-semibold"
                    placeholder="Ex: João Silva"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nº do BI (Angola)</label>
                  <input
                    required
                    value={form.bi_numero}
                    onChange={(e) => setForm({ ...form, bi_numero: e.target.value.toUpperCase() })}
                    className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm outline-none transition-all focus:bg-white focus:border-klasse-gold font-semibold"
                    placeholder="000000000LA000"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Email</label>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value.toLowerCase() })}
                    className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm outline-none transition-all focus:bg-white focus:border-klasse-gold font-semibold"
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Telefone</label>
                  <input
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                    className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm outline-none transition-all focus:bg-white focus:border-klasse-gold font-semibold"
                    placeholder="900 000 000"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Modalidade</label>
                  <select
                    value={form.modalidade}
                    onChange={(e) => setForm({ ...form, modalidade: e.target.value as any })}
                    className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm outline-none transition-all focus:bg-white focus:border-klasse-gold font-semibold appearance-none"
                  >
                    <option value="presencial">Presencial</option>
                    <option value="online_live">Online (Live)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Valor a Cobrar (AOA)</label>
                  <input
                    type="number"
                    value={form.valor_cobrado}
                    onChange={(e) => setForm({ ...form, valor_cobrado: e.target.value })}
                    className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm outline-none transition-all focus:bg-white focus:border-klasse-gold font-bold"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-3 p-1">
                  <input
                    type="checkbox"
                    id="criar_cobranca"
                    checked={form.criar_cobranca}
                    onChange={(e) => setForm({ ...form, criar_cobranca: e.target.checked })}
                    className="h-5 w-5 rounded-lg border-slate-200 text-klasse-gold focus:ring-klasse-gold"
                  />
                  <label htmlFor="criar_cobranca" className="text-xs font-bold text-slate-700 cursor-pointer">
                    Gerar cobrança financeira automática
                  </label>
                </div>

                {form.criar_cobranca && (
                  <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Data de Vencimento</label>
                    <input
                      type="date"
                      value={form.vencimento_em}
                      onChange={(e) => setForm({ ...form, vencimento_em: e.target.value })}
                      className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm outline-none transition-all focus:bg-white focus:border-klasse-gold font-semibold"
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-[2rem] bg-klasse-gold py-4 text-sm font-black text-white shadow-2xl shadow-klasse-gold/30 transition-all hover:brightness-110 active:scale-95 disabled:opacity-50 mt-4"
              >
                {loading ? <Loader2 size={20} className="animate-spin" /> : <>Finalizar Inscrição <ArrowRight size={18} /></>}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
