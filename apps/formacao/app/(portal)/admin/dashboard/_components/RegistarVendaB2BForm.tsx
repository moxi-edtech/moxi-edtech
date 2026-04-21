"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { 
  Building2, 
  Hash, 
  Users, 
  FileText, 
  Loader2, 
  ChevronRight, 
  X,
  CheckCircle2,
  DollarSign
} from "lucide-react";
import { registarVendaB2BAction } from "@/app/actions/b2b-actions";
import { toast } from "@/lib/toast";

type Props = {
  cohorts: { id: string; nome: string; curso_nome: string }[];
  onClose: () => void;
};

export function RegistarVendaB2BForm({ cohorts, onClose }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register, handleSubmit } = useForm();

  async function onSubmit(data: any) {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      Object.entries(data).forEach(([key, val]) => formData.append(key, String(val)));
      
      const res = await registarVendaB2BAction(formData);
      if (res.error) {
        toast({ title: "Erro", description: res.error, variant: "destructive" });
      } else {
        toast({ title: "Sucesso!", description: "Venda B2B registada. Link Mágico em processamento." });
        onClose();
      }
    } catch (err) {
      toast({ title: "Erro", description: "Falha na submissão.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-lg overflow-hidden rounded-t-[2.5rem] sm:rounded-[2.5rem] border border-slate-200 bg-white p-6 sm:p-10 shadow-2xl animate-in slide-in-from-bottom-10 duration-500">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-inner">
              <Building2 size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 leading-tight">Venda B2B</h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Registo Empresarial</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-slate-50 text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </header>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Empresa Cliente</label>
            <input 
              {...register("empresa_nome", { required: true })}
              placeholder="Ex: Banco BAI"
              className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-base outline-none transition-all focus:bg-white focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500 font-semibold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">NIF da Empresa</label>
              <input 
                {...register("nif")}
                placeholder="54xxxxxxx"
                className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm outline-none transition-all focus:bg-white focus:border-emerald-500 font-semibold"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Vagas Vendidas</label>
              <input 
                {...register("vagas", { required: true })}
                type="number"
                placeholder="20"
                className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm outline-none transition-all focus:bg-white focus:border-emerald-500 font-bold"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Mentoria / Evento</label>
            <select 
              {...register("cohort_id", { required: true })}
              className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm outline-none transition-all focus:bg-white focus:border-emerald-500 font-semibold appearance-none"
            >
              <option value="">Selecionar Mentoria</option>
              {cohorts.map(c => <option key={c.id} value={c.id}>{c.curso_nome} ({c.nome})</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Valor Total (AOA)</label>
              <input 
                {...register("valor_total", { required: true })}
                type="number"
                placeholder="0.00"
                className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm outline-none transition-all focus:bg-white focus:border-emerald-500 font-black text-emerald-600"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Ref. Primavera / FT</label>
              <input 
                {...register("fatura_externa_ref")}
                placeholder="FT 2026/..."
                className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm outline-none transition-all focus:bg-white focus:border-emerald-500 font-semibold"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-[2rem] bg-emerald-600 py-5 text-lg font-black text-white shadow-2xl shadow-emerald-600/30 transition-all hover:brightness-110 active:scale-95 disabled:opacity-70"
          >
            {isSubmitting ? <Loader2 className="animate-spin" /> : <>Finalizar Venda <ChevronRight size={24} /></>}
          </button>
        </form>
      </div>
    </div>
  );
}
