"use client";

import { motion } from "framer-motion";

const easeOut = [0.22, 1, 0.36, 1] as const;

export default function BrandPanel() {
  return (
    <section
      className="relative hidden min-h-screen overflow-hidden bg-[#073b2c] text-white md:block"
      aria-label="Apresentação KLASSE"
    >
      <motion.div
        initial={{ opacity: 0, scale: 1.06 }}
        animate={{ opacity: 1, scale: 1.02 }}
        transition={{ duration: 1.15, ease: easeOut }}
        className="absolute inset-0 bg-[url('/login-klasse-family.jpg')] bg-cover bg-[position:44%_center]"
      />

      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,59,44,0.94)_0%,rgba(7,59,44,0.73)_45%,rgba(7,59,44,0.27)_100%),radial-gradient(circle_at_82%_20%,rgba(249,165,26,0.48),transparent_32%),linear-gradient(180deg,rgba(249,165,26,0.1),rgba(7,59,44,0.58))] bg-blend-multiply" />
      <div className="absolute -bottom-[25%] -right-[20%] h-[48%] w-[102%] bg-[radial-gradient(circle,rgba(249,165,26,0.82),transparent_62%)] opacity-70 blur-[18px]" />

      <div className="relative z-10 flex min-h-screen flex-col p-8 lg:p-12 xl:p-[54px]">
        <motion.div
          initial={{ opacity: 0, x: -18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: easeOut }}
          className="inline-flex w-fit items-center gap-[13px] rounded-full border border-white/30 bg-gradient-to-br from-white/70 to-white/30 py-2 pl-2 pr-[18px] shadow-[inset_0_1px_0_rgba(255,255,255,0.56),0_24px_70px_rgba(0,0,0,0.18)] backdrop-blur-[18px]"
        >
          <img
            src="/klasse-mark-isolated.png"
            alt=""
            width={44}
            height={44}
            className="h-11 w-11 object-contain"
          />
          <span>
            <strong className="block text-base font-[950] leading-[0.95] tracking-[0.16em] text-white [text-shadow:0_2px_14px_rgba(7,59,44,0.28)]">
              KLASSE
            </strong>
            <small className="mt-1 block text-[9px] font-[900] uppercase leading-none tracking-[0.12em] text-[#ffc846]">
              Gestão escolar inteligente
            </small>
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, delay: 0.35, ease: easeOut }}
          className="mt-[clamp(4.5rem,14vh,7.5rem)] max-w-[540px] border-l-4 border-[#f9a51a] pl-6"
        >
          <p className="mb-3.5 text-[13px] font-black uppercase tracking-[0.12em] text-[#ffc846]">
            Uma escola conectada
          </p>
          <h1 className="text-[clamp(2.75rem,5vw,4.375rem)] font-bold leading-[0.96] tracking-[-0.052em] text-white">
            Entre no ambiente
            <strong className="block font-inherit text-[#ffc846]">da sua escola.</strong>
          </h1>
        </motion.div>

      </div>
    </section>
  );
}
