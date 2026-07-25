"use client";
import { motion } from "framer-motion";
import BrandPanel from "./BrandPanel";
import LoginForm from "./LoginForm";
import { use, Suspense } from "react";

type SearchParams = Promise<{ redirect?: string }>;

function LoginContent({ searchParams }: { searchParams: SearchParams }) {
  const params = use(searchParams);
  const redirectTo = normalizeReturnTo(params.redirect);

  return (
    <div className="grid min-h-screen w-full grid-cols-1 md:grid-cols-2">
      <BrandPanel />
      <main className="relative grid place-items-center overflow-hidden bg-[linear-gradient(180deg,#fffdf7_0%,#fff8ec_100%)] p-6 sm:p-10">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#f9a51a]/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-[#073b2c]/8 blur-3xl" />
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative w-full max-w-[440px] rounded-[30px] border border-[#073b2c]/10 bg-white/70 p-7 shadow-[0_28px_90px_rgba(7,59,44,0.11)] backdrop-blur-xl sm:p-9"
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
  if (value.startsWith("/")) return value;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return "";
}

export default function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<div className="min-h-screen w-full bg-slate-50" />}>
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}
