"use client";

import { MessageCircle, X } from "lucide-react";
import { useState, useEffect } from "react";

interface FloatingSupportProps {
  whatsappNumber?: string;
  escolaNome: string;
}

export function FloatingSupport({ whatsappNumber, escolaNome }: FloatingSupportProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Delay the appearance of the button slightly to not overwhelm on initial load
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  if (!whatsappNumber || isDismissed) return null;

  const cleanNumber = whatsappNumber.replace(/\D/g, "");
  const defaultMessage = `Olá, estou no portal de admissão da escola ${escolaNome} e preciso de ajuda.`;
  const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(defaultMessage)}`;

  return (
    <div 
      className={`fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4 transition-all duration-500 transform ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0 pointer-events-none"
      }`}
    >
      {/* Tooltip / Chat Bubble */}
      <div className="relative rounded-2xl bg-white p-4 shadow-xl ring-1 ring-slate-200 animate-klasse-fade-up max-w-[250px]">
        <button 
          onClick={() => setIsDismissed(true)}
          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition"
          aria-label="Fechar suporte"
        >
          <X size={12} />
        </button>
        <p className="text-sm font-bold text-slate-900 leading-tight">Precisa de ajuda com a inscrição?</p>
        <p className="mt-1 text-xs text-slate-500">A nossa secretaria está online para ajudar no WhatsApp.</p>
        
        {/* Pointer triangle */}
        <div className="absolute -bottom-2 right-6 h-4 w-4 rotate-45 border-b border-r border-slate-200 bg-white" />
      </div>

      {/* FAB Button */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white shadow-lg shadow-green-500/30 transition-transform hover:scale-110 hover:bg-green-600 focus:outline-none focus:ring-4 focus:ring-green-500/20"
        aria-label="Falar no WhatsApp"
      >
        <MessageCircle size={28} />
      </a>
    </div>
  );
}
