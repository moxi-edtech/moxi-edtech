"use client";
import AppShell from "@/components/layout/klasse/AppShell";
import React, { useEffect } from "react";
import RequireFinanceiro from "@/app/(guards)/RequireFinanceiro";
import { useEscolaId } from "@/hooks/useEscolaId";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

function FinanceiroShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { escolaId, escolaSlug, isLoading } = useEscolaId();

  useEffect(() => {
    if (isLoading || !escolaId) return;
    if (!pathname) return;
    if (!pathname.startsWith("/financeiro")) return;

    const suffix = pathname.slice("/financeiro".length);
    const query = searchParams?.toString() ?? "";
    const escolaParam = escolaSlug || escolaId;
    const nextPath = `/escola/${escolaParam}/financeiro${suffix}${query ? `?${query}` : ""}`;
    
    router.replace(nextPath);
  }, [escolaId, escolaSlug, isLoading, pathname, router, searchParams]);

  return (
    <RequireFinanceiro>
      <AppShell>{children}</AppShell>
    </RequireFinanceiro>
  );
}

export default function FinanceiroLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPrintView = pathname?.includes("/print");

  if (isPrintView) {
    return <RequireFinanceiro>{children}</RequireFinanceiro>;
  }

  return <FinanceiroShell>{children}</FinanceiroShell>;
}
