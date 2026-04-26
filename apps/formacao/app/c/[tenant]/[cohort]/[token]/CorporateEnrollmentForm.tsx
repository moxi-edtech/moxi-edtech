"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { CheckCircle2, Loader2, ArrowRight, User, Mail, ShieldCheck } from "lucide-react";
import { toast } from "@/lib/toast";

const corporateSchema = z.object({
  nome: z.string().min(3, "Nome completo é obrigatório"),
  bi_numero: z.string().min(6, "Número de identificação inválido"),
  email: z.string().email("E-mail corporativo inválido"),
  telefone: z.string().min(9, "Telefone inválido"),
});

type CorporateForm = z.infer<typeof corporateSchema>;

type Props = {
  escolaId: string;
  cohortId: string;
  faturaId: string;
  b2bToken: string;
  empresa: string;
};

export function CorporateEnrollmentForm({ escolaId, cohortId, faturaId, b2bToken, empresa }: Props) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CorporateForm>();

  const onSubmit = async (data: CorporateForm) => {
    const validation = corporateSchema.safeParse(data);
    if (!validation.success) {
      for (const issue of validation.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string") {
          setError(field as keyof CorporateForm, { type: "manual", message: issue.message });
        }
      }
      return;
    }

    setLoading(true);
    try {
      // 1. Chamar API de Inscrição Especial (Bypass de Pagamento)
      // Nota: Precisaremos criar este endpoint ou adaptar o existente
      const res = await fetch("/api/formacao/publico/inscrever-corporativo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...validation.data,
          escola_id: escolaId,
          cohort_id: cohortId,
          fatura_id: faturaId,
          b2b_token: b2bToken,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Falha ao processar inscrição");

      setSuccess(true);
      toast({ title: "Bem-vindo!", description: "Inscrição confirmada via " + empresa });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Falha ao processar inscrição";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center animate-in fade-in zoom-in duration-500">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
          <CheckCircle2 size={48} />
        </div>
        <h2 className="text-2xl font-black text-slate-900">Matrícula Confirmada!</h2>
        <p className="mt-4 text-slate-600 leading-relaxed">
          Olá! Já enviámos as tuas credenciais de acesso para o e-mail que forneceste. 
          Podes aceder ao portal e começar a tua jornada imediatamente.
        </p>
        <button
          onClick={() => window.location.href = "/login"}
          className="mt-8 w-full rounded-2xl bg-slate-900 py-4 text-sm font-bold text-white transition-all hover:bg-slate-800"
        >
          Ir para o Portal
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-1.5">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Nome Completo</label>
        <div className="relative">
          <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
          <input 
            {...register("nome")}
            placeholder="Nome Completo"
            className="w-full rounded-2xl border border-slate-100 bg-slate-50 pl-12 pr-4 py-4 text-sm outline-none transition-all focus:bg-white focus:ring-8 focus:ring-klasse-gold/5 focus:border-klasse-gold font-semibold"
          />
        </div>
        {errors.nome && <p className="text-[10px] font-bold text-rose-500 ml-1">{errors.nome.message}</p>}
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">E-mail Corporativo</label>
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
          <input 
            {...register("email")}
            placeholder="nome@empresa.com"
            className="w-full rounded-2xl border border-slate-100 bg-slate-50 pl-12 pr-4 py-4 text-sm outline-none transition-all focus:bg-white focus:ring-8 focus:ring-klasse-gold/5 focus:border-klasse-gold font-semibold"
          />
        </div>
        {errors.email && <p className="text-[10px] font-bold text-rose-500 ml-1">{errors.email.message}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Número de BI</label>
          <input 
            {...register("bi_numero")}
            placeholder="Documento"
            className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm outline-none transition-all focus:bg-white focus:ring-8 focus:ring-klasse-gold/5 focus:border-klasse-gold font-semibold"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Telefone</label>
          <input 
            {...register("telefone")}
            placeholder="Contacto"
            className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm outline-none transition-all focus:bg-white focus:ring-8 focus:ring-klasse-gold/5 focus:border-klasse-gold font-semibold"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-[2rem] bg-klasse-gold py-5 text-sm font-black text-white shadow-2xl shadow-klasse-gold/30 transition-all hover:scale-[1.02] hover:brightness-110 active:scale-95 disabled:opacity-70"
      >
        {loading ? (
          <Loader2 size={20} className="animate-spin" />
        ) : (
          <>
            Confirmar Inscrição Gratuita <ArrowRight size={18} />
          </>
        )}
      </button>

      <div className="flex items-center justify-center gap-2 mt-4 text-slate-400">
        <ShieldCheck size={14} />
        <span className="text-[10px] font-bold uppercase tracking-widest">Inscrição Segura & Patrocinada</span>
      </div>
    </form>
  );
}
