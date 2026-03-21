"use client";
import AppShell from "@/components/layout/klasse/AppShell";
import React, { useEffect } from "react";
import RequireSecretaria from "@/app/(guards)/RequireSecretaria";
import { useEscolaId } from "@/hooks/useEscolaId";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

function SecretariaShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { escolaId, escolaSlug, isLoading } = useEscolaId();

  useEffect(() => {
    if (isLoading || !escolaId) return;
    if (!pathname) return;
    if (!pathname.startsWith("/secretaria")) return;

    const suffix = pathname.slice("/secretaria".length);
    const query = searchParams?.toString() ?? "";
    const escolaParam = escolaSlug || escolaId;
    const nextPath = `/escola/${escolaParam}/secretaria${suffix}${query ? `?${query}` : ""}`;
    router.replace(nextPath);
  }, [escolaId, escolaSlug, isLoading, pathname, router, searchParams]);

  return (
    <RequireSecretaria>
      <AppShell>{children}</AppShell>
    </RequireSecretaria>
  );
}

export default function SecretariaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPrintView = pathname?.includes("/print");

  if (isPrintView) {
    return <RequireSecretaria>{children}</RequireSecretaria>;
  }

  return <SecretariaShell>{children}</SecretariaShell>;
}
