"use client";

import Image from "next/image";
import Link from "next/link";

import { Users, Zap, Clock } from "lucide-react";

export interface CourseCardProps {
  id: string;
  title: string;
  price: number;
  format: "PRESENCIAL" | "ONLINE" | "GRAVADO" | "HIBRIDO";
  durationHours?: number;
  maxSeats?: number;
  occupiedSeats?: number;
  thumbnailUrl?: string;
  courseSlug?: string;
  schoolSlug?: string;
  onActionClick: (id: string) => void;
  actionLabel?: string;
}

const formatLabel: Record<string, string> = {
  PRESENCIAL: "Presencial",
  ONLINE: "Online",
  GRAVADO: "Gravado",
  HIBRIDO: "Híbrido",
};

function formatPrice(value: number) {
  return new Intl.NumberFormat("pt-AO", {
    style: "currency",
    currency: "AOA",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

// Simula um número de pessoas a ver o curso baseado no ID (estável por sessão)
function getSimulatedViewers(id: string) {
  const seed = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return (seed % 8) + 3; // Gera um número entre 3 e 10
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
  courseSlug,
  schoolSlug,
  onActionClick,
  actionLabel = "Inscrever",
}: CourseCardProps) {
  const hasSeatInfo = typeof maxSeats === "number" && typeof occupiedSeats === "number";
  const availableSeats = hasSeatInfo ? Math.max(0, maxSeats - occupiedSeats) : null;
  const isSoldOut = availableSeats === 0;
  const isScarcity = availableSeats !== null && availableSeats > 0 && availableSeats <= 5;
  const isEarlyBird = !isSoldOut && occupiedSeats !== undefined && occupiedSeats < 5;
  const viewers = getSimulatedViewers(id);

  const courseUrl = schoolSlug && courseSlug ? `/${schoolSlug}/curso/${courseSlug}` : null;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-sm transition-all hover:border-klasse-gold/50 hover:shadow-2xl hover:shadow-klasse-gold/10">
      <Link href={courseUrl || "#"} className={`aspect-video w-full relative overflow-hidden ${isSoldOut ? "opacity-40 grayscale" : ""} ${!courseUrl ? "pointer-events-none" : ""}`}>
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

        <div className="absolute top-3 left-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-full bg-slate-950/80 backdrop-blur border border-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-200">
            {formatLabel[format]}
          </span>
          {isScarcity && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white animate-pulse">
              <Zap size={10} fill="currentColor" />
              Últimas {availableSeats} Vagas
            </span>
          )}
          {isEarlyBird && !isScarcity && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white">
              <Clock size={10} />
              Preço de Lançamento
            </span>
          )}
        </div>

        {!isSoldOut && (
          <div className="absolute bottom-3 left-3">
            <div className="flex items-center gap-2 rounded-lg bg-black/40 backdrop-blur-sm px-2 py-1 text-[10px] font-bold text-white/90">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              {viewers} pessoas a ver agora
            </div>
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-6">
        <Link href={courseUrl || "#"} className={!courseUrl ? "pointer-events-none" : ""}>
          <h3 className={`text-xl font-bold text-white line-clamp-2 min-h-[3.5rem] leading-tight group-hover:text-klasse-gold transition-colors ${isSoldOut ? "opacity-60" : ""}`}>
            {title}
          </h3>
        </Link>

        <div className="mt-4 flex items-baseline justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-2xl font-black text-klasse-gold [font-family:var(--font-geist-mono)]">
                {formatPrice(price)}
              </p>
              {isEarlyBird && (
                <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  POUPA 20%
                </span>
              )}
            </div>
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

          <div className="mt-3 flex items-center justify-center gap-2">
            <p className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-500">
              {isSoldOut
                ? "Turma lotada no momento"
                : (isScarcity ? `Resta apenas ${availableSeats} vaga${availableSeats > 1 ? 's' : ''}` : "Matrícula imediata online")}
            </p>
            {!isSoldOut && (
              <div className="h-1 w-1 rounded-full bg-slate-700" />
            )}
            {!isSoldOut && (
              <div className="flex items-center gap-1 text-[10px] font-bold text-klasse-gold uppercase tracking-tighter">
                <Users size={12} />
                {occupiedSeats ?? 0} inscritos
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
