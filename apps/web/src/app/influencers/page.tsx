"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound, Star, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Json } from "~types/supabase";

type AfiliadoPortalResponse = Record<string, Json | undefined> & {
  ok?: boolean;
};

function isAfiliadoPortalResponse(value: Json): value is AfiliadoPortalResponse {
  return typeof value === "object" && value !== null && !Array.isArray(value) && "ok" in value;
}

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
  const supabase = createClient();

  const resetMemberStep = () => {
    setAffiliateName("");
    setMembers([]);
    setSelectedMemberId("");
    setPin("");
  };

  const handleResolveMembers = async (normalizedCode: string) => {
    const { data, error } = await (supabase.rpc as any)("list_influencer_members_public", {
      p_codigo: normalizedCode,
    });

    if (error) throw error;

    const items = Array.isArray(data) ? data.filter(isInfluencerMemberListItem) : [];
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

      const selectedMember = members.find((member) => member.membro_id === selectedMemberId) ?? null;
      const { data, error } = await (supabase.rpc as any)("get_influencer_member_portal", {
        p_codigo: normalizedCode,
        p_member_id: selectedMemberId,
        p_pin: normalizedPin,
      });

      if (error) throw error;
      if (!data || !isAfiliadoPortalResponse(data) || !data.ok) {
        throw new Error("invalid_credentials");
      }

      window.sessionStorage.setItem(
        `klasse_influencer_auth:${normalizedCode}`,
        JSON.stringify({
          pin: normalizedPin,
          memberId: selectedMemberId,
          memberName: selectedMember?.membro_nome ?? "",
          verifiedAt: Date.now(),
        }),
      );
      router.push(`/influencers/${normalizedCode}`);
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message === "no_members_found") {
        toast.error("Nenhum membro activo foi encontrado para este parceiro.");
      } else {
        toast.error("Código, membro ou PIN inválido.");
      }
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
              onChange={e => {
                setCode(e.target.value);
                if (members.length > 0 || affiliateName) {
                  resetMemberStep();
                }
              }}
            />
          </div>
          {members.length > 0 ? (
            <>
              <div className="rounded-2xl border border-klasse-gold-200 bg-klasse-gold-50/60 p-4 text-left">
                <p className="text-[10px] font-bold uppercase tracking-widest text-klasse-gold-700">Parceiro identificado</p>
                <p className="mt-1 text-sm font-black text-slate-900">{affiliateName}</p>
              </div>
              <div className="space-y-2 text-left">
                <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 ml-1">Selecione o membro</label>
                <select
                  className="w-full rounded-2xl border-2 border-slate-100 bg-white px-4 py-4 text-base font-bold text-slate-900 outline-none transition-all focus:border-klasse-gold"
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                >
                  <option value="">Escolha quem está a entrar</option>
                  {members.map((member) => (
                    <option key={member.membro_id} value={member.membro_id}>
                      {member.membro_nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 text-left">
                <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 ml-1">PIN pessoal</label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
                  <input
                    type="password"
                    placeholder="PIN do membro"
                    className="w-full rounded-2xl border-2 border-slate-100 py-4 pl-12 pr-4 text-center text-lg font-bold tracking-[0.2em] outline-none transition-all placeholder:text-slate-200 focus:border-klasse-gold"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                  />
                </div>
              </div>
            </>
          ) : null}
          <div className="space-y-3">
            <Button 
              className="w-full py-6 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-lg group"
              disabled={
                !code.trim() ||
                isLoading ||
                (members.length > 0 && (!selectedMemberId || !pin.trim()))
              }
            >
              {isLoading
                ? (members.length > 0 ? "Validando acesso..." : "A carregar membros...")
                : (members.length > 0 ? "Entrar no Painel" : "Continuar")}
              <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            {members.length > 0 ? (
              <button
                type="button"
                className="w-full text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                onClick={resetMemberStep}
              >
                Trocar código de parceiro
              </button>
            ) : null}
          </div>
          <p className="text-center text-xs font-medium text-slate-400">
            O acesso agora exige código, membro e PIN pessoal para rastreabilidade do parceiro.
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
