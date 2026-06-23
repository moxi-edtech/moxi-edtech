"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound, Star, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
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
    <div className="relative min-h-screen bg-[#070b0d] flex flex-col items-center justify-center p-6 font-sans overflow-hidden">
      {/* Dynamic Glowing Mesh Orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-klasse-gold/10 blur-[130px] pointer-events-none" />

      {/* Decorative Grid SVG overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none" />

      <div className="max-w-md w-full space-y-8 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="space-y-4"
        >
          <div className="w-16 h-16 bg-gradient-to-tr from-klasse-gold to-amber-300 rounded-[22px] flex items-center justify-center mx-auto text-slate-950 shadow-xl shadow-klasse-gold/10">
            <Star size={32} fill="currentColor" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-3xl font-black text-white tracking-tight">Área do Parceiro</h1>
            <p className="text-slate-400 font-medium text-sm">
              Acompanhe a sua parceria e comissões no ecossistema <span className="text-klasse-gold font-bold">KLASSE</span>.
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
        >
          <form
            onSubmit={handleSubmit}
            className="bg-slate-900/40 backdrop-blur-xl p-8 rounded-[32px] border border-slate-800/80 shadow-2xl space-y-6"
          >
            <div className="space-y-2 text-left">
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 ml-1">
                Seu Código de Parceiro
              </label>
              <input
                autoFocus
                type="text"
                placeholder="EX: EDUARDO10"
                className="w-full p-4 rounded-2xl border border-slate-800 bg-slate-950/80 text-white placeholder:text-slate-700 outline-none transition-all text-center text-xl font-black uppercase tracking-widest focus:border-klasse-gold/80 focus:ring-1 focus:ring-klasse-gold/30"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  if (members.length > 0 || affiliateName) {
                    resetMemberStep();
                  }
                }}
              />
            </div>

            <AnimatePresence mode="popLayout">
              {members.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: 10 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -10 }}
                  transition={{ duration: 0.4, ease: "easeInOut" }}
                  className="space-y-6 overflow-hidden"
                >
                  <div className="rounded-2xl border border-klasse-gold/20 bg-klasse-gold/5 p-4 text-left backdrop-blur-sm">
                    <p className="text-[9px] font-extrabold uppercase tracking-widest text-klasse-gold/80">
                      Parceiro Identificado
                    </p>
                    <p className="mt-1 text-sm font-black text-white">{affiliateName}</p>
                  </div>

                  <div className="space-y-2 text-left">
                    <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 ml-1">
                      Selecione o Membro
                    </label>
                    <select
                      className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4 text-sm font-bold text-white outline-none transition-all focus:border-klasse-gold/80 focus:ring-1 focus:ring-klasse-gold/30 appearance-none cursor-pointer"
                      value={selectedMemberId}
                      onChange={(e) => setSelectedMemberId(e.target.value)}
                    >
                      <option value="" className="bg-slate-950 text-slate-500">
                        Escolha quem está a entrar
                      </option>
                      {members.map((member) => (
                        <option key={member.membro_id} value={member.membro_id} className="bg-slate-950 text-white">
                          {member.membro_nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2 text-left">
                    <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 ml-1">
                      PIN Pessoal
                    </label>
                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                      <input
                        type="password"
                        placeholder="PIN do membro"
                        className="w-full rounded-2xl border border-slate-800 bg-slate-950 py-4 pl-12 pr-4 text-center text-lg font-bold tracking-[0.2em] text-white outline-none transition-all placeholder:text-slate-800 focus:border-klasse-gold/80 focus:ring-1 focus:ring-klasse-gold/30"
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-4">
              <Button
                className="w-full py-6 rounded-2xl bg-gradient-to-r from-klasse-gold to-amber-500 hover:from-amber-500 hover:to-klasse-gold text-slate-950 font-black text-base shadow-lg shadow-klasse-gold/10 hover:shadow-klasse-gold/20 active:scale-[0.98] transition-all duration-300 border-0 flex items-center justify-center group"
                disabled={
                  !code.trim() ||
                  isLoading ||
                  (members.length > 0 && (!selectedMemberId || !pin.trim()))
                }
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-slate-950" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {members.length > 0 ? "A Validar..." : "A Processar..."}
                  </span>
                ) : (
                  <>
                    {members.length > 0 ? "Entrar no Painel" : "Continuar"}
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>

              {members.length > 0 && (
                <button
                  type="button"
                  className="w-full text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors"
                  onClick={resetMemberStep}
                >
                  Trocar código de parceiro
                </button>
              )}
            </div>

            <p className="text-center text-[10px] font-medium text-slate-600">
              Acesso restrito. Exige código de parceiro, seleção de membro e PIN pessoal.
            </p>
          </form>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="pt-4 flex items-center justify-center gap-6"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
            <Users size={14} />
            +50 Parceiros Ativos
          </div>
        </motion.div>
      </div>
    </div>
  );
}
