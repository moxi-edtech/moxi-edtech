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
    <article className="flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow group">
      <div className={`aspect-video w-full bg-slate-100 relative ${isSoldOut ? "opacity-60" : ""}`}>
        {thumbnailUrl ? (
          <Image src={thumbnailUrl} alt={title} fill sizes="(max-width: 1024px) 100vw, 33vw" className="object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-tr from-slate-900 via-slate-800 to-slate-700" />
        )}

        <div className="absolute top-2 left-2">
          <span className="inline-flex items-center rounded-md bg-white/90 backdrop-blur px-2.5 py-1 text-[11px] font-semibold text-slate-700">
            {formatLabel[format]}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className={`text-lg font-semibold text-slate-900 line-clamp-2 min-h-[3.5rem] mt-4 ${isSoldOut ? "opacity-60" : ""}`}>
          {title}
        </h3>

        <div className="mt-3 space-y-1">
          <p className="text-2xl font-black text-slate-900 [font-family:var(--font-geist-mono)]">{formatPrice(price)}</p>
          {typeof durationHours === "number" ? (
            <p className="text-sm font-medium text-slate-500">{durationHours}h de carga horária</p>
          ) : null}
        </div>

        <div className="mt-auto pt-4">
          {isScarcity ? (
            <p className="mb-2 text-xs font-semibold text-amber-600">Restam apenas {availableSeats} vagas.</p>
          ) : null}

          <button
            type="button"
            disabled={isSoldOut}
            onClick={() => onActionClick(id)}
            className={`w-full rounded-lg px-4 py-2.5 text-sm font-bold transition-colors ${
              isSoldOut
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : `bg-slate-900 text-white hover:bg-slate-800 ${isScarcity ? "animate-pulse" : ""}`
            }`}
          >
            {isSoldOut ? "ESGOTADO" : actionLabel}
          </button>
        </div>
      </div>
    </article>
  );
}

