"use client";

import { useState } from "react";
import { ExternalLink, FileText, Loader2 } from "lucide-react";

type Props = {
  url: string;
  className?: string;
};

export function DocumentPreview({ url, className }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const isPDF = url.toLowerCase().endsWith(".pdf") || url.includes("pdf");
  const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(url.split("?")[0]) || !isPDF;

  if (!url) {
    return (
      <div className="flex aspect-[4/3] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400">
        <FileText size={32} strokeWidth={1} />
        <p className="mt-2 text-xs font-medium">Documento não disponível</p>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-xl border border-slate-200 bg-slate-950 shadow-inner ${className}`}>
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        </div>
      )}

      {isPDF ? (
        <iframe
          src={`${url}#toolbar=0&navpanes=0&scrollbar=0`}
          className="h-full w-full border-none"
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
        />
      ) : (
        <img
          src={url}
          alt="Comprovativo"
          className="h-full w-full object-contain"
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
        />
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-rose-50 px-6 text-center">
          <AlertCircle size={32} className="text-rose-500" />
          <p className="mt-4 text-sm font-bold text-rose-900">Falha ao carregar visualização</p>
          <p className="mt-1 text-xs text-rose-600">O arquivo pode estar corrompido ou o link expirou.</p>
        </div>
      )}

      <div className="absolute bottom-4 right-4 flex gap-2">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex h-10 items-center gap-2 rounded-lg bg-white/10 px-4 text-xs font-bold text-white backdrop-blur-md transition-all hover:bg-white/20"
        >
          <ExternalLink size={14} /> Abrir Original
        </a>
      </div>
    </div>
  );
}

function AlertCircle({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
