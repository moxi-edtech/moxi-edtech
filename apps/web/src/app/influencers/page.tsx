"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound, Star, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Database, Json } from "~types/supabase";

type AfiliadoPortalResponse = Extract<Database["public"]["Functions"]["get_afiliado_portal"]["Returns"], Record<string, Json | undefined>> & {
  ok?: boolean;
};

function isAfiliadoPortalResponse(value: Json): value is AfiliadoPortalResponse {
  return typeof value === "object" && value !== null && !Array.isArray(value) && "ok" in value;
}

export default function AfiliadosEntryPage() {
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedCode = code.trim().toUpperCase();
    const normalizedPin = pin.trim();

    if (!normalizedCode || !normalizedPin) {
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await (supabase.rpc as any)("get_influencer_portal", {
        p_codigo: normalizedCode,
        p_pin: normalizedPin,
      });

      if (error) throw error;
      if (!data || !isAfiliadoPortalResponse(data) || !data.ok) {
        throw new Error("invalid_credentials");
      }

      window.sessionStorage.setItem(
        `klasse_influencer_auth:${normalizedCode}`,
        JSON.stringify({ pin: normalizedPin, verifiedAt: Date.now() }),
      );
      router.push(`/influencers/${normalizedCode}`);
    } catch (error) {
      console.error(error);
      toast.error("Código ou PIN inválido.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F0E8] flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="space-y-4">
          <div className="w-20 h-20 bg-klasse-gold-100 rounded-3xl flex items-center justify-center mx-auto text-klasse-gold-600 shadow-xl shadow-klasse-gold-500/10">
            <Star size={40} fill="currentColor" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Área do Parceiro</h1>
          <p className="text-slate-500 font-medium">Acompanhe a sua parceria e comissões no ecossistema KLASSE.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-2xl shadow-slate-200/50 space-y-6">
          <div className="space-y-2 text-left">
            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 ml-1">Seu Código de Parceiro</label>
            <input 
              autoFocus
              type="text"
              placeholder="Ex: EDUARDO10"
              className="w-full p-4 rounded-2xl border-2 border-slate-100 focus:border-klasse-gold outline-none transition-all text-center text-xl font-black uppercase tracking-widest placeholder:text-slate-200"
              value={code}
              onChange={e => setCode(e.target.value)}
            />
          </div>
          <div className="space-y-2 text-left">
            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 ml-1">PIN de Acesso</label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
              <input
                type="password"
                placeholder="PIN do parceiro"
                className="w-full rounded-2xl border-2 border-slate-100 py-4 pl-12 pr-4 text-center text-lg font-bold tracking-[0.2em] outline-none transition-all placeholder:text-slate-200 focus:border-klasse-gold"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
              />
            </div>
          </div>
          <Button 
            className="w-full py-6 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-lg group"
            disabled={!code.trim() || !pin.trim() || isLoading}
          >
            {isLoading ? "Validando acesso..." : "Aceder ao Painel"}
            <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
          <p className="text-center text-xs font-medium text-slate-400">
            O painel agora exige código + PIN para proteger as estatísticas do parceiro.
          </p>
        </form>

        <div className="pt-8 flex items-center justify-center gap-6 opacity-40">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <Users size={14} />
            +50 Parceiros Ativos
          </div>
        </div>
      </div>
    </div>
  );
}
