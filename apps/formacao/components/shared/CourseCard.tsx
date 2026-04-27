"use client";

import Image from "next/image";

export interface CourseCardProps {
  id: string;
  title: string;
  price: number;
  format: "PRESENCIAL" | "ONLINE" | "GRAVADO";
  durationHours?: number;
  maxSeats?: number;
  occupiedSeats?: number;
  thumbnailUrl?: string;
  onActionClick: (id: string) => void;
  actionLabel?: string;
}

const formatLabel: Record<CourseCardProps["format"], string> = {
  PRESENCIAL: "Presencial",
  ONLINE: "Online",
  GRAVADO: "Gravado",
};

function formatPrice(value: number) {
  return new Intl.NumberFormat("pt-AO", {
    style: "currency",
    currency: "AOA",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

export function CourseCard({
  id,
  title,
  price,
  format,
  durationHours,
  maxSeats,
  occupiedSeats,
  thumbnailUrl,
  onActionClick,
  actionLabel = "Inscrever",
}: CourseCardProps) {
  const hasSeatInfo = typeof maxSeats === "number" && typeof occupiedSeats === "number";
  const availableSeats = hasSeatInfo ? Math.max(0, maxSeats - occupiedSeats) : null;
  const isSoldOut = availableSeats === 0;
  const isScarcity = availableSeats !== null && availableSeats > 0 && availableSeats <= 5;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-sm transition-all hover:border-klasse-gold/50 hover:shadow-2xl hover:shadow-klasse-gold/10">
      <div className={`aspect-video w-full relative overflow-hidden ${isSoldOut ? "opacity-40 grayscale" : ""}`}>
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt={title}
            fill
            sizes="(max-width: 1024px) 100vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-tr from-slate-900 via-slate-800 to-slate-950" />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-80" />

        <div className="absolute top-3 left-3 flex gap-2">
          <span className="inline-flex items-center rounded-full bg-slate-950/80 backdrop-blur border border-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-200">
            {formatLabel[format]}
          </span>
          {isScarcity && (
            <span className="inline-flex items-center rounded-full bg-rose-500 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white">
              Últimas Vagas
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <h3 className={`text-xl font-bold text-white line-clamp-2 min-h-[3.5rem] leading-tight ${isSoldOut ? "opacity-60" : ""}`}>
          {title}
        </h3>

        <div className="mt-4 flex items-baseline justify-between">
          <div className="space-y-1">
            <p className="text-2xl font-black text-klasse-gold [font-family:var(--font-geist-mono)]">
              {formatPrice(price)}
            </p>
            {typeof durationHours === "number" && (
              <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">
                Carga: {durationHours}h
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-white/5">
          <button
            type="button"
            onClick={() => onActionClick(id)}
            className={`w-full rounded-xl px-4 py-3.5 text-sm font-black transition-all active:scale-[0.98] ${
              isSoldOut
                ? "bg-white/10 text-white hover:bg-white/20"
                : "bg-white text-slate-950 hover:bg-klasse-gold hover:text-slate-950 shadow-lg shadow-white/5"
            }`}
          >
            {isSoldOut ? "AVISA-ME QUANDO HOUVER VAGA" : actionLabel.toUpperCase()}
          </button>
          
          <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-widest text-slate-500">
            {isSoldOut 
              ? "Turma lotada no momento" 
              : (isScarcity ? `Apenas ${availableSeats} vagas restantes` : "Matrícula imediata online")}
          </p>
        </div>
      </div>
    </article>
  );
}

