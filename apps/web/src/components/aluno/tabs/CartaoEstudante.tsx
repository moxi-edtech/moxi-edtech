"use client";

import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { User, ShieldCheck, Calendar, GraduationCap } from "lucide-react";
import { AlunoCard } from "@/components/aluno/shared/AlunoCard";
import { TableSkeleton } from "@/components/feedback/FeedbackSystem";

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

  if (loading) return <TableSkeleton rows={3} cols={1} />;
  if (!data) return <div className="text-center py-8 text-slate-500">Falha ao carregar identidade.</div>;

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      {/* Visual do Cartão */}
      <div className="relative w-full max-w-[340px] aspect-[1.6/1] rounded-[24px] bg-gradient-to-br from-[#0d1f12] via-[#12321d] to-[#1f4028] p-5 text-white shadow-2xl overflow-hidden ring-1 ring-white/10">
        {/* Background Elements */}
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-klasse-gold/10 blur-3xl" />
        <div className="absolute -left-12 -bottom-12 h-40 w-40 rounded-full bg-emerald-500/5 blur-3xl" />

        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 p-1">
              {data.escola_logo ? (
                <img src={data.escola_logo} alt="Logo" className="h-full w-full object-contain" />
              ) : (
                <GraduationCap className="h-5 w-5 text-klasse-gold" />
              )}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100/70">Cartão do Estudante</p>
              <h3 className="text-xs font-bold truncate max-w-[180px]">{data.escola}</h3>
            </div>
          </div>
          <div className="text-right">
            <span className="rounded-md bg-klasse-gold/20 px-2 py-0.5 text-[9px] font-bold text-klasse-gold uppercase">
              {data.ano_letivo}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="mt-4 flex gap-4">
          {/* Photo */}
          <div className="relative h-24 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-slate-800 ring-2 ring-white/5 shadow-inner">
            {data.foto ? (
              <img src={data.foto} alt={data.nome} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <User className="h-10 w-10 text-white/20" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col justify-between py-0.5 min-w-0">
            <div>
              <h2 className="text-sm font-bold leading-tight line-clamp-2">{data.nome}</h2>
              <p className="mt-1 text-[10px] text-emerald-100/60 font-medium">Nº Processo: <span className="text-white">{data.processo}</span></p>
            </div>
            
            <div className="space-y-0.5">
              <p className="text-[9px] uppercase tracking-wide text-emerald-100/40 font-bold">Curso / Turma</p>
              <p className="text-[11px] font-semibold truncate text-klasse-gold">{data.curso}</p>
              <p className="text-[10px] font-medium text-white/80">{data.turma}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-4 right-5">
           <ShieldCheck className="h-5 w-5 text-emerald-400/30" />
        </div>
      </div>

      {/* QR Code de Verificação */}
      <div className="flex flex-col items-center gap-4 rounded-3xl bg-white p-6 shadow-sm border border-slate-100 w-full max-w-[340px]">
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
          <QRCode
            value={data.verification_url}
            size={160}
            style={{ height: "auto", maxWidth: "100%", width: "100%" }}
            viewBox={`0 0 256 256`}
          />
        </div>
        
        <div className="text-center space-y-1">
          <h4 className="text-sm font-bold text-slate-900">Autenticidade Garantida</h4>
          <p className="text-xs text-slate-500 leading-relaxed px-4">
            Aponte a câmara para validar os dados deste cartão diretamente no sistema da escola.
          </p>
        </div>

        <div className="w-full pt-2 border-t border-slate-50 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">
           <div className="flex items-center gap-1">
             <Calendar className="h-3 w-3" />
             Válido até: {new Date(data.validade).toLocaleDateString('pt-PT')}
           </div>
           <div className="text-emerald-500 flex items-center gap-1">
             <ShieldCheck className="h-3 w-3" />
             Oficial
           </div>
        </div>
      </div>
    </div>
  );
}
