"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import SignOutButton from "@/components/auth/SignOutButton";

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const s = createClient();
        const { data: auth } = await s.auth.getUser();
        const userId = auth?.user?.id;

        if (!userId) return;

        // Try to read profile name
        const { data: prof } = await s
          .from("profiles")
          .select("nome, email")
          .eq("user_id", userId)
          .maybeSingle();

        const nome = (prof as any)?.nome as string | undefined;
        const email = (prof as any)?.email as string | undefined;
        if (!mounted) return;
        setDisplayName(nome?.trim() || email || null);
      } catch {
        // keep fallback
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const initials = useMemo(() => {
    const src = displayName || "Administrador";
    const parts = src
      .trim()
      .replace(/\s+/g, " ")
      .split(" ")
      .filter(Boolean);
    if (parts.length === 0) return "AD";
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : parts[0]?.[1] ?? "";
    const calc = (first + last).toUpperCase();
    return calc || "AD";
  }, [displayName]);

  return (
    <header className="flex justify-between items-center mb-6">
      <h1 className="text-2xl font-semibold text-[#0B2C45]">{title}</h1>
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
          {initials}
        </div>
        <span className="text-sm font-medium text-gray-700">{displayName ?? "Administrador"}</span>
        <SignOutButton
          variant="ghost"
          size="sm"
          className="text-slate-600 hover:text-slate-900"
          redirectTo="/login"
        />
      </div>
    </header>
  );
}
