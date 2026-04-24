"use client";

import { AlertTriangle, Check, RefreshCw } from "lucide-react";

interface Props {
  data?: {
    escolasEmRisco: number;
    scoreMedio: number;
  };
}

export default function MorningBriefing({ data }: Props) {
  const escolasEmRisco = data?.escolasEmRisco ?? 0;
  const scoreMedio = data?.scoreMedio ?? 100;
  const tudoBem = escolasEmRisco === 0;

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 19 ? "Boa tarde" : "Boa noite";
  const agora = new Date().toLocaleTimeString("pt-AO", { hour: "2-digit", minute: "2-digit" });

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-xl ${
              tudoBem ? "bg-klasse-green/10 text-klasse-green" : "bg-red-50 text-red-600"
            }`}
          >
            {tudoBem ? <Check className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
          </div>

          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Estado da Rede • {agora}</p>
            <h2 className="text-2xl font-bold text-slate-950">{saudacao}, que bom ter-te de volta.</h2>
            <p className="mt-2 text-sm text-slate-500">
              {tudoBem
                ? "Está tudo a correr bem com as escolas hoje."
                : `Temos ${escolasEmRisco} escola${escolasEmRisco > 1 ? "s" : ""} sem atualizações recentes.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 md:border-l md:border-slate-200 md:pl-6">
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Bem-estar Global</p>
            <p className={`text-3xl font-bold ${scoreMedio > 90 ? "text-klasse-green" : "text-red-600"}`}>{scoreMedio}%</p>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:ring-1 hover:ring-klasse-gold/25"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
        </div>
      </div>
    </section>
  );
}
