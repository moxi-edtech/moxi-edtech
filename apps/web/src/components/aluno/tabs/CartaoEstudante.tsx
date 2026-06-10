"use client";

import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { User, ShieldCheck, Calendar, GraduationCap, Info } from "lucide-react";
import { AlunoCard } from "@/components/aluno/shared/AlunoCard";

type IdentidadeData = {
  nome: string;
  processo: string;
  bi: string;
  foto?: string;
  escola: string;
  escola_logo?: string;
  sigla?: string;
  curso: string;
  turma: string;
  ano_letivo: number;
  validade: string;
  verification_url: string;
};

export function CartaoEstudante() {
  const [data, setData] = useState<IdentidadeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/aluno/perfil/identidade")
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) setData(json.identidade);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-6 py-4 animate-pulse">
        <div className="w-full max-w-[340px] aspect-[1.6/1] rounded-[2rem] bg-slate-200" />
        <div className="w-full max-w-[340px] h-64 rounded-[2rem] bg-slate-100" />
      </div>
    );
  }

  if (!data) return <div className="text-center py-8 text-slate-500 font-bold">Falha ao carregar identidade.</div>;

  return (
    <div className="flex flex-col items-center gap-8 py-6 px-4">
      {/* Container do Cartão com efeito de profundidade */}
      <div className="group perspective-1000 w-full max-w-[360px]">
        <div className="relative aspect-[1.6/1] w-full transform-gpu transition-all duration-500 ease-out group-hover:rotate-x-2 group-hover:rotate-y-2">
          
          {/* Visual do Cartão Premium */}
          <div className="relative h-full w-full overflow-hidden rounded-[2rem] bg-[#0d1711] p-6 text-white shadow-[0_32px_64px_-12px_rgba(0,0,0,0.4)] ring-1 ring-white/20">
            
            {/* Efeito Holográfico / Shimmer */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out" />
            
            {/* Background Ornaments */}
            <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-klasse-gold/10 blur-[60px]" />
            <div className="absolute -left-12 -bottom-12 h-48 w-48 rounded-full bg-emerald-500/10 blur-[60px]" />

            {/* Header */}
            <div className="relative flex items-start justify-between border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-md p-1.5 shadow-inner">
                  {data.escola_logo ? (
                    <img src={data.escola_logo} alt="Logo" className="h-full w-full object-contain" />
                  ) : (
                    <GraduationCap className="h-6 w-6 text-klasse-gold" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-[13px] font-black uppercase tracking-tight text-white">{data.escola}</h3>
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-400/70">Identidade Digital</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="rounded-full bg-white/10 border border-white/10 px-2.5 py-0.5 text-[9px] font-black uppercase text-klasse-gold backdrop-blur-sm">
                  {data.ano_letivo}
                </span>
              </div>
            </div>

            {/* Body */}
            <div className="relative mt-5 flex gap-5">
              {/* Photo Section */}
              <div className="relative h-28 w-24 flex-shrink-0">
                <div className="h-full w-full overflow-hidden rounded-2xl bg-slate-800 ring-2 ring-white/10 shadow-2xl">
                    {data.foto ? (
                    <img src={data.foto} alt={data.nome} className="h-full w-full object-cover grayscale-[0.2] contrast-[1.1]" />
                    ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-slate-700 to-slate-800">
                        <User className="h-12 w-12 text-white/10" />
                    </div>
                    )}
                </div>
                {/* Status Indicator */}
                <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-[#0d1711] bg-emerald-500 shadow-sm shadow-emerald-500/50" />
              </div>

              {/* Information Section */}
              <div className="flex flex-col justify-center min-w-0 flex-1">
                <div className="space-y-0.5">
                  <h2 className="text-base font-black leading-tight text-white truncate">{data.nome}</h2>
                  <p className="text-[10px] font-bold text-slate-400">Processo: <span className="text-emerald-400">{data.processo}</span></p>
                </div>
                
                <div className="mt-4 space-y-1">
                  <div className="space-y-0">
                    <p className="text-[8px] font-black uppercase tracking-widest text-white/30">Curso</p>
                    <p className="text-[11px] font-black text-klasse-gold uppercase leading-tight line-clamp-1">{data.curso}</p>
                  </div>
                  <div className="space-y-0">
                    <p className="text-[8px] font-black uppercase tracking-widest text-white/30">Turma / Turno</p>
                    <p className="text-[11px] font-bold text-white/90">{data.turma}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Security Mark */}
            <div className="absolute bottom-6 right-6 opacity-20 group-hover:opacity-40 transition-opacity">
               <ShieldCheck className="h-8 w-8 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* QR Code de Validação Centralizado */}
      <div className="w-full max-w-[360px] space-y-6">
        <div className="relative rounded-[2.5rem] bg-white p-8 shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col items-center">
            {/* Tag Decorativa */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-white whitespace-nowrap shadow-lg">
                Validação Segura
            </div>

            <div className="rounded-3xl bg-slate-50 p-6 ring-1 ring-slate-100/50 shadow-inner group/qr transition-all hover:scale-[1.02]">
                <QRCode
                    value={data.verification_url}
                    size={180}
                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                    viewBox={`0 0 256 256`}
                    fgColor="#0f172a"
                />
            </div>
            
            <div className="mt-6 text-center space-y-2">
                <h4 className="text-base font-black text-slate-900">Autenticidade em Tempo Real</h4>
                <p className="text-xs font-medium text-slate-500 leading-relaxed max-w-[240px] mx-auto">
                    Apresente este código para acesso às instalações ou validação de status académico.
                </p>
            </div>
        </div>

        {/* Informações de Validade */}
        <div className="grid grid-cols-2 gap-3">
            <div className="rounded-3xl bg-emerald-50/50 border border-emerald-100 p-4 flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center">
                    <Calendar size={16} />
                </div>
                <div>
                    <p className="text-[8px] font-black uppercase tracking-wider text-emerald-600/60">Validade</p>
                    <p className="text-[10px] font-black text-emerald-700">{new Date(data.validade).toLocaleDateString('pt-PT')}</p>
                </div>
            </div>
            <div className="rounded-3xl bg-blue-50/50 border border-blue-100 p-4 flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-blue-500 text-white flex items-center justify-center">
                    <ShieldCheck size={16} />
                </div>
                <div>
                    <p className="text-[8px] font-black uppercase tracking-wider text-blue-600/60">Status</p>
                    <p className="text-[10px] font-black text-blue-700 uppercase">Documento Oficial</p>
                </div>
            </div>
        </div>

        {/* Dica de Uso */}
        <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 flex gap-3">
            <Info size={20} className="text-amber-500 shrink-0" />
            <p className="text-[10px] font-medium text-amber-800 leading-relaxed">
                Este cartão é de uso pessoal e intransmissível. Em caso de perda ou roubo, informe imediatamente a secretaria da escola <strong>{data.escola}</strong>.
            </p>
        </div>
      </div>

      <style jsx global>{`
        .perspective-1000 {
          perspective: 1000px;
        }
        .rotate-x-2 {
          transform: rotateX(2deg);
        }
        .rotate-y-2 {
          transform: rotateY(2deg);
        }
      `}</style>
    </div>
  );
}
