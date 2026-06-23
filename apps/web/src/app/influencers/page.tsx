"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound, Star, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "sonner";
import type { Json } from "~types/supabase";

type InfluencerMemberListItem = {
  afiliado_codigo: string;
  afiliado_nome: string;
  membro_id: string;
  membro_nome: string;
};

function isInfluencerMemberListItem(value: Json): value is InfluencerMemberListItem {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof value.afiliado_codigo === "string" &&
    typeof value.afiliado_nome === "string" &&
    typeof value.membro_id === "string" &&
    typeof value.membro_nome === "string"
  );
}

export default function AfiliadosEntryPage() {
  const [code, setCode] = useState("");
  const [affiliateName, setAffiliateName] = useState("");
  const [members, setMembers] = useState<InfluencerMemberListItem[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const resetMemberStep = () => {
    setAffiliateName("");
    setMembers([]);
    setSelectedMemberId("");
    setPin("");
  };

  const handleResolveMembers = async (normalizedCode: string) => {
    const response = await fetch(`/api/influencers/${normalizedCode}/members`, { cache: "no-store" });
    const json = (await response.json().catch(() => null)) as { ok?: boolean; members?: Json[]; error?: string } | null;

    if (!response.ok || !json?.ok) {
      throw new Error(json?.error || "no_members_found");
    }

    const items = Array.isArray(json.members) ? json.members.filter(isInfluencerMemberListItem) : [];
    if (items.length === 0) {
      throw new Error("no_members_found");
    }

    setAffiliateName(items[0]?.afiliado_nome ?? normalizedCode);
    setMembers(items);
    setSelectedMemberId(items.length === 1 ? items[0]!.membro_id : "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedCode = code.trim().toUpperCase();

    if (!normalizedCode) {
      return;
    }

    setIsLoading(true);

    try {
      if (members.length === 0) {
        await handleResolveMembers(normalizedCode);
        return;
      }

      const normalizedPin = pin.trim();
      if (!selectedMemberId || !normalizedPin) {
        return;
      }

      const response = await fetch("/api/influencers/session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          codigo: normalizedCode,
          memberId: selectedMemberId,
          pin: normalizedPin,
        }),
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

      if (!response.ok || !data?.ok) {
        throw new Error("invalid_credentials");
      }

      router.push(`/influencers/${normalizedCode}`);
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message === "no_members_found") {
        toast.error("Nenhum membro ativo foi encontrado para este parceiro.");
      } else {
        toast.error("Código, membro ou PIN inválido.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0c10] flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="space-y-2">
          {/* Refined clean logo/star container */}
          <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center mx-auto text-klasse-gold">
            <Star size={22} fill="currentColor" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-white tracking-tight">Portal do Parceiro</h1>
            <p className="text-slate-500 text-sm">
              Introduza as suas credenciais para aceder ao CRM da Klasse.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-[#12141c] p-8 rounded-2xl border border-slate-800/60 shadow-xl space-y-6 text-left"
        >
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
              Código de Parceiro
            </label>
            <input
              autoFocus
              type="text"
              placeholder="EX: EDUARDO10"
              className="w-full p-4 rounded-xl border border-slate-800 bg-[#0a0b0f] text-white placeholder:text-slate-800 outline-none transition-all text-center text-lg font-black uppercase tracking-widest focus:border-klasse-gold focus:ring-1 focus:ring-klasse-gold/20"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (members.length > 0 || affiliateName) {
                  resetMemberStep();
                }
              }}
            />
          </div>

          {members.length > 0 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-800 bg-[#0a0b0f] p-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">
                  Parceiro
                </span>
                <span className="text-sm font-semibold text-white mt-1 block">
                  {affiliateName}
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  Membro
                </label>
                <div className="relative">
                  <select
                    className="w-full rounded-xl border border-slate-800 bg-[#0a0b0f] px-4 py-3.5 text-sm font-bold text-white outline-none transition-all focus:border-klasse-gold cursor-pointer appearance-none"
                    value={selectedMemberId}
                    onChange={(e) => setSelectedMemberId(e.target.value)}
                  >
                    <option value="" className="text-slate-500">
                      Selecione quem está a entrar
                    </option>
                    {members.map((member) => (
                      <option key={member.membro_id} value={member.membro_id}>
                        {member.membro_nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  PIN Pessoal
                </label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                  <input
                    type="password"
                    placeholder="PIN"
                    className="w-full rounded-xl border border-slate-800 bg-[#0a0b0f] py-3.5 pl-12 pr-4 text-center text-lg font-bold tracking-[0.2em] text-white outline-none transition-all placeholder:text-slate-800 focus:border-klasse-gold focus:ring-1 focus:ring-klasse-gold/20"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <Button
              className="w-full py-6 rounded-xl bg-klasse-gold hover:bg-klasse-gold/90 text-slate-950 font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 border-0"
              disabled={
                !code.trim() ||
                isLoading ||
                (members.length > 0 && (!selectedMemberId || !pin.trim()))
              }
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-slate-950" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>{members.length > 0 ? "A verificar..." : "A carregar..."}</span>
                </>
              ) : (
                <>
                  <span>{members.length > 0 ? "Entrar no Painel" : "Continuar"}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </Button>

            {members.length > 0 && (
              <button
                type="button"
                className="w-full text-center text-xs font-semibold text-slate-500 hover:text-slate-350 transition-colors"
                onClick={resetMemberStep}
              >
                Trocar código de parceiro
              </button>
            )}
          </div>
        </form>

        <div className="flex items-center justify-center gap-2 text-xs text-slate-600 font-semibold uppercase tracking-widest pt-2">
          <Users size={12} />
          <span>+50 Parceiros Ativos</span>
        </div>
      </div>
    </div>
  );
}
