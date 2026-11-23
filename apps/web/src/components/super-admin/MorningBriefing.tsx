"use client";

import { AlertTriangle, Check, RefreshCw, Sun, Moon, CloudSun, Zap } from "lucide-react";
import { motion } from "framer-motion";

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
  const iconSaudacao = hora < 12 ? <Sun className="text-amber-500" /> : hora < 19 ? <CloudSun className="text-orange-400" /> : <Moon className="text-indigo-400" />;
  const agora = new Date().toLocaleTimeString("pt-AO", { hour: "2-digit", minute: "2-digit" });

  return (
    <motion.section 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-xl border border-border bg-card p-8 shadow-sm"
    >
      {/* Detalhes de Background Decorativos */}
      <div className="absolute right-0 top-0 -mr-20 -mt-20 h-64 w-64 rounded-full bg-muted/50 blur-3xl" />
      <div className="absolute left-0 bottom-0 -ml-20 -mb-20 h-64 w-64 rounded-full bg-emerald/5 blur-3xl" />

      <div className="relative z-10 flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
        <div className="flex items-center gap-6">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-xl shadow-inner ${
              tudoBem ? "bg-emerald/10 text-emerald" : "bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-300"
            }`}
          >
            {tudoBem ? (
              <div className="relative">
                <motion.div 
                  animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 rounded-full bg-emerald/20"
                />
                <Check className="relative h-10 w-10" strokeWidth={2.5} />
              </div>
            ) : (
              <AlertTriangle className="h-10 w-10 animate-bounce" strokeWidth={2.5} />
            )}
          </motion.div>

          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              <Zap className="h-3 w-3 fill-current" />
              <span>Status da Rede • {agora}</span>
            </div>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-foreground md:text-4xl">
              {saudacao}, <span className="text-muted-foreground font-medium">Gestor.</span>
            </h2>
            <p className="mt-3 max-w-md text-base leading-relaxed text-muted-foreground">
              {tudoBem
                ? "A rede está operando em alta performance. Nenhuma anomalia detectada nas últimas 24h."
                : `Atenção: Identificamos ${escolasEmRisco} escola${escolasEmRisco > 1 ? "s" : ""} com atividade crítica ou pendências graves.`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 lg:border-l lg:border-border lg:pl-10">
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Health Score</p>
              <div className="flex items-baseline gap-1">
                <span className={`text-5xl font-black tabular-nums tracking-tighter ${scoreMedio > 90 ? "text-emerald" : "text-rose-600 dark:text-rose-300"}`}>
                  {scoreMedio}
                </span>
                <span className="text-lg font-bold text-muted-foreground">%</span>
              </div>
            </div>
            
            <div className="h-12 w-px bg-muted hidden sm:block" />
            
            <div className="hidden sm:block">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                {iconSaudacao}
              </div>
            </div>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="group flex h-14 items-center gap-3 rounded-2xl bg-klasse-gold px-6 text-sm font-bold text-klasse-gold-900 transition-all hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-klasse-gold active:scale-95"
          >
            <RefreshCw className="h-4 w-4 transition-transform group-hover:rotate-180" />
            <span>Sincronizar Dados</span>
          </button>
        </div>
      </div>
    </motion.section>
  );
}
