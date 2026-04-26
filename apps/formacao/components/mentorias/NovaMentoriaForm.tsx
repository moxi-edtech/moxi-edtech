"use client";

import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { 
  Rocket, 
  MapPin, 
  Calendar, 
  CheckCircle2, 
  Copy, 
  ExternalLink,
  Loader2,
  ChevronRight,
  Monitor,
  Video,
} from "lucide-react";
import { mentoriaSchema, type MentoriaInput } from "@/lib/validations/mentoria";
import { criarMentoriaAction } from "@/app/actions/mentoria-actions";
import { toast } from "@/lib/toast";
import { trackFunnelClient } from "@/lib/funnel-client";

function nextDayISODate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

export default function NovaMentoriaForm() {
  const [successData, setSuccessData] = useState<{ link: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setError,
    setValue,
    formState: { errors },
  } = useForm<MentoriaInput>({
    defaultValues: {
      modalidade: "ONLINE",
      preco: 0,
      data_inicio: nextDayISODate(),
    }
  });

  const modalidade = useWatch({ control, name: "modalidade" });
  const precoAtual = useWatch({ control, name: "preco" });
  const precoFormatado = useMemo(() => {
    const value = Number(precoAtual ?? 0);
    return new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 }).format(
      Number.isFinite(value) ? value : 0
    );
  }, [precoAtual]);

  async function onSubmit(data: MentoriaInput) {
    trackFunnelClient({
      event: "mentor_mentoria_submit_started",
      stage: "nova_mentoria",
      source: "nova_mentoria_form_submit",
      details: { modalidade: data.modalidade, preco: data.preco },
    });
    const validation = mentoriaSchema.safeParse(data);
    if (!validation.success) {
      for (const issue of validation.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string") {
          setError(field as keyof MentoriaInput, { type: "manual", message: issue.message });
        }
      }
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await criarMentoriaAction(validation.data);
      if (res.error) {
        trackFunnelClient({
          event: "mentor_mentoria_submit_failed",
          stage: "nova_mentoria",
          source: "nova_mentoria_action",
          details: { reason: res.error },
        });
        toast({ title: "Erro", description: res.error, variant: "destructive" });
      } else if (res.success && res.turma_id) {
        const publicLink = `${window.location.origin}/${res.tenant_slug}`;
        setSuccessData({ link: publicLink });
        trackFunnelClient({
          event: "mentor_mentoria_submit_success",
          stage: "nova_mentoria",
          source: "nova_mentoria_action",
          details: { turma_id: res.turma_id, tenant_slug: res.tenant_slug },
        });
        toast({ title: "Sucesso!", description: "Mentoria criada com sucesso." });
      }
    } catch {
      trackFunnelClient({
        event: "mentor_mentoria_submit_failed",
        stage: "nova_mentoria",
        source: "nova_mentoria_action",
        details: { reason: "network_or_unexpected_error" },
      });
      toast({ title: "Erro", description: "Falha na conexão com o servidor.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (successData) {
    return (
      <div className="mx-auto max-w-xl animate-in fade-in zoom-in duration-300">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
            <CheckCircle2 size={48} />
          </div>
          <h2 className="text-2xl font-black text-slate-900">Mentoria Lançada!</h2>
          <p className="mt-4 text-slate-600">
            O seu link de vendas já está ativo. Partilhe com a sua audiência e comece a receber inscrições.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 border border-slate-100 p-4">
              <span className="text-xs font-bold text-slate-500 truncate mr-4">{successData.link}</span>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(successData.link);
                  trackFunnelClient({
                    event: "mentor_cta_click",
                    stage: "checkout",
                    source: "nova_mentoria_copy_link",
                    details: { action: "copy_link" },
                  });
                  toast({ title: "Copiado!", description: "Link copiado para a área de transferência." });
                }}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm border border-slate-200 hover:bg-slate-50 transition-all"
              >
                <Copy size={18} />
              </button>
            </div>

            <a 
              href={successData.link}
              target="_blank"
              onClick={() =>
                trackFunnelClient({
                  event: "mentor_cta_click",
                  stage: "checkout",
                  source: "nova_mentoria_open_sales_page",
                  details: { action: "open_sales_page" },
                })
              }
              className="flex items-center justify-center gap-2 rounded-2xl bg-slate-900 py-4 text-sm font-bold text-white transition-all hover:bg-slate-800"
            >
              Ver Página de Vendas <ExternalLink size={18} />
            </a>
            
            <button 
              onClick={() => window.location.reload()}
              className="mt-2 text-sm font-bold text-slate-400 hover:text-slate-600 transition-all"
            >
              Criar outra mentoria
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-2">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-xl sm:p-10">
          <header className="mb-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-klasse-gold/10 text-klasse-gold mb-4 shadow-inner">
              <Rocket size={32} />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Lançar Mentoria</h1>
            <p className="text-base text-slate-500 mt-2 font-medium">Publique em menos de 1 minuto e comece a vender hoje.</p>
          </header>

          <div className="space-y-6">
            {/* Nome e Preço - Sempre em Coluna Única para Mobile-First */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Nome do Evento</label>
              <input 
                {...register("nome")}
                placeholder="Ex: Masterclass de Marketing"
                className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-base outline-none transition-all focus:bg-white focus:ring-8 focus:ring-klasse-gold/5 focus:border-klasse-gold font-semibold"
              />
              {errors.nome && <p className="text-[10px] font-bold text-rose-500 ml-1">{errors.nome.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Preço (AOA)</label>
              <input 
                {...register("preco", { valueAsNumber: true })}
                type="number"
                placeholder="0.00"
                min={0}
                className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-xl outline-none transition-all focus:bg-white focus:ring-8 focus:ring-klasse-gold/5 focus:border-klasse-gold font-black text-klasse-gold"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {[0, 5000, 15000, 30000].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      trackFunnelClient({
                        event: "mentor_cta_click",
                        stage: "nova_mentoria",
                        source: "nova_mentoria_price_preset",
                        details: { value },
                      });
                      setValue("preco", value, { shouldDirty: true, shouldValidate: true });
                    }}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600 hover:border-klasse-gold hover:text-klasse-gold"
                  >
                    {new Intl.NumberFormat("pt-AO", {
                      style: "currency",
                      currency: "AOA",
                      maximumFractionDigits: 0,
                    }).format(value)}
                  </button>
                ))}
              </div>
              <p className="text-[10px] font-bold text-slate-400 ml-1">Preço atual: {precoFormatado}</p>
              {errors.preco && <p className="text-[10px] font-bold text-rose-500 ml-1">{errors.preco.message}</p>}
            </div>

            {/* Modalidade - Botões de Opção Grandes */}
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Modalidade</label>
              <div className="grid grid-cols-1 gap-3">
                {[
                  { id: "ONLINE", icon: Monitor, label: "Online (Direto)" },
                  { id: "GRAVADO", icon: Video, label: "Gravado (Acesso)" },
                  { id: "PRESENCIAL", icon: MapPin, label: "Presencial (Local)" }
                ].map((opt) => (
                  <label 
                    key={opt.id}
                    className={`flex cursor-pointer items-center gap-4 rounded-2xl border-2 p-5 transition-all active:scale-95 ${
                      modalidade === opt.id 
                        ? "border-klasse-gold bg-klasse-gold/5 text-klasse-gold" 
                        : "border-slate-50 bg-slate-50 text-slate-400"
                    }`}
                  >
                    <input type="radio" value={opt.id} {...register("modalidade")} className="hidden" />
                    <div className={`p-2 rounded-lg ${modalidade === opt.id ? "bg-klasse-gold text-white" : "bg-slate-200 text-slate-400"}`}>
                      <opt.icon size={20} />
                    </div>
                    <span className="text-sm font-black uppercase tracking-widest">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Data de Início */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Data do Evento</label>
              <div className="relative">
                <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  {...register("data_inicio")}
                  type="date"
                  className="w-full rounded-2xl border border-slate-100 bg-slate-50 pl-14 pr-5 py-4 text-base outline-none transition-all focus:bg-white focus:ring-8 focus:ring-klasse-gold/5 focus:border-klasse-gold font-semibold"
                />
              </div>
              {errors.data_inicio && <p className="text-[10px] font-bold text-rose-500 ml-1">{errors.data_inicio.message}</p>}
            </div>

            {/* Campos Condicionais */}
            {modalidade === "PRESENCIAL" && (
              <div className="space-y-4 animate-in slide-in-from-top-4 duration-500">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Onde será?</label>
                  <input 
                    {...register("localizacao")}
                    placeholder="Morada ou Local"
                    className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-base outline-none transition-all focus:bg-white focus:ring-8 focus:ring-klasse-gold/5 focus:border-klasse-gold font-semibold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Vagas</label>
                  <input 
                    {...register("vagas_limite", { valueAsNumber: true })}
                    type="number"
                    min={1}
                    placeholder="Capacidade"
                    className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-base outline-none transition-all focus:bg-white focus:ring-8 focus:ring-klasse-gold/5 focus:border-klasse-gold font-semibold"
                  />
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-10 flex w-full items-center justify-center gap-3 rounded-[2rem] bg-klasse-gold py-5 text-lg font-black text-white shadow-2xl shadow-klasse-gold/30 transition-all hover:brightness-110 active:scale-95 disabled:opacity-70"
          >
            {isSubmitting ? (
              <Loader2 size={24} className="animate-spin" />
            ) : (
              <>Lançar Agora <ChevronRight size={24} /></>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
