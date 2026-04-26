"use client";

import { useState } from "react";
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

export function LandingContent({ tenantType, centro, fiscal, cohorts }: Props) {
  const [selectedCohort, setSelectedCohort] = useState<Cohort | null>(null);
  const isSoloCreator = tenantType === "solo_creator";
  const ctaLabel = isSoloCreator ? "Reservar Lugar" : "Reservar Vaga";
  const emptyStateLabel = isSoloCreator
    ? "Nenhuma mentoria/evento com inscrições abertas no momento."
    : "Nenhuma turma com inscrições abertas no momento.";

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
                onActionClick={() => setSelectedCohort(cohort)}
              />
            </motion.div>
          );
        })}

        {cohorts.length === 0 && (
          <div className="col-span-full py-20 text-center">
            <p className="text-lg font-semibold text-slate-500">
              {emptyStateLabel}
            </p>
          </div>
        )}
      </div>

      <AnimatePresence>
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
