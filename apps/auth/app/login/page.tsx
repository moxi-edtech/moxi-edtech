"use client";
import { motion } from "framer-motion";
import LoginForm from "./LoginForm";
import { use, Suspense } from "react";

type SearchParams = Promise<{ redirect?: string }>;

function LoginContent({ searchParams }: { searchParams: SearchParams }) {
  const params = use(searchParams);
  const redirectTo = normalizeReturnTo(params.redirect);

  return (
    <div className="relative min-h-[100svh] w-full overflow-x-hidden overflow-y-auto bg-[#073b2c]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[url('/login-klasse-family.jpg')] bg-cover bg-[position:42%_center]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,59,44,0.04)_35%,rgba(7,59,44,0.62)_100%)] md:right-[34%]"
      />
      <div className="absolute right-0 top-0 z-10 hidden h-full w-[34%] bg-white md:block" />
      <main className="relative z-20 flex min-h-[100svh] items-end justify-center px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-16 sm:px-5 md:ml-auto md:w-[34%] md:items-center md:px-[clamp(2rem,5vw,5.5rem)] md:py-12">
        <div className="absolute right-6 top-7 hidden items-center gap-2 text-sm text-[#17211d]/80 md:flex">
          <span className="grid h-6 w-8 place-items-center rounded-sm bg-[#169b62] text-xs">🇦🇴</span>
          <span>Português</span>
          <span aria-hidden="true" className="text-xs">⌄</span>
        </div>
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative w-full max-w-[440px] rounded-[24px] border border-white/30 bg-white/90 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:p-6 md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none"
        >
          <LoginForm redirectTo={redirectTo} />
        </motion.section>
      </main>
    </div>
  );
}

function normalizeReturnTo(raw: string | undefined) {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const parsed = new URL(value);
    const allowedHosts = new Set([
      "app.klasse.ao",
      "formacao.klasse.ao",
      "app.lvh.me:3001",
      "formacao.lvh.me:3002",
    ]);
    const configuredHosts = [process.env.NEXT_PUBLIC_KLASSE_K12_URL, process.env.NEXT_PUBLIC_KLASSE_FORMACAO_URL]
      .filter(Boolean)
      .map((origin) => new URL(origin as string).host);
    if (["http:", "https:"].includes(parsed.protocol) && new Set([...allowedHosts, ...configuredHosts]).has(parsed.host)) {
      return parsed.toString();
    }
  } catch {
    // Destino inválido: continuar no destino padrão.
  }
  return "";
}

export default function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<div className="min-h-screen w-full bg-slate-50" />}>
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}
