"use client";
import { motion } from "framer-motion";
import { Users, GraduationCap, CheckCircle2 } from "lucide-react";

export default function BrandPanel() {
  return (
    <div className="relative hidden overflow-hidden md:block">
      <div className="absolute inset-0 bg-klasse-green" />

      {/* Padrão Geométrico Animado */}
      <motion.svg
        initial={{ opacity: 0 }}
        animate={{
          opacity: 0.1,
          scale: [1, 1.05, 1],
          rotate: [0, 1, 0],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear",
        }}
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 800 800"
        aria-hidden="true"
      >
        <defs>
          <pattern id="klassePattern" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M0 40 L40 0 L80 40 L40 80 Z" fill="none" stroke="currentColor" strokeWidth="6" />
            <circle cx="40" cy="40" r="8" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="800" height="800" fill="url(#klassePattern)" className="text-klasse-green-800" />
      </motion.svg>

      {/* Círculos Decorativos de Fundo */}
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-klasse-green-400/20 blur-3xl" />
      <div className="absolute -bottom-20 -left-20 h-96 w-96 rounded-full bg-klasse-green-800/30 blur-3xl" />

      <div className="relative z-10 flex h-full flex-col justify-between p-12">
        {/* Topo: Logo e Branding */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-md"
        >
          <div className="flex items-center gap-4">
            <motion.img
              initial={{ scale: 0.8, rotate: -5 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              src="/logo-klasse-ui.png"
              alt="Klasse"
              width={72}
              height={72}
              className="shrink-0 object-contain"
            />
            <div className="text-white">
              <div className="text-4xl font-semibold leading-none tracking-tight">KLASSE</div>
              <div className="text-lg opacity-90">gestão escolar</div>
            </div>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.8 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-6 text-sm leading-relaxed text-white/80"
          >
            Local. Autêntico. Orgulhoso. Uma plataforma moderna para gestão escolar em Angola.
          </motion.p>
        </motion.div>

        {/* Centro: Elemento Humanizador (Mockup/Ilustração) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.6 }}
          className="flex flex-1 items-center justify-center py-12"
        >
          <div className="relative">
            {/* Círculo de destaque atrás do ícone */}
            <div className="absolute inset-0 animate-pulse rounded-full bg-white/5 blur-2xl" />
            <div className="relative flex h-32 w-32 items-center justify-center rounded-3xl bg-white/10 backdrop-blur-sm border border-white/20">
              <GraduationCap className="h-16 w-16 text-white" strokeWidth={1.5} />
            </div>
            
            {/* Badges Flutuantes ao redor do ícone central */}
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -right-8 -top-4 flex items-center gap-2 rounded-full bg-klasse-gold px-3 py-1.5 shadow-lg"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-white" />
              <span className="text-[10px] font-bold text-white uppercase tracking-wider">Homologado</span>
            </motion.div>

            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="absolute -left-12 bottom-4 flex items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow-lg"
            >
              <Users className="h-3.5 w-3.5 text-klasse-green" />
              <span className="text-[10px] font-bold text-klasse-green uppercase tracking-wider">+50 Escolas</span>
            </motion.div>
          </div>
        </motion.div>

        {/* Rodapé: Estatísticas/Prova Social */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="grid grid-cols-2 gap-6 border-t border-white/10 pt-8"
        >
          <div>
            <div className="text-2xl font-bold text-white">100%</div>
            <div className="text-xs text-white/60 uppercase tracking-widest font-medium">Angolano</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">Suporte</div>
            <div className="text-xs text-white/60 uppercase tracking-widest font-medium">Local 24/7</div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
