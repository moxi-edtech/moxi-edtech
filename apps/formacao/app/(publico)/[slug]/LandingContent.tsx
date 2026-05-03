"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { CheckoutSheet } from "@/components/publico/CheckoutSheet";
import { CourseCard } from "@/components/shared/CourseCard";

import { Star, Quote } from "lucide-react";

type Cohort = {
  id: string;
  codigo: string;
  nome: string;
  curso_nome?: string;
  turno?: string;
  vagas: number;
  vagas_ocupadas: number;
  data_inicio: string;
  valor_referencia: number;
};

type Course = {
  id: string;
  nome: string;
  slug: string | null;
  area: string | null;
  modalidade: "presencial" | "online" | "hibrido";
  carga_horaria: number | null;
  thumbnail_url: string | null;
  video_url: string | null;
  objetivos: string[];
  requisitos: string[];
  open_cohorts: Cohort[];
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
    iban?: string | null;
  } | null;
  pagamento?: {
    ativo?: boolean;
    banco?: string | null;
    titular_conta?: string | null;
    iban?: string | null;
    numero_conta?: string | null;
    kwik_chave?: string | null;
    instrucoes_checkout?: string | null;
  } | null;
  tracking?: {
    google_analytics_id?: string;
    meta_pixel_id?: string;
  };
  publicacao?: {
    instrucoes?: string | null;
  } | null;
  testemunhos: Array<{
    autor_nome: string;
    autor_cargo?: string;
    autor_avatar_url?: string;
    conteudo: string;
    estrelas: number;
    curso_nome?: string;
  }>;
  courses: Course[];
};

import { submeterLeadAction } from "@/app/actions/submeterLeadAction";

const TURNO_LABELS: Record<string, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
  integral: "Integral",
  fim_de_semana: "Fim de Semana",
  pos_laboral: "Pós-Laboral",
};

export function LandingContent({ tenantType, centro, fiscal, pagamento, tracking, publicacao, testemunhos = [], courses = [] }: Props) {
  const [selectedCohort, setSelectedCohort] = useState<Cohort | null>(null);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [targetCourse, setTargetCourse] = useState<Course | null>(null);
  const [targetCohort, setTargetCohort] = useState<Cohort | null>(null);
  const [isSubmittingLead, setIsSubmittingLead] = useState(false);
  const [leadSent, setLeadSent] = useState(false);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);

  // Tracking effects... (unchanged)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (tracking?.google_analytics_id) {
      const script1 = document.createElement("script");
      script1.async = true;
      script1.src = `https://www.googletagmanager.com/gtag/js?id=${tracking.google_analytics_id}`;
      document.head.appendChild(script1);
      const script2 = document.createElement("script");
      script2.innerHTML = `window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '${tracking.google_analytics_id}');`;
      document.head.appendChild(script2);
    }
    if (tracking?.meta_pixel_id) {
      const scriptPixel = document.createElement("script");
      scriptPixel.innerHTML = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init', '${tracking.meta_pixel_id}');fbq('track', 'PageView');`;
      document.head.appendChild(scriptPixel);
    }
  }, [tracking]);

  const isSoloCreator = tenantType === "solo_creator";
  const ctaLabel = isSoloCreator ? "Reservar Lugar" : "Inscrever-me";
  const checkoutIban = pagamento?.ativo ? pagamento.iban ?? fiscal?.iban ?? null : fiscal?.iban ?? null;

  const handleWaitlistClick = (course: Course, cohort?: Cohort) => {
    setTargetCourse(course);
    setTargetCohort(cohort || null);
    setShowLeadModal(true);
  };

  const handleEnrollClick = (cohort: Cohort, course?: Course) => {
    setSelectedCohort({
      ...cohort,
      curso_nome: cohort.curso_nome || course?.nome || "Curso",
    });
  };

  const handleLeadSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!targetCourse) return;

    setIsSubmittingLead(true);
    const formData = new FormData(e.currentTarget);
    
    const result = await submeterLeadAction({
      escola_id: centro.id,
      curso_id: targetCourse.id,
      cohort_id: targetCohort?.id,
      nome: formData.get("nome") as string,
      telefone: formData.get("telefone") as string,
      email: formData.get("email") as string || undefined,
      turno_preferencia: formData.get("turno_preferencia") as string || undefined,
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
      <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((course, index) => {
          const openCohorts = course.open_cohorts || [];
          const hasOpenCohorts = openCohorts.length > 0;
          const mainCohort = openCohorts[0];
          const isSoldOut = hasOpenCohorts && mainCohort.vagas > 0 && mainCohort.vagas_ocupadas >= mainCohort.vagas;
          
          return (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex flex-col"
            >
              <CourseCard
                id={course.id}
                title={course.nome}
                price={(course as any).preco_referencia || mainCohort?.valor_referencia || 0}
                format={course.modalidade.toUpperCase() as any}
                durationHours={course.carga_horaria || undefined}
                maxSeats={mainCohort?.vagas}
                occupiedSeats={mainCohort?.vagas_ocupadas}
                thumbnailUrl={course.thumbnail_url || centro.logo_url || undefined}
                actionLabel={hasOpenCohorts ? ctaLabel : "Lista de Espera"}
                courseSlug={course.slug || undefined}
                schoolSlug={centro.slug}
                onActionClick={() => {
                  if (!hasOpenCohorts) {
                    handleWaitlistClick(course);
                  } else if (openCohorts.length > 1) {
                    setActiveCourseId(activeCourseId === course.id ? null : course.id);
                  } else if (isSoldOut) {
                    handleWaitlistClick(course, mainCohort);
                  } else {
                    handleEnrollClick(mainCohort, course);
                  }
                }}
              />

              <AnimatePresence>
                {activeCourseId === course.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-2 space-y-2 overflow-hidden"
                  >
                    <p className="px-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Próximas turmas disponíveis:</p>
                    {openCohorts.map((coh) => {
                      const cohSoldOut = coh.vagas > 0 && coh.vagas_ocupadas >= coh.vagas;
                      return (
                        <button
                          key={coh.id}
                          onClick={() => cohSoldOut ? handleWaitlistClick(course, coh) : handleEnrollClick(coh, course)}
                          className="flex w-full items-center justify-between rounded-xl border border-white/5 bg-white/5 p-3 text-left transition-colors hover:bg-white/10"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-bold text-white">{coh.nome}</p>
                              {coh.turno && (
                                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-300">
                                  {TURNO_LABELS[coh.turno] || coh.turno}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400" suppressHydrationWarning>Início: {new Date(coh.data_inicio).toLocaleDateString("pt-AO")}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-black text-klasse-gold" suppressHydrationWarning>{new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 }).format(coh.valor_referencia)}</p>
                            <p className={`text-[9px] font-bold uppercase ${cohSoldOut ? "text-rose-500" : "text-emerald-500"}`}>
                              {cohSoldOut ? "Esgotado" : "Vagas Abertas"}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}

        {courses.length === 0 && (
          <div className="col-span-full py-32 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white/5 text-slate-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-xl font-bold text-white">
              Cursos brevemente
            </p>
            <p className="mt-2 text-slate-400">
              {publicacao?.instrucoes || "Não existem cursos ativos no momento para este centro."}
            </p>
          </div>
        )}
      </div>

      {testemunhos.length > 0 && (
        <section className="mt-40">
          <div className="flex flex-col items-center text-center">
            <div className="inline-flex rounded-full bg-emerald-500/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">
              Histórias de Sucesso
            </div>
            <h2 className="mt-6 text-3xl font-black text-white sm:text-4xl">
              O que dizem os nossos alunos
            </h2>
            <p className="mt-4 max-w-2xl text-slate-400">
              Resultados reais de quem já passou pelas nossas formações e transformou a sua carreira.
            </p>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {testemunhos.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="relative flex flex-col justify-between rounded-3xl border border-white/5 bg-white/[0.03] p-8 transition-colors hover:bg-white/[0.05]"
              >
                <Quote className="absolute right-8 top-8 h-10 w-10 text-white/5" />

                <div>
                  <div className="flex gap-1">
                    {[...Array(Math.max(0, Math.min(5, t.estrelas || 0)))].map((_, j) => (
                      <Star key={j} size={14} className="fill-klasse-gold text-klasse-gold" />
                    ))}
                  </div>
                  <p className="mt-6 text-base italic leading-relaxed text-slate-300">
                    "{t.conteudo}"
                  </p>
                </div>

                <div className="mt-8 flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 font-bold text-slate-400 overflow-hidden">
                    {t.autor_avatar_url ? (
                      <img src={t.autor_avatar_url} alt={t.autor_nome} className="h-full w-full object-cover" />
                    ) : (
                      t.autor_nome.charAt(0)
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{t.autor_nome}</h4>
                    <p className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
                      {t.autor_cargo || "Aluno(a)"}
                    </p>
                    {t.curso_nome && (
                      <p className="mt-1 text-[10px] font-bold text-klasse-gold uppercase">
                        {t.curso_nome}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

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
                  <p className="mt-2 text-slate-400 text-sm">Avisaremos assim que houver novidades sobre o curso de {targetCourse?.nome}.</p>
                  <button onClick={() => { setShowLeadModal(false); setLeadSent(false); }} className="mt-8 w-full rounded-xl bg-white py-3 text-sm font-bold text-slate-950">FECHAR</button>
                </div>
              ) : (
                <>
                  <h3 className="text-2xl font-black text-white leading-tight">Avisa-me sobre<br/><span className="text-klasse-gold">{targetCourse?.nome}</span></h3>
                  <p className="mt-4 text-sm text-slate-400 leading-relaxed">Este curso está sem turmas abertas ou a turma selecionada está lotada. Deixe o seu contacto para ser o primeiro a saber.</p>
                  
                  <form className="mt-8 space-y-4" onSubmit={handleLeadSubmit}>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Seu Nome</label>
                      <input required name="nome" type="text" placeholder="Ex: Maria Jorge" className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-klasse-gold focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">E-mail</label>
                      <input name="email" type="email" placeholder="maria@email.com" className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-klasse-gold focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">WhatsApp / Telefone</label>
                      <input required name="telefone" type="tel" placeholder="9xx xxx xxx" className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-klasse-gold focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Turno de Preferência</label>
                      <select name="turno_preferencia" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-800 px-4 py-3 text-sm text-white focus:border-klasse-gold focus:outline-none appearance-none">
                        <option value="">Qualquer turno</option>
                        <option value="manha">Manhã</option>
                        <option value="tarde">Tarde</option>
                        <option value="noite">Noite</option>
                        <option value="integral">Integral</option>
                        <option value="fim_de_semana">Fim de Semana</option>
                        <option value="pos_laboral">Pós-Laboral</option>
                      </select>
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
              title: selectedCohort.curso_nome || "Curso",
              price: selectedCohort.valor_referencia,
            }}
            tenant={{
              id: centro.id,
              slug: centro.slug,
              nome: centro.nome,
              iban: checkoutIban,
              banco: pagamento?.ativo ? pagamento.banco ?? null : null,
              titular_conta: pagamento?.ativo ? pagamento.titular_conta ?? null : null,
              numero_conta: pagamento?.ativo ? pagamento.numero_conta ?? null : null,
              kwik_chave: pagamento?.ativo ? pagamento.kwik_chave ?? null : null,
              instrucoes_checkout: pagamento?.ativo ? pagamento.instrucoes_checkout ?? null : null,
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
