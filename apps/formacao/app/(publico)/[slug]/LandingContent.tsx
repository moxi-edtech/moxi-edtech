"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { CheckoutSheet } from "@/components/publico/CheckoutSheet";
import { CourseCard } from "@/components/shared/CourseCard";

type Cohort = {
  id: string;
  codigo: string;
  nome: string;
  curso_nome: string;
  format: "PRESENCIAL" | "ONLINE" | "GRAVADO";
  valor_referencia: number;
  vagas: number;
  vagas_ocupadas: number;
  carga_horaria: number;
  data_inicio: string;
};

type Props = {
  tenantType: "formacao" | "solo_creator";
  centro: {
    id: string;
    slug: string;
    nome: string;
    logo_url?: string | null;
  };
  fiscal: {
    iban?: string;
  } | null;
  cohorts: Cohort[];
};

import { submeterLeadAction } from "@/app/actions/submeterLeadAction";

export function LandingContent({ tenantType, centro, fiscal, cohorts }: Props) {
  const [selectedCohort, setSelectedCohort] = useState<Cohort | null>(null);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [targetCohort, setTargetCohort] = useState<Cohort | null>(null);
  const [isSubmittingLead, setIsSubmittingLead] = useState(false);
  const [leadSent, setLeadSent] = useState(false);

  const isSoloCreator = tenantType === "solo_creator";
  const ctaLabel = isSoloCreator ? "Reservar Lugar" : "Reservar Vaga";

  const handleActionClick = (cohort: Cohort) => {
    const isSoldOut = cohort.vagas > 0 && cohort.vagas_ocupadas >= cohort.vagas;
    if (isSoldOut) {
      setTargetCohort(cohort);
      setShowLeadModal(true);
    } else {
      setSelectedCohort(cohort);
    }
  };

  const handleLeadSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!targetCohort) return;

    setIsSubmittingLead(true);
    const formData = new FormData(e.currentTarget);
    
    const result = await submeterLeadAction({
      escola_id: centro.id,
      cohort_id: targetCohort.id,
      nome: formData.get("nome") as string,
      telefone: formData.get("telefone") as string,
    });

    setIsSubmittingLead(false);
    if (result.ok) {
      setLeadSent(true);
    } else {
      alert(result.error);
    }
  };

  return (
    <>
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {cohorts.map((cohort, index) => {
          return (
            <motion.div
              key={cohort.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <CourseCard
                id={cohort.id}
                title={cohort.curso_nome}
                price={cohort.valor_referencia}
                format={cohort.format}
                durationHours={cohort.carga_horaria}
                maxSeats={cohort.vagas}
                occupiedSeats={cohort.vagas_ocupadas}
                thumbnailUrl={centro.logo_url ?? undefined}
                actionLabel={ctaLabel}
                onActionClick={() => handleActionClick(cohort)}
              />
            </motion.div>
          );
        })}

        {cohorts.length === 0 && (
          <div className="col-span-full py-32 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white/5 text-slate-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-xl font-bold text-white">
              Novas turmas brevemente
            </p>
            <p className="mt-2 text-slate-400">
              Não existem inscrições abertas no momento para este centro.
            </p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showLeadModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setShowLeadModal(false); setLeadSent(false); }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-slate-900 p-8 shadow-2xl"
            >
              {leadSent ? (
                <div className="text-center py-8">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-white">Interesse Registado!</h3>
                  <p className="mt-2 text-slate-400 text-sm">Avisaremos assim que houver novidades sobre a turma de {targetCohort?.curso_nome}.</p>
                  <button onClick={() => { setShowLeadModal(false); setLeadSent(false); }} className="mt-8 w-full rounded-xl bg-white py-3 text-sm font-bold text-slate-950">FECHAR</button>
                </div>
              ) : (
                <>
                  <h3 className="text-2xl font-black text-white leading-tight">Avisa-me sobre<br/><span className="text-klasse-gold">{targetCohort?.curso_nome}</span></h3>
                  <p className="mt-4 text-sm text-slate-400 leading-relaxed">Esta turma está lotada ou aguarda nova edição. Deixe o seu contacto para ser o primeiro a saber.</p>
                  
                  <form className="mt-8 space-y-4" onSubmit={handleLeadSubmit}>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Seu Nome</label>
                      <input required name="nome" type="text" placeholder="Ex: Maria Jorge" className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-klasse-gold focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">WhatsApp / Telefone</label>
                      <input required name="telefone" type="tel" placeholder="9xx xxx xxx" className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-klasse-gold focus:outline-none" />
                    </div>
                    <button 
                      type="submit" 
                      disabled={isSubmittingLead}
                      className="mt-4 w-full rounded-xl bg-klasse-gold py-4 text-sm font-black text-slate-950 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                    >
                      {isSubmittingLead ? "A ENVIAR..." : "REGISTAR MEU INTERESSE"}
                    </button>
                  </form>
                </>
              )}
            </motion.div>
          </div>
        )}

        {selectedCohort && (
          <CheckoutSheet
            open={Boolean(selectedCohort)}
            onOpenChange={(open) => {
              if (!open) setSelectedCohort(null);
            }}
            curso={{
              id: selectedCohort.id,
              cohortRef: selectedCohort.codigo,
              title: selectedCohort.curso_nome,
              price: selectedCohort.valor_referencia,
            }}
            tenant={{
              id: centro.id,
              slug: centro.slug,
              nome: centro.nome,
              iban: fiscal?.iban ?? null,
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
