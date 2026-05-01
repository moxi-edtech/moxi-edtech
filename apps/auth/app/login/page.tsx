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
      <main className="grid place-items-center bg-slate-50 p-6">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
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
